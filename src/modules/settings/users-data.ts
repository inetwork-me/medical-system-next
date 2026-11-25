import type { Bi } from "@/lib/mock/bi"
import type { BranchKey } from "./data"
import type { RoleKey } from "./roles-data"

/**
 * Users (Settings › Users, design v9.0): 111 accounts — 96 active, 3 invited, 12 deactivated. The people the design shows
 * come first (Dr. Khaled, Nora, Dr. Sami, Rawan, Nurse Amal, Majed, Dr. Fawaz), then the rest of the staff the other
 * modules already use (Dr. Lama, Dr. Hala, Nurse Huda …), then generated staff so the role counts match the design
 * (Admin 2 · Medical director 1 · Doctor 31 · Nurse 24 · Reception 14 · Billing 6 · Claims 5 · Lab 8 · Pharmacy 5).
 */
export type UserStatus = "active" | "invited" | "deactivated"
export type DeviceKind = "pc" | "phone" | "tablet"
export type Device = { id: string; kind: DeviceKind; name: Bi; browser?: Bi; place?: Bi; ip?: string; at: string }
export type Activity = { at: string; what: Bi }

export type SetUser = {
  id: string
  initials: string
  name: Bi
  female?: boolean
  email: string
  mobile: string
  roles: RoleKey[]
  /** Shown after the role: "Doctor · cardiology", "Medical director · admin". */
  title?: Bi
  branches: BranchKey[] | "all"
  clinics?: Bi
  /** Extra permissions on top of the role (design: Nora · Patient messages). */
  extra?: Bi[]
  status: UserStatus
  twoStep: boolean
  twoStepMethod?: "app" | "sms"
  since: string
  nafath?: boolean
  lastActive?: string
  invitedAt?: string
  deactivatedAt?: string
  devices?: Device[]
  activity?: Activity[]
  /** Open work the Deactivate dialog makes you move. */
  openItems?: { count: number; what: Bi }
  /** Shared mailbox / chat access (Messages). */
  sharedAccess?: Bi
}

const bi = (en: string, ar: string): Bi => ({ en, ar })
const D = "2026-11-25"

/* ------------------------------------------------------------------ the people the design shows */

