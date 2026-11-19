import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { DoctorSettings } from "@/modules/doctors/doctor/settings"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("doctors") }
}

/** Doctor page · Settings. */
export default async function DoctorSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <DoctorSettings />
}
