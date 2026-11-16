import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { branchConfig } from "@/config/branches"
import { PatientsFrame } from "../patients-page"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.patients"))("payments") }
}

/** Patients · payments tab — content arrives in a later Patients slice. */
export default function Page() {
  if (branchConfig().hiddenTabs.includes("patients.payments")) notFound()
  return (
    <Suspense>
      <PatientsFrame tab="payments" />
    </Suspense>
  )
}
