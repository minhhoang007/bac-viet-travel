// Gives an existing user a staff role (the first admin cannot be created from the UI).
// Usage: pnpm admin:grant you@example.com              → admin
//        pnpm admin:grant writer@example.com --role editor   → editor (content pages only)
// The user must have signed in once.
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

const args = process.argv.slice(2);
const roleFlag = args.indexOf("--role");
const role = roleFlag >= 0 ? args[roleFlag + 1] : "admin";
const email = args.find((a, i) => !a.startsWith("--") && (roleFlag < 0 || i !== roleFlag + 1))?.trim().toLowerCase();
const url = process.env.DATABASE_URL;
if (!email || !url || (role !== "admin" && role !== "editor")) {
  console.error("Usage: DATABASE_URL=... pnpm admin:grant <email> [--role admin|editor]");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client);
try {
  const updated = (await db.execute(sql`update users set role = ${role} where lower(email) = ${email} and role <> ${role} returning id`)) as unknown as { id: string }[];
  const exists = (await db.execute(sql`select id from users where lower(email) = ${email}`)) as unknown as { id: string }[];
  if (!exists[0]) {
    console.error(`No user with email ${email}. Sign in once first, then run this again.`);
    process.exitCode = 1;
  } else if (updated[0]) {
    await db.execute(sql`insert into audit_logs (actor_email, action, target_type, target_id, metadata) values ('cli', 'user.set_role', 'user', ${updated[0].id}, ${JSON.stringify({ to: role })}::jsonb)`);
    console.log(`${email} is now ${role === "admin" ? "an admin" : "an editor"}.`);
  } else {
    console.log(`${email} is already ${role === "admin" ? "an admin" : "an editor"}.`);
  }
} finally {
  await client.end();
}
