export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|session|e-?mail|phone/i;
const REDACTED = "[REDACTED]";

const isQueryError = (e: Error) => "query" in e && "params" in e;
const isPostgresError = (e: Error) => e.name === "PostgresError";

/**
 * Error text that is safe to log or store. Database errors carry the query parameters (Drizzle) or the offending
 * values (Postgres) in their message, so only their SQLSTATE code and constraint are kept.
 */
export function errorSummary(error: unknown): string {
  if (!(error instanceof Error)) return "Non-error value thrown";
  const chain: Error[] = [];
  for (let e: unknown = error; e instanceof Error && chain.length < 5; e = e.cause) chain.push(e);
  if (!chain.some((e) => isQueryError(e) || isPostgresError(e))) return error.message.slice(0, 1000);
  const pg = chain.find(isPostgresError) as (Error & { code?: string; constraint_name?: string }) | undefined;
  return ["Database error", pg?.code, pg?.constraint_name].filter(Boolean).join(" ");
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: errorSummary(value) };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1)]),
  );
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

/** A redacted log entry, as written. */
export type LogEntry = LogFields & { time: string; level: LogLevel; msg: string };

export function createLogger(options: {
  level?: LogLevel;
  base?: LogFields;
  write?: (line: string) => void;
  /** Also called for every error entry (already redacted), e.g. to send it to an error tracker. Must not throw. */
  onError?: (entry: LogEntry) => void;
} = {}): Logger {
  const min = LEVEL_ORDER[options.level ?? "info"];
  const base = options.base ?? {};
  const write = options.write ?? ((line: string) => console.log(line));

  const log = (level: LogLevel, msg: string, fields?: LogFields) => {
    if (LEVEL_ORDER[level] < min) return;
    const entry: LogEntry = { time: new Date().toISOString(), level, msg, ...(redact({ ...base, ...fields }) as LogFields) };
    write(JSON.stringify(entry));
    if (level === "error" && options.onError) {
      try {
        options.onError(entry);
      } catch {
        // a broken tracker must never break the code that logged
      }
    }
  };

  return {
    debug: (m, f) => log("debug", m, f),
    info: (m, f) => log("info", m, f),
    warn: (m, f) => log("warn", m, f),
    error: (m, f) => log("error", m, f),
    child: (fields) => createLogger({ ...options, base: { ...base, ...fields } }),
  };
}

/** Child logger bound to a request id (from `x-request-id` or generated). */
export function requestLogger(logger: Logger, requestId?: string | null): Logger {
  return logger.child({ requestId: requestId || crypto.randomUUID() });
}
