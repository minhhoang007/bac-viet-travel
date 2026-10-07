CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"tour_slug" text,
	"min_total_vnd" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"active" boolean DEFAULT true NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_value_check" CHECK ("discount_codes"."value" > 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_vnd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_code_idx" ON "discount_codes" USING btree ("code");