import type { Bi } from "@/lib/mock/bi"

/*
 * Measures are defined once (brief §4) and read by every dashboard, saved report, builder preview and official
 * return. The report's "About" card prints the definition, so "no-show" means the same thing everywhere.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

export type MeasureId =
  | "visits"
  | "newPatients"
  | "avgWait"
  | "noShowRate"
  | "missedVisits"
  | "revenue"
  | "revenueMissed"
  | "claimRejections"
  | "labTurnaround"
  | "notesOnTime"
  | "rating"
  | "roomsInUse"
  | "avgVisit"
  | "returns30"
  | "visitsPerDoctor"
  | "antibiotics"

export type Unit = "count" | "percent" | "minutes" | "sar" | "hours" | "stars"
/** Which way is good: a rise in visits is good, a rise in no-shows is bad. */
export type Better = "up" | "down"
/** Where the numbers come from (the builder's "1 Data" choices). */
export type SourceId = "appointments" | "visits" | "invoices" | "claims" | "lab" | "prescriptions"

export type Measure = {
  id: MeasureId
  name: Bi
  unit: Unit
  better: Better
  source: SourceId
  /** The rule, as the About card prints it ("Not checked in 30 min after the time"). */
  rule: Bi
  /** The label the About card puts before the rule ("Counts as no-show"). */
  ruleLabel: Bi
  /** Thresholds the tables colour by (amber / red) and the goal badge. */
  goal?: number
  amberOver?: number
  redOver?: number
  amberUnder?: number
}

export const MEASURES: Record<MeasureId, Measure> = {
  visits: {
    id: "visits",
    name: bi("Visits", "الزيارات"),
    unit: "count",
    better: "up",
    source: "visits",
    ruleLabel: bi("Counts as a visit", "تنحسب زيارة"),
    rule: bi("Checked in and seen by a doctor", "سجّل حضوره وشافه الطبيب"),
  },
  newPatients: {
    id: "newPatients",
    name: bi("New patients", "مرضى جدد"),
    unit: "count",
    better: "up",
    source: "visits",
    ruleLabel: bi("Counts as new", "ينحسب جديد"),
    rule: bi("First visit to the center", "أول زيارة للمركز"),
  },
  avgWait: {
    id: "avgWait",
    name: bi("Average wait", "متوسط الانتظار"),
    unit: "minutes",
    better: "down",
    source: "visits",
    ruleLabel: bi("Wait is", "الانتظار"),
    rule: bi("From check-in to the doctor", "من التسجيل للطبيب"),
    goal: 15,
    amberOver: 20,
  },
  noShowRate: {
    id: "noShowRate",
    name: bi("No-show rate", "نسبة عدم الحضور"),
    unit: "percent",
    better: "down",
    source: "appointments",
    ruleLabel: bi("Counts as no-show", "ينحسب عدم حضور"),
    rule: bi("Not checked in 30 min after the time", "ما سجّل حضوره بعد الموعد بـ 30 دقيقة"),
    redOver: 12,
  },
  missedVisits: {
    id: "missedVisits",
    name: bi("Missed visits", "زيارات فاتت"),
    unit: "count",
    better: "down",
    source: "appointments",
    ruleLabel: bi("Counts as missed", "تنحسب فايتة"),
    rule: bi("A no-show that wasn't rebooked the same day", "عدم حضور ما انحجز له نفس اليوم"),
  },
  revenue: {
    id: "revenue",
    name: bi("Revenue", "الإيرادات"),
    unit: "sar",
    better: "up",
    source: "invoices",
    ruleLabel: bi("Counts as revenue", "تنحسب إيراد"),
    rule: bi("Invoiced, before VAT, credit notes taken off", "المفوتر قبل الضريبة، بعد خصم الإشعارات الدائنة"),
  },
  revenueMissed: {
    id: "revenueMissed",
    name: bi("Revenue missed", "إيراد فات"),
    unit: "sar",
    better: "down",
    source: "appointments",
    ruleLabel: bi("Estimated as", "ينحسب كذا"),
    rule: bi("Missed visits × the price list", "الزيارات الفايتة × قائمة الأسعار"),
  },
  claimRejections: {
    id: "claimRejections",
    name: bi("Claim rejections", "رفض المطالبات"),
    unit: "percent",
    better: "down",
    source: "claims",
    ruleLabel: bi("Counts as rejected", "تنحسب مرفوضة"),
    rule: bi("Rejected in full or in part by the insurer", "رفضتها شركة التأمين كلها أو جزء منها"),
  },
  labTurnaround: {
    id: "labTurnaround",
    name: bi("Lab turnaround", "وقت نتائج المختبر"),
    unit: "hours",
    better: "down",
    source: "lab",
    ruleLabel: bi("Turnaround is", "الوقت"),
    rule: bi("From the sample taken to the result released", "من سحب العينة لطلوع النتيجة"),
  },
  notesOnTime: {
    id: "notesOnTime",
    name: bi("Notes on time", "الملاحظات بوقتها"),
    unit: "percent",
    better: "up",
    source: "visits",
    ruleLabel: bi("On time means", "بوقتها يعني"),
    rule: bi("Visit note signed within 24 h", "ملاحظة الزيارة انوقّعت خلال 24 ساعة"),
    amberUnder: 90,
  },
  rating: {
    id: "rating",
    name: bi("Patient rating", "تقييم المرضى"),
    unit: "stars",
    better: "up",
    source: "visits",
    ruleLabel: bi("Rating is", "التقييم"),
    rule: bi("The SMS survey after the visit, out of 5", "استبيان الرسالة بعد الزيارة، من 5"),
  },
  roomsInUse: {
    id: "roomsInUse",
    name: bi("Rooms in use", "استخدام الغرف"),
    unit: "percent",
    better: "up",
    source: "appointments",
    ruleLabel: bi("In use means", "مستخدمة يعني"),
    rule: bi("Booked hours ÷ open hours", "الساعات المحجوزة ÷ ساعات الدوام"),
  },
  avgVisit: {
    id: "avgVisit",
    name: bi("Average visit", "متوسط الزيارة"),
    unit: "minutes",
    better: "down",
    source: "visits",
    ruleLabel: bi("Visit length is", "مدة الزيارة"),
    rule: bi("From the doctor calling the patient in to the note saved", "من نداء الطبيب للمريض لحفظ الملاحظة"),
  },
  returns30: {
    id: "returns30",
    name: bi("30-day returns", "عودة خلال 30 يوم"),
    unit: "percent",
    better: "down",
    source: "visits",
    ruleLabel: bi("Counts as a return", "تنحسب عودة"),
    rule: bi("Back within 30 days for the same diagnosis", "رجع خلال 30 يوم بنفس التشخيص"),
  },
  visitsPerDoctor: {
    id: "visitsPerDoctor",
    name: bi("Visits a doctor a day", "زيارات الطبيب باليوم"),
    unit: "count",
    better: "up",
    source: "visits",
    ruleLabel: bi("Counted as", "تنحسب كذا"),
    rule: bi("Visits ÷ doctor working days", "الزيارات ÷ أيام دوام الأطباء"),
  },
  antibiotics: {
    id: "antibiotics",
    name: bi("Antibiotic prescribing", "وصف المضادات الحيوية"),
    unit: "percent",
    better: "down",
    source: "prescriptions",
    ruleLabel: bi("Counted as", "تنحسب كذا"),
    rule: bi("Prescriptions with an antibiotic ÷ all prescriptions", "الوصفات اللي فيها مضاد حيوي ÷ كل الوصفات"),
    amberOver: 15,
  },
}

