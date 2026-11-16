import type { routing } from "@/i18n/routing";
import type { formats } from "@/i18n/formats";
import type common from "../messages/en/common.json";

// English messages are the type source; ar/*.json must have the same keys.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: { common: typeof common };
    Formats: typeof formats;
  }
}
