import { setLocaleFrom } from "@/i18n/set-locale"

import { SettingsOverview } from "@/modules/settings/overview"
import { settingsTitle } from "./title"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await settingsTitle("overview") }
}

/** Settings · Overview (the Settings home on mobile). */
export default async function SettingsOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <SettingsOverview />
}