const NAMED: SetUser[] = [
  {
    id: "khaled", initials: "KM", name: bi("Dr. Khaled Mansour", "د. خالد منصور"), email: "khaled.mansour@alnoor.sa", mobile: "0551234567",
    roles: ["director"], title: bi("admin", "مشرف"), branches: "all", clinics: bi("Cardiology", "القلب"), status: "active", twoStep: true, twoStepMethod: "app",
    since: "2019-09-01", nafath: true, lastActive: `${D}T11:00`,
    devices: [
      { id: "d1", kind: "pc", name: bi("This PC · Olaya", "هالجهاز · العليا"), browser: bi("Chrome", "كروم"), ip: "10.20.1.5", at: `${D}T11:00` },
      { id: "d2", kind: "phone", name: bi("iPhone · mobile app", "آيفون · التطبيق"), place: bi("Riyadh", "الرياض"), at: `${D}T10:00` },
      { id: "d3", kind: "pc", name: bi("Malaz clinic 4", "عيادة الملز 4"), browser: bi("Edge", "إيدج"), ip: "10.30.4.12", at: "2026-11-24T17:30" },
    ],
    activity: [
      { at: `${D}T07:55`, what: bi("Signed in with Nafath", "دخل بنفاذ") },
      { at: `${D}T09:10`, what: bi("Signed the Holter report for Abdullah Al-Shammari", "وقّع تقرير هولتر لعبدالله الشمري") },
    ],
    openItems: { count: 3, what: bi("3 notes to sign", "3 ملاحظات تنتظر توقيع") },
    sharedAccess: bi("Manage on cardiology@", "إدارة صندوق القلب"),
  },
  {
    id: "nora", initials: "NF", name: bi("Nora Al-Fahad", "نورة الفهد"), female: true, email: "nora.alfahad@alnoor.sa", mobile: "0553318842",
    roles: ["reception"], branches: ["olaya"], clinics: bi("All clinics at Olaya", "كل عيادات العليا"), extra: [bi("Patient messages", "رسائل المرضى")],
    status: "active", twoStep: true, twoStepMethod: "app", since: "2024-03-03", nafath: true, lastActive: `${D}T10:55`,
    devices: [
      { id: "d1", kind: "pc", name: bi("Reception PC 2 · Olaya", "جهاز الاستقبال 2 · العليا"), browser: bi("Chrome", "كروم"), ip: "10.20.4.17", at: `${D}T11:00` },
      { id: "d2", kind: "phone", name: bi("iPhone · mobile app", "آيفون · التطبيق"), place: bi("Riyadh", "الرياض"), at: `${D}T09:00` },
    ],
    activity: [
      { at: `${D}T10:15`, what: bi("Signed in with Nafath", "دخلت بنفاذ") },
      { at: `${D}T10:22`, what: bi("Checked in Reem Al-Mutairi", "سجّلت حضور ريم المطيري") },
      { at: "2026-11-24T16:40", what: bi("Given read only on cardiology@ until 31 Dec", "انعطت قراءة بس على صندوق القلب لين 31 ديسمبر") },
    ],
    openItems: { count: 2, what: bi("2 patient messages waiting", "رسالتين مرضى تنتظر رد") },
    sharedAccess: bi("Read only on cardiology@", "قراءة بس على صندوق القلب"),
  },
  {
    id: "sami", initials: "SA", name: bi("Dr. Sami Al-Otaibi", "د. سامي العتيبي"), email: "sami.alotaibi@alnoor.sa", mobile: "0554471209",
    roles: ["doctor"], title: bi("cardiology", "القلب"), branches: ["olaya", "malaz"], clinics: bi("Cardiology", "القلب"), status: "active", twoStep: false,
    since: "2022-01-16", nafath: true, lastActive: `${D}T10:00`,
    openItems: { count: 2, what: bi("2 notes to sign", "ملاحظتين تنتظر توقيع") },
  },
  {
    id: "rawan", initials: "RS", name: bi("Rawan Al-Saleh", "روان الصالح"), female: true, email: "rawan.alsaleh@alnoor.sa", mobile: "0559012233",
    roles: ["claims"], branches: "all", status: "active", twoStep: true, twoStepMethod: "app", since: "2023-05-21", nafath: true, lastActive: "2026-11-24T15:30",
    openItems: { count: 4, what: bi("4 claims being worked on", "4 مطالبات قيد الشغل") },
    sharedAccess: bi("Send as on claims@", "إرسال باسم صندوق المطالبات"),
  },
  {
    id: "amal", initials: "AM", name: bi("Nurse Amal Al-Zahrani", "الممرضة أمل الزهراني"), female: true, email: "amal.alzahrani@alnoor.sa", mobile: "0556678120",
    roles: ["nurse"], branches: ["olaya"], clinics: bi("Cardiology", "القلب"), status: "active", twoStep: true, twoStepMethod: "sms", since: "2021-11-07", lastActive: `${D}T10:40`,
  },
  {
    id: "majed", initials: "MS", name: bi("Majed Al-Sahli", "ماجد السهلي"), email: "majed.alsahli@alnoor.sa", mobile: "0557723410",
    roles: ["pharmacy"], branches: ["jeddah"], status: "active", twoStep: false, since: "2024-08-12", lastActive: "2026-11-22T13:20",
  },
  {
    id: "fawaz", initials: "FS", name: bi("Dr. Fawaz Al-Shehri", "د. فواز الشهري"), email: "fawaz.alshehri@alnoor.sa", mobile: "0559876543",
    roles: ["doctor"], title: bi("fellow", "زميل"), branches: ["olaya"], clinics: bi("Cardiology", "القلب"), status: "invited", twoStep: false,
    since: "2026-12-01", nafath: true, invitedAt: "2026-11-20T09:30",
  },
  {
    id: "lama", initials: "LH", name: bi("Dr. Lama Al-Harbi", "د. لمى الحربي"), female: true, email: "lama.alharbi@alnoor.sa", mobile: "0552210984",
    roles: ["doctor"], title: bi("cardiology", "القلب"), branches: ["olaya"], clinics: bi("Cardiology", "القلب"), status: "active", twoStep: true, twoStepMethod: "app",
    since: "2023-02-05", nafath: true, lastActive: `${D}T10:30`,
  },
  {
    id: "hala", initials: "HN", name: bi("Dr. Hala Nasser", "د. هالة ناصر"), female: true, email: "hala.nasser@alnoor.sa", mobile: "0553390176",
    roles: ["doctor"], title: bi("dermatology", "الجلدية"), branches: ["jeddah"], clinics: bi("Dermatology", "الجلدية"), status: "active", twoStep: false,
    since: "2024-10-01", lastActive: "2026-11-24T12:10",
  },
  {
    id: "huda", initials: "HM", name: bi("Nurse Huda Al-Mutairi", "الممرضة هدى المطيري"), female: true, email: "huda.almutairi@alnoor.sa", mobile: "0558841732",
    roles: ["nurse"], branches: ["olaya"], clinics: bi("Cardiology", "القلب"), status: "active", twoStep: true, twoStepMethod: "sms", since: "2022-06-19", lastActive: `${D}T09:45`,
  },
  {
    id: "omar", initials: "OH", name: bi("Omar Al-Harbi", "عمر الحربي"), email: "omar.alharbi@alnoor.sa", mobile: "0550091827",
    roles: ["admin"], title: bi("IT", "التقنية"), branches: "all", status: "active", twoStep: true, twoStepMethod: "app", since: "2020-02-02", nafath: true, lastActive: `${D}T10:50`,
  },
  {
    id: "abeer", initials: "AK", name: bi("Abeer Al-Khalaf", "عبير الخلف"), female: true, email: "abeer.alkhalaf@alnoor.sa", mobile: "0554409911",
    roles: ["admin"], title: bi("HR and operations", "الموارد البشرية والتشغيل"), branches: "all", status: "active", twoStep: true, twoStepMethod: "app", since: "2021-04-11",
    nafath: true, lastActive: `${D}T09:20`,
  },
  {
    id: "hudaq", initials: "HQ", name: bi("Huda Al-Qahtani", "هدى القحطاني"), female: true, email: "huda.alqahtani@alnoor.sa", mobile: "0557310045",
    roles: ["reception"], branches: ["olaya"], clinics: bi("All clinics at Olaya", "كل عيادات العليا"), status: "active", twoStep: true, twoStepMethod: "sms",
    since: "2023-09-17", lastActive: `${D}T10:58`,
  },
  {
    id: "fqarni", initials: "FQ", name: bi("Fatimah Al-Qarni", "فاطمة القرني"), female: true, email: "fatimah.alqarni@alnoor.sa", mobile: "0556120934",
    roles: ["reception"], title: bi("referrals", "التحويلات"), branches: ["olaya"], status: "active", twoStep: true, twoStepMethod: "sms", since: "2022-12-04", lastActive: `${D}T10:05`,
  },
  {
    id: "mona", initials: "MQ", name: bi("Mona Al-Qahtani", "منى القحطاني"), female: true, email: "mona.alqahtani@alnoor.sa", mobile: "0559934410",
    roles: ["billing"], branches: "all", status: "active", twoStep: false, since: "2023-07-30", lastActive: `${D}T08:15`,
  },
  {
    id: "rana", initials: "RS", name: bi("Dr. Rana Al-Shammari", "د. رنا الشمري"), female: true, email: "rana.alshammari@alnoor.sa", mobile: "0553307718",
    roles: ["doctor"], title: bi("dermatology", "الجلدية"), branches: ["jeddah"], clinics: bi("Dermatology", "الجلدية"), status: "invited", twoStep: false,
    since: "2026-12-01", nafath: true, invitedAt: "2026-11-19T11:00",
  },
  {
    id: "ali", initials: "AG", name: bi("Ali Al-Ghamdi", "علي الغامدي"), email: "ali.alghamdi@alnoor.sa", mobile: "0558802216",
    roles: ["reception"], branches: ["jeddah"], status: "invited", twoStep: false, since: "2026-12-01", invitedAt: "2026-11-24T14:10",
  },
]

