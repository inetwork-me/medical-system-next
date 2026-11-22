import { setLocaleFrom } from "@/i18n/set-locale"

import { ContractsTab } from "@/modules/billing/tabs"
import { TabGuard, billingTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await billingTitle("contracts") }
}

/** Billing · Contracts. */
export default async function BillingContractsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="contracts">
      <ContractsTab />
    </TabGuard>
  )
}
