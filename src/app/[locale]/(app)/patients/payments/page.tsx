import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { PaymentsKpis, TransactionsCard } from "@/modules/patients/payments/payments-tab"
import { PatientsFrame } from "../patients-page"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.patients"))("payments") }
}

/** Patients · Payments tab: KPIs + transactions (+ Receipt overlay). */
export default function PaymentsPage() {
  return (
    <Suspense>
      <PatientsFrame tab="payments">
        <PaymentsKpis />
        <TransactionsCard />
      </PatientsFrame>
    </Suspense>
  )
}
