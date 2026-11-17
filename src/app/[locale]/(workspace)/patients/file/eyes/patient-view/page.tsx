import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { isTabEnabled } from "@/lib/modules"
import { EyePatientView } from "@/modules/patients/specialties/patient-view"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("specialties.pv"))("title") }
}

/** Patients · Eye · Patient view (education, full screen). Patient from `?id=`. Part of the patients.eyes record tab. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isTabEnabled("patients", "eyes")) notFound()
  return <EyePatientView />
}
