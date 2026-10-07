import { describe, expect, it } from "vitest";
import type { MailMessage } from "@/core/ports/mail";
import { createMemoryRateLimiter } from "@/core/security/rate-limit";
import { createInquiryService } from "../inquiry";

const logger = { debug() {}, info() {}, warn() {}, error() {}, child() { return logger; } } as never;

function setup(options: { max?: number; failMail?: (m: MailMessage) => boolean } = {}) {
  const sent: MailMessage[] = [];
  const service = createInquiryService({
    mail: {
      send: async (m) => {
        if (options.failMail?.(m)) throw new Error("smtp down");
        sent.push(m);
      },
    },
    rateLimiter: createMemoryRateLimiter({ max: options.max ?? 100, windowMs: 60_000 }),
    to: () => "team@example.com",
    logger,
    tourTitles: async (locale) => (locale === "vi" ? ["Du thuyền Hạ Long"] : ["Ha Long cruise"]),
    today: () => "2026-10-01",
  });
  return { service, sent };
}

const valid = {
  tour: "Du thuyền Hạ Long",
  name: "Nguyễn Văn A",
  email: "a@example.com",
  phone: "+84 912 345 678",
  channel: "zalo",
  date: "2026-10-20",
  adults: "2",
  children: "1",
  note: "Ăn chay",
  locale: "vi",
};

describe("tour inquiry", () => {
  it("emails the team (reply-to the visitor) and confirms to the visitor in their language", async () => {
    const { service, sent } = setup();
    expect(await service.submit(valid, "ip1")).toEqual({ status: "success" });
    expect(sent[0]).toMatchObject({ to: "team@example.com", replyTo: "a@example.com", kind: "tour_inquiry" });
    expect(sent[0]!.subject).toBe("[Đặt tour] Du thuyền Hạ Long · 2026-10-20 · 3 khách · Nguyễn Văn A");
    expect(sent[0]!.text).toContain("Liên hệ qua: zalo");
    expect(sent[1]).toMatchObject({ to: "a@example.com", kind: "tour_inquiry_confirmation" });
    expect(sent[1]!.subject).toContain("Đã nhận yêu cầu");

    const en = setup();
    await en.service.submit({ ...valid, tour: "Ha Long cruise", locale: "en" }, "ip1");
    expect(en.sent[1]!.subject).toBe("We received your booking request: Ha Long cruise");
  });

  it("reports field errors: email, phone, past date, people, unknown tour", async () => {
    const { service, sent } = setup();
    const res = await service.submit({ ...valid, email: "x", phone: "abc", adults: "0", children: "-1" }, "ip");
    expect(res).toEqual({ status: "invalid", fieldErrors: { email: "invalid_email", phone: "invalid_phone", adults: "invalid_number", children: "invalid_number" } });
    expect(await service.submit({ ...valid, date: "2026-09-30" }, "ip")).toEqual({ status: "invalid", fieldErrors: { date: "past_date" } });
    // All problems at once, not only the schema ones.
    expect(await service.submit({ ...valid, email: "x", date: "2020-01-01" }, "ip")).toEqual({ status: "invalid", fieldErrors: { email: "invalid_email", date: "past_date" } });
    expect(await service.submit({ ...valid, tour: "Free text in the subject" }, "ip")).toEqual({ status: "invalid", fieldErrors: { tour: "required" } });
    expect(sent).toHaveLength(0);
  });

  it("strips control characters from the subject line", async () => {
    const { service, sent } = setup();
    await service.submit({ ...valid, name: "A\r\nBcc: evil@example.com" }, "ip");
    expect(sent[0]!.subject).not.toMatch(/[\r\n]/);
  });

  it("honeypot: pretends success and sends nothing; rate limit applies per client", async () => {
    const bot = setup();
    expect(await bot.service.submit({ ...valid, website: "spam" }, "ip")).toEqual({ status: "success" });
    expect(bot.sent).toHaveLength(0);

    const limited = setup({ max: 1 });
    await limited.service.submit(valid, "ip");
    expect(await limited.service.submit(valid, "ip")).toEqual({ status: "rate_limited" });
    expect(await limited.service.submit(valid, "other-ip")).toEqual({ status: "success" });
  });

  it("team email failure → error; confirmation failure alone still succeeds", async () => {
    expect(await setup({ failMail: (m) => m.kind === "tour_inquiry" }).service.submit(valid, "ip")).toEqual({ status: "error" });
    const partial = setup({ failMail: (m) => m.kind === "tour_inquiry_confirmation" });
    expect(await partial.service.submit(valid, "ip")).toEqual({ status: "success" });
    expect(partial.sent).toHaveLength(1);
  });
});
