import type { routing } from "@/i18n/routing";
import type { formats } from "@/i18n/formats";
import type common from "../messages/en/common.json";
import type shell from "../messages/en/shell.json";
import type auth from "../messages/en/auth.json";
import type dashboard from "../messages/en/dashboard.json";
import type patients from "../messages/en/patients.json";
import type appointments from "../messages/en/appointments.json";
import type specialties from "../messages/en/specialties.json";
import type clinics from "../messages/en/clinics.json";
import type doctors from "../messages/en/doctors.json";
import type labs from "../messages/en/labs.json";
import type billing from "../messages/en/billing.json";
import type records from "../messages/en/records.json";

// English messages are the type source; ar/*.json must have the same keys.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: { common: typeof common; shell: typeof shell; auth: typeof auth; dashboard: typeof dashboard; patients: typeof patients; appointments: typeof appointments; specialties: typeof specialties; clinics: typeof clinics; doctors: typeof doctors; labs: typeof labs; billing: typeof billing; records: typeof records };
    Formats: typeof formats;
  }
}
