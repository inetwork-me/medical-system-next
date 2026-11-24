import type { Bi } from "@/lib/mock/bi"

/*
 * Reports (design v7.0): management reporting — dashboards (Operations, Finance, Clinical, Doctors), a library of
 * saved reports, a builder, scheduled email reports and official returns (MOH, HESN, CCHI, ZATCA). Reports read the
 * other modules' data through one set of measure definitions (measures.ts) and never carry patient names or IDs.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

/* ------------------------------------------------------------------ clock */

/** The demo clock: Sunday 22 Nov 2026, 10:40 (the dashboards cover 1–22 Nov, compared with October). */
export const REP_TODAY = "2026-11-22"
export const REP_NOW = `${REP_TODAY}T10:40`
/** All schedules and sends are in Riyadh time. */
export const REP_TZ = "Asia/Riyadh"

export function daysBetween(a: string, b: string = REP_TODAY) {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((d(b) - d(a)) / 86_400_000)
}
export function addDays(iso: string, n: number) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n))
  return d.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ dimensions */

export type Branch = { id: string; name: Bi; short: Bi }
/** Branches a report can cover. Which ones a user sees comes from the server (server.ts), never from the UI. */
export const BRANCHES: Branch[] = [
  { id: "riyadh-main", name: bi("Riyadh main branch", "فرع الرياض الرئيسي"), short: bi("Riyadh main", "الرياض الرئيسي") },
  { id: "olaya", name: bi("Olaya clinic", "عيادة العليا"), short: bi("Olaya", "العليا") },
  { id: "jeddah", name: bi("Jeddah branch", "فرع جدة"), short: bi("Jeddah", "جدة") },
]

export type Clinic = { id: string; name: Bi; color: string }
export const CLINICS: Clinic[] = [
  { id: "pediatrics", name: bi("Pediatrics", "الأطفال"), color: "var(--chart-1)" },
  { id: "dental", name: bi("Dental", "الأسنان"), color: "var(--chart-2)" },
  { id: "cardiology", name: bi("Cardiology", "القلب"), color: "var(--chart-3)" },
  { id: "eyes", name: bi("Eyes", "العيون"), color: "var(--chart-4)" },
  { id: "dermatology", name: bi("Dermatology", "الجلدية"), color: "var(--chart-5)" },
  { id: "family", name: bi("Family medicine", "طب الأسرة"), color: "var(--chart-1)" },
]

export type Doctor = { id: string; name: Bi; clinic: string }
export const DOCTORS: Doctor[] = [
  { id: "khaled", name: bi("Dr. Khaled Mansour", "د. خالد منصور"), clinic: "cardiology" },
  { id: "sami", name: bi("Dr. Sami Al-Otaibi", "د. سامي العتيبي"), clinic: "cardiology" },
  { id: "zaki", name: bi("Dr. Ahmed Zaki", "د. أحمد زكي"), clinic: "pediatrics" },
  { id: "hala", name: bi("Dr. Hala Nasser", "د. هالة ناصر"), clinic: "dermatology" },
  { id: "lama", name: bi("Dr. Lama Al-Saud", "د. لمى آل سعود"), clinic: "dental" },
]

export type Payer = { id: string; name: Bi }
export const PAYERS: Payer[] = [
  { id: "cash", name: bi("Cash", "كاش") },
  { id: "bupa", name: bi("Bupa Arabia", "بوبا العربية") },
  { id: "tawuniya", name: bi("Tawuniya", "التعاونية") },
  { id: "medgulf", name: bi("MedGulf", "ميدغلف") },
  { id: "alrajhi", name: bi("Al Rajhi Takaful", "تكافل الراجحي") },
]

/* ------------------------------------------------------------------ filters */

export type Period = "today" | "week" | "month" | "custom"

/**
 * The filters every dashboard, report and builder preview reads: a date range, the comparison with the period
 * before (same length), branch, clinic, doctor and payer. "all" = no filter on that dimension.
 */
export type ReportFilters = {
  period: Period
  from: string
  to: string
  compare: boolean
  branch: string
  clinic: string
  doctor: string
  payer: string
}

export const DEFAULT_FILTERS: ReportFilters = {
  period: "month",
  from: "2026-11-01",
  to: REP_TODAY,
  compare: true,
  branch: "riyadh-main",
  clinic: "all",
  doctor: "all",
  payer: "all",
}

/** The range a period stands for on the demo clock (Custom keeps the dates typed). */
export function rangeOf(p: Period, custom?: { from: string; to: string }): { from: string; to: string } {
  if (p === "today") return { from: REP_TODAY, to: REP_TODAY }
  if (p === "week") return { from: addDays(REP_TODAY, -6), to: REP_TODAY }
  if (p === "month") return { from: `${REP_TODAY.slice(0, 8)}01`, to: REP_TODAY }
  return custom ?? { from: DEFAULT_FILTERS.from, to: DEFAULT_FILTERS.to }
}

