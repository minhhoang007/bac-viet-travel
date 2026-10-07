export function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </>
  );
  return href ? (
    <a href={href} className="block rounded-lg border border-border p-4 hover:bg-muted">
      {body}
    </a>
  ) : (
    <div className="rounded-lg border border-border p-4">{body}</div>
  );
}
