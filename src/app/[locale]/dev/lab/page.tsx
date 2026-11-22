import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { LabStories } from "./stories"

/** Dev-only preview: Labs shared helpers (tube dot, flag chip, STAT chip, status badge) and the status machine. */
export default async function LabDevPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Labs · data model and helpers</h1>
      <p className="mb-8 text-sm text-muted-foreground">Step 1 of the Labs build. Switch language for Arabic.</p>
      <LabStories />
    </main>
  )
}
