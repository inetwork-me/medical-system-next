import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { PatientsCharts, PatientsKpis } from "@/modules/patients/list/overview"
import { PatientsList } from "@/modules/patients/list/patients-list"
import { PatientsFrame } from "./patients-page"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.patients"))("list") }
}

/** Patients · Patients list (+ No results state, Filters panel, Row actions, Export, Patient sheet). */
export default async function PatientsListPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
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
