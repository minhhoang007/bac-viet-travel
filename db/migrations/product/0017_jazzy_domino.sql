ALTER TABLE "booking_payments" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
-- Payments recorded before this change were emailed then: never send them again.
UPDATE "booking_payments" SET "notified_at" = "paid_at" WHERE "status" = 'paid';