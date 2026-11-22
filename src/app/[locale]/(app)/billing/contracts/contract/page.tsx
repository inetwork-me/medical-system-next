import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { ContractPage } from "@/modules/billing/contract-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.billing"))("contracts") }
}

/** Billing · Contract page (`?no=CTR-26-031`); part of the Contracts tab (off with it). */
export default async function BillingContractPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="contracts">
      <Suspense>
        <ContractPage />
      </Suspense>
    </TabGuard>
  )
}
