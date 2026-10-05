export const APP_ERROR_CODES = [
  "AUTH_ERROR",
  "PERMISSION_ERROR",
  "VALIDATION_ERROR",
  "BILLING_ERROR",
  "RATE_LIMIT_ERROR",
  "QUOTA_EXCEEDED",
  "MODULE_DISABLED",
  "NOT_FOUND",
  /** The request clashes with the current state (e.g. deleting an image still in use, a stale edit). */
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

const HTTP_STATUS: Record<AppErrorCode, number> = {
  AUTH_ERROR: 401,
  PERMISSION_ERROR: 403,
  VALIDATION_ERROR: 400,
  BILLING_ERROR: 402,
  RATE_LIMIT_ERROR: 429,
  QUOTA_EXCEEDED: 429,
  MODULE_DISABLED: 404,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

const SAFE_MESSAGE: Record<AppErrorCode, string> = {
  AUTH_ERROR: "Authentication required.",
  PERMISSION_ERROR: "You do not have permission to do this.",
  VALIDATION_ERROR: "The request is invalid.",
  BILLING_ERROR: "A billing problem occurred.",
  RATE_LIMIT_ERROR: "Too many requests. Please try again later.",
  QUOTA_EXCEEDED: "Usage limit reached.",
  MODULE_DISABLED: "Not found.",
  NOT_FOUND: "Not found.",
  CONFLICT: "This conflicts with the current state. Reload and try again.",
  INTERNAL_ERROR: "Something went wrong.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: AppErrorCode, message?: string, options?: { cause?: unknown; details?: Record<string, unknown> }) {
    super(message ?? code, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Converts any error into a response-safe shape. Raw messages of unknown errors never leak. */
export function toSafeError(error: unknown): { code: AppErrorCode; status: number; message: string } {
  const code = isAppError(error) ? error.code : "INTERNAL_ERROR";
  return { code, status: HTTP_STATUS[code], message: SAFE_MESSAGE[code] };
}
