import { defineConfig } from "drizzle-kit";

// Project-owned tables (ADR-0004). Runs after starter migrations.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./product/schema/*.ts"],
  out: "./db/migrations/product",
  migrations: { table: "__product_migrations", schema: "public" },
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
