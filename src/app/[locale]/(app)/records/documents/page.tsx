import { setLocaleFrom } from "@/i18n/set-locale"

import { DocumentsTab } from "@/modules/records/tabs"
import { TabGuard, recordsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await recordsTitle("documents") }
}

/** Medical records · Documents. */
export default async function RecordsDocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="documents">
      <DocumentsTab />
    </TabGuard>
  )
}
