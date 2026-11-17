import { setLocaleFrom } from "@/i18n/set-locale"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { NewAppointmentPage } from "@/modules/appointments/new/new-appointment-page"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("appointments"))("newAppointment") }
}

/** Appointments · New appointment (+ Conflict). Optional ?patient=MRN&doctor=az&date=2026-11-18 prefill the form. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <Suspense>
      <NewAppointmentPage />
    </Suspense>
  )
}
