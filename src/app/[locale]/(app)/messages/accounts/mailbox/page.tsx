import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { setLocaleFrom } from "@/i18n/set-locale"
import { MailboxPage } from "@/modules/messages/mailbox-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("messages"))("titles.mailbox") }
}

/** Mailbox access (inner page of Mail accounts): `/messages/accounts/mailbox?id=cardiology`; off with the Mail accounts tab. */
export default async function MessagesMailboxPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="accounts">
      <Suspense>
        <MailboxPage />
      </Suspense>
    </TabGuard>
  )
}
