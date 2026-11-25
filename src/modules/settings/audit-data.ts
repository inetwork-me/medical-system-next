import type { Bi } from "@/lib/mock/bi"
import type { AuditEntry } from "./store"
import { USERS } from "./users-data"

/**
 * Audit log seed (Settings › Audit log, design v9.0): this week (Thu 19 – Wed 25 Nov) — every settings change, sign-in
 * (failed ones too) and export, with who, what, where and IP. Kept 10 years, read-only. The design's rows come first (Khaled
 * changing the Reception role at 10:42, Nora signing in with Nafath, the locked-out unknown at 09:58 …), then the week's other
 * changes and exports, then the staff sign-ins that make up the week's 2,418 rows (5 failed).
 */
const bi = (en: string, ar: string): Bi => ({ en, ar })
const D = "2026-11-25"
const Y = "2026-11-24"

const by = (id: string) => {
  const u = USERS.find((x) => x.id === id)!
  return { who: u.name, initials: u.initials }
}
const SYSTEM = { who: bi("System", "النظام"), initials: "SY" }
const UNKNOWN = { who: bi("Unknown", "غير معروف"), initials: "?" }

type Seed = Omit<AuditEntry, "id">

const DESIGN: Seed[] = [
  { at: `${D}T10:42`, ...by("khaled"), kind: "settings", what: bi("Changed the Reception role · Billing create → own branch", "عدّل دور الاستقبال · إنشاء الفواتير ← فرعه بس"), where: "roles", ip: "10.20.1.5" },
  { at: `${D}T10:15`, ...by("nora"), kind: "signin", what: bi("Signed in with Nafath", "دخلت بنفاذ"), where: "signin", ip: "10.20.4.17" },
  { at: `${D}T09:58`, ...UNKNOWN, kind: "failed", what: bi("5 failed sign-ins · account locked 15 min", "5 محاولات دخول غلط · انقفل الحساب 15 دقيقة"), where: "signin", ip: "85.154.20.33" },
  { at: `${D}T09:30`, ...by("rawan"), kind: "export", what: bi("Exported claims · 214 rows", "صدّرت المطالبات · 214 سطر"), where: "billing", ip: "10.20.6.9" },
  { at: `${Y}T21:40`, ...by("khaled"), kind: "settings", what: bi("Turned off Eyes and dental at Malaz", "قفل العيون والأسنان في الملز"), where: "modules", ip: "10.20.1.5" },
  { at: `${Y}T21:05`, ...SYSTEM, kind: "settings", what: bi("Renewed the Nafath key", "جدّد مفتاح نفاذ"), where: "integrations", ip: "—" },
]

