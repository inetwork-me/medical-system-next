import { setLocaleFrom } from "@/i18n/set-locale"

import { DashboardTab } from "@/modules/reports/tabs"
import { TabGuard, reportsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await reportsTitle("operations") }
}

/** Reports · Operations dashboard. */
export default async function ReportsOperationsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="operations">
      <DashboardTab tab="operations" />
    </TabGuard>
  )
}
