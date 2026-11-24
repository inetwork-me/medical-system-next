import type { Bi } from "@/lib/mock/bi"
import type { ChangeKind, MeasureId } from "./measures"

/*
 * The figures the Overview shows, as the reports server returns them for the signed-in user's branches over 1–22 Nov
 * (vs October). The dashboards (step 3) break the same numbers down; the server stub hands these back.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

export type Figure = { measure: MeasureId; now: number; before: number; kind: ChangeKind; unit?: string }

export const OVERVIEW = {
  visits: { measure: "visits", now: 8412, before: 7936, kind: "relative" },
  revenue: { measure: "revenue", now: 2_840_000, before: 2_731_000, kind: "relative" },
  collectedPct: 81,
  noShow: { measure: "noShowRate", now: 9.8, before: 11.0, kind: "points" },
  missedVisits: 889,
  claimRejections: { measure: "claimRejections", now: 4.1, before: 3.5, kind: "points" },
  rejectedAmount: 137_000,
} satisfies Record<string, Figure | number>

export type AreaId = "operations" | "finance" | "clinical" | "doctors"

/** Area cards: 2 headline figures each and the last 10 days (today is the last, dark bar). */
export const AREAS: { id: AreaId; icon: "trend-up" | "money-recive" | "activity" | "people"; figures: [Figure, Figure]; days: number[] }[] = [
  {
    id: "operations",
    icon: "trend-up",
    figures: [OVERVIEW.visits, OVERVIEW.noShow],
    days: [412, 455, 438, 470, 401, 449, 476, 463, 480, 304],
  },
  {
    id: "finance",
    icon: "money-recive",
    figures: [OVERVIEW.revenue, OVERVIEW.claimRejections],
    days: [131, 142, 128, 150, 120, 139, 155, 133, 141, 96],
  },
  {
    id: "clinical",
    icon: "activity",
    figures: [
      { measure: "labTurnaround", now: 3.2, before: 3.6, kind: "abs", unit: "h" },
      { measure: "returns30", now: 2.1, before: 2.1, kind: "points" },
    ],
    days: [3.4, 3.3, 3.6, 3.5, 3.3, 3.2, 3.4, 3.1, 3.2, 2.9],
  },
  {
    id: "doctors",
    icon: "people",
    figures: [
      { measure: "visitsPerDoctor", now: 14.2, before: 13.4, kind: "abs" },
      { measure: "notesOnTime", now: 94, before: 95, kind: "points" },
    ],
    days: [13.8, 14.6, 13.1, 15.0, 12.4, 14.1, 15.2, 13.6, 14.4, 11.2],
  },
]

/** Saved reports the Overview needs (the library, step 4, holds the rest). */
export type SavedReportRef = { id: string; name: Bi; area: AreaId; when: Bi }
export const FAVOURITES: SavedReportRef[] = [
  { id: "no-shows-by-clinic", name: bi("No-shows by clinic", "عدم الحضور حسب العيادة"), area: "operations", when: bi("every Sunday", "كل أحد") },
  { id: "claim-rejections-by-insurer", name: bi("Claim rejections by insurer", "المطالبات المرفوضة حسب الشركة"), area: "finance", when: bi("run yesterday", "انشغّل أمس") },
  { id: "waiting-time-by-hour", name: bi("Waiting time by hour", "وقت الانتظار حسب الساعة"), area: "operations", when: bi("run today 08:00", "انشغّل اليوم 08:00") },
  { id: "notes-on-time", name: bi("Doctor notes signed on time", "ملاحظات الأطباء الموقّعة بوقتها"), area: "doctors", when: bi("every month", "كل شهر") },
]

/** Official returns still to submit, soonest first (Official returns, step 7, holds the full list). */
export type ReturnDue = { id: string; name: Bi; authority: "MOH" | "HESN" | "CCHI" | "ZATCA"; period: Bi; due: string; warnings: number }
export const RETURNS_DUE: ReturnDue[] = [
  { id: "hesn-weekly-47", name: bi("Notifiable diseases · HESN", "الأمراض المبلّغ عنها · حصن"), authority: "HESN", period: bi("Weekly", "أسبوعي"), due: "2026-11-23", warnings: 0 },
  { id: "moh-monthly-2611", name: bi("MOH monthly statistics", "إحصائية وزارة الصحة الشهرية"), authority: "MOH", period: bi("November", "نوفمبر"), due: "2026-12-10", warnings: 2 },
  { id: "zatca-vat-q4", name: bi("ZATCA VAT return", "إقرار ضريبة القيمة المضافة"), authority: "ZATCA", period: bi("Q4", "الربع الرابع"), due: "2027-01-31", warnings: 0 },
]

/** The next scheduled send (Schedules, step 6): Sunday 29 Nov 08:00, 6 reports to 14 people. */
export const NEXT_SEND = { at: "2026-11-29T08:00", reports: 6, people: 14 }
