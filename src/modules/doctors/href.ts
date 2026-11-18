import { APPT_DOCTOR_KEY } from "./data"

/** Doctor page tabs (route segment under /doctors/doctor). */
export const DOCTOR_TABS = ["overview", "schedule", "patients", "performance", "credentials", "settings"] as const
export type DoctorTab = (typeof DOCTOR_TABS)[number]

/** Doctor page URL: /doctors/doctor[/tab]?id=<key> — the doctor travels in the query so the pages stay static. */
export function doctorHref(key: string, tab?: DoctorTab, query?: Record<string, string>) {
  const q = new URLSearchParams({ id: key, ...query })
  return `/doctors/doctor${tab && tab !== "overview" ? `/${tab}` : ""}?${q}`
}

/** Book / Book visit → Appointments · New appointment, with the doctor preselected when Appointments knows them. */
export function bookHref(key: string) {
  const id = Object.entries(APPT_DOCTOR_KEY).find(([, k]) => k === key)?.[0]
  return id ? `/appointments/new?doctor=${id}` : "/appointments/new"
}
