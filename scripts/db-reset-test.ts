// Drops and recreates the public schema of a TEST database. Refuses any database whose name lacks "test" or "e2e".
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const name = new URL(url).pathname.slice(1);
if (!/(test|e2e)/.test(name)) {
  console.error(`refusing to reset "${name}": only databases named *test* or *e2e* can be reset`);
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe("drop schema if exists public cascade; create schema public;");
  console.log(`reset ${name}`);
} finally {
  await sql.end();
}
