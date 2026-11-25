import { setLocaleFrom } from "@/i18n/set-locale"
import { IntegrationsPage } from "@/modules/settings/integrations"
import { settingsTitle } from "../title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("integrations") }
}

/** Settings · Integrations. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <IntegrationsPage />
}
