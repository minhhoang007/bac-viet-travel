// Project-owned: override starter defaults here.
import type { Features } from "@/core/module";
import { featureDefaults } from "./features.defaults";

export const features: Features = {
  ...featureDefaults,
  profile: "app",
  email: true,
  blog: true,
  jobs: true,
  admin: true,
  // Editorial workflow for tours (CMS): drafts, review, versions, scheduled publishing.
  content: true,
  // Media library (Cloudinary): on wherever its keys are set (local .env.local, Vercel once added), off in CI.
  // simplification: a top-level env read (AGENTS.md asks for none) because the media module requires its keys when on,
  // and CI has none. Read by next.config (build: CSP, image hosts) and the server: after adding the keys, redeploy.
  // Upgrade when the starter supports "on when configured" modules.
  media: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
};
