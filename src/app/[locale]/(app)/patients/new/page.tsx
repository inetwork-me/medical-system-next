import { getTranslations } from "next-intl/server"

import { NewPatientWizard } from "@/modules/patients/new/wizard"

export async function generateMetadata() {
  return { title: (await getTranslations("patients.new"))("title") }
}

/** Patients · New patient (Step 1–4 + Duplicate found + Done). */
export default function NewPatientPage() {
  return <NewPatientWizard />
}
