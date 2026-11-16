import type { Bi } from "@/lib/mock/bi"
import type { IconName } from "@/components/ds/icon"
import { allPatients, missingOf, patientDetails, type BranchKey, type MissingField, type Patient } from "../data"

/**
 * Patients › Reports (mock data). Each report starts with the design's rows, then deterministic generated rows so
 * totals and chip counts match the design (312 registrations, 86 stays today, 1,946 visits, 214 log entries…)
 * and paging / filters behave like the real thing. Duplicates and incomplete files come from the patients data.
 */

export const REPORTS: { key: ReportKey; icon: IconName; badge: Bi }[] = [
  { key: "activity", icon: "activity", badge: { en: "Audit", ar: "تدقيق" } },
  { key: "registrations", icon: "user-add", badge: { en: "Period", ar: "فترة" } },
  { key: "stay", icon: "clock", badge: { en: "Operations", ar: "تشغيل" } },
  { key: "visits", icon: "calendar-tick", badge: { en: "Visits", ar: "زيارات" } },
  { key: "duplicates", icon: "people", badge: { en: "Data quality", ar: "جودة البيانات" } },
  { key: "incomplete", icon: "warning-2", badge: { en: "Data quality", ar: "جودة البيانات" } },
]
export type ReportKey = "activity" | "registrations" | "stay" | "visits" | "duplicates" | "incomplete"
export const REPORT_KEYS = REPORTS.map((r) => r.key)

