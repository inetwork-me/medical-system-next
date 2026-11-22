import { Suspense } from "react"
import { setLocaleFrom } from "@/i18n/set-locale"

import { ClaimsTab } from "@/modules/billing/tabs"
import { TabGuard, billingTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await billingTitle("claims") }
}

/** Billing · Claims. */
export default async function BillingClaimsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="claims">
      <Suspense>
        <ClaimsTab />
      </Suspense>
    </TabGuard>
  )
}
