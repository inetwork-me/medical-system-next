import { setLocaleFrom } from "@/i18n/set-locale"
import { GeneralPage } from "@/modules/settings/general"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("general") }
}

/** Settings · General. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <GeneralPage />
}
