import { setLocaleFrom } from "@/i18n/set-locale"
import { ZatcaPage } from "@/modules/settings/zatca-page"
import { settingsTitle } from "../../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("zatca") }
}

/** Settings · Integration · ZATCA (inner page of Integrations). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <ZatcaPage />
}
