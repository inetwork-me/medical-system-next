import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { AppointmentsReportsIndex } from "@/modules/appointments/reports/reports"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.appointments"))("reports") }
}

/** Appointments · Reports tab: the module's six reports. */
export default async function AppointmentsReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <AppointmentsReportsIndex />
}