export const SOURCES: { id: SourceId; name: Bi }[] = [
  { id: "appointments", name: bi("Appointments", "المواعيد") },
  { id: "visits", name: bi("Visits + diagnoses", "الزيارات + التشخيصات") },
  { id: "invoices", name: bi("Invoices + payments", "الفواتير + المدفوعات") },
  { id: "claims", name: bi("Insurance claims", "مطالبات التأمين") },
  { id: "lab", name: bi("Lab orders", "طلبات المختبر") },
  { id: "prescriptions", name: bi("Prescriptions", "الوصفات") },
]

/** A threshold tone for a value of a measure (tables and KPIs colour by these, nothing else). */
export function toneOf(m: MeasureId, v: number): "destructive" | "warning" | undefined {
  const x = MEASURES[m]
  if (x.redOver !== undefined && v > x.redOver) return "destructive"
  if (x.amberOver !== undefined && v > x.amberOver) return "warning"
  if (x.amberUnder !== undefined && v < x.amberUnder) return "warning"
  return undefined
}

/**
 * The change badge: a signed number with no unit word ("+0.6", "−1.2"); English adds "pt" for percentage points,
 * Arabic leaves it to the label. Good = green, bad = red, by the measure's direction.
 */
export type ChangeKind = "relative" | "points" | "abs"
export function changeOf(m: MeasureId, now: number, before: number, kind: ChangeKind = "relative") {
  const diff = kind === "relative" ? (before === 0 ? 0 : ((now - before) / before) * 100) : now - before
  const rounded = Math.round(diff * 10) / 10
  const good = MEASURES[m].better === "up" ? rounded >= 0 : rounded <= 0
  return { value: rounded, kind, good }
}
