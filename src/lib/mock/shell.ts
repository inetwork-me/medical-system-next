import type { IconName } from "@/components/ds/icon"
import type { ModuleId } from "@/config/modules"
import type { Bi } from "./bi"

/** Signed-in user (design sample: Dr. Khaled Mansour). Replaced by the session once auth is wired. */
export const SESSION_USER = {
  initials: "KM",
  name: { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" } satisfies Bi,
  /** Used in greetings ("Good morning, Dr. Khaled" / "يا هلا د. خالد"). */
  shortName: { en: "Dr. Khaled", ar: "د. خالد" } satisfies Bi,
  role: { en: "Cardiologist", ar: "استشاري قلب" } satisfies Bi,
  facility: { en: "Al Noor Hospital", ar: "مستشفى النور" } satisfies Bi,
  branch: { en: "Main branch", ar: "الفرع الرئيسي" } satisfies Bi,
  email: "khaled.m@clinic.sa",
}

/** Nav counts / dots (sidebar count pill, rail + bottom-nav dot). */
export const NAV_BADGES: Partial<Record<ModuleId, number>> = {
  appointments: 12,
  messages: 12,
}

export type NotificationItem = {
  id: string
  icon: IconName
  tone: "info" | "warning" | "destructive" | "success" | "accent"
  title: Bi
  meta: Bi
  time: Bi
  unread: boolean
}

export const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    icon: "glass",
    tone: "info",
    title: { en: "Lab results ready", ar: "نتائج التحاليل جاهزة" },
    meta: { en: "Fahad Al-Dosari · CBC, Vitamin D", ar: "فهد الدوسري · CBC وفيتامين د" },
    time: { en: "5 min ago", ar: "قبل 5 دقايق" },
    unread: true,
  },
  {
    id: "n2",
    icon: "people",
    tone: "warning",
    title: { en: "Possible duplicate", ar: "ملف مكرر محتمل" },
    meta: { en: "Sultan Al-Mutairi · same mobile as 004650", ar: "سلطان المطيري · نفس جوال 004650" },
    time: { en: "20 min ago", ar: "قبل 20 دقيقة" },
    unread: true,
  },
  {
    id: "n3",
    icon: "close-circle",
    tone: "destructive",
    title: { en: "Appointment cancelled", ar: "انلغى موعد" },
    meta: { en: "Maha Saleh · Dermatology · 14:00", ar: "مها صالح · الجلدية · 14:00" },
    time: { en: "1 h ago", ar: "قبل ساعة" },
    unread: true,
  },
  {
    id: "n4",
    icon: "wallet-money",
    tone: "success",
    title: { en: "Payment received", ar: "وصل مبلغ" },
    meta: { en: "Sara Ahmed · SAR 450 · Mada", ar: "سارة أحمد · 450 ر.س · مدى" },
    time: { en: "2 h ago", ar: "قبل ساعتين" },
    unread: true,
  },
  {
    id: "n5",
    icon: "calendar-tick",
    tone: "accent",
    title: { en: "Booking confirmed", ar: "تأكد الحجز" },
    meta: { en: "Omar Al-Harbi · Cardiology · tomorrow", ar: "عمر الحربي · القلب · بكرة" },
    time: { en: "Yesterday", ar: "أمس" },
    unread: false,
  },
]

export type SearchPatient = {
  id: string
  initials: string
  name: Bi
  mrn: string
  /** Kept separate from any Arabic text and rendered LTR-isolated (brief §5.2). */
  mobile?: string
  age?: number
  note?: Bi
}

/** Header quick search sample (query "fahad"). Patients module will replace this with the real index. */
export const SEARCH_PATIENTS: SearchPatient[] = [
  { id: "004891", initials: "FD", name: { en: "Fahad Al-Dosari", ar: "فهد الدوسري" }, mrn: "004891", mobile: "059 300 1287", age: 15 },
  { id: "004520", initials: "FA", name: { en: "Fahad Aldosari", ar: "فهد الدوسري" }, mrn: "004520", note: { en: "possible duplicate", ar: "مكرر محتمل" } },
  { id: "004355", initials: "FQ", name: { en: "Fahad Al-Qahtani", ar: "فهد القحطاني" }, mrn: "004355", mobile: "055 811 0021", age: 42 },
  { id: "004861", initials: "YN", name: { en: "Yousef Nasser", ar: "يوسف ناصر" }, mrn: "004861" },
  { id: "004812", initials: "SA", name: { en: "Sara Ahmed", ar: "سارة أحمد" }, mrn: "004812" },
]

export const RECENT_SEARCHES: Bi[] = [
  { en: "Yousef Nasser", ar: "يوسف ناصر" },
  { en: "004861", ar: "004861" },
  { en: "055 987 1122", ar: "055 987 1122" },
]
