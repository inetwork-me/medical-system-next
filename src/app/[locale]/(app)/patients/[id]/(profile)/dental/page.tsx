import { notFound } from "next/navigation"

import { isTabEnabled } from "@/lib/modules"
import { TabLayout } from "@/modules/patients/profile/tabs"
import { DentalTab } from "@/modules/patients/specialties/dental-tab"

/** Patients · Patient page · Dental (a record tab the branch can switch off: patients.dental). */
export default function PatientDentalPage() {
  if (!isTabEnabled("patients", "dental")) notFound()
  return (
    <TabLayout>
      <DentalTab />
    </TabLayout>
  )
}
