// Pure part of `pnpm setup:check` (see scripts/setup-check.ts): turns facts about the machine and config into a report.
import { emailDomain } from "./launch-check-lib";

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
  /** Present when checking production settings (--production or VERCEL_ENV=production). */
  production?: { upstash: boolean; emailFrom?: string; legalIsTemplate: boolean };
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

  // Production mistakes seen in a real project: each one works in dev and fails quietly in production.
  if (f.production) {
    const p = f.production;
    lines.push(
      p.upstash
        ? { ok: true, text: "Rate limits shared (Upstash)" }
        : { ok: false, text: "No Upstash: rate limits count per server instance", hint: "set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (docs/DEPLOY.md)" },
    );
    const domain = p.emailFrom === undefined ? undefined : emailDomain(p.emailFrom);
    if (p.emailFrom === undefined) lines.push({ ok: false, text: "EMAIL_FROM not set", hint: "a sender on your verified domain (docs/LAUNCH.md §2)" });
    else if (domain === undefined) lines.push({ ok: false, text: "EMAIL_FROM has no email address", hint: 'e.g. "Shop <noreply@mail.shop.vn>"' });
    else if (domain === "resend.dev" || domain.endsWith(".resend.dev"))
      lines.push({ ok: false, text: "EMAIL_FROM uses resend.dev: mail only reaches the Resend account owner", hint: "verify your domain in Resend (docs/LAUNCH.md §2)" });
    else lines.push({ ok: true, text: `EMAIL_FROM on ${domain}` });
    lines.push(
      p.legalIsTemplate
        ? { ok: false, text: "Terms and privacy are still the template", hint: "replace content/legal.ts and set legalIsTemplate = false" }
        : { ok: true, text: "Legal pages" },
    );
  }

  return { lines, ok: lines.every((l) => l.ok) };
}

export function formatReport(report: { lines: SetupLine[]; ok: boolean }): string {
  const body = report.lines.map((l) => `${l.ok ? "✔" : "✖"} ${l.text}${l.hint ? `\n    → ${l.hint}` : ""}`).join("\n");
  return `${body}\n\n${report.ok ? "All good. Next: pnpm dev" : "Fix the ✖ items above, then run pnpm setup:check again."}`;
}
