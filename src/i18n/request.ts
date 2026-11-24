import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { formats } from "./formats";

/**
 * Messages are split per namespace: messages/{en,ar}/<namespace>.json.
 * Each module adds its namespace here (the module stays self-contained; hidden modules simply aren't rendered).
 */
const namespaces = ["common", "shell", "auth", "dashboard", "patients", "appointments", "specialties", "clinics", "doctors", "labs", "billing", "records", "reports"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const entries = await Promise.all(
    namespaces.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const),
  );

  return {
    locale,
    messages: Object.fromEntries(entries),
    formats,
    timeZone: "Asia/Riyadh",
  };
});
