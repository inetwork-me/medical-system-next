import { getTranslations } from "next-intl/server"

import { PatientsFrame } from "./patients-page"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.patients"))("list") }
}

export default function PatientsListPage() {
  return <PatientsFrame tab="list" />
}
