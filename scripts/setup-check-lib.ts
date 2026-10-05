// Pure part of `pnpm setup:check` (see scripts/setup-check.ts): turns facts about the machine and config into a report.

export interface SetupFacts {
  nodeVersion: string;
  /** Minimum major version from package.json "engines.node" (">=24" → 24). */
  minNodeMajor: number;
  hasEnvFile: boolean;
  profile: "site" | "app";
  enabledModules: string[];
  /** From envProblems(): "KEY: what is wrong", never values. */
  envProblems: string[];
  /** undefined: not checked (profile site or no DATABASE_URL). */
  database?: "ok" | "unreachable";
}

export interface SetupLine {
  ok: boolean;
  text: string;
  hint?: string;
}

export function diagnose(f: SetupFacts): { lines: SetupLine[]; ok: boolean } {
  const lines: SetupLine[] = [];
  const major = Number.parseInt(f.nodeVersion.replace(/^v/, ""), 10);
  lines.push(
    major >= f.minNodeMajor
      ? { ok: true, text: `Node ${f.nodeVersion}` }
      : { ok: false, text: `Node ${f.nodeVersion} is too old`, hint: `install Node ${f.minNodeMajor} or newer` },
  );
  lines.push({
    ok: true,
    text: `Profile "${f.profile}", modules: ${f.enabledModules.length > 0 ? f.enabledModules.join(", ") : "none"}`,
  });
  if (!f.hasEnvFile) lines.push({ ok: true, text: "No .env.local (fine if variables come from the shell)", hint: "cp .env.example .env.local" });

  if (f.envProblems.length === 0) lines.push({ ok: true, text: "Environment variables" });
  for (const problem of f.envProblems) lines.push({ ok: false, text: problem, hint: "see .env.example and docs/SETUP.md §5" });

  if (f.database === "ok") lines.push({ ok: true, text: "Database reachable" });
  if (f.database === "unreachable") lines.push({ ok: false, text: "Database unreachable", hint: "pnpm db:up (local) or check DATABASE_URL" });

  return { lines, ok: lines.every((l) => l.ok) };
}

export function formatReport(report: { lines: SetupLine[]; ok: boolean }): string {
  const body = report.lines.map((l) => `${l.ok ? "✔" : "✖"} ${l.text}${l.hint ? `\n    → ${l.hint}` : ""}`).join("\n");
  return `${body}\n\n${report.ok ? "All good. Next: pnpm dev" : "Fix the ✖ items above, then run pnpm setup:check again."}`;
}