/* ------------------------------------------------------------------ the rest of the staff */

const MALE: [string, string][] = [
  ["Faisal", "فيصل"], ["Abdullah", "عبدالله"], ["Mohammed", "محمد"], ["Saad", "سعد"], ["Turki", "تركي"], ["Nawaf", "نواف"], ["Bandar", "بندر"],
  ["Yazeed", "يزيد"], ["Waleed", "وليد"], ["Ahmed", "أحمد"], ["Khalid", "خالد"], ["Sultan", "سلطان"], ["Hamad", "حمد"], ["Rakan", "راكان"],
  ["Ziyad", "زياد"], ["Mansour", "منصور"], ["Talal", "طلال"], ["Badr", "بدر"],
]
const FEMALE: [string, string][] = [
  ["Sara", "سارة"], ["Maha", "مها"], ["Hessa", "حصة"], ["Lulwa", "لولوة"], ["Ghada", "غادة"], ["Dana", "دانة"], ["Reem", "ريم"], ["Abeer", "عبير"],
  ["Hind", "هند"], ["Asma", "أسماء"], ["Nouf", "نوف"], ["Shahad", "شهد"], ["Haya", "هيا"], ["Jawaher", "جواهر"], ["Mashael", "مشاعل"], ["Wejdan", "وجدان"],
]
const LAST: [string, string][] = [
  ["Al-Dosari", "الدوسري"], ["Al-Ghamdi", "الغامدي"], ["Al-Subaie", "السبيعي"], ["Al-Anazi", "العنزي"], ["Al-Rashid", "الراشد"], ["Al-Mutlaq", "المطلق"],
  ["Al-Omari", "العمري"], ["Al-Shehri", "الشهري"], ["Al-Qahtani", "القحطاني"], ["Al-Malki", "المالكي"], ["Al-Juhani", "الجهني"], ["Al-Harthi", "الحارثي"],
  ["Al-Zahrani", "الزهراني"], ["Al-Shammari", "الشمري"], ["Al-Otaibi", "العتيبي"], ["Al-Mutairi", "المطيري"], ["Al-Asmari", "الأسمري"], ["Al-Balawi", "البلوي"],
  ["Al-Tamimi", "التميمي"], ["Al-Rasheed", "الرشيد"], ["Al-Yami", "اليامي"], ["Al-Khathami", "الخثعمي"],
]
const SPECIALTIES: Bi[] = [
  bi("family medicine", "طب الأسرة"), bi("pediatrics", "الأطفال"), bi("internal medicine", "الباطنة"), bi("dermatology", "الجلدية"), bi("ENT", "الأنف والأذن"),
  bi("ophthalmology", "العيون"), bi("dental", "الأسنان"), bi("orthopedics", "العظام"), bi("OB/GYN", "النساء والولادة"), bi("cardiology", "القلب"),
]
const CLINIC_OF: Record<string, Bi> = Object.fromEntries(SPECIALTIES.map((s) => [s.en, bi(s.en[0].toUpperCase() + s.en.slice(1), s.ar)]))

