/** DEMO_MODE: a notice above every page (site, account and admin) saying nothing here is real. The first link is the main action. */
export function DemoNotice({ text, links }: { text: string; links: { label: string; href: string }[] }) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-b border-border bg-muted px-4 py-2 text-center text-sm text-foreground print:hidden"
      data-testid="demo-notice"
    >
      <span>{text}</span>
      {links.length > 0 && (
        <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {links.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              className={
                i === 0
                  ? "inline-flex min-h-8 items-center rounded-full bg-primary px-3.5 font-medium text-primary-foreground hover:bg-primary/90"
                  : "inline-flex min-h-8 items-center font-medium underline underline-offset-4 hover:no-underline"
              }
            >
              {l.label}
            </a>
          ))}
        </span>
      )}
    </div>
  );
}
