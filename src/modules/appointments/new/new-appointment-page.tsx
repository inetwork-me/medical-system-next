"use client"

import { useSearchParams } from "next/navigation"

import { NewAppointment } from "./new-appointment"

/** New appointment route: ?patient=MRN&doctor=az&date=2026-11-18 prefill the form (read in the browser). */
export function NewAppointmentPage() {
  const sp = useSearchParams()
  const date = sp.get("date")
  return (
    <NewAppointment
      initial={{ patient: sp.get("patient") ?? undefined, doctor: sp.get("doctor") ?? undefined, date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined }}
    />
  )
}
