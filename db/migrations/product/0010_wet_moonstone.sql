ALTER TABLE "booking_payments" ADD COLUMN "purpose" text DEFAULT 'deposit' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "balance_paid_at" timestamp with time zone;