import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { VisitPage } from "@/modules/records/visit-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("records.visit"))("mobileTitle") }
}

/** Medical records · Visit (inner page of Visits): `/records/visits/visit?id=V-2611-08412`. */
export default async function RecordsVisitPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="visits">
      <Suspense>
        <VisitPage />
      </Suspense>
    </TabGuard>
  )
}
