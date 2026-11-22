import { setLocaleFrom } from "@/i18n/set-locale"

import { InsurersTab } from "@/modules/billing/tabs"
import { TabGuard, billingTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await billingTitle("insurers") }
}

/** Billing · Insurers. */
export default async function BillingInsurersPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="insurers">
      <InsurersTab />
    </TabGuard>
  )
}
