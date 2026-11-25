import { setLocaleFrom } from "@/i18n/set-locale"

import { MsgTabPage } from "@/modules/messages/tabs"
import { TabGuard, messagesTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await messagesTitle("partners") }
}

/** Messages · Partners. */
export default async function MessagesPartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="partners">
      <MsgTabPage tab="partners" />
    </TabGuard>
  )
}
