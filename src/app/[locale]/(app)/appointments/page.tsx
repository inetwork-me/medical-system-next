import { getTranslations } from "next-intl/server"

import { CalendarScreen } from "@/modules/appointments/calendar/calendar"
import { parseCalendarParams } from "@/modules/appointments/calendar/params"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.nav"))("appointments") }
}

/** Appointments · Calendar · Day / Week / Month (?view=, ?date=). */
export default async function AppointmentsCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const { view, date } = parseCalendarParams(await searchParams)
  return <CalendarScreen key={`${view}-${date}`} initialView={view} initialDate={date} />
}
