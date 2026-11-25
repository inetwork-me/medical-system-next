import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { setLocaleFrom } from "@/i18n/set-locale"
import { ComposePage } from "@/modules/messages/compose"
import { TabGuard } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("messages"))("titles.compose") }
}

/** New message (inner page of Inbox): `/messages/new` (`?draft=`, `?forward=`, `?to=`, `?partner=`); off with the Inbox tab. */
export default async function MessagesComposePage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="inbox">
      <Suspense>
        <ComposePage />
      </Suspense>
    </TabGuard>
  )
}
