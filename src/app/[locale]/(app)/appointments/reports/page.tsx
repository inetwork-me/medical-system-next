import { getTranslations } from "next-intl/server"

import { AppointmentsReportsIndex } from "@/modules/appointments/reports/reports"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.appointments"))("reports") }
}

/** Appointments · Reports tab: the module's six reports. */
export default function AppointmentsReportsPage() {
  return <AppointmentsReportsIndex />
}
