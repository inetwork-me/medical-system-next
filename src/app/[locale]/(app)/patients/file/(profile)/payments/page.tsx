import { setLocaleFrom } from "@/i18n/set-locale"
import { PaymentsTab, TabLayout } from "@/modules/patients/profile/tabs"

/** Patients · Patient page · Payments. */
export default async function PatientPaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabLayout>
      <PaymentsTab />
    </TabLayout>
  )
}
