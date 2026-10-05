ALTER TABLE "bookings" ADD COLUMN "source" text DEFAULT 'website' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_emails" boolean DEFAULT true NOT NULL;