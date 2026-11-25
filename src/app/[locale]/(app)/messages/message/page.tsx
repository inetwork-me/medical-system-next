import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { setLocaleFrom } from "@/i18n/set-locale"
import { MessagePage } from "@/modules/messages/message-page"
import { TabGuard } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("messages"))("titles.message") }
}

/** Message (inner page of Inbox): `/messages/message?id=t-bupa-holter`; off with the Inbox tab. */
export default async function MessagesMessagePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="inbox">
      <Suspense>
        <MessagePage />
      </Suspense>
    </TabGuard>
  )
}
