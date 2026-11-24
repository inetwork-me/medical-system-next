import type { Bi } from "@/lib/mock/bi"
import { REP_TODAY, addDays } from "./data"

/*
 * The four dashboards' numbers as the reports server returns them for 1–22 Nov 2026 (Riyadh main, vs October).
 * Stub figures, one source: the KPIs, charts and tables of each dashboard read from here, and the Overview's area
 * cards show the same values.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

/* ------------------------------------------------------------------ operations */

/** Visits a day: the last 10 working days (Sunday–Thursday), today last. */
export function lastWorkingDays(n = 10, until = REP_TODAY): string[] {
  const out: string[] = []
  let d = until
  while (out.length < n) {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay()
    if (wd !== 5 && wd !== 6) out.unshift(d)
    d = addDays(d, -1)
  }
  return out
}
export const VISITS_A_DAY = [412, 455, 438, 470, 401, 449, 476, 463, 480, 304]

export type ClinicRow = { clinic: string; visits: number; noShow: number; wait: number; rooms: number; color: string }
export const CLINIC_ROWS: ClinicRow[] = [
  { clinic: "pediatrics", visits: 1920, noShow: 7.2, wait: 14, rooms: 88, color: "var(--chart-1)" },
  { clinic: "dental", visits: 1480, noShow: 13.6, wait: 11, rooms: 79, color: "var(--chart-2)" },
  { clinic: "cardiology", visits: 1210, noShow: 8.1, wait: 22, rooms: 91, color: "var(--chart-3)" },
  { clinic: "eyes", visits: 1040, noShow: 9.4, wait: 17, rooms: 74, color: "var(--chart-4)" },
  { clinic: "dermatology", visits: 980, noShow: 10.9, wait: 15, rooms: 69, color: "var(--chart-5)" },
  { clinic: "family", visits: 1782, noShow: 8.8, wait: 19, rooms: 93, color: "var(--chart-1)" },
]

export const OPS_KPIS = {
  visits: { now: 8412, before: 7936 },
  newPatients: { now: 1106, before: 1074, share: 13 },
  avgWait: { now: 18, goal: 15 },
  noShow: { now: 9.8, before: 11.0, worst: "dental" },
}

/* ------------------------------------------------------------------ finance */

/** Revenue by month (SAR), November so far last. */
export const REVENUE_BY_MONTH: { month: string; value: number }[] = [
  { month: "2026-06", value: 3_620_000 },
  { month: "2026-07", value: 3_410_000 },
  { month: "2026-08", value: 3_090_000 },
  { month: "2026-09", value: 3_710_000 },
  { month: "2026-10", value: 3_840_000 },
  { month: "2026-11", value: 2_840_000 },
]

export const WHO_PAID: { name: Bi; share: number; color: string }[] = [
  { name: bi("Bupa Arabia", "بوبا العربية"), share: 38, color: "var(--chart-1)" },
  { name: bi("Tawuniya", "التعاونية"), share: 22, color: "var(--chart-2)" },
  { name: bi("Patients · cash and cards", "المرضى · كاش وبطاقات"), share: 18, color: "var(--chart-3)" },
  { name: bi("MedGulf", "ميدغلف"), share: 9, color: "var(--chart-4)" },
  { name: bi("Al Rajhi Takaful", "تكافل الراجحي"), share: 8, color: "var(--chart-5)" },
]

export type RejectionRow = { reason: Bi; claims: number; amount: number; share: number; mostFrom?: Bi }
export const REJECTIONS: RejectionRow[] = [
  { reason: bi("Pre-authorization missing", "ما فيه موافقة مسبقة"), claims: 71, amount: 64_900, share: 41, mostFrom: bi("Bupa", "بوبا") },
  { reason: bi("Code doesn't match the service", "الكود ما يطابق الخدمة"), claims: 40, amount: 31_200, share: 23, mostFrom: bi("Tawuniya", "التعاونية") },
  { reason: bi("Not covered by the policy", "ما يغطيها التأمين"), claims: 31, amount: 22_750, share: 18, mostFrom: bi("MedGulf", "ميدغلف") },
  { reason: bi("Sent twice", "انرسلت مرتين"), claims: 16, amount: 9_800, share: 9, mostFrom: bi("Bupa", "بوبا") },
  { reason: bi("Other", "غيرها"), claims: 15, amount: 8_350, share: 9 },
]

export const FIN_KPIS = {
  revenue: { now: 2_840_000, before: 2_731_000 },
  collected: { amount: 2_310_000, pct: 81 },
  waiting: { amount: 412_000, claims: 1240, answerDays: 2.1 },
  rejected: { now: 4.1, before: 3.5, amount: 137_000, claims: 173 },
}

/* ------------------------------------------------------------------ clinical */

