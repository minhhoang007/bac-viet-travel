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
