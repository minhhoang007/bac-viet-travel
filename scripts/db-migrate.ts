// Runs starter migrations, then product migrations (ADR-0004). Usage: DATABASE_URL=... node scripts/db-migrate.ts
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client);
try {
  for (const [folder, table] of [
    ["db/migrations/starter", "__starter_migrations"],
    ["db/migrations/product", "__product_migrations"],
  ] as const) {
    if (!existsSync(`${folder}/meta/_journal.json`)) continue;
    await migrate(db, { migrationsFolder: folder, migrationsTable: table, migrationsSchema: "public" });
    console.log(`migrated ${folder}`);
  }
} finally {
  await client.end();
}
