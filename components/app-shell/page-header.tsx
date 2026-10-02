import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  /** Omit for the current page (always the last item). */
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons/links shown next to the title (wrap below it on small screens). */
  actions?: ReactNode;
  /** Parent pages; `label` names the landmark for screen readers. */
  breadcrumb?: { label: string; items: Crumb[] };
}

/** Top of a dashboard/admin page: optional breadcrumb, the page's only h1, description and actions. */
export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="grid gap-2">
      {breadcrumb && breadcrumb.items.length > 0 && (
        <nav aria-label={breadcrumb.label}>
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {breadcrumb.items.map((item, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                {item.href ? (
                  <a href={item.href} className="hover:text-foreground">
                    {item.label}
                  </a>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-bold break-words">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
