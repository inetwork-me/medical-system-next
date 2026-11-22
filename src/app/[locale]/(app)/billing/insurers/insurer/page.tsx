import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { InsurerPage } from "@/modules/billing/insurer-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.billing"))("insurers") }
}

/** Billing · Insurer page (`?id=bupa`); part of the Insurers tab (off with it). */
export default async function BillingInsurerPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="insurers">
      <Suspense>
        <InsurerPage />
      </Suspense>
    </TabGuard>
  )
}
