/**
 * "Really off" checks for the email module (ARCHITECTURE.md §7):
 * 1. no secrets required, 2. builds without them (covered by CI build-minimal job),
 * 3. endpoint blocked, 4. no jobs/menu (email has none yet).
 */
import { describe, expect, it, vi } from "vitest";
import { featureDefaults } from "@/config/features.defaults";
import { validateEnv } from "@/bootstrap/env";
import { buildContainer } from "@/bootstrap/container";
import { moduleManifests } from "@/bootstrap/modules";

const off = { ...featureDefaults };
const on = { ...featureDefaults, email: true };
const emailEnv = { EMAIL_FROM: "noreply@example.com", EMAIL_API_KEY: "key", CONTACT_TO_EMAIL: "owner@example.com" };

describe("email module off", () => {
  it("requires no email secrets", () => {
    expect(() => validateEnv({}, off, moduleManifests)).not.toThrow();
  });

  it("wires no contact service and a mail port that refuses to send", async () => {
    const c = buildContainer(off, validateEnv({}, off, moduleManifests));
    expect(c.contact).toBeUndefined();
    await expect(c.mail.send({ to: "a@b.c", subject: "s", text: "t" })).rejects.toMatchObject({ code: "MODULE_DISABLED" });
  });

  it("contact action responds 404 when the module is off", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
    vi.doMock("@/bootstrap/container", () => ({ getContainer: () => ({ contact: undefined }) }));
    const { submitContact } = await import("@/app/actions/contact");
    await expect(submitContact(null, new FormData())).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    vi.doUnmock("next/headers");
    vi.doUnmock("@/bootstrap/container");
  });
});

describe("email module on", () => {
  it("requires its secrets", () => {
    expect(() => validateEnv({}, on, moduleManifests)).toThrow(/EMAIL_FROM[\s\S]*EMAIL_API_KEY[\s\S]*CONTACT_TO_EMAIL/);
  });

  it("wires the contact service", () => {
    const c = buildContainer(on, validateEnv(emailEnv, on, moduleManifests));
    expect(c.contact).toBeDefined();
  });

  it("contact action passes the first forwarded IP as client key", async () => {
    vi.resetModules();
    const submit = vi.fn(async () => ({ status: "success" as const }));
    vi.doMock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }) }));
    vi.doMock("@/bootstrap/container", () => ({ getContainer: () => ({ contact: { submit } }) }));
    const { submitContact } = await import("@/app/actions/contact");
    const form = new FormData();
    form.set("name", "An");
    await submitContact(null, form);
    expect(submit).toHaveBeenCalledWith({ name: "An" }, "1.2.3.4");
    vi.doUnmock("next/headers");
    vi.doUnmock("@/bootstrap/container");
  });
});
