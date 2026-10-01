import { defineModule } from "@/core/module";

export const analyticsModule = defineModule({
  name: "analytics",
  // In profile "site" the module needs a database of its own (DATABASE_URL) just for events.
  profiles: ["site", "app"],
  uses: ["jobs", "admin"],
  env: ["DATABASE_URL", "ANALYTICS_SECRET"],
});