/**
 * The period before, of the same length (brief §4). "This month so far" compares with the whole previous month,
 * as the design labels it ("vs October").
 */
export function previousOf(f: Pick<ReportFilters, "period" | "from" | "to">): { from: string; to: string; wholeMonth: boolean } {
  if (f.period === "month") {
    const y = +f.from.slice(0, 4)
    const m = +f.from.slice(5, 7)
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    const last = new Date(Date.UTC(py, pm, 0)).getUTCDate()
    const mm = String(pm).padStart(2, "0")
    return { from: `${py}-${mm}-01`, to: `${py}-${mm}-${last}`, wholeMonth: true }
  }
  const len = daysBetween(f.from, f.to) + 1
  return { from: addDays(f.from, -len), to: addDays(f.from, -1), wholeMonth: false }
}

/* ------------------------------------------------------------------ tab counts (filled by the later steps) */

/** Saved reports in the library, schedules, official returns still to submit (design: 42 · 6 · 2). */
export const LIBRARY_TOTAL = 42
export const SCHEDULES_TOTAL = 6
export const RETURNS_OPEN = 2

/* ------------------------------------------------------------------ people (schedules, sharing) */

export type Person = { id: string; initials: string; name: Bi; role: Bi; email: string }
export const PEOPLE: Person[] = [
  { id: "ghamdi", initials: "SG", name: bi("Dr. Saleh Al-Ghamdi", "د. صالح الغامدي"), role: bi("Medical director", "المدير الطبي"), email: "saleh.g@clinic.sa" },
  { id: "fahad", initials: "NF", name: bi("Nora Al-Fahad", "نورة الفهد"), role: bi("Front office lead", "مسؤولة الاستقبال"), email: "nora.f@clinic.sa" },
  { id: "harthi", initials: "MH", name: bi("Mona Al-Harthi", "منى الحارثي"), role: bi("Dental clinic manager", "مديرة عيادة الأسنان"), email: "mona.h@clinic.sa" },
  { id: "sulami", initials: "AS", name: bi("Abeer Al-Sulami", "عبير السلمي"), role: bi("Finance manager", "المدير المالي"), email: "abeer.s@clinic.sa" },
  { id: "mansour", initials: "KM", name: bi("Dr. Khaled Mansour", "د. خالد منصور"), role: bi("Cardiologist", "استشاري قلب"), email: "khaled.m@clinic.sa" },
  { id: "sahli", initials: "MS", name: bi("Majed Al-Sahli", "ماجد السهلي"), role: bi("Lab manager", "مدير المختبر"), email: "majed.s@clinic.sa" },
  { id: "qahtani", initials: "FQ", name: bi("Faisal Al-Qahtani", "فيصل القحطاني"), role: bi("CEO", "الرئيس التنفيذي"), email: "faisal.q@clinic.sa" },
]

/* ------------------------------------------------------------------ schedules */

/** "quarterly" is shown (Every 3 months) but not offered in the dialog (brief: day / week / month). */
export type Frequency = "daily" | "weekly" | "monthly" | "quarterly"
export type Recipient = { personId?: string; email: string; name?: Bi; role?: Bi; initials?: string }
/** A scheduled email report: when (Riyadh time), to whom, as what, skip when nothing changed. */
export type Schedule = {
  id: string
  /** The report (saved report id or a dashboard: "dash:operations"). */
  target: string
  targetName: Bi
  frequency: Frequency
  /** Weekly: 0 = Sunday … 6 = Saturday; monthly: day of the month (1–28). */
  day: number
  time: string
  recipients: Recipient[]
  format: "pdf" | "xlsx"
  skipUnchanged: boolean
  status: "active" | "paused" | "failed"
  /** Why the last send failed ("Email bounced · 1 address") and the address that bounced. */
  failure?: Bi
  bounced?: string
}

/** The next send after `now` (Riyadh time, the demo clock), as an ISO date-time. */
export function nextSend(s: Pick<Schedule, "frequency" | "day" | "time">, now: string = REP_NOW): string {
  for (let i = 0; i < 100; i++) {
    const d = addDays(now.slice(0, 10), i)
    const at = `${d}T${s.time}`
    if (at <= now) continue
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay()
    if (s.frequency === "daily") return at
    if (s.frequency === "weekly" && wd === s.day) return at
    if (s.frequency === "monthly" && +d.slice(8) === s.day) return at
    if (s.frequency === "quarterly" && +d.slice(8) === s.day && [1, 4, 7, 10].includes(+d.slice(5, 7))) return at
  }
  return `${addDays(now.slice(0, 10), 1)}T${s.time}`
}
