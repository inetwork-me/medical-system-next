import { setLocaleFrom } from "@/i18n/set-locale"
import { notFound } from "next/navigation"

import { isTabEnabled } from "@/lib/modules"
import { TabLayout } from "@/modules/patients/profile/tabs"
import { EyesTab } from "@/modules/patients/specialties/eyes-tab"

/** Patients · Patient page · Eyes (a record tab the branch can switch off: patients.eyes). */
export default async function PatientEyesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isTabEnabled("patients", "eyes")) notFound()
  return (
    <TabLayout>
      <EyesTab />
    </TabLayout>
  )
}
