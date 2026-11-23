import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { RequestPage } from "@/modules/records/request-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("records.request"))("mobileTitle") }
}

/** Medical records · Request (inner page of Requests): `/records/requests/request?no=REQ-2611-014`. */
export default async function RecordsRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="requests">
      <Suspense>
        <RequestPage />
      </Suspense>
    </TabGuard>
  )
}
