/** Sand accent of the brand (decoration only: logo ring, wave, small labels). */
export const SAND = "#b8935a";
/** Sand for text on light backgrounds (AA 4.5:1 on the paper colour); SAND itself only on dark or as decoration. */
export const SAND_TEXT = "#8a6a35";

/** Logo mark A: limestone karsts over water (Ha Long, Ninh Binh) in a sand ring. */
export function LogoMark({ className, peak = "currentColor" }: { className?: string; peak?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="23" fill="none" stroke={SAND} strokeWidth="1.5" />
      <path d="M9 31 L17 15 L21 22 L26 11 L35 31Z" fill={peak} />
      <path d="M10 35 Q15 32.5 20 35 T30 35 T39 35" fill="none" stroke={SAND} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + wordmark. The link around it carries the accessible name. */
export function Logo({ tone = "light", size = "md" }: { tone?: "light" | "dark"; size?: "sm" | "md" }) {
  const dark = tone === "dark";
  return (
    <span className="flex items-center gap-3">
      <LogoMark className={size === "sm" ? "size-9" : "size-10"} peak={dark ? "#2dd4bf" : "var(--primary)"} />
      <span className="grid leading-none">
        <span className={`font-heading font-semibold ${size === "sm" ? "text-xl" : "text-2xl"} ${dark ? "text-[#f3efe6]" : "text-foreground"}`}>Bắc Việt</span>
        <span className="mt-1.5 text-[10px] font-medium tracking-[0.42em]" style={{ color: dark ? SAND : SAND_TEXT }}>
          TRAVEL
        </span>
      </span>
    </span>
  );
}
