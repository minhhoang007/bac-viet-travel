import { defineModule } from "@/core/module";

export const blogModule = defineModule({
  name: "blog",
  // Posts are MDX files in the repo: no database, no secrets; pages are prerendered.
  profiles: ["site", "app"],
});
