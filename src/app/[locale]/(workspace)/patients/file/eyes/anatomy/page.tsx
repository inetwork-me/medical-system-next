import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { isTabEnabled } from "@/lib/modules"
import { EyeAnatomyWorkspace } from "@/modules/patients/specialties/eye-ws"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("specialties.ws"))("titleEye") }
}

/** Patients · Eye movement exam · Anatomy. Patient from `?id=`. Part of the patients.eyes record tab. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isTabEnabled("patients", "eyes")) notFound()
  return <EyeAnatomyWorkspace />
}
