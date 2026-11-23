import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { NewInvoicePage } from "@/modules/billing/new-invoice"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("billing.newInvoice"))("title") }
}

/** Billing · New invoice (by hand); part of the Invoices tab (off with it). */
export default async function BillingNewInvoicePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="invoices">
      <Suspense>
        <NewInvoicePage />
      </Suspense>
    </TabGuard>
  )
}
