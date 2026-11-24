import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { PrescriptionPage } from "@/modules/records/prescription"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("records.rx"))("mobileTitle") }
}

/** Medical records · New prescription (inner page of Visit notes › Visit note): `/records/notes/prescription?visit=V-2611-08412`. */
export default async function RecordsPrescriptionPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="notes">
      <Suspense>
        <PrescriptionPage />
      </Suspense>
    </TabGuard>
  )
}
