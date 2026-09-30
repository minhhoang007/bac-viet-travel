import { createLogger, type Logger } from "@/core/logger";
import type { Features } from "@/core/module";
import { features } from "@/config/features";
import { getEnv } from "./env";

/** Services wired for the running project. Grows as modules are added (email in V0.1b, auth in V0.2). */
export interface Container {
  features: Features;
  logger: Logger;
}

let cached: Container | undefined;

/** Lazy: nothing is validated or constructed until the first call. */
export function getContainer(): Container {
  return (cached ??= build());
}

function build(): Container {
  const env = getEnv();
  return { features, logger: createLogger({ level: env.LOG_LEVEL }) };
}
