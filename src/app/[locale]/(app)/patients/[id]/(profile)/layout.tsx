import { getLocale, getTranslations } from "next-intl/server"

import { bi } from "@/lib/mock/bi"
import { patientById } from "@/modules/patients/data"
import { PatientFrame } from "@/modules/patients/profile/frame"

export async function generateMetadata({ params }: LayoutProps<"/[locale]/patients/[id]">) {
  const { id } = await params
  const p = patientById(id)
  const t = await getTranslations("patients.page")
  return { title: p ? `${bi(p.name, await getLocale())} · ${t("title")}` : t("notFoundTitle") }
}

/** Patient page (Overview + Visits / Payments / Medical / Files / Activity tabs). Edit lives outside this frame. */
export default function PatientLayout({ children }: LayoutProps<"/[locale]/patients/[id]">) {
  return <PatientFrame>{children}</PatientFrame>
}
