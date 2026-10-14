CREATE TABLE "booking_ledger" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_vnd" integer NOT NULL,
	"channel" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"payment_id" uuid,
	"actor_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_ledger_amount_check" CHECK ("booking_ledger"."amount_vnd" <> 0 and ("booking_ledger"."kind" = 'adjust' or "booking_ledger"."amount_vnd" > 0))
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "received_vnd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_ledger" ADD CONSTRAINT "booking_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_ledger" ADD CONSTRAINT "booking_ledger_payment_id_booking_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."booking_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_ledger_booking_idx" ON "booking_ledger" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_ledger_at_idx" ON "booking_ledger" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_ledger_payment_idx" ON "booking_ledger" USING btree ("payment_id");--> statement-breakpoint
-- Backfill (review wave 2): the ledger from what bookings recorded so far. Staff-entered bookings received their whole
-- total when entered (the old form's amount), so they are also paid in full.
UPDATE "bookings" SET "balance_paid_at" = coalesce("balance_paid_at", "deposit_paid_at") WHERE "source" <> 'website' AND "deposit_paid_at" IS NOT NULL;--> statement-breakpoint
INSERT INTO "booking_ledger" ("booking_id", "kind", "amount_vnd", "channel", "at", "note")
SELECT b."id", 'in', b."total_vnd", CASE WHEN b."source" IN ('klook', 'viator', 'getyourguide') THEN 'ota' ELSE 'staff' END, b."deposit_paid_at", 'backfill'
FROM "bookings" b WHERE b."source" <> 'website' AND b."deposit_paid_at" IS NOT NULL AND b."total_vnd" > 0;--> statement-breakpoint
-- Website deposits and balances: the payment that settled them (same paid time), with its real amount; none = staff.
INSERT INTO "booking_ledger" ("booking_id", "kind", "amount_vnd", "channel", "at", "payment_id", "note")
SELECT b."id", 'in', coalesce(p."amount_vnd", b."deposit_vnd"), coalesce(p."method", 'staff'), b."deposit_paid_at", p."id", 'backfill'
FROM "bookings" b
LEFT JOIN "booking_payments" p ON p."booking_id" = b."id" AND p."purpose" = 'deposit' AND p."status" = 'paid' AND p."paid_at" = b."deposit_paid_at"
WHERE b."source" = 'website' AND b."deposit_paid_at" IS NOT NULL AND b."deposit_vnd" > 0;--> statement-breakpoint
INSERT INTO "booking_ledger" ("booking_id", "kind", "amount_vnd", "channel", "at", "payment_id", "note")
SELECT b."id", 'in', coalesce(p."amount_vnd", b."total_vnd" - b."deposit_vnd"), coalesce(p."method", 'staff'), b."balance_paid_at", p."id", 'backfill'
FROM "bookings" b
LEFT JOIN "booking_payments" p ON p."booking_id" = b."id" AND p."purpose" = 'balance' AND p."status" = 'paid' AND p."paid_at" = b."balance_paid_at"
WHERE b."source" = 'website' AND b."balance_paid_at" IS NOT NULL AND b."total_vnd" > b."deposit_vnd";--> statement-breakpoint
-- Every other paid attempt (late deposit, a second payment): money in, already counted as owed back.
INSERT INTO "booking_ledger" ("booking_id", "kind", "amount_vnd", "channel", "at", "payment_id", "note")
SELECT p."booking_id", 'in', p."amount_vnd", p."method", p."paid_at", p."id", 'backfill'
FROM "booking_payments" p
WHERE p."status" = 'paid' AND p."amount_vnd" > 0 AND p."paid_at" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "booking_ledger" l WHERE l."payment_id" = p."id");--> statement-breakpoint
-- Refunds: only the total and the latest day were kept; one row on that day.
INSERT INTO "booking_ledger" ("booking_id", "kind", "amount_vnd", "channel", "at", "note")
SELECT b."id", 'refund', b."refunded_vnd", 'staff', b."refunded_at", 'backfill'
FROM "bookings" b WHERE b."refunded_vnd" > 0 AND b."refunded_at" IS NOT NULL;--> statement-breakpoint
UPDATE "bookings" b SET "received_vnd" = l."vnd"
FROM (SELECT "booking_id", sum("amount_vnd")::int AS "vnd" FROM "booking_ledger" WHERE "kind" <> 'refund' GROUP BY "booking_id") l
WHERE l."booking_id" = b."id";
