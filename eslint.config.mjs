import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "tests/arch-fixtures/**", "next-env.d.ts", "playwright-report/**"] },
  ...nextVitals,
  ...nextTs,
  {
    // Size budget: a file past this does too much; split it before adding more. Ratchet: lower `max` as files shrink.
    // Not counted: vendored shadcn components, text files (*content.ts), tests, migrations.
    files: ["**/*.{ts,tsx}"],
    ignores: ["components/ui/**", "**/*content.ts", "**/tests/**", "tests/**", "db/migrations/**"],
    rules: { "max-lines": ["error", { max: 450, skipBlankLines: true, skipComments: true }] },
  },
];

export default config;
