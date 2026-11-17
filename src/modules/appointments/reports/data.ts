import type { Bi } from "@/lib/mock/bi"
import type { IconName } from "@/components/ds/icon"

/**
 * Appointments reports (FigCraft · Appointments · Reports tab + 6 reports). The design's figures are the
 * "1–15 Nov 2026 · all clinics · all doctors" view; the period / clinic / doctor filters scale counts by share and
 * narrow the per-doctor rows, so every filter changes what's on screen while the default view matches the design.
 */

export type ReportKey = "volume" | "no-shows" | "utilisation" | "waiting-time" | "channels" | "reminders"
export const REPORTS: { key: ReportKey; icon: IconName }[] = [
  { key: "volume", icon: "chart-2" },
  { key: "no-shows", icon: "close-circle" },
  { key: "utilisation", icon: "trend-up" },
  { key: "waiting-time", icon: "clock" },
  { key: "channels", icon: "global" },
  { key: "reminders", icon: "sms" },
]
export const REPORT_KEYS = REPORTS.map((r) => r.key)

/* ---------------------------------------------------------------- filters */

export type Period = "nov1" | "oct2" | "oct1"
export const PERIODS: { key: Period; from: string; to: string; factor: number }[] = [
  { key: "nov1", from: "2026-11-01", to: "2026-11-15", factor: 1 },
  { key: "oct2", from: "2026-10-16", to: "2026-10-31", factor: 1.04 },
  { key: "oct1", from: "2026-10-01", to: "2026-10-15", factor: 0.95 },
]
export type ClinicKey = "cardiology" | "pediatrics" | "orthopedics" | "dental"
export const CLINICS: { key: ClinicKey; name: Bi }[] = [
  { key: "cardiology", name: { en: "Cardiology", ar: "القلب" } },
  { key: "pediatrics", name: { en: "Pediatrics", ar: "الأطفال" } },
  { key: "orthopedics", name: { en: "Orthopedics", ar: "العظام" } },
  { key: "dental", name: { en: "Dental", ar: "الأسنان" } },
]

