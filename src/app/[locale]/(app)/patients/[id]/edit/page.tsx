import { getLocale, getTranslations } from "next-intl/server"

import { bi } from "@/lib/mock/bi"
import { patientById } from "@/modules/patients/data"
import { EditPatient } from "@/modules/patients/edit/edit-page"

export async function generateMetadata({ params }: PageProps<"/[locale]/patients/[id]/edit">) {
  const { id } = await params
  const p = patientById(id)
  const t = await getTranslations("patients.edit")
  return { title: p ? `${t("title")} · ${bi(p.name, await getLocale())}` : t("title") }
}

/** Patients · Patient edit (+ Errors state, Unsaved-changes dialog). */
export default function PatientEditPage() {
  return <EditPatient />
}
