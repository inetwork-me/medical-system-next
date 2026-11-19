import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { ToastPreviews } from "./previews"

/** Dev-only preview stories for DS sheet 12 · Toasts: every Tone × Layout × Dir, plus a live playground. */
export default async function ToastsPage({ params }: PageProps<"/[locale]/dev/toasts">) {
  if (process.env.NODE_ENV === "production") notFound()
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">12 · Toasts</h1>
      <p className="mb-8 text-sm text-muted-foreground">Tone × Layout × Dir, then a live playground for the toaster (stacking, timer, ×2, promise).</p>
      <ToastPreviews />
    </main>
  )
}
