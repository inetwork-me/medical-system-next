import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { ClinicsList } from "@/modules/clinics/list/list"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("clinics") }
}

/** Clinics · Clinics: KPIs, filters and the clinic cards. */
export default async function ClinicsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <ClinicsList />
}
