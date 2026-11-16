import { getTranslations } from "next-intl/server"

import { PatientsFrame } from "../patients-page"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.patients"))("reports") }
}

export default function PatientsReportsPage() {
  return <PatientsFrame tab="reports" />
}
