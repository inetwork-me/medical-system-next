"use client"

import { isModuleEnabled } from "@/lib/modules"
import { APPT_DOCTOR_CLINIC, CLINICS_TODAY, WEEKDAYS, isSettingUp, type Clinic } from "./data"
import { useClinics } from "./store"

/** "08:00–14:00" → [480, 840] */
export const shiftRange = (s: string) => s.split("–").map((x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5))) as [number, number]

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** What a clinic allows on a day: closed, or open between from–to (minutes), slots every `step` minutes. */
export type ClinicDayLimits = { closed: true; why: "dayOff" | "holiday" | "paused" | "tooFar" | "setup" | "archived" } | { closed: false; from: number; to: number; step: number }

/**
 * A clinic's booking limits for a date, from its Schedule tab: day switch and shifts (the outer bounds of the day),
 * closures (a holiday blocks the day, a half day opens at 12:00), "Book up to N days ahead", a pause, and the visit
 * length + gap as the slot step.
 */
export function clinicDayLimits(c: Clinic, date: string, today = CLINICS_TODAY): ClinicDayLimits {
  if (c.archived) return { closed: true, why: "archived" }
  if (isSettingUp(c)) return { closed: true, why: "setup" }
  if (c.pausedUntil && date < c.pausedUntil && (c.pausedFrom ? date >= c.pausedFrom : c.status === "paused")) return { closed: true, why: "paused" }
  if (date > addDays(today, c.rules.maxDaysAhead)) return { closed: true, why: "tooFar" }
  const closure = c.closures.find((x) => x.date === date)
  if (closure?.kind === "holiday") return { closed: true, why: "holiday" }
  const shifts = c.hours[WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]] ?? []
  if (!shifts.length) return { closed: true, why: "dayOff" }
  const ranges = shifts.map(shiftRange)
  const from = Math.max(Math.min(...ranges.map((r) => r[0])), closure?.kind === "halfDay" ? 12 * 60 : 0)
  return { closed: false, from, to: Math.max(...ranges.map((r) => r[1])), step: c.rules.slotMin + c.rules.gapMin }
}

/**
 * For Appointments: the limits of an Appointments doctor's clinic on a date, or null when the doctor has no clinic
 * here or the Clinics module is off for the branch (Appointments then uses the doctor's own schedule only).
 */
export function useClinicLimits(): (doctor: string, date: string) => ClinicDayLimits | null {
  const clinics = useClinics()
  const on = isModuleEnabled("clinics")
  return (doctor, date) => {
    if (!on) return null
    const c = clinics.find((x) => x.key === APPT_DOCTOR_CLINIC[doctor])
    return c ? clinicDayLimits(c, date) : null
  }
}
