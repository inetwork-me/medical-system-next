import { setLocaleFrom } from "@/i18n/set-locale"

import { DashboardTab } from "@/modules/reports/tabs"
import { TabGuard, reportsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await reportsTitle("doctors") }
}

/** Reports · Doctors dashboard. */
export default async function ReportsDoctorsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="doctors">
      <DashboardTab tab="doctors" />
    </TabGuard>
  )
}
