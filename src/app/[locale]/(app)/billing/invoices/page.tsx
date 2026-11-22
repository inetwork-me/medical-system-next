import { setLocaleFrom } from "@/i18n/set-locale"

import { InvoicesTab } from "@/modules/billing/tabs"
import { TabGuard, billingTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await billingTitle("invoices") }
}

/** Billing · Invoices. */
export default async function BillingInvoicesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="invoices">
      <InvoicesTab />
    </TabGuard>
  )
}
