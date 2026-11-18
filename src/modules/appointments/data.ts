import type { Bi } from "@/lib/mock/bi"
import { clinicByKey } from "@/modules/clinics/data"
import { APPT_DOCTOR_KEY, doctorByKey } from "@/modules/doctors/data"

/**
 * Appointments mock data (FigCraft · Appointments). "Today" is Mon 16 Nov 2026 and "now" is 10:40, like the design.
 * Today's board is the design's data; every other day is generated deterministically from the doctors' templates,
 * so the calendar, week view and agenda stay stable between reloads.
 */

export const TODAY = "2026-11-16"
export const NOW_MIN = 10 * 60 + 40
export const NOW_LABEL = "10:40"
/** Board hours: 08:00–16:00 (8 rows). */
export const DAY_START = 8 * 60
export const DAY_END = 16 * 60

export type DoctorId = "km" | "az" | "so" | "hf"
export type Doctor = { id: DoctorId; initials: string; name: Bi; clinic: Bi; color: string; room: number }

/** The Appointments board's 4 doctors, from the shared roster (Doctors module). */
const BOARD_LOOK: { id: DoctorId; color: string; room: number }[] = [
  { id: "km", color: "var(--chart-1)", room: 3 },
  { id: "az", color: "var(--chart-2)", room: 1 },
  { id: "so", color: "var(--chart-3)", room: 5 },
  { id: "hf", color: "var(--chart-4)", room: 2 },
]
export const DOCTORS: Doctor[] = BOARD_LOOK.map(({ id, color, room }) => {
  const d = doctorByKey(APPT_DOCTOR_KEY[id])!
  return { id, initials: d.initials, name: d.name, clinic: clinicByKey(d.clinic)!.name, color, room }
})
export const doctorById = (id: DoctorId) => DOCTORS.find((d) => d.id === id)!

export type ApptStatus = "booked" | "confirmed" | "arrived" | "withDoctor" | "completed" | "noShow" | "cancelled"
export const STATUSES: ApptStatus[] = ["booked", "confirmed", "arrived", "withDoctor", "completed", "noShow", "cancelled"]

export type Appointment = {
  id: string
  date: string
  doctor: DoctorId
  /** Minutes from midnight */
  start: number
  duration: number
  /** null = unnamed booked slot (week view: "Booked slot") */
  patient: Bi | null
  reason: Bi | null
  status: ApptStatus
  telehealth?: boolean
  /** Minutes from midnight the patient arrived (arrived) or was called in (with doctor) — waiting room timers. */
  since?: number
}

/** Lunch breaks drawn on the boards (not appointments). */
export type Break = { doctor: DoctorId; start: number; duration: number }

const t = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

