// PostToolUse hook: lint the TypeScript file Claude just edited, so a broken edit shows up at once (exit 2 sends
// the errors back to Claude). Files outside the repo, non-TS files and ignored paths are skipped.
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const file = JSON.parse(input || "{}").tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
if (!file || !/\.(ts|tsx|mts)$/.test(file)) process.exit(0);
const rel = relative(root, resolve(file));
if (rel.startsWith("..") || isAbsolute(rel) || /^(node_modules|\.next|tests[\\/]arch-fixtures)[\\/]/.test(rel)) process.exit(0);

try {
  execFileSync(process.execPath, [resolve(root, "node_modules/eslint/bin/eslint.js"), "--max-warnings", "0", rel], { cwd: root, stdio: "pipe" });
} catch (error) {
  process.stderr.write(`eslint found problems in ${rel}:\n${error.stdout?.toString() ?? ""}${error.stderr?.toString() ?? ""}`);
  process.exit(2);
}
