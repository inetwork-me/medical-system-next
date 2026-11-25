import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { setLocaleFrom } from "@/i18n/set-locale"
import { PatientThreadPage } from "@/modules/messages/patient-thread-page"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("messages"))("titles.patientThread") }
}

/** Patient conversation (inner page of Patient messages): `/messages/patients/conversation?id=pt-reem`; off with the tab. */
export default async function MessagesPatientThreadPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="patients">
      <Suspense>
        <PatientThreadPage />
      </Suspense>
    </TabGuard>
  )
}
