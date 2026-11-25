import { setLocaleFrom } from "@/i18n/set-locale"
import { NumberingPage } from "@/modules/settings/numbering"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("numbering") }
}

/** Settings · Numbering and formats. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <NumberingPage />
}
