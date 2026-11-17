import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { DoctorSchedules } from "@/modules/appointments/schedules/schedules"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.tabs.appointments"))("schedules") }
}

/** Appointments · Doctor schedules: weekly hours, today's load, time off. */
export default async function SchedulesPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return <DoctorSchedules />
}
