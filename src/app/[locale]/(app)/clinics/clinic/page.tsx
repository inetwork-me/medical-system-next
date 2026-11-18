import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { ClinicOverview } from "@/modules/clinics/clinic/overview"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("clinics") }
}

/** Clinic page · Overview. */
export default async function ClinicOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <ClinicOverview />
}
