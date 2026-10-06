import { renderSVG } from "uqr";

// VietQR (NAPAS 247 bank transfer QR, EMVCo format): every Vietnamese banking app scans it and pre-fills the
// account, the amount and the transfer note. Built here, so no image comes from an outside service (CSP: img-src 'self').

export interface VietQrInput {
  /** NAPAS bank BIN, 6 digits (e.g. 970436 Vietcombank, 970415 VietinBank, 970422 MB). */
  bankBin: string;
  /** Account number at that bank. */
  accountNumber: string;
  /** Amount in VND (integer); omitted = the payer types it. */
  amountVnd?: number;
  /** Transfer note (e.g. the booking code). ASCII letters, digits and spaces only, at most 25 characters. */
  note?: string;
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as EMVCo requires, in 4 upper-case hex digits. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** The VietQR payload string; throws on input a banking app would reject. */
export function vietQrPayload({ bankBin, accountNumber, amountVnd, note }: VietQrInput): string {
  if (!/^\d{6}$/.test(bankBin)) throw new Error("VietQR: bankBin must be 6 digits");
  if (!/^[0-9A-Za-z]{1,19}$/.test(accountNumber)) throw new Error("VietQR: invalid account number");
  if (amountVnd !== undefined && (!Number.isInteger(amountVnd) || amountVnd <= 0 || String(amountVnd).length > 13)) throw new Error("VietQR: invalid amount");
  if (note !== undefined && !/^[0-9A-Za-z ]{1,25}$/.test(note)) throw new Error("VietQR: note must be 1-25 ASCII letters, digits or spaces");

  const merchant = field("00", "A000000727") + field("01", field("00", bankBin) + field("01", accountNumber)) + field("02", "QRIBFTTA");
  const body =
    field("00", "01") +
    field("01", amountVnd ? "12" : "11") + // 12: one payment with this amount; 11: reusable
    field("38", merchant) +
    field("53", "704") + // VND
    (amountVnd ? field("54", String(amountVnd)) : "") +
    field("58", "VN") +
    (note ? field("62", field("08", note)) : "") +
    "6304";
  return body + crc16(body);
}

/** The VietQR as an SVG string (black on white; inline it in the page). */
export function vietQrSvg(input: VietQrInput): string {
  return renderSVG(vietQrPayload(input), { border: 2 });
}
