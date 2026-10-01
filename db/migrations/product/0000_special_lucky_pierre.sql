CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code" text NOT NULL,
	"token_hash" text NOT NULL,
	"departure_id" uuid NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"hold_expires_at" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"locale" text NOT NULL,
	"adults" integer NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"infants" integer DEFAULT 0 NOT NULL,
	"seats" integer NOT NULL,
	"unit_price_vnd" integer NOT NULL,
	"total_vnd" integer NOT NULL,
	"deposit_vnd" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_seats_check" CHECK ("bookings"."seats" > 0)
);
--> statement-breakpoint
CREATE TABLE "departures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tour_slug" text NOT NULL,
	"date" date NOT NULL,
	"capacity" integer NOT NULL,
	"price_vnd" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departures_capacity_check" CHECK ("departures"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_code_idx" ON "bookings" USING btree ("code");--> statement-breakpoint
CREATE INDEX "bookings_departure_status_idx" ON "bookings" USING btree ("departure_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "departures_tour_date_idx" ON "departures" USING btree ("tour_slug","date");