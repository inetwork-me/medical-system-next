import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { isTabEnabled } from "@/lib/modules"
import { DentalChartWorkspace } from "@/modules/patients/specialties/dental-chart"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("specialties.ws"))("titleDental") }
}

/** Patients · Dental chart workspace (?tooth=36 opens that tooth). Patient from `?id=`. Part of the patients.dental record tab. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isTabEnabled("patients", "dental")) notFound()
  return <DentalChartWorkspace />
}
