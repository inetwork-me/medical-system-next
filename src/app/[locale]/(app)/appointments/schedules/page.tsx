import { getTranslations } from "next-intl/server"

import { DoctorSchedules } from "@/modules/appointments/schedules/schedules"

export async function generateMetadata() {
  return { title: (await getTranslations("shell.tabs.appointments"))("schedules") }
}

/** Appointments · Doctor schedules: weekly hours, today's load, time off. */
export default function SchedulesPage() {
  return <DoctorSchedules />
}
