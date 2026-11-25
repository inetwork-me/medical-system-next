import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { setLocaleFrom } from "@/i18n/set-locale"
import { ConversationPage } from "@/modules/messages/conversation-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("messages"))("titles.conversation") }
}

/** Chat · Conversation (inner page of Chat): `/messages/chat/conversation?id=cardiology-team`; off with the Chat tab. */
export default async function MessagesConversationPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="chat">
      <Suspense>
        <ConversationPage />
      </Suspense>
    </TabGuard>
  )
}
