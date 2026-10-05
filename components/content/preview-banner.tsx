/** Shown on public pages rendered in Draft Mode (`readContent(...).preview`). */
export function PreviewBanner({ label, exit, href }: { label: string; exit: string; href: string }) {
  return (
    <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-warning px-4 py-2 text-sm font-medium text-background">
      {label}
      <a href={href} className="underline">
        {exit}
      </a>
    </div>
  );
}
