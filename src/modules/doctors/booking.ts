"use client"

import { isModuleEnabled } from "@/lib/modules"
import type { ClinicLimits } from "@/modules/appointments/data"
import { shiftRange } from "@/modules/clinics/booking"
import { useClinicLimits } from "@/modules/clinics/booking"
import { useClinics } from "@/modules/clinics/store"
import { APPT_DOCTOR_KEY, WEEKDAYS, isBlocked, type Doctor, type Leave } from "./data"
import { useDoctors, useLeaves } from "./store"

const mins = (hhmm: string) => shiftRange(`${hhmm}–${hhmm}`)[0]

/** Approved leave that covers a day. */
export const leaveOn = (leaves: Leave[], doctor: string, date: string) =>
  leaves.find((l) => l.doctor === doctor && l.status === "approved" && l.from <= date && l.to >= date)

/**
 * A doctor's booking limits for a day, from the Doctors module: closed when deactivated, a required credential has
 * expired, on approved leave, the clinic is closed, or it's their day off; otherwise slots inside their own shifts
 * (in-clinic shifts clipped to the clinic's hours; telehealth shifts only while telehealth visits are on), every
 * visit length + clinic gap, at most "Max per day".
 */
export function doctorDayLimits(
  d: Doctor,
  date: string,
  clinic: { closed: boolean; from?: number; to?: number } | null,
  rules: { slotMin: number; gapMin: number } | null,
  leaves: Leave[]
): ClinicLimits {
  if (!d.active || isBlocked(d) || leaveOn(leaves, d.key, date) || clinic?.closed) return { closed: true }
  const shifts = d.week[WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]].filter((s) => !s.telehealth || d.booking.telehealth)
  const ranges = shifts
    .map((s): [number, number] => {
      const [a, z] = [mins(s.from), mins(s.to)]
      return s.telehealth || !clinic || clinic.from === undefined || clinic.to === undefined ? [a, z] : [Math.max(a, clinic.from), Math.min(z, clinic.to)]
    })
    .filter(([a, z]) => z > a)
  if (!ranges.length) return { closed: true }
  const step = (d.booking.visitMin ?? rules?.slotMin ?? 15) + (rules?.gapMin ?? 5)
  return {
    closed: false,
    own: true,
    from: Math.min(...ranges.map((r) => r[0])),
    to: Math.max(...ranges.map((r) => r[1])),
    step,
    ranges,
    max: d.booking.maxPerDay,
  }
}

/**
 * For Appointments: the slot limits for one of its doctors on a date. With Doctors on, the doctor's own hours and
 * booking settings decide (inside the clinic's limits); with Doctors hidden for the branch, only the clinic's limits.
 */
export function useBookingLimits(): (apptDoctor: string, date: string) => ClinicLimits | null {
  const clinicLimits = useClinicLimits()
  const doctors = useDoctors()
  const leaves = useLeaves()
  const clinics = useClinics()
  const on = isModuleEnabled("doctors")
  return (apptDoctor, date) => {
    const cl = clinicLimits(apptDoctor, date)
    const d = on ? doctors.find((x) => x.key === APPT_DOCTOR_KEY[apptDoctor as keyof typeof APPT_DOCTOR_KEY]) : undefined
    if (!d) return cl
    const c = clinics.find((x) => x.key === d.clinic)
    return doctorDayLimits(d, date, cl, c && isModuleEnabled("clinics") ? c.rules : null, leaves)
  }
}
