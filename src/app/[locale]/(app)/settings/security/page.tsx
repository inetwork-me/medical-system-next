import { setLocaleFrom } from "@/i18n/set-locale"
import { SecurityPage } from "@/modules/settings/security"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("security") }
}

/** Settings · Security. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <SecurityPage />
}
