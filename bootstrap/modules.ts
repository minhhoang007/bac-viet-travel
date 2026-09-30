import type { ModuleManifest } from "@/core/module";
import { billingModule } from "@/modules/billing";
import { emailModule } from "@/modules/email";
import { entitlementsModule } from "@/modules/entitlements";
import { jobsModule } from "@/modules/jobs";

/** Manifests of all modules shipped with the starter. */
export const moduleManifests: readonly ModuleManifest[] = [emailModule, jobsModule, entitlementsModule, billingModule];
