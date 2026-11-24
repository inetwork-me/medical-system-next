import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { ReceptionPage } from "@/modules/records/reception"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("records.reception"))("pageTitle") }
}

/** Medical records · Visits · Reception list (inner page of Visits): `/records/visits/reception?task=…` (the latest when no id). */
export default async function RecordsReceptionPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="visits">
      <Suspense>
        <ReceptionPage />
      </Suspense>
    </TabGuard>
  )
}
