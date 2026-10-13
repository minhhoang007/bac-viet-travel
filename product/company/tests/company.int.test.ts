import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { defaultBankTransfer } from "@/config/bank-transfer";
import { defaultContact } from "@/config/contact";
import { users } from "@/core/users/schema";
import { testApp } from "@/tests/integration/setup/app";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { companyFormValues } from "../settings";

const { db, close } = testDb();
const { container } = testApp(db, { modules: { admin: true } });
const { company } = container.app!.product;

let admin: { id: string; email: string };

beforeEach(async () => {
  await resetDb(db);
  await db.execute(sql`TRUNCATE site_settings`);
  const [a] = await db.insert(users).values({ email: "boss@example.com", role: "admin" }).returning();
  admin = { id: a!.id, email: a!.email };
});
afterAll(() => close());

describe("company details and bank account (Admin → Thông tin công ty)", () => {
  it("defaults until an admin saves; saving replaces them; each save is audited", async () => {
    expect(await company.get()).toEqual({ company: defaultContact, bank: defaultBankTransfer });

    expect(await company.setCompany(admin, { ...companyFormValues(defaultContact), hotline: "+84 912 345 678", legalName: "Công ty TNHH Bắc Việt" })).toBe(true);
    expect(await company.setBank(admin, { bankBin: "970422", accountNumber: "0123456789", accountName: "CONG TY TNHH BAC VIET", live: true })).toBe(true);
    const { company: saved, bank } = await company.get();
    expect(saved).toMatchObject({ hotline: "+84 912 345 678", legalName: "Công ty TNHH Bắc Việt" });
    expect(bank).toMatchObject({ bankName: "MB", accountNumber: "0123456789", demo: false });

    const actions = async (targetId: string) => (await container.admin!.listAudit({ targetId })).rows.map((r) => [r.action, r.actorEmail]);
    expect(await actions("company")).toEqual([["settings.company", "boss@example.com"]]);
    expect(await actions("bank")).toEqual([["settings.bank", "boss@example.com"]]);
  });

  it("an invalid value saves nothing", async () => {
    expect(await company.setCompany(admin, { ...companyFormValues(defaultContact), email: "nope" })).toBe(false);
    expect(await company.setBank(admin, { bankBin: "970422", accountNumber: "12ab", accountName: "X", live: true })).toBe(false);
    expect(await company.get()).toEqual({ company: defaultContact, bank: defaultBankTransfer });
  });
});
