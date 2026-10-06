CREATE TABLE "trip_feedback" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"booking_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_feedback_rating_check" CHECK ("trip_feedback"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "feedback_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_feedback" ADD CONSTRAINT "trip_feedback_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_feedback_booking_idx" ON "trip_feedback" USING btree ("booking_id");