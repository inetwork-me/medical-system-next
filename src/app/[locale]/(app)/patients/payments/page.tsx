import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { branchConfig } from "@/config/branches"
import { PatientsFrame } from "../patients-page"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.patients"))("payments") }
}

export default function PatientsPaymentsPage() {
  // Tab guard: hidden per branch → not reachable.
  if (branchConfig().hiddenTabs.includes("patients.payments")) notFound()
  return <PatientsFrame tab="payments" />
}