export type ReportDoctor = { key: string; name: Bi; clinic: ClinicKey }
export const RDOCTORS: ReportDoctor[] = [
  { key: "km", name: { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" }, clinic: "cardiology" },
  { key: "az", name: { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }, clinic: "pediatrics" },
  { key: "so", name: { en: "Dr. Sami Odeh", ar: "د. سامي عودة" }, clinic: "dental" },
  { key: "hf", name: { en: "Dr. Huda Fares", ar: "د. هدى فارس" }, clinic: "orthopedics" },
  { key: "ra", name: { en: "Dr. Reem Alotaibi", ar: "د. ريم العتيبي" }, clinic: "cardiology" },
]

export type Filters = { period: Period; clinic: "all" | ClinicKey; doctor: string }
export const DEFAULT_FILTERS: Filters = { period: "nov1", clinic: "all", doctor: "all" }

/** Doctors in view for the filters. */
export const doctorsFor = (f: Filters) => RDOCTORS.filter((d) => (f.clinic === "all" || d.clinic === f.clinic) && (f.doctor === "all" || d.key === f.doctor))

/* ---------------------------------------------------------------- volume */

export const VOLUME_BY_DOCTOR: Record<string, { booked: number; completed: number; cancelled: number; noShow: number }> = {
  km: { booked: 412, completed: 371, cancelled: 22, noShow: 19 },
  az: { booked: 498, completed: 452, cancelled: 31, noShow: 15 },
  so: { booked: 276, completed: 241, cancelled: 24, noShow: 11 },
  hf: { booked: 351, completed: 318, cancelled: 20, noShow: 13 },
  ra: { booked: 409, completed: 366, cancelled: 34, noShow: 9 },
}
export const TOTAL_BOOKED = 1946

/** Share of all bookings in view (1 = everything) — scales every count on the reports. */
export function shareFor(f: Filters) {
  const ds = doctorsFor(f)
  const booked = ds.reduce((s, d) => s + VOLUME_BY_DOCTOR[d.key].booked, 0)
  return (booked / TOTAL_BOOKED) * PERIODS.find((p) => p.key === f.period)!.factor
}

/** 1–15 Nov per day (Fridays closed), scaled from the design's bars so they add up to 1,946. */
const NOV_DAYS = [155, 168, 164, 170, 152, 0, 74, 158, 172, 167, 163, 154, 0, 83, 166]
export function perDay(f: Filters) {
  const p = PERIODS.find((x) => x.key === f.period)!
  const share = shareFor(f) / p.factor
  const days: { date: string; value: number }[] = []
  const start = new Date(`${p.from}T12:00:00Z`)
  const end = new Date(`${p.to}T12:00:00Z`)
  for (let d = start, i = 0; d <= end; d = new Date(d.getTime() + 86400000), i++) {
    const iso = d.toISOString().slice(0, 10)
    const dow = d.getUTCDay()
    const base = p.key === "nov1" ? NOV_DAYS[i] : dow === 5 ? 0 : dow === 6 ? 72 + ((i * 7) % 13) : 150 + ((i * 37) % 23)
    days.push({ date: iso, value: Math.round(base * share * (p.key === "nov1" ? 1 : p.factor)) })
  }
  return days
}

export const BY_TYPE = { new: 412, followUp: 986, procedure: 238, telehealth: 310 }

/* ---------------------------------------------------------------- no-shows */

export const NOSHOW_BY_WEEKDAY = [8.2, 5.4, 5.1, 6.1, 8.8, 0, 10.8] // Sun → Sat, %
export const CANCEL_REASONS = { patient: 58, rescheduled: 34, doctor: 17, duplicate: 12, none: 10 }
export const REPEAT_NOSHOWS: { name: Bi; mobile: string; count: number; last: string; doctor: string }[] = [
  { name: { en: "Yazan Saleh", ar: "يزن صالح" }, mobile: "055 201 7744", count: 3, last: "2026-11-09", doctor: "az" },
  { name: { en: "Maha Saleh", ar: "مها صالح" }, mobile: "056 410 7733", count: 3, last: "2026-11-14", doctor: "so" },
  { name: { en: "Turki Al-Anazi", ar: "تركي العنزي" }, mobile: "050 993 1120", count: 2, last: "2026-11-12", doctor: "hf" },
  { name: { en: "Rana Youssef", ar: "رنا يوسف" }, mobile: "054 330 8812", count: 2, last: "2026-11-05", doctor: "hf" },
]

/* ---------------------------------------------------------------- utilisation */

export const HOURS_BY_DOCTOR: Record<string, { available: number; booked: number; idle: number; overtime: number }> = {
  km: { available: 160, booked: 138, idle: 4, overtime: 6 },
  az: { available: 152, booked: 138, idle: 2, overtime: 9 },
  so: { available: 168, booked: 108, idle: 21, overtime: 0 },
  hf: { available: 160, booked: 125, idle: 11, overtime: 2 },
  ra: { available: 120, booked: 85, idle: 14, overtime: 0 },
}
/** Busy hours heatmap, Sun → Thu × 08 → 15, level 1 (quiet) – 6 (busy). */
export const HEAT = [
  [3, 5, 6, 6, 4, 2, 4, 3],
  [4, 6, 6, 5, 4, 2, 3, 2],
  [3, 5, 5, 6, 3, 1, 3, 2],
  [4, 6, 6, 6, 5, 2, 4, 3],
  [2, 4, 5, 4, 3, 1, 2, 1],
]

/* ---------------------------------------------------------------- waiting time */

export const WAIT_BY_HOUR = [6, 9, 15, 19, 14, 8, 11, 10] // 08 → 15, minutes
export const WAIT_BY_DOCTOR: Record<string, number> = { km: 17, az: 11, so: 13, hf: 9, ra: 10 }
export const LONGEST_WAITS: { name: Bi; doctor: string; checkIn: string; calledIn: string; wait: number; reason: "late" | "walkIn" | "lab" | "overrun" }[] = [
  { name: { en: "Abdullah Al-Qahtani", ar: "عبدالله القحطاني" }, doctor: "km", checkIn: "10:22", calledIn: "11:14", wait: 52, reason: "late" },
  { name: { en: "Saad Al-Dossary", ar: "سعد الدوسري" }, doctor: "hf", checkIn: "10:19", calledIn: "10:58", wait: 39, reason: "walkIn" },
  { name: { en: "Omar Faisal", ar: "عمر فيصل" }, doctor: "az", checkIn: "10:34", calledIn: "11:08", wait: 34, reason: "lab" },
  { name: { en: "Khalid Al-Zahrani", ar: "خالد الزهراني" }, doctor: "so", checkIn: "11:05", calledIn: "11:37", wait: 32, reason: "overrun" },
]

/* ---------------------------------------------------------------- channels */

export type ChannelKey = "online" | "phone" | "walkIn" | "referral"
export const CHANNELS: { key: ChannelKey; share: number; bookings: number; noShow: number; cancelled: number; lead: number; color: string }[] = [
  { key: "online", share: 46, bookings: 895, noShow: 4.1, cancelled: 5.2, lead: 4.8, color: "var(--chart-1)" },
  { key: "phone", share: 31, bookings: 603, noShow: 6.8, cancelled: 7.9, lead: 3.1, color: "var(--chart-2)" },
  { key: "walkIn", share: 15, bookings: 292, noShow: 0, cancelled: 1.2, lead: 0, color: "var(--chart-3)" },
  { key: "referral", share: 8, bookings: 156, noShow: 9, cancelled: 6.4, lead: 6.2, color: "var(--chart-4)" },
]
export const LEAD_BUCKETS = [
  { key: "same", value: 22 },
  { key: "one", value: 17 },
  { key: "two", value: 25 },
  { key: "four", value: 21 },
  { key: "eight", value: 10 },
  { key: "fifteen", value: 5 },
] as const

/* ---------------------------------------------------------------- reminders */

export const FUNNEL = { sent: 3812, delivered: 3701, opened: 3154, confirmed: 2706 }
export const REMINDER_CHANNELS = [
  { key: "sms", sent: 2210, delivered: 96.1, confirmed: 63.0, cost: 1140 },
  { key: "whatsapp", sent: 1602, delivered: 98.7, confirmed: 82.4, cost: 0 },
] as const
