import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { PatientFrame } from "@/modules/patients/profile/frame"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("patients.page"))("title") }
}

/** Patient page (Overview + Visits / Payments / Medical / Eyes / Dental / Files / Activity tabs) for `?id=`. Edit lives outside this frame. */
export default async function PatientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <PatientFrame>{children}</PatientFrame>
}
