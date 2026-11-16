import { cookies } from "next/headers"
import { hasLocale } from "next-intl"
import { notFound } from "next/navigation"
import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { SESSION_COOKIE } from "@/lib/session"

/** Entry route: signed in → dashboard, otherwise → sign in. */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const signedIn = (await cookies()).has(SESSION_COOKIE)
  redirect({ href: signedIn ? "/dashboard" : "/login", locale })
}
