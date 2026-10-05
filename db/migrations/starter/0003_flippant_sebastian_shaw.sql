CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"public_id" text NOT NULL,
	"version" bigint DEFAULT 0 NOT NULL,
	"format" text DEFAULT '' NOT NULL,
	"width" integer DEFAULT 0 NOT NULL,
	"height" integer DEFAULT 0 NOT NULL,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"alt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"focal_x" real DEFAULT 0.5 NOT NULL,
	"focal_y" real DEFAULT 0.5 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_public_id_idx" ON "media_assets" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status","created_at");