import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Db = PostgresJsDatabase<Record<string, never>>;
/** The handle inside `db.transaction(async (tx) => …)`. */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

/** Created lazily by bootstrap/ (profile "app" only). Never import this at module scope elsewhere. */
export function createDb(url: string, options: { max?: number } = {}): DbHandle {
  const client = postgres(url, { max: options.max ?? 10, prepare: false });
  return { db: drizzle(client), close: () => client.end() };
}
