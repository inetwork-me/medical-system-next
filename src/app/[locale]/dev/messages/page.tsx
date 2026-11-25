import { Suspense } from "react"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { MessagesStories } from "./stories"

/** Preview: Messages atoms, data counts and permissions (design v8.0). */
export default async function MessagesDevPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Messages · data model and atoms</h1>
      <p className="mb-8 text-sm text-muted-foreground">Messages (design v8.0), build step 1. Switch language for Arabic; switch the role to check tabs and access.</p>
      <Suspense>
        <MessagesStories />
      </Suspense>
    </main>
  )
}
