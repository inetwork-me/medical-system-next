import type { IconName } from "@/components/ds/icon"
import type { StatusTone } from "@/components/ds/status-badge"
import type { Bi } from "./bi"

/** Dashboard sample data from design-scripts/dash_widgets.py + dash_common.py. Replace with API data later. */

export const VISITS_YEAR = 2026
/** Monthly visits (Jan…Dec), share of the 0–100 axis, as in the design. */
export const VISITS = {
  inPerson: [62, 70, 66, 78, 72, 84, 80, 88, 76, 92, 86, 95],
  telehealth: [30, 34, 38, 40, 46, 44, 50, 54, 52, 58, 60, 64],
}

export type AppointmentStatus = "completed" | "inProgress" | "confirmed" | "pending" | "cancelled"

export const STATUS_TONE: Record<AppointmentStatus, StatusTone> = {
  completed: "success",
  inProgress: "info",
  confirmed: "success",
  pending: "warning",
  cancelled: "destructive",
}

export type TodayAppointment = {
  id: string
  initials: string
  patient: Bi
  mrn: string
  doctor: Bi
  time: string
  status: AppointmentStatus
}

export const TODAY_APPOINTMENTS: TodayAppointment[] = [
  { id: "a1", initials: "SA", patient: { en: "Sara Ahmed", ar: "سارة أحمد" }, mrn: "004812", doctor: { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" }, time: "08:30", status: "completed" },
  { id: "a2", initials: "OH", patient: { en: "Omar Al-Harbi", ar: "عمر الحربي" }, mrn: "004833", doctor: { en: "Dr. Reem Alotaibi", ar: "د. ريم العتيبي" }, time: "09:15", status: "inProgress" },
  { id: "a3", initials: "LH", patient: { en: "Lina Haddad", ar: "لينا حداد" }, mrn: "004857", doctor: { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }, time: "10:00", status: "confirmed" },
  { id: "a4", initials: "YN", patient: { en: "Yousef Nasser", ar: "يوسف ناصر" }, mrn: "004861", doctor: { en: "Dr. Huda Fares", ar: "د. هدى فارس" }, time: "10:45", status: "pending" },
  { id: "a5", initials: "MS", patient: { en: "Maha Saleh", ar: "مها صالح" }, mrn: "004870", doctor: { en: "Dr. Sami Odeh", ar: "د. سامي عودة" }, time: "11:30", status: "cancelled" },
]
export const APPOINTMENTS_SUMMARY = { scheduled: 12, remainingThisHour: 3 }

export type AttentionItem = {
  id: string
  icon: IconName
  tone: "destructive" | "warning" | "info" | "accent"
  title: Bi
  detail: Bi
  time: string
}

export const ATTENTION: AttentionItem[] = [
  { id: "t1", icon: "danger", tone: "destructive", title: { en: "Critical lab value", ar: "نتيجة تحليل حرجة" }, detail: { en: "Potassium 6.4 mmol/L · Sara Ahmed", ar: "البوتاسيوم 6.4 mmol/L · سارة أحمد" }, time: "09:12" },
  { id: "t2", icon: "warning-2", tone: "warning", title: { en: "Follow-up overdue", ar: "متابعة متأخرة" }, detail: { en: "Yousef Nasser · 2-week review", ar: "يوسف ناصر · مراجعة بعد أسبوعين" }, time: "08:40" },
  { id: "t3", icon: "clipboard-text", tone: "info", title: { en: "Discharge summary to sign", ar: "ملخص خروج ينتظر توقيعك" }, detail: { en: "Room 214 · Dr. Khaled Mansour", ar: "الغرفة 214 · د. خالد منصور" }, time: "08:05" },
  { id: "t4", icon: "drop", tone: "accent", title: { en: "Blood units low", ar: "مخزون الدم قليل" }, detail: { en: "O− · 4 units left in bank", ar: "باقي 4 وحدات · فصيلة O سالب" }, time: "07:50" },
]
export const ATTENTION_UPDATED = "09:12"
export const ER_CAPACITY = { used: 42, total: 54 }

export type BedRow = { id: string; name: Bi; used: number; total: number; color: `var(--chart-${1 | 2 | 3 | 4 | 5})` }

export const BEDS: BedRow[] = [
  { id: "icu", name: { en: "ICU", ar: "العناية المركزة" }, used: 36, total: 40, color: "var(--chart-1)" },
  { id: "cardiology", name: { en: "Cardiology", ar: "أمراض القلب" }, used: 58, total: 72, color: "var(--chart-2)" },
  { id: "pediatrics", name: { en: "Pediatrics", ar: "طب الأطفال" }, used: 44, total: 68, color: "var(--chart-3)" },
  { id: "surgery", name: { en: "Surgery", ar: "الجراحة" }, used: 52, total: 74, color: "var(--chart-4)" },
  { id: "other", name: { en: "Other", ar: "أخرى" }, used: 122, total: 146, color: "var(--chart-5)" },
]

/** KPI row (generic for the whole facility). */
export const KPIS = {
  totalPatients: { value: 1284, delta: "+12.5%" },
  appointmentsToday: { value: 86, delta: "+4" },
  critical: { value: 7, delta: "+2", since: "08:00" },
  waitTime: { minutes: 18, deltaMinutes: -3 },
}
