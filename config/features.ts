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
};
