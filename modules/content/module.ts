import { defineModule } from "@/core/module";

/** Shared editorial workflow for staff-edited content: drafts, review, versions, scheduled publishing (ADR-0009). */
export const contentModule = defineModule({
  name: "content",
  profiles: ["app"],
  requires: ["admin"],
  uses: ["email", "jobs"],
});
