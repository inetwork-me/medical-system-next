import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { InvoicePage } from "@/modules/billing/invoice-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("billing.invoice"))("taxInvoice") }
}

/** Billing · Invoice page (`?no=INV-2611-0241`); part of the Invoices tab (off with it). */
export default async function BillingInvoicePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="invoices">
      <Suspense>
        <InvoicePage />
      </Suspense>
    </TabGuard>
  )
}
