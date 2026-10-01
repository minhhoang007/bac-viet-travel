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
};
