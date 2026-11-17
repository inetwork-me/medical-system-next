import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { CalendarPage } from "@/modules/appointments/calendar/calendar-page"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("appointments") }
}

/** Appointments · Calendar · Day / Week / Month (?view=, ?date=). */
export default async function AppointmentsCalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <CalendarPage />
    </Suspense>
  )
}
