import { setLocaleFrom } from "@/i18n/set-locale"

import { AccessTab } from "@/modules/records/tabs"
import { TabGuard, recordsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await recordsTitle("access") }
}

/** Medical records · Access log. */
export default async function RecordsAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="access">
      <AccessTab />
    </TabGuard>
  )
}
