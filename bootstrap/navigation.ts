import { isModuleEnabled, type NavItem } from "@/core/module";
import { features } from "@/config/features";
import { moduleManifests } from "./modules";

/** Dashboard menu items contributed by enabled modules. */
export function getModuleNavigation(): NavItem[] {
  return moduleManifests.filter((m) => isModuleEnabled(features, m.name)).flatMap((m) => m.nav);
}
