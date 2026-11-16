import { hasLocale } from "next-intl"
import { notFound } from "next/navigation"
import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

// Entry route → dashboard for now; switches to /login once the auth flow is built (step 4).
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  redirect({ href: "/dashboard", locale })
}
