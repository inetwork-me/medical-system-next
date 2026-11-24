import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { ReturnPage } from "@/modules/reports/returns"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.reports"))("returns") }
}

/** Reports · Return (inner page of Official returns): `/reports/returns/return?id=moh-monthly-2611`. */
export default async function ReportsReturnPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="returns">
      <Suspense>
        <ReturnPage />
      </Suspense>
    </TabGuard>
  )
}
