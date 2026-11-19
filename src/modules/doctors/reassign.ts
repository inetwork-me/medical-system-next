import { daysIn, daysUntil, employedOn, weekdayOf, type Doctor, type Leave, type Shift } from "./data"

/**
 * Coverage maths for the "Move bookings" block (Deactivate doctor, Request leave). A moved booking keeps its day and
 * time and its visit length, so a colleague covers it when, that day, they work in clinic at overlapping hours and
 * still have a free slot of that length:
 *   free(day) = ⌊overlap minutes ÷ visit length⌋ (≤ their max per day) − what they already have booked that day.
 * Bookings per day thin out the further ahead the day is, like everywhere else (bookingsBetween).
 */

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const fillOn = (iso: string) => {
  const ahead = daysUntil(iso)
  return ahead < 0 ? 0 : ahead <= 1 ? 1 : Math.max(0.1, 1 - ahead / 52)
}
const inClinic = (s: Shift[]) => s.filter((x) => !x.telehealth)
const overlap = (a: Shift[], b: Shift[]) =>
  inClinic(a).reduce((n, x) => n + inClinic(b).reduce((m, y) => m + Math.max(0, Math.min(mins(x.to), mins(y.to)) - Math.max(mins(x.from), mins(y.from))), 0), 0)

/** The source doctor's bookings on a day (what has to move). */
export const movedOn = (d: Doctor, iso: string) => Math.round(d.booked[weekdayOf(iso)] * fillOn(iso))

/** Approved leave of a doctor overlapping the dates. */
const leaveIn = (leaves: Leave[], key: string, from: string, to: string) =>
  leaves.find((l) => l.doctor === key && l.status === "approved" && l.from <= to && l.to >= from)

/** Free slots a colleague has for the source doctor's bookings on a day. */
export function freeFor(source: Doctor, target: Doctor, iso: string, leaves: Leave[]) {
  if (!target.active || !employedOn(target, iso)) return 0
  if (leaves.some((l) => l.doctor === target.key && l.status === "approved" && l.from <= iso && l.to >= iso)) return 0
  const w = weekdayOf(iso)
  const len = source.booking.visitMin ?? 15
  const slots = Math.min(Math.floor(overlap(source.week[w], target.week[w]) / len), target.booking.maxPerDay)
  return Math.max(0, slots - Math.round(target.booked[w] * fillOn(iso)))
}

export type DoctorCover =
  | { doctor: Doctor; state: "all" | "some"; covered: number; total: number }
  | { doctor: Doctor; state: "leave"; until: string }
  | { doctor: Doctor; state: "unavailable" }

/**
 * Every active doctor in the source's department (main clinic), minus the source, with their coverage of the moving
 * bookings — best coverage first; colleagues on leave during the dates or with no matching hours come last, disabled.
 */
export function doctorCandidates(source: Doctor, all: Doctor[], leaves: Leave[], from: string, to: string): DoctorCover[] {
  const days = daysIn(from, to)
  const total = days.reduce((n, x) => n + movedOn(source, x), 0)
  const rows: DoctorCover[] = all
    .filter((x) => x.active && x.key !== source.key && x.clinic === source.clinic && !(x.deactivation && x.deactivation.lastDay < from))
    .map((x) => {
      const away = leaveIn(leaves, x.key, from, to)
      if (away) return { doctor: x, state: "leave" as const, until: away.to }
      const covered = days.reduce((n, d) => n + Math.min(movedOn(source, d), freeFor(source, x, d, leaves)), 0)
      if (total > 0 && covered === 0) return { doctor: x, state: "unavailable" as const }
      return { doctor: x, state: covered >= total ? ("all" as const) : ("some" as const), covered, total }
    })
  const score = (r: DoctorCover) => (r.state === "all" || r.state === "some" ? r.covered + 1 : r.state === "leave" ? 0 : -1)
  return rows.sort((a, z) => score(z) - score(a))
}

/**
 * Spread: day by day, booking by booking, each goes to the next colleague in turn who still has a free slot then — so
 * the load is shared instead of landing on one doctor.
 */
export function spreadPlan(source: Doctor, rows: DoctorCover[], leaves: Leave[], from: string, to: string) {
  const open = rows.filter((r) => r.state === "all" || r.state === "some").map((r) => r.doctor)
  const used = new Set<string>()
  let covered = 0
  let total = 0
  let turn = 0
  for (const d of daysIn(from, to)) {
    const n = movedOn(source, d)
    total += n
    const free = open.map((x) => freeFor(source, x, d, leaves))
    for (let k = 0; k < n; k++) {
      const i = open.findIndex((_, j) => free[(turn + j) % open.length] > 0)
      if (i < 0) break
      const at = (turn + i) % open.length
      free[at]--
      used.add(open[at].key)
      covered++
      turn = at + 1
    }
  }
  return { covered, total, doctors: used.size, waiting: total - covered }
}
