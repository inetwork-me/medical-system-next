import { setLocaleFrom } from "@/i18n/set-locale"
import { FilesTab, TabLayout } from "@/modules/patients/profile/tabs"

/** Patients · Patient page · Files. */
export default async function PatientFilesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabLayout>
      <FilesTab />
    </TabLayout>
  )
}
