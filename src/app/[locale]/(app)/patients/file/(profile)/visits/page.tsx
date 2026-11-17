import { setLocaleFrom } from "@/i18n/set-locale"
import { VisitsTab, TabLayout } from "@/modules/patients/profile/tabs"

/** Patients · Patient page · Visits. */
export default async function PatientVisitsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabLayout>
      <VisitsTab />
    </TabLayout>
  )
}
