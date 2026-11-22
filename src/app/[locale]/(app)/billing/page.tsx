import { setLocaleFrom } from "@/i18n/set-locale"

import { OverviewTab } from "@/modules/billing/tabs"
import { TabGuard, billingTitle } from "./tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await billingTitle("overview") }
}

/** Billing · Overview (module home). */
export default async function BillingOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="overview">
      <OverviewTab />
    </TabGuard>
  )
}
