import { Suspense } from "react"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { ReassignStories } from "./stories"

/** Dev-only preview stories for the Move bookings block: target × selected option (EN at /en, AR at /ar). */
export default async function ReassignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">ReassignBookings</h1>
      <p className="mb-8 text-sm text-muted-foreground">Move bookings block · target × selected option. Switch language for the Arabic stories.</p>
      <Suspense>
        <ReassignStories />
      </Suspense>
    </main>
  )
}
