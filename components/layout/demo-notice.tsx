/** DEMO_MODE: a notice above every page (site, account and admin) saying nothing here is real. */
export function DemoNotice({ text, contact }: { text: string; contact?: { label: string; href: string } }) {
  return (
    <div role="note" className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-sm text-foreground print:hidden" data-testid="demo-notice">
      {text}
      {contact && (
        <>
          {" "}
          <a href={contact.href} className="font-medium underline underline-offset-4 hover:no-underline">
            {contact.label}
          </a>
        </>
      )}
    </div>
  );
}
