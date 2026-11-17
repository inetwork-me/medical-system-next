import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { isTabEnabled } from "@/lib/modules"
import { Dental3dWorkspace } from "@/modules/patients/specialties/dental-3d"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("specialties.ws"))("titleDental") }
}

/** Patients · Dental · 3D view workspace. Patient from `?id=`. Part of the patients.dental record tab. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isTabEnabled("patients", "dental")) notFound()
  return <Dental3dWorkspace />
}
