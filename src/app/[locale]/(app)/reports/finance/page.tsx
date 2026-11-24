import { setLocaleFrom } from "@/i18n/set-locale"

import { DashboardTab } from "@/modules/reports/tabs"
import { TabGuard, reportsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await reportsTitle("finance") }
}

/** Reports · Finance dashboard. */
export default async function ReportsFinancePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="finance">
      <DashboardTab tab="finance" />
    </TabGuard>
  )
}
