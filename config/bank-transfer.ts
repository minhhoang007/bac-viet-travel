// Project-owned: defaults for the account guests transfer deposits to (VietQR). Admins set the real account in
// Admin → Thông tin công ty (pages read it through app/_lib/company.ts `currentBank()`). While `demo` is true the
// transfer option shows only in payments sandbox mode, with a "do not transfer" warning.

export const defaultBankTransfer = {
  demo: true,
  /** NAPAS bank BIN (6 digits): 970436 Vietcombank, 970415 VietinBank, 970418 BIDV, 970422 MB, 970407 Techcombank, 970416 ACB. */
  bankBin: "970436",
  bankName: "Vietcombank",
  accountNumber: "0011000000000",
  /** Account holder exactly as the bank shows it (upper case, no accents). */
  accountName: "CONG TY TNHH DU LICH BAC VIET",
  /** How long seats stay held once the guest chooses a bank transfer (staff confirm it by hand). */
  holdMinutes: 120,
};
