CREATE TABLE "booking_refunds" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount_vnd" integer NOT NULL,
	"refunded_at" timestamp with time zone NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_refunds_amount_positive" CHECK ("booking_refunds"."amount_vnd" > 0)
);
--> statement-breakpoint
ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_refunds_booking_idx" ON "booking_refunds" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_refunds_refunded_at_idx" ON "booking_refunds" USING btree ("refunded_at");--> statement-breakpoint
-- Refunds already marked: one row each with the total and day known so far (earlier history was not kept).
INSERT INTO "booking_refunds" ("booking_id", "amount_vnd", "refunded_at", "note")
SELECT "id", "refunded_vnd", "refunded_at", coalesce("refund_note", '') FROM "bookings" WHERE "refunded_vnd" > 0 AND "refunded_at" IS NOT NULL;--> statement-breakpoint
-- NOT VALID: checked on every new write; existing rows are not scanned, so the migration cannot fail on old data.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_money_check" CHECK ("bookings"."total_vnd" >= 0 and "bookings"."deposit_vnd" >= 0 and "bookings"."refund_due_vnd" >= 0 and "bookings"."refunded_vnd" >= 0 and "bookings"."refunded_vnd" <= "bookings"."refund_due_vnd") NOT VALID;