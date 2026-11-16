import type { routing } from "@/i18n/routing";
import type { formats } from "@/i18n/formats";
import type common from "../messages/en/common.json";
import type shell from "../messages/en/shell.json";
import type dashboard from "../messages/en/dashboard.json";
import type patients from "../messages/en/patients.json";

// English messages are the type source; ar/*.json must have the same keys.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: { common: typeof common; shell: typeof shell; dashboard: typeof dashboard; patients: typeof patients };
    Formats: typeof formats;
  }
}
