import { bigint, index, integer, jsonb, pgTable, real, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/core/users/schema";

/** Public images (ADR-0008). "pending" = upload signed, not yet confirmed; purged with the image after an hour. */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: id(),
    /** Provider id, e.g. Cloudinary public_id "<folder>/<random uuid>". */
    publicId: text("public_id").notNull(),
    version: bigint("version", { mode: "number" }).notNull().default(0),
    format: text("format").notNull().default(""),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    bytes: bigint("bytes", { mode: "number" }).notNull().default(0),
    /** Original file name (display only). */
    name: text("name").notNull().default(""),
    /** Alt text per locale, e.g. { vi: "...", en: "..." }. */
    alt: jsonb("alt").$type<Record<string, string>>().notNull().default({}),
    /** Focal point for crops, 0–1 from the top-left corner. */
    focalX: real("focal_x").notNull().default(0.5),
    focalY: real("focal_y").notNull().default(0.5),
    status: text("status", { enum: ["pending", "ready"] }).notNull().default("pending"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("media_assets_public_id_idx").on(t.publicId), index("media_assets_status_idx").on(t.status, t.createdAt)],
);

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
