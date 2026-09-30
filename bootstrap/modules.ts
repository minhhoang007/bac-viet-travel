import type { ModuleManifest } from "@/core/module";
import { emailModule } from "@/modules/email";

/** Manifests of all modules shipped with the starter. */
export const moduleManifests: readonly ModuleManifest[] = [emailModule];
