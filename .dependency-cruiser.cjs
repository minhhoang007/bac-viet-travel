/** Architecture rules — see ARCHITECTURE.md §3. Each rule has a fixture in tests/arch-fixtures/. */
const rules = [
  {
    name: "no-circular",
    severity: "error",
    comment: "No dependency cycles.",
    from: {},
    to: { circular: true },
  },
  {
    name: "core-no-upward",
    severity: "error",
    comment: "Core (core/, components/, config/, content/, db/) must not import modules, product, providers or bootstrap. Declare a port in core/ports/ instead.",
    from: { path: "^(core|components|config|content|db)/" },
    to: { path: "^(modules|product|providers|bootstrap)/" },
  },
  {
    name: "providers-only-from-bootstrap",
    severity: "error",
    comment: "Only bootstrap/ may import providers/.",
    from: { path: "^(?!bootstrap/|providers/)" },
    to: { path: "^providers/" },
  },
{
    name: "modules-no-upward",
    severity: "error",
    comment: "Modules must not import product, providers or bootstrap.",
    from: { path: "^modules/" },
    to: { path: "^(product|providers|bootstrap)/" },
  },
  {
    name: "modules-public-api-only-inside",
    severity: "error",
    comment: "A module may use another module only through its index.ts.",
    from: { path: "^modules/([^/]+)/" },
    to: { path: "^modules/[^/]+/.+", pathNot: ["^modules/$1/", "^modules/[^/]+/index\\.ts$"] },
  },
  {
    name: "modules-public-api-only-outside",
    severity: "error",
    comment: "Code outside modules/ may import a module only through modules/<name>/index.ts.",
    from: { pathNot: "^modules/" },
    to: { path: "^modules/[^/]+/.+", pathNot: "^modules/[^/]+/index\\.ts$" },
  },
  {
    name: "vendor-sdk-only-in-adapters",
    severity: "error",
    comment: "Vendor SDKs only in providers/ and core/auth/adapters/.",
    from: { pathNot: "^(providers|core/auth/adapters)/" },
    to: { path: "(^|node_modules/)(stripe|resend|@upstash|@aws-sdk|@anthropic-ai|openai|better-auth|posthog-node|@sentry|@lemonsqueezy|@paddle|@polar-sh)(/|$)" },
  },
  {
    name: "db-driver-only-in-db",
    severity: "error",
    comment: "Database drivers only in db/.",
    from: { pathNot: "^db/" },
    to: { path: "(^|node_modules/)(pg|postgres|@neondatabase/serverless)(/|$)" },
  },
];

module.exports = {
  forbidden: rules,
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^(\.next|node_modules|tests/arch-fixtures)/" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".mjs"] },
  },
};
