import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { SettingsStories } from "./stories"

/** Preview: Settings section access per role and the audit-log writer (design v9.0, build step 1). */
export default async function SettingsDevPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Settings · access and audit</h1>
      <p className="mb-8 text-sm text-muted-foreground">Settings (design v9.0), build step 1. Pick the demo user&apos;s roles to check which sections open; write a test audit row.</p>
      <SettingsStories />
    </main>
  )
}
