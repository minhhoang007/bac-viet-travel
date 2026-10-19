import { describe, expect, it } from "vitest";
import { isPrivatePath } from "./private-paths";

describe("isPrivatePath", () => {
  it("covers the pages that carry sign-in links and tokens", () => {
    for (const path of ["/vi/login/confirm", "/en/login/reset", "/login", "/vi/verify", "/vi/security", "/vi/demo", "/vi/dashboard/account", "/en/admin"]) {
      expect(isPrivatePath(path), path).toBe(true);
    }
  });

  it("leaves the public pages measured", () => {
    for (const path of ["/", "/vi", "/vi/tours/ha-giang", "/en/booking/BV123", "/vi/blog/login-tips", "/vi/loginx"]) {
      expect(isPrivatePath(path), path).toBe(false);
    }
  });
});
