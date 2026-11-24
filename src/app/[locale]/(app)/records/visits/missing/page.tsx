import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { MissingPage } from "@/modules/records/missing"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("records.missingView"))("title.nationality") }
}

/**
 * Medical records · Visits with missing data (inner page of Visits), where a return's check lands:
 * `/records/visits/missing?rule=nationality&period=2026-11&branch=riyadh-main&from=moh-monthly-2611`.
 */
export default async function RecordsMissingPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="visits">
      <Suspense>
        <MissingPage />
      </Suspense>
    </TabGuard>
  )
}
