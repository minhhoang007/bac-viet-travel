DROP INDEX "departures_tour_date_idx";--> statement-breakpoint
ALTER TABLE "departures" ADD COLUMN "kind" text DEFAULT 'group' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "departures_tour_date_idx" ON "departures" USING btree ("tour_slug","date") WHERE "departures"."kind" = 'group';