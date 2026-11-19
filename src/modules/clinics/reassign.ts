import type { Bi } from "@/lib/mock/bi"
import { WEEKDAYS, type Clinic } from "./data"

/**
 * Pause clinic · Move bookings block maths (design v4.7).
 *  · Next open days: each booking keeps its doctor and visit type and takes the first free slot after the pause. The
 *    open days right after the pause (until the clinic's next closed day) each take up to their free slots — a normal
 *    day's bookings minus what's already booked that day (bookings thin out further ahead); the rest go to the
 *    Appointments waiting list.
 *  · Another clinic or branch: every clinic, here or in another branch, that sees the same visits; it covers up to its
 *    free slots per open day in the pause dates, and is unavailable when it's closed during the dates too.
 */

const DAY = 86_400_000
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]
const daysIn = (from: string, to: string) => {
  const out: string[] = []
  for (let x = from; x <= to && out.length < 120; x = addDays(x, 1)) out.push(x)
  return out
}
const fillOn = (iso: string, today: string) => {
  const ahead = Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY)
  return ahead <= 1 ? 1 : Math.max(0.1, 1 - ahead / 52)
}
const openOn = (c: Clinic, iso: string) => c.hours[weekdayOf(iso)].length > 0 && !c.closures.some((x) => x.date === iso && x.kind === "holiday")

export type NextDays = { days: { date: string; n: number }[]; moved: number; waiting: number }

/** Move to the next open days: how many land on each day after the pause and how many wait. */
export function nextOpenDays(c: Clinic, until: string, count: number, today: string): NextDays {
  const days: { date: string; n: number }[] = []
  let left = count
  let started = false
  for (let i = 1, d = addDays(until, 1); i <= 14 && left > 0; i++, d = addDays(d, 1)) {
    if (!openOn(c, d)) {
      if (started) break
      continue
    }
    started = true
    const free = Math.max(0, c.today.booked - Math.round(c.today.booked * fillOn(d, today)))
    const n = Math.min(left, free)
    if (n > 0) days.push({ date: d, n })
    left -= n
  }
  return { days, moved: count - left, waiting: left }
}

/** A clinic that can take another clinic's bookings (sample data: other branches, and clinics here that see the same visits). */
export type Site = {
  key: string
  name: Bi
  /** Clinics (keys) whose visit types it sees. */
  takes: string[]
  /** In this branch (floor) or another (minutes away). */
  floor?: number
  minutesAway?: number
  /** Free slots per open day (Sun–Thu). */
  freePerDay: number
  /** Paused too (inclusive dates). */
  paused?: [string, string]
}

export const SITES: Site[] = [
  { key: "peds-malqa", name: { en: "Pediatrics · Al-Malqa branch", ar: "الأطفال · فرع الملقا" }, takes: ["peds"], minutesAway: 12, freePerDay: 6 },
  { key: "family", name: { en: "Family medicine", ar: "طب الأسرة" }, takes: ["peds", "internal"], floor: 1, freePerDay: 5 },
  { key: "peds-rawdah", name: { en: "Pediatrics · Al-Rawdah branch", ar: "الأطفال · فرع الروضة" }, takes: ["peds"], minutesAway: 25, freePerDay: 6, paused: ["2026-11-20", "2026-11-22"] },
]

export type SiteCover =
  | { site: Site; state: "all" | "some"; covered: number; total: number }
  | { site: Site; state: "unavailable"; paused?: [string, string] }

/** Clinics that see the same visits, with their coverage of the paused dates; best first, unavailable last. */
export function siteCandidates(c: Clinic, from: string, to: string, count: number): SiteCover[] {
  const open = daysIn(from, to).filter((d) => !["fri", "sat"].includes(weekdayOf(d)))
  return SITES.filter((s) => s.takes.includes(c.key))
    .map((s): SiteCover => {
      if (s.paused && s.paused[0] <= to && s.paused[1] >= from) return { site: s, state: "unavailable", paused: s.paused }
      const covered = Math.min(count, open.length * s.freePerDay)
      if (count > 0 && covered === 0) return { site: s, state: "unavailable" }
      return { site: s, state: covered >= count ? "all" : "some", covered, total: count }
    })
    .sort((a, z) => (z.state === "unavailable" ? -1 : z.covered) - (a.state === "unavailable" ? -1 : a.covered))
}
