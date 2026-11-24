import { setLocaleFrom } from "@/i18n/set-locale"

import { OverviewTab } from "@/modules/reports/tabs"
import { TabGuard, reportsTitle } from "./tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await reportsTitle("overview") }
}

/** Reports · Overview (module home). */
export default async function ReportsOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="overview">
      <OverviewTab />
    </TabGuard>
  )
}
