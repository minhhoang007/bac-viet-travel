import { describe, expect, it } from "vitest";
import { crc16, vietQrPayload, vietQrSvg } from "./vietqr";

/** Splits an EMVCo payload into { id: value } (top level). */
function parse(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < payload.length; ) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    out[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

describe("VietQR", () => {
  it("CRC-16/CCITT-FALSE matches the standard check value", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("encodes bank, account, amount and note; the CRC covers everything before it", () => {
    const payload = vietQrPayload({ bankBin: "970436", accountNumber: "0123456789", amountVnd: 717_000, note: "BV-7K3Q9X".replace("-", "") });
    const f = parse(payload);
    expect(f["00"]).toBe("01");
    expect(f["01"]).toBe("12");
    expect(parse(f["38"]!)).toEqual({ "00": "A000000727", "01": "000697043601100123456789", "02": "QRIBFTTA" });
    expect(f["53"]).toBe("704");
    expect(f["54"]).toBe("717000");
    expect(f["58"]).toBe("VN");
    expect(parse(f["62"]!)).toEqual({ "08": "BV7K3Q9X" });
    expect(f["63"]).toBe(crc16(payload.slice(0, -4)));
  });

  it("without an amount the QR is reusable (11) and has no amount field", () => {
    const f = parse(vietQrPayload({ bankBin: "970422", accountNumber: "1234" }));
    expect(f["01"]).toBe("11");
    expect(f["54"]).toBeUndefined();
    expect(f["62"]).toBeUndefined();
  });

  it("refuses input a banking app would reject", () => {
    expect(() => vietQrPayload({ bankBin: "97043", accountNumber: "1" })).toThrow();
    expect(() => vietQrPayload({ bankBin: "970436", accountNumber: "12 34" })).toThrow();
    expect(() => vietQrPayload({ bankBin: "970436", accountNumber: "1", amountVnd: 10.5 })).toThrow();
    expect(() => vietQrPayload({ bankBin: "970436", accountNumber: "1", note: "Đặt cọc" })).toThrow();
    expect(() => vietQrPayload({ bankBin: "970436", accountNumber: "1", note: "x".repeat(26) })).toThrow();
  });

  it("renders an SVG", () => {
    expect(vietQrSvg({ bankBin: "970436", accountNumber: "0123456789", amountVnd: 1000 })).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });
});
