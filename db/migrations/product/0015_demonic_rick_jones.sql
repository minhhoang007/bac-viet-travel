ALTER TABLE "bookings" ADD COLUMN "refunded_vnd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Refunds already made gave back everything owed at the time.
UPDATE "bookings" SET "refunded_vnd" = "refund_due_vnd" WHERE "refunded_at" IS NOT NULL;
