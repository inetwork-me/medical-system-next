import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { TemplatesPage } from "@/modules/billing/templates-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("billing.templates"))("title") }
}

/** Billing · Contract templates (`?id=staff-doctors@4`); part of the Contracts tab (off with it). */
export default async function BillingTemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="contracts">
      <Suspense>
        <TemplatesPage />
      </Suspense>
    </TabGuard>
  )
}
