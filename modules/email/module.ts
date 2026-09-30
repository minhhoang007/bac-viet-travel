import { defineModule } from "@/core/module";

export const emailModule = defineModule({
  name: "email",
  profiles: ["site", "app"],
  uses: ["jobs"], // retry via jobs once that module exists (V1.1)
  // EMAIL_API_KEY is passed to the provider selected in bootstrap/. CONTACT_TO_EMAIL receives contact form messages.
  env: ["EMAIL_FROM", "EMAIL_API_KEY", "CONTACT_TO_EMAIL"],
});