/** The week's other changes and exports (and the other 4 failed sign-ins). */
const WEEK: Seed[] = [
  { at: `${Y}T16:40`, ...by("khaled"), kind: "settings", what: bi("Gave Nora Al-Fahad read only on cardiology@ until 31 Dec", "أعطى نورة الفهد قراءة بس على صندوق القلب لين 31 ديسمبر"), where: "users", ip: "10.20.1.5" },
  { at: `${Y}T14:10`, ...by("omar"), kind: "settings", what: bi("Invited Ali Al-Ghamdi as Reception", "دعا علي الغامدي بدور الاستقبال"), where: "users", ip: "10.20.1.22" },
  { at: `${Y}T11:25`, ...by("mona"), kind: "export", what: bi("Exported unpaid invoices · 9 rows", "صدّرت الفواتير غير المدفوعة · 9 أسطر"), where: "billing", ip: "10.20.6.14" },
  { at: `${Y}T08:12`, ...by("majed"), kind: "failed", what: bi("Wrong password", "كلمة مرور غلط"), where: "signin", ip: "10.40.3.8" },
  { at: "2026-11-23T17:30", ...by("abeer"), kind: "settings", what: bi("Changed the Sunday hours at Jeddah", "عدّلت أوقات الأحد في جدة"), where: "branches", ip: "10.20.1.30" },
  { at: "2026-11-23T13:02", ...by("khaled"), kind: "export", what: bi("Exported the November operations report", "صدّر تقرير التشغيل لنوفمبر"), where: "reports", ip: "10.20.1.5" },
  { at: "2026-11-23T09:48", ...by("omar"), kind: "settings", what: bi("Added Mona Al-Qahtani to billing@", "أضاف منى القحطاني لصندوق الفواتير"), where: "messages", ip: "10.20.1.22" },
  { at: "2026-11-22T22:15", ...UNKNOWN, kind: "failed", what: bi("Nafath sign-in not approved", "الدخول بنفاذ ما انعتمد"), where: "signin", ip: "94.99.41.120" },
  { at: "2026-11-22T15:20", ...by("omar"), kind: "settings", what: bi("Reset 2-step for Nurse Huda Al-Mutairi · checked in person", "أعاد ضبط التحقق للممرضة هدى المطيري · حضورياً"), where: "users", ip: "10.20.1.22" },
  { at: "2026-11-22T10:05", ...by("rawan"), kind: "export", what: bi("Exported rejected claims · 31 rows", "صدّرت المطالبات المرفوضة · 31 سطر"), where: "billing", ip: "10.20.6.9" },
  { at: "2026-11-21T19:44", ...by("hala"), kind: "failed", what: bi("Wrong 2-step code", "رمز التحقق غلط"), where: "signin", ip: "10.40.2.17" },
  { at: "2026-11-21T12:30", ...by("khaled"), kind: "settings", what: bi("Turned on 2-step for Doctor and Billing from 1 Dec", "فعّل التحقق بخطوتين للأطباء والفواتير من 1 ديسمبر"), where: "security", ip: "10.20.1.5" },
  { at: "2026-11-20T16:55", ...by("abeer"), kind: "export", what: bi("Exported the staff list · 96 rows", "صدّرت قائمة الموظفين · 96 سطر"), where: "users", ip: "10.20.1.30" },
  { at: "2026-11-20T09:30", ...by("omar"), kind: "settings", what: bi("Invited Dr. Fawaz Al-Shehri as Doctor", "دعا د. فواز الشهري بدور طبيب"), where: "users", ip: "10.20.1.22" },
  { at: "2026-11-19T18:10", ...by("sami"), kind: "failed", what: bi("Wrong password", "كلمة مرور غلط"), where: "signin", ip: "10.30.1.40" },
  { at: "2026-11-19T11:00", ...by("omar"), kind: "settings", what: bi("Invited Dr. Rana Al-Shammari as Doctor", "دعا د. رنا الشمري بدور طبيب"), where: "users", ip: "10.20.1.22" },
  { at: "2026-11-19T08:40", ...by("khaled"), kind: "settings", what: bi("Changed invoice numbers to INV-{YYMM}-{4}", "غيّر صيغة الفواتير إلى INV-{YYMM}-{4}"), where: "numbering", ip: "10.20.1.5" },
]

/** The week's total in the design ("Showing 6 of 2,418 this week"). */
export const WEEK_TOTAL = 2418

const SUBNET: Record<string, string> = { olaya: "10.20", malaz: "10.30", jeddah: "10.40" }
const pad = (n: number) => String(n).padStart(2, "0")
const DAYS = ["2026-11-24", "2026-11-23", "2026-11-22", "2026-11-21", "2026-11-20", "2026-11-19"]

/**
 * Staff sign-ins filling the week: shared reception and clinic PCs sign people out after 15 idle minutes, so most staff
 * sign in several times a day. They cover the six days before today and end by 21:00, so the design's rows (today's, and
 * the two late on 24 Nov) stay on top. Deterministic.
 */
function signIns(count: number): Seed[] {
  const staff = USERS.filter((u) => u.status === "active")
  const out: Seed[] = []
  let k = 0
  while (out.length < count) {
    const u = staff[k % staff.length]
    const day = DAYS[Math.floor(k / staff.length) % DAYS.length]
    const late = 21 * 60
    const start = 6 * 60 + 40
    const min = start + ((k * 37 + Math.floor(k / staff.length) * 13) % (late - start))
    const home = u.branches === "all" ? "olaya" : u.branches[0]
    out.push({
      at: `${day}T${pad(Math.floor(min / 60))}:${pad(min % 60)}`,
      who: u.name,
      initials: u.initials,
      kind: "signin",
      what: u.nafath ? bi("Signed in with Nafath", "دخل بنفاذ") : bi("Signed in with password and 2-step", "دخل بكلمة المرور والتحقق"),
      where: "signin",
      ip: `${SUBNET[home] ?? "10.20"}.${1 + (k % 9)}.${10 + ((k * 7) % 80)}`,
    })
    k++
  }
  return out
}

export const AUDIT_SEED: AuditEntry[] = [...DESIGN, ...WEEK, ...signIns(WEEK_TOTAL - DESIGN.length - WEEK.length)]
  .sort((a, b) => b.at.localeCompare(a.at))
  .map((e, i) => ({ ...e, id: `s-${i}` }))
