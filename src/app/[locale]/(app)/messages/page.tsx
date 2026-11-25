import { setLocaleFrom } from "@/i18n/set-locale"

import { InboxTab } from "@/modules/messages/tabs"
import { TabGuard, messagesTitle } from "./tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await messagesTitle("inbox") }
}

/** Messages · Inbox (module home). */
export default async function MessagesInboxPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="inbox">
      <InboxTab />
    </TabGuard>
  )
}
