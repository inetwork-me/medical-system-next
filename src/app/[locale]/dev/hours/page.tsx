import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { HoursStories } from "./stories"

/** Dev-only preview stories for Overlay · Edit hours: desktop (680) / mobile (390) × default / conflict / errors. */
export default async function HoursPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Edit hours</h1>
      <p className="mb-8 text-sm text-muted-foreground">Dr. Ahmed Zaki · desktop (680) and mobile (390) widths. Switch language for Arabic.</p>
      <HoursStories />
    </main>
  )
}
