import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { PatientsFrame } from "../patients-page"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.patients"))("reports") }
}

/** Patients · reports tab — content arrives in a later Patients slice. */
export default function Page() {

  return (
    <Suspense>
      <PatientsFrame tab="reports" />
    </Suspense>
  )
}
