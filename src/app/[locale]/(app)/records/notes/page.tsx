import { Suspense } from "react"
import { setLocaleFrom } from "@/i18n/set-locale"

import { NotesTab } from "@/modules/records/tabs"
import { TabGuard, recordsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await recordsTitle("notes") }
}

/** Medical records · Visit notes. */
export default async function RecordsNotesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="notes">
      <Suspense>
        <NotesTab />
      </Suspense>
    </TabGuard>
  )
}
