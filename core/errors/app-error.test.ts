import { describe, expect, it } from "vitest";
import { AppError, toSafeError } from ".";

describe("AppError", () => {
  it("maps codes to HTTP status", () => {
    expect(new AppError("MODULE_DISABLED").status).toBe(404);
    expect(new AppError("RATE_LIMIT_ERROR").status).toBe(429);
  });

  it("never leaks raw messages of unknown errors", () => {
    const safe = toSafeError(new Error('duplicate key value violates unique constraint "users_email"'));
    expect(safe).toEqual({ code: "INTERNAL_ERROR", status: 500, message: "Something went wrong." });
  });

  it("uses safe messages for AppError too", () => {
    expect(toSafeError(new AppError("AUTH_ERROR", "token abc expired")).message).toBe("Authentication required.");
  });
});
