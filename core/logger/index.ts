export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|session/i;
const REDACTED = "[REDACTED]";

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
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

export function createLogger(options: {
  level?: LogLevel;
  base?: LogFields;
  write?: (line: string) => void;
} = {}): Logger {
  const min = LEVEL_ORDER[options.level ?? "info"];
  const base = options.base ?? {};
  const write = options.write ?? ((line: string) => console.log(line));

  const log = (level: LogLevel, msg: string, fields?: LogFields) => {
    if (LEVEL_ORDER[level] < min) return;
    const entry = { time: new Date().toISOString(), level, msg, ...(redact({ ...base, ...fields }) as LogFields) };
    write(JSON.stringify(entry));
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