type Row = [DoctorId, string, number, string, string, string, string, ApptStatus, boolean?]
// doctor, start, minutes, patient EN, patient AR, reason EN, reason AR, status, telehealth
const TODAY_ROWS: Row[] = [
  ["az", "08:00", 20, "Lina Haddad", "لينا حداد", "Vaccination", "تطعيم", "completed"],
  ["km", "08:30", 30, "Sara Ahmed", "سارة أحمد", "Follow-up", "متابعة", "completed"],
  ["hf", "08:30", 30, "Ali Hassan", "علي حسن", "Knee pain", "ألم الركبة", "completed"],
  ["az", "08:40", 20, "Reem Al-Harbi", "ريم الحربي", "Follow-up", "متابعة", "completed"],
  ["so", "09:00", 60, "Noura Al-Rashid", "نورة الراشد", "Cleaning", "تنظيف", "completed"],
  ["km", "09:15", 45, "Omar Al-Harbi", "عمر الحربي", "Echo review", "مراجعة إيكو", "completed"],
  ["az", "09:20", 20, "Yazan Saleh", "يزن صالح", "Check-up", "كشف", "noShow"],
  ["hf", "09:30", 30, "Majed Al-Qahtani", "ماجد القحطاني", "Physio review", "مراجعة علاج طبيعي", "completed"],
  ["km", "10:00", 30, "Yousef Nasser", "يوسف ناصر", "ECG review", "مراجعة تخطيط", "withDoctor"],
  ["so", "10:15", 45, "Maha Saleh", "مها صالح", "Filling", "حشوة", "withDoctor"],
  ["az", "10:20", 20, "Jana Al-Qahtani", "جنى القحطاني", "Fever", "حرارة", "withDoctor"],
  ["km", "10:30", 30, "Abdullah Al-Qahtani", "عبدالله القحطاني", "Consultation", "استشارة", "arrived"],
  ["hf", "10:30", 30, "Saad Al-Dossary", "سعد الدوسري", "Back pain", "ألم الظهر", "arrived"],
  ["az", "10:40", 20, "Omar Faisal", "عمر فيصل", "Asthma", "ربو", "arrived"],
  ["az", "11:00", 20, "Layan Ali", "ليان علي", "Check-up", "كشف", "confirmed"],
  ["hf", "11:00", 30, "Abeer Mohammed", "عبير محمد", "Follow-up", "متابعة", "confirmed"],
  ["so", "11:15", 45, "Khalid Al-Zahrani", "خالد الزهراني", "Root canal", "علاج عصب", "confirmed"],
  ["km", "11:30", 30, "Nasser Al-Otaibi", "ناصر العتيبي", "New patient", "مريض جديد", "confirmed"],
  ["az", "11:40", 20, "Hamad Nasser", "حمد ناصر", "Follow-up", "متابعة", "confirmed"],
  ["hf", "12:00", 30, "Turki Al-Anazi", "تركي العنزي", "Shoulder pain", "ألم الكتف", "booked"],
  ["so", "12:30", 30, "Faris Al-Malki", "فارس المالكي", "Check-up", "كشف", "cancelled"],
  ["km", "13:00", 60, "Faisal Al-Shehri", "فيصل الشهري", "Stress test", "اختبار الجهد", "booked"],
  ["az", "13:30", 20, "Tala Ahmed", "تالا أحمد", "Vaccination", "تطعيم", "booked"],
  ["so", "14:00", 60, "Huda Al-Mutairi", "هدى المطيري", "Crown fitting", "تركيب تاج", "booked"],
  ["hf", "14:00", 30, "Rana Youssef", "رنا يوسف", "Follow-up", "متابعة", "booked"],
  ["km", "14:30", 30, "Mona Al-Ghamdi", "منى الغامدي", "Follow-up", "متابعة", "confirmed", true],
  ["az", "15:00", 20, "Sara Khalid", "سارة خالد", "Check-up", "كشف", "booked"],
  ["hf", "15:30", 30, "Waleed Saad", "وليد سعد", "Follow-up", "متابعة", "booked", true],
]

const BREAKS: Break[] = [
  { doctor: "km", start: t("12:00"), duration: 60 },
  { doctor: "az", start: t("12:30"), duration: 30 },
  { doctor: "hf", start: t("13:00"), duration: 60 },
]
/** Dr. Sami Odeh has no lunch block on the design (his 12:30 slot is a cancelled visit). */
export const breaksFor = (doctor: DoctorId) => BREAKS.filter((b) => b.doctor === doctor)

/** Design · Waiting room: waiting 18 / 6 / 11 min, with the doctor 26 / 14 / 21 min at 10:40. */
const SINCE: Record<string, string> = {
  "Abdullah Al-Qahtani": "10:22",
  "Omar Faisal": "10:34",
  "Saad Al-Dossary": "10:29",
  "Yousef Nasser": "10:14",
  "Jana Al-Qahtani": "10:26",
  "Maha Saleh": "10:19",
}

const fromRow = (date: string, [doctor, start, duration, en, ar, ren, rar, status, tele]: Row, i: number): Appointment => ({
  id: `${date}-${doctor}-${start}-${i}`,
  date,
  doctor,
  start: t(start),
  duration,
  patient: { en, ar },
  reason: { en: ren, ar: rar },
  status,
  telehealth: tele,
  since: SINCE[en] ? t(SINCE[en]) : undefined,
})

/* ---------------------------------------------------------------- Dr. Khaled Mansour's week (design · Week view) */

