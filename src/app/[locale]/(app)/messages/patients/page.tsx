import { setLocaleFrom } from "@/i18n/set-locale"

import { MsgTabPage } from "@/modules/messages/tabs"
import { TabGuard, messagesTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await messagesTitle("patients") }
}

/** Messages · Patient messages. */
export default async function MessagesPatientsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="patients">
      <MsgTabPage tab="patients" />
    </TabGuard>
  )
}
