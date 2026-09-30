import { defineModule } from "@/core/module";

export const emailModule = defineModule({
  name: "email",
  profiles: ["site", "app"],
  uses: ["jobs"], // retry via jobs once that module exists (V1.1)
  // Provider + key: EMAIL_PROVIDER / EMAIL_API_KEY (checked in bootstrap/env.ts). CONTACT_TO_EMAIL receives contact form messages.
  env: ["EMAIL_FROM", "CONTACT_TO_EMAIL"],
});
