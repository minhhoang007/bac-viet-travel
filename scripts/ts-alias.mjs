// Lets `node` run scripts that import project code: maps the "@/" alias (tsconfig paths) to the repo root and
// resolves extensionless TypeScript imports (".ts", ".tsx", "/index.ts"). Node strips the types itself.
// Usage: node --import ./scripts/ts-alias.mjs scripts/<name>.ts
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const isFile = (path) => existsSync(path) && statSync(path).isFile();

function resolveTs(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (isFile(candidate)) return pathToFileURL(candidate).href;
  }
  return undefined;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const url = resolveTs(root + specifier.slice(2));
      if (url) return { url, shortCircuit: true };
    } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const url = resolveTs(fileURLToPath(new URL(specifier, context.parentURL)));
      if (url) return { url, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
