import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { ReportsIndex } from "@/modules/patients/reports/bodies"
import { PatientsFrame } from "../patients-page"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.patients"))("reports") }
}

/** Patients · Reports tab: the module's six reports. */
export default function ReportsPage() {
  return (
    <Suspense>
      <PatientsFrame tab="reports">
        <ReportsIndex />
      </PatientsFrame>
    </Suspense>
  )
}
