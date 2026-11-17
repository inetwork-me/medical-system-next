import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { HomeRedirect } from "@/components/auth/client-guards"

/** Entry route: signed in → dashboard, otherwise → sign in (decided in the browser, so it also works as a static page). */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return <HomeRedirect />
}
