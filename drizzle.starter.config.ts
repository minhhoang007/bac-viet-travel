import { defineConfig } from "drizzle-kit";

// Starter-owned tables (ADR-0004). Generate only inside the starter repo.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./core/**/schema.ts", "./modules/*/schema.ts"],
  out: "./db/migrations/starter",
  migrations: { table: "__starter_migrations", schema: "public" },
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
