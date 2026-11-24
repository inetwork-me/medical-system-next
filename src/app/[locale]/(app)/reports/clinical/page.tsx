import { setLocaleFrom } from "@/i18n/set-locale"

import { DashboardTab } from "@/modules/reports/tabs"
import { TabGuard, reportsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await reportsTitle("clinical") }
}

/** Reports · Clinical dashboard. */
export default async function ReportsClinicalPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="clinical">
      <DashboardTab tab="clinical" />
    </TabGuard>
  )
}
