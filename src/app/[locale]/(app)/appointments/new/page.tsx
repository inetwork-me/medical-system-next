import { getTranslations } from "next-intl/server"

import { NewAppointment } from "@/modules/appointments/new/new-appointment"

export async function generateMetadata() {
  return { title: (await getTranslations("appointments"))("newAppointment") }
}

/** Appointments · New appointment (+ Conflict). Optional ?patient=MRN&doctor=az&date=2026-11-18 prefill the form. */
export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ patient?: string; doctor?: string; date?: string }> }) {
  const sp = await searchParams
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined
  return <NewAppointment initial={{ patient: sp.patient, doctor: sp.doctor, date }} />
}
