---
name: ui-components
description: Rules for building UI in this starter with shadcn/ui (components/ui), Tailwind 4 and the brand theme. Use when creating or changing pages, forms, menus, dialogs or any visual component, in the starter or in a project built from it.
---

# UI components

## 1. Use what exists first
- Primitives live in `components/ui/` (shadcn/ui, Radix-based, new-york style): `Button`/`ButtonLink`, `Input`, `Textarea`,
  `Label`, `Select`, `Popover`, `Calendar`, `DatePicker`, `Dialog`, `Sheet`, `Accordion`, `Carousel`, `Separator`, `Toaster`.
- Blocks: `components/marketing/` (Hero with optional `image`, Features, Faq, Cta, ContactForm), `components/layout/`.
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
- Dark mode is automatic (brand `dark` palette). Check both.

## 4. Text and i18n
- No hard-coded visible or screen-reader text in components: pass labels as props from `content/` (starter) or
  `product/content.ts` (project). `content/content.test.ts` enforces this for starter component folders.
- Localized close labels: `SheetContent closeLabel`, `DialogContent closeLabel`.

## 5. Server first
- Pages and blocks are Server Components. Add `"use client"` only to the smallest interactive leaf (menu, picker, form).
- Forms post to Server Actions; client pickers submit through hidden inputs (see `DatePicker`).
- Content that search engines must see stays in the HTML (FAQ uses `forceMount`; don't lazy-render SEO text).

## 6. Accessibility (checked in CI)
- Every input has a `<label>`; errors use `aria-invalid` + `aria-describedby`; status messages use `role="status"`/`"alert"`.
- Interactive elements are real `<button>`/`<a>`; icon-only buttons have `aria-label`.
- `tests/e2e/starter.spec.ts` runs axe (WCAG 2 A/AA) on key pages; add your new pages to a project E2E with the same check.
- Test at 390 px width (mobile menu, no horizontal scroll) and at desktop width.

## 7. Done means
`pnpm check` green, `pnpm build` green, E2E covering the new UI (including mobile width), no serious axe violations.
