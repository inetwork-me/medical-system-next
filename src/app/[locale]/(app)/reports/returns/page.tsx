import { setLocaleFrom } from "@/i18n/set-locale"

import { ReturnsTab } from "@/modules/reports/tabs"
import { TabGuard, reportsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await reportsTitle("returns") }
}

/** Reports · Official returns. */
export default async function ReportsReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="returns">
      <ReturnsTab />
    </TabGuard>
  )
}
