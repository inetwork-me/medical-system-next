import { setLocaleFrom } from "@/i18n/set-locale"

import { RequestsTab } from "@/modules/records/tabs"
import { TabGuard, recordsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await recordsTitle("requests") }
}

/** Medical records · Requests for records. */
export default async function RecordsRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="requests">
      <RequestsTab />
    </TabGuard>
  )
}
