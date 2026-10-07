/** Brass accent of the brand (logo ring, wave). The site is dark ("Sơn Mài"), so it also reads as small text. */
export const SAND = "#c9a25e";

/** Logo mark: limestone karsts over water (Ha Long, Ninh Binh) in a brass ring. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="23" fill="none" stroke={SAND} strokeWidth="1.2" />
      <path d="M9 31 L17 15 L21 22 L26 11 L35 31Z" fill="currentColor" />
      <path d="M10 35 Q15 32.5 20 35 T30 35 T39 35" fill="none" stroke={SAND} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + wordmark ("BẮC VIỆT" in spaced capitals of the heading serif). The link around it carries the accessible name. */
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className="flex items-center gap-3 text-foreground">
      <LogoMark className={size === "sm" ? "size-8" : "size-10"} />
      <span className="grid leading-none">
        <span className={`font-heading font-medium tracking-[0.28em] ${size === "sm" ? "text-lg" : "text-2xl"}`}>BẮC VIỆT</span>
        <span className="mt-1.5 text-[9px] font-medium tracking-[0.5em]" style={{ color: SAND }}>
          TRAVEL
        </span>
      </span>
    </span>
  );
}
