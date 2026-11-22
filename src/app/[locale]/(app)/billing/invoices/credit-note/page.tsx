import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { CreditNotePage } from "@/modules/billing/credit-note"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("billing.creditNote"))("paper") }
}

/** Billing · Credit note page (`?no=CN-2611-0012`); part of the Invoices tab (off with it). */
export default async function BillingCreditNotePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="invoices">
      <Suspense>
        <CreditNotePage />
      </Suspense>
    </TabGuard>
  )
}
