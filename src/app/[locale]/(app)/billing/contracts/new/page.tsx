import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { NewContractPage } from "@/modules/billing/new-contract"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("billing.newContract"))("title") }
}

/** Billing · New contract (`?kind=staff|partner|insurer`); part of the Contracts tab (off with it). */
export default async function BillingNewContractPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="contracts">
      <Suspense>
        <NewContractPage />
      </Suspense>
    </TabGuard>
  )
}
