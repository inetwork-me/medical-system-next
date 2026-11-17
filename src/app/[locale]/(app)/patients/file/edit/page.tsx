import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { EditPatient } from "@/modules/patients/edit/edit-page"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("patients.edit"))("title") }
}

/** Patients · Patient edit (+ Errors state, Unsaved-changes dialog) for `?id=`. */
export default async function PatientEditPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <EditPatient />
}
