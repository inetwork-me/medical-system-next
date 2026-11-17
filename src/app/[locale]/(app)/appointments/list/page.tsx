import { getTranslations } from "next-intl/server"

import { AppointmentsList } from "@/modules/appointments/list/list"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.appointments"))("list") }
}

/** Appointments · List: today's appointments (KPIs, status chips, table / compact rows, row actions). */
export default function AppointmentsListPage() {
  return <AppointmentsList />
}
