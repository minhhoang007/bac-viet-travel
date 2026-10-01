import { defineModule } from "@/core/module";

export const storageModule = defineModule({
  name: "storage",
  profiles: ["app"],
  // Quota follows the plan when entitlements is on; otherwise the free plan's "storage.max_bytes".
  uses: ["entitlements", "jobs"],
  env: ["STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"],
  nav: [{ label: { vi: "Tệp", en: "Files" }, href: "/dashboard/files" }],
});
