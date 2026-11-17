import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { NewPatientWizard } from "@/modules/patients/new/wizard"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("patients.new"))("title") }
}

/** Patients · New patient (Step 1–4 + Duplicate found + Done). */
export default async function NewPatientPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <NewPatientWizard />
}
