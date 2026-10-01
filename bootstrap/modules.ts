import type { ModuleManifest } from "@/core/module";
import { adminModule } from "@/modules/admin";
import { analyticsModule } from "@/modules/analytics";
import { billingModule } from "@/modules/billing";
import { emailModule } from "@/modules/email";
import { entitlementsModule } from "@/modules/entitlements";
import { jobsModule } from "@/modules/jobs";
import { storageModule } from "@/modules/storage";

/** Manifests of all modules shipped with the starter. */
export const moduleManifests: readonly ModuleManifest[] = [
  emailModule,
  jobsModule,
  entitlementsModule,
  billingModule,
  adminModule,
  analyticsModule,
  storageModule,
];
