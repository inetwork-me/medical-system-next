import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { isTabEnabled } from "@/lib/modules"
import { PlanWorkspace } from "@/modules/patients/specialties/plan-ws"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("specialties.ws"))("titleDental") }
}

/** Patients · Dental · Treatment plan workspace. Patient from `?id=`. Part of the patients.dental record tab. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isTabEnabled("patients", "dental")) notFound()
  return <PlanWorkspace />
}
