import { setLocaleFrom } from "@/i18n/set-locale"

import { OverviewTab } from "@/modules/records/tabs"
import { TabGuard, recordsTitle } from "./tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await recordsTitle("overview") }
}

/** Medical records · Overview (module home). */
export default async function RecordsOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="overview">
      <OverviewTab />
    </TabGuard>
  )
}
