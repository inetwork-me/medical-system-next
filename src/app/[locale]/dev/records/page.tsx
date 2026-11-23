import { Suspense } from "react"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { RecordsStories } from "./stories"

/** Preview: Medical records atoms, rules, counts and permissions (design v6.0). */
export default async function RecordsDevPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Medical records · data model and helpers</h1>
      <p className="mb-8 text-sm text-muted-foreground">Medical records (design v6.0). Switch language for Arabic; switch the role to check permissions.</p>
      <Suspense>
        <RecordsStories />
      </Suspense>
    </main>
  )
}
