CREATE TABLE "billing_notices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_notices" ADD CONSTRAINT "billing_notices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_notices_kind_ref_idx" ON "billing_notices" USING btree ("kind","ref");--> statement-breakpoint
CREATE INDEX "billing_notices_owner_idx" ON "billing_notices" USING btree ("owner_id");