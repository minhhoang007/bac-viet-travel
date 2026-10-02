import type { ZodError } from "zod";
import { isAppError, type AppErrorCode } from "@/core/errors";

/**
 * What a form's server action returns to `useActionState` when it does not redirect.
 * Field errors and `code` are message keys; the form maps them to localized labels.
 */
export type FormState<F extends string> =
  | null
  | { status: "invalid"; fieldErrors: Partial<Record<F, string>> }
  | { status: "error"; code: AppErrorCode };

type Issue = { path: string; code: string };

function issuesOf(error: unknown): Issue[] | undefined {
  if (isAppError(error) && error.code === "VALIDATION_ERROR") return error.details?.issues as Issue[] | undefined;
  if (error instanceof Error && error.name === "ZodError") {
    return (error as ZodError).issues.map((i) => ({ path: i.path.join("."), code: i.message }));
  }
  return undefined;
}

/**
 * Maps an error thrown by a service to a form state: zod issues (or an AppError VALIDATION_ERROR carrying
 * `details.issues`) become field errors (first issue per known field), any other AppError keeps its code,
 * and unknown errors become INTERNAL_ERROR (never their raw message).
 */
export function toFormState<F extends string>(error: unknown, fields: readonly F[]): FormState<F> {
  const issues = issuesOf(error);
  if (issues) {
    const fieldErrors: Partial<Record<F, string>> = {};
    for (const issue of issues) {
      const field = fields.find((f) => f === issue.path);
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.code;
    }
    if (Object.keys(fieldErrors).length > 0) return { status: "invalid", fieldErrors };
    return { status: "error", code: "VALIDATION_ERROR" };
  }
  return { status: "error", code: isAppError(error) ? error.code : "INTERNAL_ERROR" };
}
