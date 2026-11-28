import { setLocaleFrom } from "@/i18n/set-locale"
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Providers } from "@/components/providers";
import { dirOf, routing } from "@/i18n/routing";
import { inter, plexArabic } from "@/lib/fonts";
import { STATIC_EXPORT } from "@/lib/static";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  await setLocaleFrom(params)
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : "en", namespace: "common" });
  return { title: { default: t("app.name"), template: `%s · ${t("app.name")}` } };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Every page is rendered per request so Next can put the proxy's CSP nonce on its scripts (the static export has no request).
  if (!STATIC_EXPORT) await connection();
  const dir = dirOf(locale);

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${plexArabic.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
