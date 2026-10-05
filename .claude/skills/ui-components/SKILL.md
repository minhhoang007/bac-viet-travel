---
name: ui-components
description: Rules for building UI in this starter with shadcn/ui (components/ui), Tailwind 4 and the brand theme. Use when creating or changing pages, forms, menus, dialogs or any visual component, in the starter or in a project built from it.
---

# UI components

## 1. Use what exists first
- Primitives live in `components/ui/` (shadcn/ui, Radix-based, new-york style): `Button`/`ButtonLink`, `Input`, `Textarea`,
  `Label`, `Select`, `Popover`, `Calendar`, `DatePicker`, `Dialog`, `Sheet`, `Accordion`, `Carousel`, `Separator`, `Toaster`,
  `Table` (+ `TableHeader/Body/Row/Head/Cell`: every list of records; scrolls sideways on phones), `Skeleton`.
- Blocks: `components/marketing/` (Hero with optional `image`, Features, Faq, Cta, ContactForm, Pricing, Steps,
  ProblemSolution, Testimonials, LogoCloud), `components/layout/`. The home page shows the optional ones when their
  key is set in `content/<locale>/marketing.ts`. Testimonials and logos must be real customers, with permission.
- Signed-in pages: `components/app-shell/` — `AppShell` (dashboard/admin layouts; menus come from `nav`), `PageHeader`
  (every dashboard/admin page starts with it: the page's only `h1`, optional `description`, `actions`, `breadcrumb`).
- Feedback: `components/feedback/` — `Notice` (every message box: `tone` info / success / warning / danger; danger is
  announced as an alert), `EmptyState` (list with no rows — never a bare `<p>`), `ErrorState` (a part that failed;
  safe message only), `ConfirmDialog` (wraps a server action that is hard to undo; hidden inputs as children).
  Admin outcomes: `ResultNotice` (`?result=done|failed`).
- Forms: `components/forms/` — `FormField`, `FormError`, `SubmitButton`, `FormState` + `toFormState` (see §5).
- Icons: `lucide-react` only. No emoji or text glyphs as icons.
- Need another shadcn component? `pnpm dlx shadcn@latest add <name>`, then **fix imports**: utils must be
  `@/components/ui/cn` (the CLI may write `"cn"`), and remove any `next-themes` usage (theme follows prefers-color-scheme).
- Never add another component library (MUI, Ant, Mantine, HeroUI, daisyUI) — ADR-0001.

## 2. Ownership
- `components/ui/*` is starter-owned. Projects do **not** edit it; they compose it in `product/components/`.
- A change that every project would want (bug, a11y, missing prop) goes to the starter as a PR, not into a project copy.

## 3. Theme
- Colors come only from `config/brand.ts` (7 tokens). shadcn's extra tokens (`--accent`, `--ring`, `--input`, `--popover`…)
  are derived from them in `app/globals.css`. Use semantic classes (`bg-primary`, `text-muted-foreground`, `border-border`),
  never raw palette colors, except brand-fixed colors (e.g. Zalo blue) in project code.
- Status colors: `danger`, `warning`, `success` (`text-danger`, `border-warning/50`, `bg-success/10`), defined with
  light and dark values in `app/globals.css`. No `red-600`, `amber-50`… in components.
- Dark mode is automatic (brand `dark` palette). Check both.

## 4. Text and i18n
- No hard-coded visible or screen-reader text in components: pass labels as props from `content/` (starter) or
  `product/content.ts` (project). `content/content.test.ts` enforces this for starter component folders.
- Localized close labels: `SheetContent closeLabel`, `DialogContent closeLabel`.

## 5. Server first
- Pages and blocks are Server Components. Add `"use client"` only to the smallest interactive leaf (menu, picker, form).
- Forms post to Server Actions; client pickers submit through hidden inputs (see `DatePicker`).
- Form pattern (copy `product/_example-notes`): zod schema in the service → action catches and returns
  `toFormState(error, fields)` (or redirects on success) → client form with `useActionState`, one `FormField` per
  field, `FormError` for `status: "error"`, `SubmitButton`.
- **Every form that posts to a server action submits with `SubmitButton`** (`variant`, `size`, `pendingLabel`): it is
  disabled while the action runs, so a double click never submits twice. Plain `<button>` only for GET forms
  (search, export) and client-only buttons. Map message keys to labels from content; never show
  raw error text. React Hook Form only in `product/` for field arrays, multi-step forms or live validation.
- Content that search engines must see stays in the HTML (FAQ uses `forceMount`; don't lazy-render SEO text).

## 6. Accessibility (checked in CI)
- Every input has a `<label>`; errors use `aria-invalid` + `aria-describedby`; status messages use `role="status"`/`"alert"`.
- Interactive elements are real `<button>`/`<a>`; icon-only buttons have `aria-label`.
- `tests/e2e/starter.spec.ts` runs axe (WCAG 2 A/AA) on key pages; add your new pages to a project E2E with the same check. Admin pages are scanned in `tests/e2e-app/shell.spec.ts`;
  a new starter page goes into its list, a project page into the project's own axe test.
- Test at 390 px width (mobile menu, no horizontal scroll) and at desktop width.

## 7. Pages staff use every day (admin, CMS)
The people editing content are not developers.
- Button labels are verbs that say what happens ("Gửi duyệt", "Xoá ảnh"), not "OK" / "Submit".
- Anything hard to undo goes through `ConfirmDialog`; say what will be lost.
- Errors say how to fix it ("Chỉ nhận ảnh JPG, PNG…"), never codes or raw messages.
- Long forms: group fields in `<fieldset>` sections (tabs when there are many), keep the save button reachable, and
  keep the workflow panel (`app/_components/workflow-panel.tsx`) on content edit pages.
- Lists: `Table` + filters as links (`?status=`) so a filtered view can be shared; `EmptyState` when empty.

## 8. Done means
`pnpm check` green, `pnpm build` green, E2E covering the new UI (including mobile width), no serious axe violations.
