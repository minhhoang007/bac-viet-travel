import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@/core/errors";
import { toFormState } from "./form-state";

const fields = ["title", "body"] as const;

describe("toFormState", () => {
  it("maps zod issues to the first error of each known field", () => {
    const parsed = z
      .object({ title: z.string().min(1, "required").max(3, "too_long"), body: z.string().max(2, "too_long"), extra: z.string() })
      .safeParse({ title: "", body: "long", extra: 1 });
    expect(toFormState(parsed.error, fields)).toEqual({ status: "invalid", fieldErrors: { title: "required", body: "too_long" } });
  });

  it("reads issues from an AppError VALIDATION_ERROR", () => {
    const error = new AppError("VALIDATION_ERROR", "bad", { details: { issues: [{ path: "body", code: "too_long" }] } });
    expect(toFormState(error, fields)).toEqual({ status: "invalid", fieldErrors: { body: "too_long" } });
  });

  it("keeps a validation error without known fields as a form error", () => {
    expect(toFormState(new AppError("VALIDATION_ERROR"), fields)).toEqual({ status: "error", code: "VALIDATION_ERROR" });
  });

  it("keeps AppError codes and hides unknown errors", () => {
    expect(toFormState(new AppError("RATE_LIMIT_ERROR"), fields)).toEqual({ status: "error", code: "RATE_LIMIT_ERROR" });
    expect(toFormState(new Error('duplicate key "users_email"'), fields)).toEqual({ status: "error", code: "INTERNAL_ERROR" });
  });
});
