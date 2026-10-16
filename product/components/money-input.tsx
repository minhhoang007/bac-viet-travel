"use client";

// Amounts in VND shown as "4.290.000" while typing: a missing or extra zero is easy to see. Digits only are kept.
import type { InputHTMLAttributes } from "react";

const format = (n: number | undefined) => (n === undefined ? "" : n.toLocaleString("vi-VN"));

export function MoneyInput({
  value,
  onValue,
  ...rest
}: { value: number | undefined; onValue: (n: number | undefined) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={format(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onValue(digits ? Number(digits) : undefined);
      }}
    />
  );
}
