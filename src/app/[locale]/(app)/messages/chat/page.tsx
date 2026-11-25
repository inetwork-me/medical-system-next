import { setLocaleFrom } from "@/i18n/set-locale"

import { MsgTabPage } from "@/modules/messages/tabs"
import { TabGuard, messagesTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await messagesTitle("chat") }
}

/** Messages · Chat. */
export default async function MessagesChatPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="chat">
      <MsgTabPage tab="chat" />
    </TabGuard>
  )
}
