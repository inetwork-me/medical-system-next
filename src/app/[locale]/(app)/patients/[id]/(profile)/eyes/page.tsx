import { notFound } from "next/navigation"

import { isTabEnabled } from "@/lib/modules"
import { TabLayout } from "@/modules/patients/profile/tabs"
import { EyesTab } from "@/modules/patients/specialties/eyes-tab"

/** Patients · Patient page · Eyes (a record tab the branch can switch off: patients.eyes). */
export default function PatientEyesPage() {
  if (!isTabEnabled("patients", "eyes")) notFound()
  return (
    <TabLayout>
      <EyesTab />
    </TabLayout>
  )
}
