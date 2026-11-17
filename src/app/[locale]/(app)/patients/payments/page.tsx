import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { PaymentsKpis, TransactionsCard } from "@/modules/patients/payments/payments-tab"
import { PatientsFrame } from "../patients-page"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.patients"))("payments") }
}

/** Patients · Payments tab: KPIs + transactions (+ Receipt overlay). */
export default async function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <PatientsFrame tab="payments">
        <PaymentsKpis />
        <TransactionsCard />
      </PatientsFrame>
    </Suspense>
  )
}