const PREFIX: Record<string, [string, string, string]> = { doctor: ["Dr. ", "د. ", "د. "], nurse: ["Nurse ", "الممرض ", "الممرضة "] }

/** Generated staff: how many active per role (named people above make up the rest of the design's counts). */
const ACTIVE_REST: [RoleKey, number][] = [["doctor", 28], ["nurse", 22], ["reception", 11], ["billing", 5], ["claims", 4], ["lab", 8], ["pharmacy", 4]]
const DEACTIVATED: RoleKey[] = ["doctor", "nurse", "nurse", "reception", "reception", "reception", "doctor", "lab", "billing", "pharmacy", "nurse", "reception"]

const pad = (n: number) => String(n).padStart(2, "0")
/** Minutes before the demo time (11:00 on 25 Nov) as "YYYY-MM-DDTHH:MM". */
function ago(min: number) {
  const t = Date.UTC(2026, 10, 25, 11, 0) - min * 60_000
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/**
 * Home branches for the generated active staff, spread evenly so the branch staff counts match the design (Olaya 58 ·
 * Malaz 24 · Jeddah 14, counting the named people above and billing / claims staff who work across branches at Olaya).
 */
function branchSequence(n: number, targets: [BranchKey, number][]): BranchKey[] {
  const got = new Map<BranchKey, number>()
  const out: BranchKey[] = []
  for (let k = 0; k < n; k++) {
    let best = targets[0][0]
    let gap = -Infinity
    for (const [b, t] of targets) {
      const d = (t * (k + 1)) / n - (got.get(b) ?? 0)
      if (d > gap) [best, gap] = [b, d]
    }
    got.set(best, (got.get(best) ?? 0) + 1)
    out.push(best)
  }
  return out
}
const HOME = branchSequence(73, [["olaya", 37], ["malaz", 24], ["jeddah", 12]])

function generated(): SetUser[] {
  const out: SetUser[] = []
  let home = 0
  const used = new Set(NAMED.map((u) => u.name.en.replace(/^(Dr\.|Nurse) /, "")))
  let i = 0
  const make = (role: RoleKey, status: UserStatus): SetUser => {
    let first: [string, string]
    let last: [string, string]
    let female: boolean
    // Walk the name pools until the name is new.
    do {
      female = i % 5 === 1 || i % 5 === 3 || (role === "nurse" && i % 3 !== 0)
      first = female ? FEMALE[(i * 7) % FEMALE.length] : MALE[(i * 5) % MALE.length]
      last = LAST[(i * 3 + Math.floor(i / LAST.length)) % LAST.length]
      i++
    } while (used.has(`${first[0]} ${last[0]}`))
    used.add(`${first[0]} ${last[0]}`)
    const n = i
    const pre = PREFIX[role]
    const spec = role === "doctor" ? SPECIALTIES[n % SPECIALTIES.length] : undefined
    const across = role === "billing" || role === "claims"
    const homeBranch: BranchKey = status === "active" && !across ? HOME[home++] : n % 5 < 3 ? "olaya" : "jeddah"
    // A few doctors also see patients at a second Riyadh branch.
    const branches: BranchKey[] = role === "doctor" && n % 7 === 0 && homeBranch !== "jeddah" ? [homeBranch, homeBranch === "olaya" ? "malaz" : "olaya"] : [homeBranch]
    const email = `${first[0].toLowerCase()}.${last[0].toLowerCase().replace("-", "")}@alnoor.sa`
    const minutes = status === "deactivated" ? 60 * 24 * (40 + n * 9) : (n * 47) % (60 * 24 * 4)
    return {
      id: `u${n}`,
      initials: first[0][0] + last[0].replace("Al-", "")[0],
      name: bi(`${pre?.[0] ?? ""}${first[0]} ${last[0]}`, `${pre ? (female ? pre[2] : pre[1]) : ""}${first[1]} ${last[1]}`),
      female,
      email,
      mobile: `05${String(50000000 + ((n * 7919) % 49999999)).padStart(8, "0")}`,
      roles: [role],
      title: spec,
      branches: across ? "all" : branches,
      clinics: spec ? CLINIC_OF[spec.en] : undefined,
      status,
      twoStep: status !== "invited",
      twoStepMethod: n % 3 === 0 ? "sms" : "app",
      since: `20${18 + (n % 7)}-${pad(1 + (n % 12))}-${pad(1 + (n % 27))}`,
      nafath: n % 2 === 0,
      lastActive: ago(minutes),
      deactivatedAt: status === "deactivated" ? ago(minutes - 60 * 24 * 2) : undefined,
      openItems: role === "doctor" && n % 3 === 0 ? { count: 1 + (n % 4), what: bi(`${1 + (n % 4)} notes to sign`, `${1 + (n % 4)} ملاحظات تنتظر توقيع`) } : undefined,
    }
  }
  for (const [role, count] of ACTIVE_REST) for (let k = 0; k < count; k++) out.push(make(role, "active"))
  for (const role of DEACTIVATED) out.push(make(role, "deactivated"))
  return out
}

export const USERS: SetUser[] = [...NAMED, ...generated()]

/** The signed-in demo user. */
export const ME_USER = "khaled"

/** Invites expire 7 days after they're sent. */
export const INVITE_DAYS = 7

/** Clinics a new user can be put in (Invite a user · Clinic). */
export const CLINIC_LIST: Bi[] = [
  bi("Cardiology", "القلب"), bi("Dermatology", "الجلدية"), bi("Pediatrics", "الأطفال"), bi("Family medicine", "طب الأسرة"), bi("Internal medicine", "الباطنة"),
  bi("ENT", "الأنف والأذن"), bi("Ophthalmology", "العيون"), bi("Dental", "الأسنان"), bi("Orthopedics", "العظام"), bi("OB/GYN", "النساء والولادة"),
]
