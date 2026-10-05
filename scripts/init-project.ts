// Initializes a new project from the starter.
//
//   pnpm init:project --name "Tour Hạ Long" --profile site --modules email
//   pnpm init:project --name "My SaaS" --profile app            (email is added automatically: magic link needs it)
//   pnpm init:project --name "X" --keep-example --dry-run
//
// Writes project-owned overrides only (config/*.ts, starter.lock.json, package.json name) and removes the
// example vertical slice unless --keep-example. Starter-owned files (*.defaults.ts, core/, modules/) are untouched.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const MODULES = ["email", "jobs", "entitlements", "billing", "usage", "storage", "analytics", "admin", "ai", "blog", "media"];
const AVAILABLE = ["email", "jobs", "entitlements", "billing", "admin", "analytics", "storage", "blog", "media"]; // modules implemented in this starter version

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    profile: { type: "string", default: "site" },
    modules: { type: "string", default: "" },
    "keep-example": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`init:project: ${message}`);
  process.exit(1);
}

const name = values.name?.trim();
if (!name) fail('--name is required, e.g. --name "My App"');
if (values.profile !== "site" && values.profile !== "app") fail('--profile must be "site" or "app"');
const profile = values.profile;

const modules = new Set(values.modules.split(",").map((m) => m.trim()).filter(Boolean));
for (const m of modules) {
  if (!MODULES.includes(m)) fail(`unknown module "${m}". Known: ${MODULES.join(", ")}`);
  if (!AVAILABLE.includes(m)) fail(`module "${m}" is not implemented in this starter version yet`);
}
const APP_ONLY = ["jobs", "entitlements", "billing", "admin", "storage", "media"];
for (const m of modules) {
  if (profile === "site" && APP_ONLY.includes(m)) fail(`module "${m}" needs --profile app`);
}
// Dependencies (mirrors `requires` in modules/*/module.ts).
if (modules.has("billing")) {
  for (const dep of ["entitlements", "jobs"]) {
    if (!modules.has(dep)) {
      modules.add(dep);
      console.log(`note: "billing" requires "${dep}", enabled`);
    }
  }
}
if (profile === "app" && !modules.has("email")) {
  modules.add("email");
  console.log('note: profile "app" signs in with magic links, so the "email" module was enabled');
}
if (existsSync("starter.lock.json") && !values.force) fail("starter.lock.json exists: project already initialized (use --force)");

const dryRun = values["dry-run"];
const actions: string[] = [];
const write = (file: string, content: string) => {
  actions.push(`write  ${file}`);
  if (!dryRun) writeFileSync(file, content);
};
const remove = (path: string) => {
  if (!existsSync(path)) return;
  actions.push(`remove ${path}`);
  if (!dryRun) rmSync(path, { recursive: true, force: true });
};
const q = (s: string) => JSON.stringify(s);

// ── Project-owned config overrides (ADR-0004) ─────────────────────────
const enabled = MODULES.filter((m) => modules.has(m));
write(
  "config/features.ts",
  `// Project-owned: override starter defaults here.
import type { Features } from "@/core/module";
import { featureDefaults } from "./features.defaults";

export const features: Features = {
  ...featureDefaults,
  profile: ${q(profile)},${enabled.map((m) => `\n  ${m}: true,`).join("")}
};
`,
);
write(
  "config/app.ts",
  `// Project-owned.
import { appDefaults } from "./app.defaults";

export const appConfig = { ...appDefaults, name: ${q(name)} };
export type Locale = (typeof appConfig.locales)[number];
`,
);
write(
  "config/brand.ts",
  `// Project-owned.
import { brandDefaults } from "./brand.defaults";

export const brand = { ...brandDefaults, logoText: ${q(name)} };
`,
);
write(
  "config/seo.ts",
  `// Project-owned.
import { seoDefaults } from "./seo.defaults";

export const seoConfig = { ...seoDefaults, titleTemplate: ${q(`%s | ${name}`)} };
`,
);

