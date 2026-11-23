import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { DocumentPage } from "@/modules/records/document-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("records.kind"))("report") }
}

/** Medical records · Medical report and the other documents (inner page of Documents): `/records/documents/report?no=MR-2611-0057`. */
export default async function RecordsReportPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="documents">
      <Suspense>
        <DocumentPage />
      </Suspense>
    </TabGuard>
  )
}
