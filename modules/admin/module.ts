import { defineModule } from "@/core/module";

export const adminModule = defineModule({
  name: "admin",
  profiles: ["app"],
  // Pages for these appear only when they are enabled.
  uses: ["jobs", "billing", "analytics", "storage"],
  // No dashboard nav entry: the admin link is shown to admins only (app/[locale]/dashboard/layout.tsx).
});
