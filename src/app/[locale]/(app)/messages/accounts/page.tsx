import { setLocaleFrom } from "@/i18n/set-locale"

import { MsgTabPage } from "@/modules/messages/tabs"
import { TabGuard, messagesTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await messagesTitle("accounts") }
}

/** Messages · Mail accounts (admin). */
export default async function MessagesAccountsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="accounts">
      <MsgTabPage tab="accounts" />
    </TabGuard>
  )
}
