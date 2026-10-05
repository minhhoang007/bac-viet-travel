import { defineModule } from "@/core/module";

/** Public images edited by staff (ADR-0008). The library page lives in the admin area. */
export const mediaModule = defineModule({
  name: "media",
  profiles: ["app"],
  requires: ["admin"],
  env: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
});