type WeekRow = [string, string, number, string | null, ApptStatus]
const KM_WEEK: WeekRow[] = [
  ["2026-11-15", "08:30", 30, "Sara Ahmed", "completed"],
  ["2026-11-15", "09:30", 60, null, "completed"],
  ["2026-11-15", "11:00", 30, null, "completed"],
  ["2026-11-15", "13:00", 60, "Faisal Al-Shehri", "completed"],
  ["2026-11-17", "09:00", 30, null, "confirmed"],
  ["2026-11-17", "10:00", 30, "Yousef Nasser", "confirmed"],
  ["2026-11-17", "11:30", 60, "Nasser Al-Otaibi", "booked"],
  ["2026-11-17", "14:00", 30, null, "booked"],
  ["2026-11-18", "08:30", 30, "Sara Ahmed", "booked"],
  ["2026-11-18", "10:30", 30, "Abdullah Al-Qahtani", "confirmed"],
  ["2026-11-18", "13:00", 30, "Faisal Al-Shehri", "booked"],
  ["2026-11-18", "15:00", 30, null, "booked"],
  ["2026-11-19", "09:00", 60, null, "booked"],
  ["2026-11-19", "11:00", 30, null, "booked"],
]

/* ---------------------------------------------------------------- generator for every other day */

const POOL: Bi[] = TODAY_ROWS.map((r) => ({ en: r[3], ar: r[4] }))
const byEn = new Map(POOL.map((p) => [p.en, p]))
const REASONS: Record<DoctorId, Bi[]> = {
  km: [
    { en: "Follow-up", ar: "متابعة" },
    { en: "ECG review", ar: "مراجعة تخطيط" },
    { en: "Consultation", ar: "استشارة" },
    { en: "Echo review", ar: "مراجعة إيكو" },
  ],
  az: [
    { en: "Check-up", ar: "كشف" },
    { en: "Vaccination", ar: "تطعيم" },
    { en: "Follow-up", ar: "متابعة" },
    { en: "Fever", ar: "حرارة" },
  ],
  so: [
    { en: "Cleaning", ar: "تنظيف" },
    { en: "Filling", ar: "حشوة" },
    { en: "Root canal", ar: "علاج عصب" },
    { en: "Check-up", ar: "كشف" },
  ],
  hf: [
    { en: "Follow-up", ar: "متابعة" },
    { en: "Knee pain", ar: "ألم الركبة" },
    { en: "Back pain", ar: "ألم الظهر" },
    { en: "Physio review", ar: "مراجعة علاج طبيعي" },
  ],
}
/** Slot templates per doctor (start, minutes). */
const TEMPLATES: Record<DoctorId, [string, number][]> = {
  km: [["08:30", 30], ["09:15", 45], ["10:00", 30], ["10:30", 30], ["11:30", 30], ["13:00", 60], ["14:30", 30], ["15:00", 30]],
  az: [["08:00", 20], ["08:40", 20], ["09:20", 20], ["10:00", 20], ["10:40", 20], ["11:20", 20], ["13:30", 20], ["14:20", 20], ["15:00", 20]],
  so: [["09:00", 60], ["10:15", 45], ["11:15", 45], ["14:00", 60], ["15:00", 45]],
  hf: [["08:30", 30], ["09:30", 30], ["10:30", 30], ["11:00", 30], ["12:00", 30], ["14:00", 30], ["15:30", 30]],
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Clinic days: Sunday–Thursday and Saturday; Friday is closed. */
export const isClosed = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() === 5

function generate(date: string, doctor: DoctorId): Appointment[] {
  if (isClosed(date)) return []
  const sat = new Date(`${date}T12:00:00Z`).getUTCDay() === 6
  const slots = TEMPLATES[doctor].filter((_, i) => !sat || i < 3)
  const out: Appointment[] = []
  slots.forEach(([start, duration], i) => {
    const h = hash(`${date}|${doctor}|${i}`)
    if (h % 10 < 3) return // ~30% of slots stay free
    const past = date < TODAY
    const status: ApptStatus = past ? (h % 17 === 0 ? "noShow" : h % 13 === 0 ? "cancelled" : "completed") : h % 3 === 0 ? "confirmed" : "booked"
    out.push({
      id: `${date}-${doctor}-${start}`,
      date,
      doctor,
      start: t(start),
      duration,
      patient: POOL[(h >>> 4) % POOL.length],
      reason: REASONS[doctor][(h >>> 8) % REASONS[doctor].length],
      status,
    })
  })
  return out
}

const cache = new Map<string, Appointment[]>()

/** All appointments on a day (every doctor), sorted by time. */
export function appointmentsOn(date: string): Appointment[] {
  const hit = cache.get(date)
  if (hit) return hit
  let list: Appointment[]
  if (date === TODAY) list = TODAY_ROWS.map((r, i) => fromRow(date, r, i))
  else {
    list = DOCTORS.flatMap((d) => generate(date, d.id))
    const week = KM_WEEK.filter((w) => w[0] === date)
    if (week.length) {
      list = list.filter((a) => a.doctor !== "km")
      list.push(
        ...week.map(([, start, duration, name, status], i) => ({
          id: `${date}-km-${start}-${i}`,
          date,
          doctor: "km" as const,
          start: t(start),
          duration,
          patient: name ? byEn.get(name) ?? null : null,
          reason: name ? REASONS.km[i % REASONS.km.length] : null,
          status,
        }))
      )
    }
  }
  // Design · New appointment · Conflict: Dr. Ahmed Zaki already has Layan Ali at 11:00 on 18 Nov.
  if (date === "2026-11-18") {
    list = list.filter((a) => !(a.doctor === "az" && a.start < t("11:20") && a.start + a.duration > t("11:00")))
    list.push({ id: "2026-11-18-az-layan", date, doctor: "az", start: t("11:00"), duration: 20, patient: { en: "Layan Ali", ar: "ليان علي" }, reason: { en: "Check-up", ar: "كشف" }, status: "confirmed" })
  }
  list.sort((a, b) => a.start - b.start || DOCTORS.findIndex((d) => d.id === a.doctor) - DOCTORS.findIndex((d) => d.id === b.doctor))
  cache.set(date, list)
  return list
}

/** Busy days in November 2026 (design · Month view). Other months fall back to the generated count. */
const NOV_COUNTS: Record<number, number> = {
  1: 31, 2: 42, 3: 39, 4: 44, 5: 28, 7: 12, 8: 33, 9: 45, 10: 41, 11: 38, 12: 30, 14: 14, 15: 40, 16: 48, 17: 36, 18: 33, 19: 21,
  21: 8, 22: 25, 23: 19, 24: 14, 25: 11, 26: 6, 28: 2, 29: 4, 30: 3,
}
export const ALMOST_FULL = 44

/** Booked appointments for the month grid (clinic-wide, every branch). */
export function dayCount(date: string) {
  if (isClosed(date)) return 0
  if (date.startsWith("2026-11-")) return NOV_COUNTS[Number(date.slice(8, 10))] ?? 0
  return appointmentsOn(date).filter((a) => a.status !== "cancelled").length * 2
}

/* ---------------------------------------------------------------- date helpers (ISO yyyy-mm-dd, UTC noon) */

export const toDate = (iso: string) => new Date(`${iso}T12:00:00Z`)
export const iso = (d: Date) => d.toISOString().slice(0, 10)
export function addDays(date: string, n: number) {
  const d = toDate(date)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
export function addMonths(date: string, n: number) {
  const d = toDate(`${date.slice(0, 7)}-01`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return iso(d)
}
/** Sunday that starts the week of `date`. */
export const weekStart = (date: string) => addDays(date, -toDate(date).getUTCDay())
/** Month grid (Sunday-first) covering the month of `date`. */
export function monthCells(date: string) {
  const first = `${date.slice(0, 7)}-01`
  const start = weekStart(first)
  const days = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate()
  const weeks = Math.ceil((toDate(first).getUTCDay() + days) / 7)
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
}

/* ---------------------------------------------------------------- doctor schedules (design · Doctor schedules) */

/** Working hours Sunday → Saturday: "08–16", "off" (day off this week) or null (not a working day). */
export type DayHours = string | "off" | null
export const SCHEDULES: Record<DoctorId, { slot: number; week: DayHours[]; load: [number, number] }> = {
  km: { slot: 30, week: ["08–16", "08–16", "08–16", "08–14", "08–16", null, "09–13"], load: [14, 16] },
  az: { slot: 20, week: ["08–16", "08–16", "off", "08–16", "08–16", null, null], load: [18, 20] },
  so: { slot: 45, week: ["09–17", "09–17", "09–17", "09–17", "09–13", null, "09–13"], load: [8, 12] },
  hf: { slot: 30, week: ["08–16", "08–16", "08–16", "08–16", "08–16", null, null], load: [10, 14] },
}

export type TimeOffReason = "annual" | "sick" | "training" | "personal" | "other"
export type TimeOff = { id: string; doctor: DoctorId; from: string; to: string; reason: TimeOffReason }
/** Dr. Huda Fares is on leave 22–24 Nov (design). */
export const TIME_OFF: TimeOff[] = [{ id: "to-hf-1", doctor: "hf", from: "2026-11-22", to: "2026-11-24", reason: "annual" }]

/** Booked patients for a doctor between two dates (inclusive) — "N patients are booked in these days". */
export function bookedBetween(doctor: DoctorId, from: string, to: string) {
  let n = 0
  for (let d = from; d <= to; d = addDays(d, 1)) n += appointmentsOn(d).filter((a) => a.doctor === doctor && a.status !== "cancelled" && a.patient).length
  return n
}

/* ---------------------------------------------------------------- booking (design · New appointment) */

export type Service = { key: string; name: Bi; minutes: number; fee: number }
/** Services per clinic (doctor), with length and fee in SAR. */
export const SERVICES: Record<DoctorId, Service[]> = {
  km: [
    { key: "consultation", name: { en: "Consultation", ar: "استشارة" }, minutes: 30, fee: 500 },
    { key: "follow-up", name: { en: "Follow-up", ar: "متابعة" }, minutes: 30, fee: 400 },
    { key: "ecg", name: { en: "ECG review", ar: "مراجعة تخطيط" }, minutes: 30, fee: 450 },
    { key: "stress", name: { en: "Stress test", ar: "اختبار الجهد" }, minutes: 60, fee: 900 },
  ],
  az: [
    { key: "follow-up", name: { en: "Follow-up", ar: "متابعة" }, minutes: 20, fee: 350 },
    { key: "check-up", name: { en: "Check-up", ar: "كشف" }, minutes: 20, fee: 300 },
    { key: "vaccination", name: { en: "Vaccination", ar: "تطعيم" }, minutes: 20, fee: 150 },
  ],
  so: [
    { key: "check-up", name: { en: "Check-up", ar: "كشف" }, minutes: 45, fee: 200 },
    { key: "cleaning", name: { en: "Cleaning", ar: "تنظيف" }, minutes: 45, fee: 300 },
    { key: "filling", name: { en: "Filling", ar: "حشوة" }, minutes: 45, fee: 450 },
    { key: "root-canal", name: { en: "Root canal", ar: "علاج عصب" }, minutes: 90, fee: 1200 },
  ],
  hf: [
    { key: "follow-up", name: { en: "Follow-up", ar: "متابعة" }, minutes: 30, fee: 400 },
    { key: "consultation", name: { en: "Consultation", ar: "استشارة" }, minutes: 30, fee: 500 },
    { key: "physio", name: { en: "Physio review", ar: "مراجعة علاج طبيعي" }, minutes: 30, fee: 350 },
  ],
}

export type Slot = { start: number; held: boolean; past: boolean }

/**
 * Bookable start times for a doctor on a day: every slot inside working hours, minus lunch. A few are "held" (kept
 * for walk-ins, greyed like the design); past times today are greyed too. Booked times stay pickable — picking one
 * shows the conflict, so reception can double-book urgent cases.
 */
/** Design · New appointment: Dr. Ahmed Zaki on 18 Nov has 08:20, 09:00, 11:20 and 14:10 greyed. */
const HELD_AZ_18 = ["08:20", "09:00", "11:20", "14:10"].map(t)

/**
 * Limits from the doctor's clinic (Clinics · Schedule: hours, closures, booking rules), passed in by the screens so
 * this module doesn't depend on Clinics: closed → no slots; otherwise slots stay inside from–to, every `step` min.
 */
export type ClinicLimits = { closed: true } | { closed: false; from: number; to: number; step: number }

export function slotsFor(doctor: DoctorId, date: string, clinic?: ClinicLimits | null): Slot[] {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  const hours = SCHEDULES[doctor].week[day]
  if (!hours || hours === "off" || clinic?.closed) return []
  let [open, close] = hours.split("–").map((h) => Number(h) * 60)
  if (clinic) {
    open = Math.max(open, clinic.from)
    close = Math.min(close, clinic.to)
  }
  const step = clinic?.step ?? SCHEDULES[doctor].slot
  const lunch = breaksFor(doctor)
  const out: Slot[] = []
  for (let m = open; m + step <= close; m += step) {
    if (lunch.some((b) => m < b.start + b.duration && m + step > b.start)) continue
    const held = date === "2026-11-18" && doctor === "az" ? HELD_AZ_18.includes(m) : hash(`${date}|${doctor}|held|${m}`) % 6 === 0
    out.push({ start: m, held, past: date < TODAY || (date === TODAY && m <= NOW_MIN) })
  }
  return out
}
