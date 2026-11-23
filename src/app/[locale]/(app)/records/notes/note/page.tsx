import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { VisitNotePage } from "@/modules/records/note-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("records.note"))("mobileTitle") }
}

/** Medical records · Visit note (inner page of Visit notes): `/records/notes/note?id=VN-2611-2041`. */
export default async function RecordsVisitNotePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="notes">
      <Suspense>
        <VisitNotePage />
      </Suspense>
    </TabGuard>
  )
}
