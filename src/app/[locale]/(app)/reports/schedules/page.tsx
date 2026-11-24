import { setLocaleFrom } from "@/i18n/set-locale"

import { SchedulesTab } from "@/modules/reports/tabs"
import { TabGuard, reportsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await reportsTitle("schedules") }
}

/** Reports · Schedules. */
export default async function ReportsSchedulesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="schedules">
      <SchedulesTab />
    </TabGuard>
  )
}
