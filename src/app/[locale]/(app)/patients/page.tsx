import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { PatientsCharts, PatientsKpis } from "@/modules/patients/list/overview"
import { PatientsList } from "@/modules/patients/list/patients-list"
import { PatientsFrame } from "./patients-page"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.patients"))("list") }
}

/** Patients · Patients list (+ No results state, Filters panel, Row actions, Export, Patient sheet). */
export default function PatientsListPage() {
  return (
    <Suspense>
      <PatientsFrame tab="list">
        <PatientsKpis />
        <PatientsCharts />
        <PatientsList />
      </PatientsFrame>
    </Suspense>
  )
}
