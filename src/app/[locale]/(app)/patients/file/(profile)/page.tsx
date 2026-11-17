import { setLocaleFrom } from "@/i18n/set-locale"
import { OverviewLayout } from "@/modules/patients/profile/overview"

/** Patients · Patient page (Overview). */
export default async function PatientOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <OverviewLayout />
}