export const TOP_DIAGNOSES: { code: string; name: Bi; short: Bi; count: number }[] = [
  { code: "J06.9", name: bi("Upper respiratory infection", "التهاب الجهاز التنفسي العلوي"), short: bi("Upper respiratory", "التهاب الجهاز التنفسي"), count: 812 },
  { code: "I10", name: bi("High blood pressure", "ارتفاع ضغط الدم"), short: bi("High blood pressure", "ارتفاع ضغط الدم"), count: 604 },
  { code: "E11.9", name: bi("Type 2 diabetes", "السكري النوع الثاني"), short: bi("Type 2 diabetes", "السكري النوع الثاني"), count: 571 },
  { code: "K02.9", name: bi("Tooth decay", "تسوس الأسنان"), short: bi("Tooth decay", "تسوس الأسنان"), count: 498 },
  { code: "H52.1", name: bi("Short sight", "قصر النظر"), short: bi("Short sight", "قصر النظر"), count: 377 },
]

/** Lab turnaround by test (hours, sample to result); over the goal shows red. */
export const LAB_GOAL_HOURS = 4
export const LAB_TURNAROUND: { test: Bi; hours: number }[] = [
  { test: bi("CBC", "CBC"), hours: 1.4 },
  { test: bi("Kidney function", "وظائف الكلى"), hours: 2.6 },
  { test: bi("HbA1c", "HbA1c"), hours: 3.1 },
  { test: bi("Vitamin D", "فيتامين د"), hours: 6.5 },
]

/** Quality indicators (CBAHI / MOH, this quarter). `goal` is a floor, or a ceiling when `under`. */
export type Indicator = { name: Bi; value: number; goal: number; under?: boolean }
export const QUALITY: Indicator[] = [
  { name: bi("Diabetics with HbA1c checked in 6 months", "مرضى السكري اللي انفحص لهم HbA1c خلال 6 شهور"), value: 86, goal: 90 },
  { name: bi("High blood pressure under control", "ضغط الدم تحت السيطرة"), value: 71, goal: 70 },
  { name: bi("Antibiotics for colds", "مضادات حيوية لنزلات البرد"), value: 14, goal: 20, under: true },
  { name: bi("Children's vaccines on time", "تطعيمات الأطفال بوقتها"), value: 95, goal: 95 },
  { name: bi("Critical lab results told within 1 h", "النتائج الحرجة انبلّغت خلال ساعة"), value: 98, goal: 100 },
]
export const indicatorMet = (i: Indicator) => (i.under ? i.value < i.goal : i.value >= i.goal)

export const CLIN_KPIS = {
  labTurnaround: { now: 3.2, goal: LAB_GOAL_HOURS },
  returns30: { now: 2.1, before: 2.1 },
  prescriptions: { count: 5930, antibioticsPct: 14, goal: 20 },
}

/* ------------------------------------------------------------------ doctors */

/** `doctorKey` = the Doctors module's key, when that doctor exists there (the row opens the doctor's page). */
export type DoctorRow = { id: string; initials: string; name: Bi; clinic: string; visits: number; avgVisit: number; notesOnTime: number; rating: number; doctorKey?: string }
export const DOCTOR_ROWS: DoctorRow[] = [
  { id: "zaki", initials: "AZ", name: bi("Dr. Ahmed Zaki", "د. أحمد زكي"), clinic: "pediatrics", visits: 402, avgVisit: 12, notesOnTime: 98, rating: 4.8, doctorKey: "zaki" },
  { id: "hala", initials: "HN", name: bi("Dr. Hala Nasser", "د. هالة ناصر"), clinic: "dermatology", visits: 318, avgVisit: 15, notesOnTime: 96, rating: 4.7 },
  { id: "khaled", initials: "KM", name: bi("Dr. Khaled Mansour", "د. خالد منصور"), clinic: "cardiology", visits: 286, avgVisit: 19, notesOnTime: 91, rating: 4.6, doctorKey: "mansour" },
  { id: "sami", initials: "SO", name: bi("Dr. Sami Al-Otaibi", "د. سامي العتيبي"), clinic: "cardiology", visits: 241, avgVisit: 21, notesOnTime: 84, rating: 4.4 },
  { id: "lama", initials: "LS", name: bi("Dr. Lama Al-Saud", "د. لمى آل سعود"), clinic: "pediatrics", visits: 377, avgVisit: 13, notesOnTime: 97, rating: 4.9, doctorKey: "saud" },
  { id: "reem", initials: "RA", name: bi("Dr. Reem Al-Otaibi", "د. ريم العتيبي"), clinic: "eyes", visits: 295, avgVisit: 16, notesOnTime: 93, rating: 4.7, doctorKey: "otaibi" },
]

export const DOC_KPIS = {
  working: 46,
  onLeave: 3,
  clinics: 6,
  perDay: { now: 14.2, before: 13.4 },
  notesOnTime: { now: 94, goal: 95 },
  rating: { now: 4.6, answers: 2140 },
}
