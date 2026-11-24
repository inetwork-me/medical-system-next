import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { ReportPage } from "@/modules/reports/report-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("reports.viewer"))("mobileTitle") }
}

/** Reports · Report (inner page of Library): `/reports/library/report?id=no-shows-by-clinic`. */
export default async function ReportsReportPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="library">
      <Suspense>
        <ReportPage />
      </Suspense>
    </TabGuard>
  )
}
