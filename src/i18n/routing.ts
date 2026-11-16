import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  // URLs are always prefixed (/en/…, /ar/…); first visit follows Accept-Language, then the NEXT_LOCALE cookie.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const dirOf = (locale: string): "ltr" | "rtl" => (locale === "ar" ? "rtl" : "ltr");
