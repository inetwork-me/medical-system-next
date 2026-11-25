import { setLocaleFrom } from "@/i18n/set-locale"
import { NotificationsPage } from "@/modules/settings/notifications"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("notifications") }
}

/** Settings · Notification rules. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <NotificationsPage />
}
