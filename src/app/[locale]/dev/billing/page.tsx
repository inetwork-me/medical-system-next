import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { BillingStories } from "./stories"

/** Dev-only preview: Billing atoms, money, rules and counts. */
export default async function BillingDevPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Billing · data model and helpers</h1>
      <p className="mb-8 text-sm text-muted-foreground">Billing & contracts (design v5.0). Switch language for Arabic; switch the role to check permissions. </p>
      <BillingStories />
    </main>
  )
}
