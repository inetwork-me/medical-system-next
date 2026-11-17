import { setLocaleFrom } from "@/i18n/set-locale"
import { ActivityTab, TabLayout } from "@/modules/patients/profile/tabs"

/** Patients · Patient page · Activity. */
export default async function PatientActivityPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabLayout>
      <ActivityTab />
    </TabLayout>
  )
}
