// Makes an existing user an admin (the first admin cannot be created from the UI).
// Usage: pnpm admin:grant you@example.com   (the user must have signed in once)
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.DATABASE_URL;
if (!email || !url) {
  console.error("Usage: DATABASE_URL=... pnpm admin:grant <email>");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client);
try {
  const updated = (await db.execute(sql`update users set role = 'admin' where lower(email) = ${email} and role <> 'admin' returning id`)) as unknown as { id: string }[];
  const exists = (await db.execute(sql`select id from users where lower(email) = ${email}`)) as unknown as { id: string }[];
  if (!exists[0]) {
    console.error(`No user with email ${email}. Sign in once first, then run this again.`);
    process.exitCode = 1;
  } else if (updated[0]) {
    await db.execute(sql`insert into audit_logs (actor_email, action, target_type, target_id) values ('cli', 'user.set_role', 'user', ${updated[0].id})`);
    console.log(`${email} is now an admin.`);
  } else {
    console.log(`${email} is already an admin.`);
  }
} finally {
  await client.end();
}
