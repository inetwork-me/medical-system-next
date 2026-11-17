import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { AppointmentsList } from "@/modules/appointments/list/list"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.appointments"))("list") }
}

/** Appointments · List: today's appointments (KPIs, status chips, table / compact rows, row actions). */
export default async function AppointmentsListPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <AppointmentsList />
}
