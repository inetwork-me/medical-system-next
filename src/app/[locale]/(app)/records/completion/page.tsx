import { setLocaleFrom } from "@/i18n/set-locale"

import { CompletionTab } from "@/modules/records/tabs"
import { TabGuard, recordsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await recordsTitle("completion") }
}

/** Medical records · Chart completion. */
export default async function RecordsCompletionPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="completion">
      <CompletionTab />
    </TabGuard>
  )
}