/* ---------------------------------------------------------------- helpers */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function bag<T>(counts: [T, number][], rand: () => number): T[] {
  const out = counts.flatMap(([v, n]) => Array<T>(Math.max(0, n)).fill(v))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
const pad = (n: number) => String(n).padStart(2, "0")
const pick = <T>(list: T[], r: () => number) => list[Math.floor(r() * list.length)]
const byId = (id: string) => allPatients().find((p) => p.id === id)!
/** Generated rows reference ordinary files (not the design's named samples). */
const pool = () => allPatients().slice(12)

export type Staff = { initials: string; name: Bi; role: Bi }
export const STAFF: Record<string, Staff> = {
  RA: { initials: "RA", name: { en: "Reem Alotaibi", ar: "ريم العتيبي" }, role: { en: "Reception", ar: "الاستقبال" } },
  HF: { initials: "HF", name: { en: "Huda Fares", ar: "هدى فارس" }, role: { en: "Records", ar: "الملفات الطبية" } },
  SO: { initials: "SO", name: { en: "Sami Odeh", ar: "سامي عودة" }, role: { en: "Admin", ar: "الإدارة" } },
  MQ: { initials: "MQ", name: { en: "Majed Al-Qahtani", ar: "ماجد القحطاني" }, role: { en: "Reception", ar: "الاستقبال" } },
  KM: { initials: "KM", name: { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" }, role: { en: "Cardiology", ar: "القلب" } },
  AZ: { initials: "AZ", name: { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }, role: { en: "Pediatrics", ar: "الأطفال" } },
}
const DESK = ["RA", "HF", "SO", "MQ"]

export const BRANCH: Record<BranchKey, Bi> = {
  main: { en: "Main", ar: "الرئيسي" },
  olaya: { en: "Olaya", ar: "العليا" },
  jeddah: { en: "Jeddah", ar: "جدة" },
}

/** Period filter shared by the dated reports. */
export type Period = "all" | "last7"
export const inPeriod = (day: number, p: Period) => p === "all" || day >= 9

/* ================================================================== 1 · activity log (214) */

export type ActionKind = "added" | "edited" | "deleted" | "merged" | "banned"
export type LogRow = { id: string; day: number; time: string; staff: string; kind: ActionKind; patient: Patient | null; mrn: string; change: Bi; branch: BranchKey }

const LOG_DESIGN: [number, string, string, ActionKind, string | null, string, Bi, BranchKey][] = [
  [15, "09:41", "RA", "edited", "004812", "004812", { en: "Phone: 050 111 2233 → 050 123 4567", ar: "الجوال: 050 111 2233 ← 050 123 4567" }, "main"],
  [15, "09:12", "KM", "added", "004833", "004833", { en: "Allergy: Penicillin", ar: "حساسية: البنسلين" }, "main"],
  [14, "16:05", "HF", "merged", "004861", "004861", { en: "Merged MRN 004712 into 004861", ar: "دمج ملف 004712 في 004861" }, "olaya"],
  [14, "11:30", "SO", "banned", "004870", "004870", { en: "Reason: repeated no-show (5)", ar: "السبب: غياب متكرر (5)" }, "main"],
  [13, "10:02", "RA", "added", "004880", "004880", { en: "New patient registered", ar: "تسجيل مريض جديد" }, "jeddah"],
  [12, "14:48", "AZ", "edited", "004857", "004857", { en: "Weight: 24 → 25.5 kg", ar: "الوزن: 24 ← 25.5 كجم" }, "main"],
  [12, "08:20", "SO", "deleted", null, "004699", { en: "Removed test record", ar: "حذف ملف تجريبي" }, "main"],
  [11, "17:15", "RA", "edited", "004874", "004874", { en: "Classification: Regular → VIP", ar: "التصنيف: عادي ← VIP" }, "olaya"],
]
const CHANGES: Record<ActionKind, Bi[]> = {
  added: [
    { en: "New patient registered", ar: "تسجيل مريض جديد" },
    { en: "Allergy: Peanuts", ar: "حساسية: الفول السوداني" },
    { en: "Insurance card uploaded", ar: "رفع بطاقة التأمين" },
    { en: "Lab results: CBC", ar: "نتائج تحاليل: CBC" },
    { en: "Clinical note", ar: "ملاحظة طبية" },
  ],
  edited: [
    { en: "Address updated", ar: "تحديث العنوان" },
    { en: "Phone number updated", ar: "تحديث رقم الجوال" },
    { en: "Insurance class updated", ar: "تحديث فئة التأمين" },
    { en: "National ID added", ar: "إضافة رقم الهوية" },
    { en: "Emergency contact updated", ar: "تحديث شخص الطوارئ" },
  ],
  deleted: [{ en: "Removed duplicate test record", ar: "حذف ملف تجريبي مكرر" }],
  merged: [{ en: "Merged a duplicate file", ar: "دمج ملف مكرر" }],
  banned: [{ en: "Reason: unpaid balance", ar: "السبب: مبالغ ما انسددت" }],
}

let logCache: LogRow[] | null = null
export function activityRows(): LogRow[] {
  if (logCache) return logCache
  const r = mulberry32(214)
  const design = LOG_DESIGN.map(([day, time, staff, kind, pid, mrn, change, branch], i) => ({
    id: `d${i}`,
    day,
    time,
    staff,
    kind,
    patient: pid ? byId(pid) : null,
    mrn,
    change,
    branch,
  }))
  const kinds = bag<ActionKind>([["added", 59], ["edited", 115], ["deleted", 6], ["merged", 18], ["banned", 8]], r)
  const people = pool()
  const gen: LogRow[] = kinds.map((kind, i) => {
    const p = pick(people, r)
    const day = 11 - Math.floor((i / kinds.length) * 11) // 11 → 1 Nov
    return {
      id: `g${i}`,
      day: Math.max(1, day),
      time: `${pad(8 + Math.floor(r() * 10))}:${pad(Math.floor(r() * 60))}`,
      staff: kind === "deleted" || kind === "banned" ? "SO" : pick([...DESK, "KM", "AZ"], r),
      kind,
      patient: kind === "deleted" ? null : p,
      mrn: p.mrn,
      change: pick(CHANGES[kind], r),
      branch: p.branch,
    }
  })
  gen.sort((a, b) => b.day - a.day || b.time.localeCompare(a.time))
  logCache = [...design, ...gen]
  return logCache
}

/* ================================================================== 2 · registrations by period (312) */

export const REG_DAYS = [18, 22, 20, 25, 19, 14, 34, 27, 21, 24, 23, 17, 16, 22, 10]
export type Source = "walkin" | "online" | "referral" | "insurance"
export type RegRow = { id: string; day: number; time: string; patient: Patient; branch: BranchKey; staff: string; source: Source; complete: boolean }

const REG_DESIGN: [number, string, string, BranchKey, string, Source, boolean][] = [
  [15, "10:02", "004880", "main", "RA", "walkin", true],
  [15, "09:40", "004891", "main", "RA", "online", false],
  [14, "17:22", "004857", "olaya", "HF", "referral", false],
  [14, "12:10", "004874", "main", "MQ", "insurance", true],
  [13, "16:48", "004833", "jeddah", "SO", "walkin", true],
  [13, "11:05", "004870", "main", "RA", "online", true],
  [12, "09:15", "004861", "olaya", "HF", "walkin", true],
]

let regCache: RegRow[] | null = null
export function registrationRows(): RegRow[] {
  if (regCache) return regCache
  const r = mulberry32(312)
  const design: RegRow[] = REG_DESIGN.map(([day, time, pid, branch, staff, source, complete], i) => ({ id: `d${i}`, day, time, patient: byId(pid), branch, staff, source, complete }))
  const sources = bag<Source>([["walkin", 138], ["online", 94], ["referral", 42], ["insurance", 31]], r)
  const incomplete = bag<boolean>([[false, 39], [true, 305 - 39]], r)
  const people = pool()
  const gen: RegRow[] = []
  let k = 0
  for (let day = 15; day >= 1; day--) {
    const n = REG_DAYS[day - 1] - design.filter((x) => x.day === day).length
    const times = Array.from({ length: n }, () => `${pad(8 + Math.floor(r() * 11))}:${pad(Math.floor(r() * 60))}`).sort().reverse()
    for (const time of times) {
      const p = pick(people, r)
      gen.push({ id: `g${k}`, day, time, patient: p, branch: p.branch, staff: pick(DESK, r), source: sources[k], complete: incomplete[k] })
      k++
    }
  }
  // Design rows first (page 1 as designed), then the rest newest first.
  regCache = [...design, ...gen.sort((a, b) => b.day - a.day || b.time.localeCompare(a.time))]
  return regCache
}

/* ================================================================== 3 · length of stay (today · 86) */

export type Dept = "emergency" | "cardiology" | "pediatrics" | "dental" | "dermatology" | "lab"
export const DEPT: Record<Dept, Bi> = {
  emergency: { en: "Emergency", ar: "الطوارئ" },
  cardiology: { en: "Cardiology", ar: "القلب" },
  pediatrics: { en: "Pediatrics", ar: "الأطفال" },
  dental: { en: "Dental", ar: "الأسنان" },
  dermatology: { en: "Dermatology", ar: "الجلدية" },
  lab: { en: "Lab only", ar: "تحاليل فقط" },
}
/** Average minutes per department (design chart). */
export const STAY_DEPT: [Dept, number][] = [["emergency", 155], ["cardiology", 115], ["pediatrics", 80], ["dental", 65], ["dermatology", 50], ["lab", 35]]
export const STAY_STEPS: [Bi, number, string][] = [
  [{ en: "Reception", ar: "الاستقبال" }, 12, "chart-1"],
  [{ en: "Waiting", ar: "الانتظار" }, 38, "warning"],
  [{ en: "Consultation", ar: "الكشف" }, 22, "chart-2"],
  [{ en: "Lab & imaging", ar: "التحاليل والأشعة" }, 18, "chart-4"],
  [{ en: "Billing & exit", ar: "المحاسبة والخروج" }, 12, "chart-3"],
]
export type StayRow = { id: string; patient: Patient; dept: Dept; in: string; out: string; minutes: number; staff: Bi }
const STAY_DESIGN: [string, Dept, string, string, Bi][] = [
  ["004812", "cardiology", "08:12", "10:04", { en: "Reem · Dr. Khaled", ar: "ريم · د. خالد" }],
  ["004861", "emergency", "07:40", "11:58", { en: "Majed · Dr. Reem", ar: "ماجد · د. ريم" }],
  ["004891", "pediatrics", "09:05", "10:12", { en: "Huda · Dr. Ahmed", ar: "هدى · د. أحمد" }],
  ["004833", "cardiology", "09:30", "12:02", { en: "Reem · Dr. Khaled", ar: "ريم · د. خالد" }],
  ["004880", "dental", "10:00", "10:58", { en: "Sami · Dr. Sami", ar: "سامي · د. سامي" }],
  ["004874", "lab", "10:20", "10:51", { en: "Huda", ar: "هدى" }],
  ["004857", "pediatrics", "11:15", "12:40", { en: "Huda · Dr. Ahmed", ar: "هدى · د. أحمد" }],
]
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const toTime = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
const DUTY: Record<Dept, Bi[]> = {
  emergency: [{ en: "Majed · Dr. Reem", ar: "ماجد · د. ريم" }],
  cardiology: [{ en: "Reem · Dr. Khaled", ar: "ريم · د. خالد" }],
  pediatrics: [{ en: "Huda · Dr. Ahmed", ar: "هدى · د. أحمد" }],
  dental: [{ en: "Sami · Dr. Sami", ar: "سامي · د. سامي" }],
  dermatology: [{ en: "Reem · Dr. Huda", ar: "ريم · د. هدى" }],
  lab: [{ en: "Huda", ar: "هدى" }],
}
export const STAY_TARGET = 120

let stayCache: StayRow[] | null = null
export function stayRows(): StayRow[] {
  if (stayCache) return stayCache
  const r = mulberry32(86)
  const design: StayRow[] = STAY_DESIGN.map(([pid, dept, tin, tout, staff], i) => ({ id: `d${i}`, patient: byId(pid), dept, in: tin, out: tout, minutes: toMin(tout) - toMin(tin), staff }))
  // 21 emergency · 58 outpatient · 7 lab only = 86; 16 over the 2h target (2 in the design rows)
  const depts = bag<Dept>([["emergency", 20], ["cardiology", 16], ["pediatrics", 14], ["dental", 13], ["dermatology", 10], ["lab", 6]], r)
  const over = bag<boolean>([[true, 14], [false, depts.length - 14]], r)
  const people = pool()
  const gen = depts.map((dept, i) => {
    const avg = STAY_DEPT.find((d) => d[0] === dept)![1]
    const minutes = over[i] ? 125 + Math.floor(r() * 120) : Math.max(20, Math.min(118, Math.round(avg * (0.55 + r() * 0.5))))
    const start = 7 * 60 + Math.floor(r() * 8 * 60)
    return { id: `g${i}`, patient: pick(people, r), dept, in: toTime(start), out: toTime(start + minutes), minutes, staff: DUTY[dept][0] }
  })
  stayCache = [...design, ...gen.sort((a, b) => a.in.localeCompare(b.in))]
  return stayCache
}
export const isOutpatient = (d: Dept) => d !== "emergency" && d !== "lab"

/* ================================================================== 4 · patient visits (1,946) */

export type VClinic = "lab" | "pediatrics" | "cardiology" | "dental" | "orthopedics" | "dermatology"
export const CLINIC: Record<VClinic, Bi> = {
  lab: { en: "Lab", ar: "التحاليل" },
  pediatrics: { en: "Pediatrics", ar: "الأطفال" },
  cardiology: { en: "Cardiology", ar: "القلب" },
  dental: { en: "Dental", ar: "الأسنان" },
  orthopedics: { en: "Orthopedics", ar: "العظام" },
  dermatology: { en: "Dermatology", ar: "الجلدية" },
}
export const CLINIC_COUNTS: [VClinic, number][] = [["lab", 491], ["pediatrics", 428], ["cardiology", 312], ["dental", 276], ["orthopedics", 241], ["dermatology", 198]]
export const DOCTOR: Record<string, { name: Bi; clinic: VClinic }> = {
  km: { name: { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" }, clinic: "cardiology" },
  ra: { name: { en: "Dr. Reem Alotaibi", ar: "د. ريم العتيبي" }, clinic: "cardiology" },
  az: { name: { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }, clinic: "pediatrics" },
  hf: { name: { en: "Dr. Huda Fares", ar: "د. هدى فارس" }, clinic: "orthopedics" },
  so: { name: { en: "Dr. Sami Odeh", ar: "د. سامي عودة" }, clinic: "dental" },
  ln: { name: { en: "Dr. Lama Nasser", ar: "د. لمى ناصر" }, clinic: "dermatology" },
  lb: { name: { en: "Lab team", ar: "فريق المختبر" }, clinic: "lab" },
}
export type Booking = "online" | "walkin" | "phone" | "referral"
export type VStatus = "completed" | "inProgress" | "confirmed" | "pending" | "cancelled" | "noShow"
export type VisitRow = { id: string; day: number; time: string; patient: Patient; doctor: string; clinic: VClinic; booking: Booking; status: VStatus; amount: number }
const VIS_DESIGN: [number, string, string, string, VClinic, Booking, VStatus, number][] = [
  [15, "08:30", "004812", "km", "cardiology", "online", "completed", 450],
  [15, "09:15", "004833", "ra", "cardiology", "phone", "inProgress", 1200],
  [15, "10:00", "004857", "az", "pediatrics", "walkin", "confirmed", 350],
  [14, "16:30", "004861", "hf", "orthopedics", "referral", "pending", 640],
  [14, "11:30", "004870", "so", "dermatology", "online", "cancelled", 0],
  [13, "09:30", "004874", "km", "cardiology", "online", "completed", 2800],
  [13, "08:45", "004880", "so", "dental", "walkin", "noShow", 0],
]
const PRICE: Record<VClinic, number[]> = {
  lab: [120, 180, 280],
  pediatrics: [250, 350],
  cardiology: [450, 650, 1200],
  dental: [300, 520, 800],
  orthopedics: [400, 640],
  dermatology: [300, 450],
}

let visCache: VisitRow[] | null = null
export function visitRows(): VisitRow[] {
  if (visCache) return visCache
  const r = mulberry32(1946)
  const design: VisitRow[] = VIS_DESIGN.map(([day, time, pid, doctor, clinic, booking, status, amount], i) => ({ id: `d${i}`, day, time, patient: byId(pid), doctor, clinic, booking, status, amount }))
  const used = (c: VClinic) => design.filter((d) => d.clinic === c).length
  const clinics = bag<VClinic>(CLINIC_COUNTS.map(([c, n]) => [c, n - used(c)]), r)
  const statuses = bag<VStatus>([["completed", 1594], ["confirmed", 97], ["cancelled", 130], ["noShow", 43], ["inProgress", 39], ["pending", 36]], r)
  const bookings = bag<Booking>([["online", 892], ["walkin", 601], ["phone", 291], ["referral", 155]], r)
  const docs = Object.entries(DOCTOR)
  const people = pool()
  const gen: VisitRow[] = clinics.map((clinic, i) => {
    const status = statuses[i]
    const day = 15 - Math.floor((i / clinics.length) * 15)
    return {
      id: `g${i}`,
      day: Math.max(1, day),
      time: `${pad(8 + Math.floor(r() * 10))}:${pick(["00", "15", "30", "45"], r)}`,
      patient: pick(people, r),
      doctor: pick(docs.filter(([, d]) => d.clinic === clinic), r)?.[0] ?? "lb",
      clinic,
      booking: bookings[i],
      status,
      amount: status === "cancelled" || status === "noShow" ? 0 : pick(PRICE[clinic], r),
    }
  })
  // Calibrate amounts so the period revenue matches the design (SAR 612,400).
  const designSum = design.reduce((s, x) => s + x.amount, 0)
  const genSum = gen.reduce((s, x) => s + x.amount, 0)
  const k = (612_400 - designSum) / genSum
  for (const g of gen) g.amount = Math.round((g.amount * k) / 10) * 10
  // Spread the rounding drift over paid visits, 10 riyals at a time.
  let drift = 612_400 - designSum - gen.reduce((s, x) => s + x.amount, 0)
  for (let i = 0; drift !== 0 && i < gen.length * 4; i++) {
    const g = gen[i % gen.length]
    if (g.amount <= 10) continue
    const step = Math.sign(drift) * 10
    g.amount += step
    drift -= step
  }
  visCache = [...design, ...gen.sort((a, b) => b.day - a.day || a.time.localeCompare(b.time))]
  return visCache
}

/* ================================================================== 5 · duplicate patients (23 groups) */

export type DupReason = "phone" | "whatsapp" | "nationalId" | "nameBirth"
export type DupField = "name" | "phone" | "whatsapp" | "nationalId" | "birth" | "visits" | "lastVisit"
export type DupGroup = { id: string; high: boolean; reasons: DupReason[]; keep: Patient; drop: Patient; matched: DupField[] }

const DUP_DESIGN: [boolean, DupReason[], string, string, DupField[]][] = [
  [true, ["phone"], "004891", "004520", ["phone", "name", "birth"]],
  [true, ["nationalId"], "004861", "004712", ["nationalId", "birth"]],
  [false, ["whatsapp"], "004880", "003998", ["phone", "whatsapp"]],
]
const MATCHED: Record<DupReason, DupField[]> = {
  phone: ["phone"],
  whatsapp: ["phone", "whatsapp"],
  nationalId: ["nationalId", "birth"],
  nameBirth: ["name", "birth"],
}

/** 3 design groups + one per generated "possible duplicate" file (paired with its look-alike), 23 in all. */
export function duplicateGroups(list: Patient[]): DupGroup[] {
  const r = mulberry32(23)
  const get = (id?: string) => list.find((p) => p.id === id)
  const groups: DupGroup[] = []
  for (const [high, reasons, a, b, matched] of DUP_DESIGN) {
    const keep = get(a)
    const drop = get(b)
    if (keep && drop) groups.push({ id: `${a}-${b}`, high, reasons, keep, drop, matched })
  }
  const reasons = bag<DupReason>([["phone", 10], ["whatsapp", 4], ["nationalId", 3], ["nameBirth", 3]], r)
  const tagged = allPatients()
    .filter((p) => p.tags.includes("duplicate") && !DUP_DESIGN.some((d) => d[2] === p.id))
    .slice(0, 20)
  tagged.forEach((base, i) => {
    const keep = get(base.id)
    const drop = get(base.duplicateOf)
    if (!keep || !drop || !keep.tags.includes("duplicate")) return
    const reason = reasons[i]
    groups.push({ id: `${keep.id}-${drop.id}`, high: reason === "nationalId" || reason === "nameBirth" || r() < 0.3, reasons: [reason], keep, drop, matched: MATCHED[reason] })
  })
  return groups
}

/** Field values for a record card (matched values mirror the main file, as the data-quality check found them). */
export function dupValues(g: DupGroup, side: "keep" | "drop") {
  const p = g[side]
  const d = patientDetails(p)
  const k = patientDetails(g.keep)
  const same = (f: DupField) => side === "drop" && g.matched.includes(f)
  return {
    phone: same("phone") ? g.keep.mobile : p.mobile,
    whatsapp: same("whatsapp") || same("phone") ? g.keep.mobile : d.whatsapp,
    nationalId: same("nationalId") ? k.nationalId : d.nationalId,
    birth: same("birth") ? k.birthDate : missingOf(p).includes("birthDate") ? null : d.birthDate,
    visits: p.visits,
    lastVisit: p.lastVisit,
  }
}

/* ================================================================== 6 · incomplete records (128) */

export type IncRow = { patient: Patient; missing: MissingField[]; completeness: number; staff: string }

export function incompleteRows(list: Patient[]): IncRow[] {
  const r = mulberry32(77)
  const rows = list
    .filter((p) => p.tags.includes("incomplete"))
    .map((p) => {
      const missing = missingOf(p)
      return { patient: p, missing, completeness: (10 - missing.length) / 10, staff: pick(DESK, r) }
    })
  const first = ["004891", "004857"]
  return [...rows.filter((x) => first.includes(x.patient.id)).sort((a, b) => first.indexOf(a.patient.id) - first.indexOf(b.patient.id)), ...rows.filter((x) => !first.includes(x.patient.id)).sort((a, b) => b.patient.lastVisit.localeCompare(a.patient.lastVisit))]
}
