import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { ClinicSettingsPage } from "@/modules/clinics/settings"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("clinics.page.tabs"))("settings") }
}

/** Clinic page · Settings (basics, location, booking, specialty tools, pause / archive). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <ClinicSettingsPage />
}
