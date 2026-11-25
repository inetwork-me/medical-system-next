import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { setLocaleFrom } from "@/i18n/set-locale"
import { PartnerPage } from "@/modules/messages/partner-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("messages"))("titles.partner") }
}

/** Partner (inner page of Partners): `/messages/partners/partner?id=bupa`; off with the Partners tab. */
export default async function MessagesPartnerPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="partners">
      <Suspense>
        <PartnerPage />
      </Suspense>
    </TabGuard>
  )
}
