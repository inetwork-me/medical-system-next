import { setLocaleFrom } from "@/i18n/set-locale"
import { MedicalTab, TabLayout } from "@/modules/patients/profile/tabs"

/** Patients · Patient page · Medical. */
export default async function PatientMedicalPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabLayout>
      <MedicalTab />
    </TabLayout>
  )
}
