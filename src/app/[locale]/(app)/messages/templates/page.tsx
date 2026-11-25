import { setLocaleFrom } from "@/i18n/set-locale"

import { MsgTabPage } from "@/modules/messages/tabs"
import { TabGuard, messagesTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await messagesTitle("templates") }
}

/** Messages · Templates. */
export default async function MessagesTemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="templates">
      <MsgTabPage tab="templates" />
    </TabGuard>
  )
}
