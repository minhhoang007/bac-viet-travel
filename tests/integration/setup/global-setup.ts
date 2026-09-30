import { execFileSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./db";

export default function setup() {
  execFileSync(process.execPath, ["scripts/db-migrate.ts"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
