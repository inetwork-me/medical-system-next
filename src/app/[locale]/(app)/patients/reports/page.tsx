import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { ReportsIndex } from "@/modules/patients/reports/bodies"
import { PatientsFrame } from "../patients-page"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.patients"))("reports") }
}

/** Patients · Reports tab: the module's six reports. */
export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <PatientsFrame tab="reports">
        <ReportsIndex />
      </PatientsFrame>
    </Suspense>
  )
}