// ── Remove the example vertical slice ─────────────────────────────────
if (!values["keep-example"]) {
  remove("content/blog/vi/chao-mung-den-voi-blog.mdx");
  remove("content/blog/en/welcome-to-the-blog.mdx");
  remove("product/_example-notes");
  remove("app/[locale]/dashboard/product");
  remove("db/migrations/product");
  write(
    "product/manifest.ts",
    `import type { AccountDataExporter } from "@/core/account";
import type { Locale } from "@/config/app";
import type { ProductContext, ProductJobs } from "@/core/product/context";
import type { Db } from "@/db/client";

/**
 * The only file bootstrap/ imports from product/. Declares product services, menu, account-data exporters and jobs.
 * \`ctx\` gives services the database, logger, mail, rate limiter, payments and jobs (core/product/context.ts).
 */
export function createProduct(db: Db, ctx: ProductContext) {
  void db; // pass db / ctx to your product services
  void ctx;
  const exporters: AccountDataExporter[] = [];
  // Background work (needs the jobs module): { handlers: { "booking.x": fn }, periodic: { "booking.sweep": fn } }.
  const jobs: ProductJobs = {};
  return { services: {}, exporters, jobs };
}

export interface ProductNavItem {
  href: string;
  label: Record<Locale, string>;
}

/** Dashboard menu entries for product pages (href without locale prefix). */
export const productNav: ProductNavItem[] = [];

/** Public product pages for sitemap.xml (paths without locale prefix). */
export const sitemapPaths: string[] = [];

/** Admin menu entries for product pages (e.g. "/admin/orders"); shown when the admin module is on. */
export const productAdminNav: ProductNavItem[] = [];

export type Product = ReturnType<typeof createProduct>;
`,
  );
  const drizzleProduct = readFileSync("drizzle.product.config.ts", "utf8").replace(
    `schema: ["./product/schema/*.ts", "./product/_example-notes/schema.ts"],`,
    `schema: ["./product/schema/*.ts"],`,
  );
  write("drizzle.product.config.ts", drizzleProduct);
}

// ── package.json name + lock file ─────────────────────────────────────
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string; version: string };
// The starter version lives in .starter-version (not package.json), so upgrades never conflict on it.
const starterVersion = readFileSync(".starter-version", "utf8").trim();
const slug =
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "my-app";
// The project's own version starts at 0.1.0; the starter never touches these lines again.
write("package.json", `${JSON.stringify({ ...pkg, name: slug, version: "0.1.0" }, null, 2)}\n`);
write(
  "starter.lock.json",
  `${JSON.stringify(
    { starterVersion, initializedAt: new Date().toISOString().slice(0, 10), profile, modules: enabled, example: values["keep-example"] },
    null,
    2,
  )}\n`,
);

// ── Report ────────────────────────────────────────────────────────────
console.log(`\n${dryRun ? "[dry run] " : ""}Initialized "${name}" (profile ${profile}, modules: ${enabled.join(", ") || "none"})`);
for (const a of actions) console.log(`  ${a}`);

const env = ["NEXT_PUBLIC_SITE_URL"];
if (modules.has("email")) env.push("EMAIL_PROVIDER / EMAIL_API_KEY", "EMAIL_FROM", "CONTACT_TO_EMAIL");
if (profile === "app") env.push("DATABASE_URL", "BETTER_AUTH_SECRET", "(optional) GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
if (profile === "site" && modules.has("analytics")) env.push("DATABASE_URL (analytics events)");
if (modules.has("jobs")) env.push("CRON_SECRET");
if (modules.has("analytics")) env.push("ANALYTICS_SECRET");
if (modules.has("storage")) env.push("STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY");
if (modules.has("media")) env.push("CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET");
if (modules.has("billing")) {
  env.push(
    "POLAR_ACCESS_TOKEN / POLAR_WEBHOOK_SECRET / POLAR_SERVER / POLAR_PRODUCT_PRO_MONTHLY / POLAR_PRODUCT_PRO_YEARLY",
    "VNPAY_TMN_CODE / VNPAY_HASH_SECRET (providers: config/billing.ts)",
  );
}
console.log(`\nNext steps:
  1. cp .env.example .env.local and set: ${env.join(", ")}
  2. Edit content/ (texts), config/brand.ts (colors), content/legal.ts (legal text)${
    profile === "app" ? "\n  3. pnpm db:up && pnpm db:generate:product (when you add tables) && pnpm db:migrate" : ""
  }
  ${profile === "app" ? 4 : 3}. pnpm check && pnpm dev${modules.has("admin") ? "\n  then: sign in once and run pnpm admin:grant <your email>" : ""}
`);
