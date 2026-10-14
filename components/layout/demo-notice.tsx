/** DEMO_MODE: a notice above every page (site, account and admin) saying nothing here is real. */
export function DemoNotice({ text, links }: { text: string; links: { label: string; href: string }[] }) {
  return (
    <div role="note" className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-sm text-foreground print:hidden" data-testid="demo-notice">
      {text}
      {links.map((l) => (
        <span key={l.href}>
          {" · "}
          <a href={l.href} className="font-medium underline underline-offset-4 hover:no-underline">
            {l.label}
          </a>
        </span>
      ))}
    </div>
  );
}
