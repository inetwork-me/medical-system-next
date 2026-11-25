import { setLocaleFrom } from "@/i18n/set-locale"
import { AccountPage } from "@/modules/settings/account"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("account") }
}

/** Settings · My account (everyone). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <AccountPage />
}
