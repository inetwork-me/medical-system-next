import { Suspense } from "react"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { ReportsStories } from "./stories"

/** Preview: Reports atoms, measure definitions, filters and permissions (design v7.0). */
export default async function ReportsDevPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Reports · data model and helpers</h1>
      <p className="mb-8 text-sm text-muted-foreground">Reports (design v7.0). Switch language for Arabic; switch the role to check permissions.</p>
      <Suspense>
        <ReportsStories />
      </Suspense>
    </main>
  )
}
