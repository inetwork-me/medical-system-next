import { Suspense } from "react"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"

import { routing } from "@/i18n/routing"
import { Gallery } from "./gallery"

/** Dev-only component gallery (DS sheets 08 / 10 / 11). `?open=dialog|sheet|drawer|popover|menu` opens an overlay. */
export default async function ComponentsPage({ params }: PageProps<"/[locale]/dev/components">) {
  if (process.env.NODE_ENV === "production") notFound()
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6 lg:p-8">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Components</h1>
      <Suspense>
        <Gallery />
      </Suspense>
    </main>
  )
}
