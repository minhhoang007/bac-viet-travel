import { defineModule } from "@/core/module";

export const jobsModule = defineModule({
  name: "jobs",
  profiles: ["app"],
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` to /api/jobs/run (ADR-0002).
  env: ["CRON_SECRET"],
});
