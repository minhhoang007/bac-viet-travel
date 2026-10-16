import { desc, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { EmailProvider } from "./ports";
import { demoEmails, type DemoEmail } from "./schema";

export interface DemoMailbox {
  /** Email provider that stores instead of sending. */
  provider: EmailProvider;
  /** Latest emails first. */
  list(limit?: number): Promise<DemoEmail[]>;
  /** Removes emails older than `days` (the demo keeps a short history only). */
  purgeOlderThan(days: number, now?: Date): Promise<void>;
}

/** DEMO_MODE: emails kept in the database and shown in the admin, never delivered. */
export function createDemoMailbox(db: Db): DemoMailbox {
  return {
    provider: {
      async send(message) {
        const [row] = await db
          .insert(demoEmails)
          .values({ kind: message.kind, to: message.to, subject: message.subject, text: message.text })
          .returning({ id: demoEmails.id });
        return { id: `demo-${row!.id}` };
      },
    },
    list: (limit = 50) => db.select().from(demoEmails).orderBy(desc(demoEmails.createdAt)).limit(Math.min(Math.max(limit, 1), 200)),
    async purgeOlderThan(days, now = new Date()) {
      await db.delete(demoEmails).where(lt(demoEmails.createdAt, new Date(now.getTime() - days * 86_400_000)));
    },
  };
}
