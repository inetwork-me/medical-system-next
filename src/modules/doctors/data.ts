import type { Bi } from "@/lib/mock/bi"

/**
 * Doctors module mock data — the one doctor roster shared by Doctors, Clinics and Appointments.
 * Figures from design-scripts/doctor_widgets.py (DOCTORS, CREDS, EXPIRING, REP) and build_doctors.py (KPIS).
 * The 9 design doctors come first; the other 14 are the clinic doctors the Clinics screens already list, which
 * makes the design's "23 doctors". "Today" is Wed 18 Nov 2026, like every Clinics / Doctors screen.
 */
export const DOCTORS_TODAY = "2026-11-18"

export type DoctorStatus = "in" | "late" | "later" | "off" | "leave"
export type Grade = "consultant" | "specialist" | "resident"

export type CredentialType = "scfhs" | "moh" | "bls" | "pals" | "acls" | "malpractice"
export type Credential = { type: CredentialType; number: string; issuer: Bi; issued: string; expires: string; required: boolean; /** Scan uploaded with Renew (this session). */ fileName?: string }

export type Doctor = {
  key: string
  initials: string
  name: Bi
  /** "Consultant pediatrician" */
  title: Bi
  grade: Grade
  female: boolean
  /** Main clinic (Clinics key) and room. */
  clinic: string
  room: string
  /** Head of this clinic (Clinics key). */
  headOf?: string
  status: DoctorStatus
  /** Badge text: "In clinic", "Running late · 6 waiting", "Starts 2 PM", "Off today", "On leave · back 20 Nov". */
  statusLabel: Bi
  /** Off / on leave: who has the patients (replaces today's figures on the card). */
  awayNote?: Bi
  /** Today: seen / booked, next free slot ("HH:MM", or an ISO day when away). */
  today: { seen: number; booked: number; nextFree: string }
  /** This month (1st → today). */
  month: DoctorMonth
  credentials: Credential[]
  active: boolean
  ext: string
  yearsExp: number
  languages: Bi
  /** Patient ages seen (Pediatrics: 0–14); null = all ages. */
  ages: [number, number] | null
  /** Booking settings (override the clinic rules). */
  booking: DoctorBooking
  /** Weekly hours: shifts per weekday. */
  week: Record<Weekday, Shift[]>
  /** Booked per day this week (Sun 15 – Thu 19 Nov). */
  booked: Record<Weekday, number>
  /** Annual leave days used this year (balance 21). */
  leaveUsed: number
  /* Settings (Widget / Doctor Profile Form). Optional: defaults come from contactOf / the main clinic. */
  /** Specialty; defaults to the main clinic's specialty. */
  specialty?: Bi
  /** Nationality code (Patients' nationality list), default "sa". */
  nationality?: string
  mobile?: string
  email?: string
  role?: SystemRole
  /** Sends prescriptions to Wasfaty; default on. */
  ePrescribing?: boolean
  /** Extra clinics (Assign clinic): weekly shifts outside the main clinic, bookable from `start`. */
  assignments?: Assignment[]
  /** Set by Deactivate doctor: no slots after the last working day. */
  deactivation?: Deactivation
}

export type SystemRole = "doctor" | "head" | "director"
export const SYSTEM_ROLES: SystemRole[] = ["doctor", "head", "director"]
export type AssignRole = "visiting" | "member" | "cover"
export const ASSIGN_ROLES: AssignRole[] = ["visiting", "member", "cover"]
export type Assignment = { clinic: string; role: AssignRole; room: string; day: Weekday; from: string; to: string; start: string }
export type DeactivateReason = "contract" | "resigned" | "transfer" | "retired" | "other"
export const DEACTIVATE_REASONS: DeactivateReason[] = ["contract", "resigned", "transfer", "retired", "other"]
export type Deactivation = { lastDay: string; reason: DeactivateReason; cover?: string; cancelBookings?: boolean; keepAccess: boolean; bookings: number }

/** Languages a doctor can list (Settings · Languages); stored on the doctor as "Arabic · English". */
export const LANGUAGES: { key: string; name: Bi }[] = [
  { key: "ar", name: { en: "Arabic", ar: "عربي" } },
  { key: "en", name: { en: "English", ar: "إنجليزي" } },
  { key: "fr", name: { en: "French", ar: "فرنسي" } },
  { key: "ur", name: { en: "Urdu", ar: "أوردو" } },
  { key: "hi", name: { en: "Hindi", ar: "هندي" } },
  { key: "tl", name: { en: "Tagalog", ar: "تاغالوغ" } },
]
export const languageKeys = (l: Bi) => LANGUAGES.filter((x) => l.en.split(/\s*[·,]\s*/).includes(x.name.en)).map((x) => x.key)
export const languagesOf = (keys: string[]): Bi => {
  const list = LANGUAGES.filter((x) => keys.includes(x.key))
  return { en: list.map((x) => x.name.en).join(" · "), ar: list.map((x) => x.name.ar).join(" · ") }
}

/** Contact & system access with defaults: mobile from the extension, work email from the name ("a.zaki@alnoor.sa"). */
export function contactOf(d: Doctor) {
  const parts = d.name.en.replace(/^Dr\.\s*/, "").trim().split(/\s+/)
  const last = (parts.at(-1) ?? "").toLowerCase().replace(/^al-/, "").replace(/[^a-z]/g, "")
  const ext = d.ext.padEnd(4, "0")
  return {
    nationality: d.nationality ?? "sa",
    mobile: d.mobile ?? (d.ext ? `+966 55 ${ext.slice(0, 3)} ${ext}` : ""),
    email: d.email ?? (last ? `${parts[0][0].toLowerCase()}.${last}@alnoor.sa` : ""),
    role: d.role ?? ("doctor" as const),
    ePrescribing: d.ePrescribing ?? true,
  }
}

/** Extra clinics' shifts on a weekday (Assign clinic). */
export const assignmentsOn = (d: Doctor, day: Weekday) => (d.assignments ?? []).filter((a) => a.day === day)

/** Still working that day (on or before the last working day, when deactivated)? */
export const employedOn = (d: Doctor, date: string) => !d.deactivation || date <= d.deactivation.lastDay

/** Deactivate dialog: open items someone else must pick up (design: 4 open referrals · 2 unsigned notes, Dr. Ahmed Zaki). */
export function openItems(d: Doctor) {
  const n = [...d.key].reduce((s, c) => s + c.charCodeAt(0), 0)
  return d.key === "zaki" ? { referrals: 4, notes: 2 } : { referrals: n % 5, notes: n % 3 }
}

/** Booking settings that override the clinic rules; visitMin null = the clinic's visit length. */
export type DoctorBooking = { visitMin: number | null; maxPerDay: number; online: boolean; acceptsNew: boolean; telehealth: boolean }

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
export const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
/** "08:00", "16:00"; telehealth shifts are video visits. */
export type Shift = { from: string; to: string; telehealth?: boolean }
export type DoctorMonth = {
  visits: number
  rating: string
  reviews: number
  /** Average consult, minutes. */
  consult: number
  noShow: number
  utilisation: number
  /** SAR thousands. */
  revenue: number
  /** Visits vs last month, %. */
  delta: number
  /** Average wait before being seen, min. */
  wait: number
  /** Follow-ups that came back, %. */
  returnRate: number
}
type Base = Omit<Doctor, "month" | "ext" | "yearsExp" | "languages" | "ages" | "booking" | "week" | "booked" | "leaveUsed"> & {
  month: { visits: number; rating: string }
}
export const ANNUAL_LEAVE = 21

const bi = (en: string, ar: string): Bi => ({ en, ar })

const SCFHS = bi("SCFHS", "هيئة التخصصات")
const MOH = bi("Ministry of Health", "وزارة الصحة")
const SHA = bi("Saudi Heart Association", "جمعية القلب السعودية")
const TAWUNIYA = bi("Tawuniya", "التعاونية")

/** PALS for the Pediatrics doctors. */
const PALS = (n: number): Credential => ({ type: "pals", number: `PALS-3${1000 + n * 23}`, issuer: SHA, issued: "2025-05-20", expires: "2027-05-20", required: true })

/** The standard set every doctor holds; a doctor's own entries replace these by type. */
function creds(n: number, own: Credential[] = []): Credential[] {
  const base: Credential[] = [
    { type: "scfhs", number: `RM-1${n % 10}-00${41200 + n * 37}`, issuer: SCFHS, issued: "2025-03-14", expires: "2028-03-14", required: true },
    { type: "moh", number: `ML-2${10 + n}-${4100 + n * 13}`, issuer: MOH, issued: "2024-06-30", expires: "2027-06-30", required: true },
    { type: "bls", number: `BLS-8${8000 + n * 11}`, issuer: SHA, issued: `2025-0${4 + (n % 6)}-15`, expires: `2027-0${4 + (n % 6)}-15`, required: true },
    { type: "acls", number: `ACLS-6${1000 + n * 17}`, issuer: SHA, issued: "2025-09-15", expires: "2027-09-15", required: false },
    { type: "malpractice", number: `TW-MP-7${7000 + n * 9}`, issuer: TAWUNIYA, issued: "2026-01-01", expires: "2027-12-31", required: true },
  ]
  return [...base.filter((b) => !own.some((o) => o.type === b.type)), ...own]
}

/* ---------------------------------------------------------------- the 9 design doctors */
const DESIGN: Base[] = [
  {
    key: "zaki",
    initials: "AZ",
    name: bi("Dr. Ahmed Zaki", "د. أحمد زكي"),
    title: bi("Consultant pediatrician", "استشاري طب أطفال"),
    grade: "consultant",
    female: false,
    mobile: "+966 55 412 0981",
    clinic: "peds",
    room: "101",
    headOf: "peds",
    status: "in",
    statusLabel: bi("In clinic", "في العيادة"),
    today: { seen: 14, booked: 18, nextFree: "11:30" },
    month: { visits: 412, rating: "4.8" },
    credentials: [
      { type: "scfhs", number: "RM-10-0045821", issuer: SCFHS, issued: "2025-03-14", expires: "2028-03-14", required: true },
      { type: "moh", number: "ML-221-4471", issuer: MOH, issued: "2024-06-30", expires: "2027-06-30", required: true },
      { type: "bls", number: "BLS-88213", issuer: SHA, issued: "2025-02-02", expires: "2027-02-02", required: true },
      { type: "pals", number: "PALS-30417", issuer: SHA, issued: "2024-12-26", expires: "2026-12-26", required: true },
      { type: "malpractice", number: "TW-MP-77120", issuer: TAWUNIYA, issued: "2026-01-01", expires: "2026-12-31", required: true },
    ],
    active: true,
  },
  {
    key: "odeh",
    initials: "SO",
    name: bi("Dr. Sami Odeh", "د. سامي عودة"),
    title: bi("Consultant endodontist", "استشاري علاج عصب"),
    grade: "consultant",
    female: false,
    clinic: "dental",
    room: "201",
    headOf: "dental",
    status: "in",
    statusLabel: bi("In clinic", "في العيادة"),
    today: { seen: 9, booked: 12, nextFree: "12:15" },
    month: { visits: 286, rating: "4.7" },
    credentials: creds(1, [{ type: "bls", number: "BLS-80417", issuer: SHA, issued: "2025-03-03", expires: "2027-03-03", required: true }]),
    active: true,
  },
  {
    key: "otaibi",
    initials: "RO",
    name: bi("Dr. Reem Al-Otaibi", "د. ريم العتيبي"),
    title: bi("Consultant ophthalmologist", "استشارية عيون"),
    grade: "consultant",
    female: true,
    clinic: "eyes",
    room: "210",
    headOf: "eyes",
    status: "in",
    statusLabel: bi("In clinic", "في العيادة"),
    today: { seen: 8, booked: 10, nextFree: "13:00" },
    month: { visits: 198, rating: "4.9" },
    credentials: creds(2, [{ type: "scfhs", number: "RM-12-0038816", issuer: SCFHS, issued: "2023-12-09", expires: "2026-12-09", required: true }]),
    active: true,
  },
  {
    key: "mansour",
    initials: "KM",
    name: bi("Dr. Khaled Mansour", "د. خالد منصور"),
    title: bi("Consultant cardiologist", "استشاري قلب"),
    grade: "consultant",
    female: false,
    clinic: "cardio",
    room: "301",
    headOf: "cardio",
    status: "late",
    statusLabel: bi("Running late · 6 waiting", "متأخر · 6 ينتظرون"),
    today: { seen: 11, booked: 13, nextFree: "15:30" },
    month: { visits: 264, rating: "4.6" },
    credentials: creds(3),
    active: true,
  },
  {
    key: "saud",
    initials: "LS",
    name: bi("Dr. Lama Al-Saud", "د. لمى آل سعود"),
    title: bi("Pediatrics specialist", "أخصائية أطفال"),
    grade: "specialist",
    female: true,
    clinic: "peds",
    room: "102",
    status: "later",
    statusLabel: bi("Starts 2 PM", "تبدأ 2 الظهر"),
    today: { seen: 0, booked: 12, nextFree: "14:00" },
    month: { visits: 356, rating: "4.9" },
    credentials: creds(4, [PALS(4)]),
    active: true,
  },
  {
    key: "shehri",
    initials: "MS",
    name: bi("Dr. Majed Al-Shehri", "د. ماجد الشهري"),
    title: bi("Consultant internist", "استشاري باطنية"),
    grade: "consultant",
    female: false,
    clinic: "internal",
    room: "110",
    headOf: "internal",
    status: "in",
    statusLabel: bi("In clinic", "في العيادة"),
    today: { seen: 16, booked: 20, nextFree: "12:40" },
    month: { visits: 448, rating: "4.5" },
    credentials: creds(5),
    active: true,
  },
  {
    key: "qahtani",
    initials: "NQ",
    name: bi("Dr. Nora Al-Qahtani", "د. نورة القحطاني"),
    title: bi("Dermatology specialist", "أخصائية جلدية"),
    grade: "specialist",
    female: true,
    clinic: "derma",
    room: "310",
    headOf: "derma",
    status: "in",
    statusLabel: bi("In clinic", "في العيادة"),
    today: { seen: 10, booked: 12, nextFree: "11:45" },
    month: { visits: 231, rating: "4.8" },
    credentials: creds(6, [{ type: "moh", number: "ML-216-4178", issuer: MOH, issued: "2024-01-12", expires: "2027-01-12", required: true }]),
    active: true,
  },
  {
    key: "fares",
    initials: "HF",
    name: bi("Dr. Huda Fares", "د. هدى فارس"),
    title: bi("Consultant orthopedic surgeon", "استشارية جراحة عظام"),
    grade: "consultant",
    female: true,
    clinic: "ortho",
    room: "120",
    headOf: "ortho",
    status: "off",
    statusLabel: bi("Off today", "إجازة اليوم"),
    awayNote: bi("Back on Sunday. 4 bookings moved to Dr. Faisal.", "يرجع الأحد، وانتقلت 4 حجوزات للدكتور فيصل."),
    today: { seen: 0, booked: 0, nextFree: "2026-11-22" },
    month: { visits: 174, rating: "4.7" },
    credentials: creds(7, [{ type: "bls", number: "BLS-81942", issuer: SHA, issued: "2024-11-12", expires: "2026-11-12", required: true }]),
    active: true,
  },
  {
    key: "hamdan",
    initials: "TH",
    name: bi("Dr. Tariq Hamdan", "د. طارق حمدان"),
    title: bi("Consultant ENT surgeon", "استشاري أنف وأذن وحنجرة"),
    grade: "consultant",
    female: false,
    clinic: "ent",
    room: "320",
    headOf: "ent",
    status: "leave",
    statusLabel: bi("On leave · back 20 Nov", "في إجازة · يرجع 20 نوفمبر"),
    awayNote: bi("Annual leave. Patients are booked with Dr. Waleed Saeed.", "إجازة سنوية، والمرضى محجوزين عند د. وليد سعيد."),
    today: { seen: 0, booked: 0, nextFree: "2026-11-20" },
    month: { visits: 96, rating: "4.6" },
    credentials: creds(8),
    active: true,
  },
]

/* ---------------------------------------------------------------- the other clinic doctors (Clinics' rosters) */
const IN = bi("In clinic", "في العيادة")
type Extra = [key: string, name: Bi, female: boolean, clinic: string, room: string, grade: Grade, status: DoctorStatus, seen: number, booked: number, next: string, visits: number, rating: string]
const EXTRA: Extra[] = [
  ["harbi", bi("Dr. Faisal Al-Harbi", "د. فيصل الحربي"), false, "dental", "202", "specialist", "in", 11, 14, "12:30", 262, "4.7"],
  ["zahrani", bi("Dr. Rawan Al-Zahrani", "د. روان الزهراني"), true, "dental", "203", "specialist", "in", 9, 12, "11:50", 238, "4.8"],
  ["nasser", bi("Dr. Omar Nasser", "د. عمر ناصر"), false, "dental", "204", "resident", "later", 0, 19, "14:00", 204, "4.5"],
  ["bqahtani", bi("Dr. Bandar Al-Qahtani", "د. بندر القحطاني"), false, "eyes", "211", "specialist", "off", 0, 0, "2026-11-19", 176, "4.6"],
  ["dossary", bi("Dr. Hessa Al-Dossary", "د. حصة الدوسري"), true, "cardio", "302", "specialist", "in", 8, 11, "13:10", 214, "4.7"],
  ["mutairi", bi("Dr. Saad Al-Mutairi", "د. سعد المطيري"), false, "internal", "111", "specialist", "in", 14, 18, "12:20", 392, "4.6"],
  ["shammari", bi("Dr. Amal Al-Shammari", "د. أمل الشمري"), true, "internal", "112", "specialist", "in", 12, 17, "11:40", 341, "4.8"],
  ["whassan", bi("Dr. Waleed Hassan", "د. وليد حسن"), false, "internal", "113", "resident", "leave", 0, 0, "2026-11-25", 168, "4.4"],
  ["rashid", bi("Dr. Lulwa Al-Rashid", "د. لولوة الرشيد"), true, "derma", "311", "specialist", "in", 9, 12, "12:00", 224, "4.7"],
  ["anazi", bi("Dr. Turki Al-Anazi", "د. تركي العنزي"), false, "ortho", "121", "specialist", "in", 9, 12, "12:45", 156, "4.6"],
  ["ghamdi", bi("Dr. Mona Al-Ghamdi", "د. منى الغامدي"), true, "obgyn", "220", "consultant", "in", 15, 20, "13:20", 318, "4.8"],
  ["sulami", bi("Dr. Abeer Al-Sulami", "د. عبير السلمي"), true, "obgyn", "221", "specialist", "later", 0, 20, "15:00", 287, "4.7"],
  ["nharthi", bi("Dr. Nouf Al-Harthi", "د. نوف الحارثي"), true, "obgyn", "222", "specialist", "off", 0, 0, "2026-11-19", 243, "4.9"],
  ["kamal", bi("Dr. Yasser Kamal", "د. ياسر كمال"), false, "peds", "103", "specialist", "in", 12, 16, "11:15", 280, "4.6"],
]

/** Title by clinic: specialty, "-ist" noun, Arabic specialty — "Consultant cardiologist", "Dermatology specialist". */
const TITLES: Record<string, [string, string, string]> = {
  dental: ["Dental", "dentist", "أسنان"],
  eyes: ["Ophthalmology", "ophthalmologist", "عيون"],
  cardio: ["Cardiology", "cardiologist", "قلب"],
  internal: ["Internal medicine", "internist", "باطنية"],
  derma: ["Dermatology", "dermatologist", "جلدية"],
  ortho: ["Orthopedics", "orthopedic surgeon", "عظام"],
  obgyn: ["OB/GYN", "obstetrician", "نساء وولادة"],
  peds: ["Pediatrics", "pediatrician", "أطفال"],
}
const GRADE_AR: Record<Grade, [string, string]> = { consultant: ["استشاري", "استشارية"], specialist: ["أخصائي", "أخصائية"], resident: ["مقيم", "مقيمة"] }
const titleOf = (clinic: string, grade: Grade, female: boolean): Bi => {
  const [spec, ist, ar] = TITLES[clinic]
  const en = grade === "consultant" ? `Consultant ${ist}` : `${spec} ${grade}`
  return bi(en, `${GRADE_AR[grade][female ? 1 : 0]} ${ar}`)
}

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\. /, "")
    .replace(/Al-/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

const OTHER: Base[] = EXTRA.map(([key, name, female, clinic, room, grade, status, seen, booked, next, visits, rating], i) => ({
  key,
  initials: initialsOf(name.en),
  name,
  title: titleOf(clinic, grade, female),
  grade,
  female,
  clinic,
  room,
  ...(key === "ghamdi" ? { headOf: "obgyn" } : {}),
  status,
  statusLabel:
    status === "in"
      ? IN
      : status === "later"
        ? bi(`Starts ${next === "14:00" ? "2 PM" : "3 PM"}`, `${female ? "تبدأ" : "يبدأ"} ${next === "14:00" ? "2" : "3"} الظهر`)
        : status === "off"
          ? bi("Off today", "إجازة اليوم")
          : bi("On leave · back 25 Nov", "في إجازة · يرجع 25 نوفمبر"),
  ...(status === "off" || status === "leave"
    ? { awayNote: status === "off" ? bi("Back tomorrow. Today's patients were moved.", "يرجع بكرة، وانتقل مرضى اليوم.") : bi("Annual leave. Patients were moved to the clinic's other doctors.", "إجازة سنوية، وانتقل المرضى لباقي أطباء العيادة.") }
    : {}),
  today: { seen, booked, nextFree: next },
  month: { visits, rating },
  credentials: creds(10 + i, clinic === "peds" ? [PALS(10 + i)] : []),
  active: true,
}))

/* ---------------------------------------------------------------- profile, hours and month figures */
const DAY_SHIFT: Shift[] = [{ from: "08:00", to: "16:00" }]
const LATE_SHIFT: Shift[] = [{ from: "14:00", to: "22:00" }]
const TELE: Shift = { from: "20:00", to: "22:00", telehealth: true }
const OFF = { fri: [] as Shift[], sat: [] as Shift[] }

/** REP (design): utilisation %, average consult (min), no-show %, reviews, revenue (SAR K). */
const REP: Record<string, [number, number, number, number, number]> = {
  zaki: [88, 14, 4.6, 128, 148],
  shehri: [92, 12, 6.9, 141, 132],
  saud: [81, 15, 5.2, 117, 121],
  odeh: [86, 32, 3.8, 96, 214],
  mansour: [94, 19, 3.1, 88, 236],
  qahtani: [84, 13, 5.0, 74, 118],
  otaibi: [76, 21, 6.0, 63, 102],
  fares: [70, 18, 6.6, 52, 109],
  hamdan: [34, 11, 4.0, 31, 38],
  kamal: [79, 19, 5.9, 90, 43],
}

/** Wait before seen (min) and follow-ups that return (%) — the design's Pediatrics figures, generated for the rest. */
const PERF: Record<string, [number, number]> = { zaki: [11, 72], saud: [12, 66], kamal: [16, 54] }

function profile(b: Base, i: number): Doctor {
  const zaki = b.key === "zaki"
  const later = b.status === "later"
  const shift = later ? LATE_SHIFT : DAY_SHIFT
  const week: Record<Weekday, Shift[]> = zaki
    ? { sun: DAY_SHIFT, mon: [...DAY_SHIFT, TELE], tue: DAY_SHIFT, wed: [...DAY_SHIFT, TELE], thu: [{ from: "08:00", to: "13:00" }], ...OFF }
    : { sun: shift, mon: shift, tue: shift, wed: shift, thu: shift, ...OFF }
  const perDay = b.today.booked || Math.round(b.month.visits / 13)
  const booked: Record<Weekday, number> = zaki
    ? { sun: 18, mon: 22, tue: 17, wed: 18, thu: 11, fri: 0, sat: 0 }
    : { sun: perDay + 2, mon: perDay + 3, tue: Math.max(0, perDay - 2), wed: b.today.booked, thu: Math.max(0, perDay - 4), fri: 0, sat: 0 }
  const [utilisation, consult, noShow, reviews, revenue] = REP[b.key] ?? [78 + (i % 5) * 3, 15 + (i % 4) * 2, 4 + (i % 3) * 0.8, 40 + i * 3, 80 + i * 6]
  return {
    ...b,
    month: { ...b.month, reviews, consult, noShow: Math.round(noShow * 10) / 10, utilisation, revenue, delta: zaki ? 5 : ((i * 7) % 11) - 4, wait: (PERF[b.key] ?? [9 + (i % 7), 0])[0], returnRate: (PERF[b.key] ?? [0, 58 + ((i * 5) % 20)])[1] },
    ext: zaki ? "1121" : String(1100 + i * 7),
    yearsExp: zaki ? 18 : b.grade === "consultant" ? 14 + (i % 6) : b.grade === "specialist" ? 6 + (i % 5) : 2 + (i % 2),
    languages: i % 3 === 2 ? { en: "Arabic · English · French", ar: "عربي · إنجليزي · فرنسي" } : { en: "Arabic · English", ar: "عربي · إنجليزي" },
    ages: b.clinic === "peds" ? [0, 14] : null,
    booking: { visitMin: zaki ? 15 : null, maxPerDay: zaki ? 24 : 20, online: true, acceptsNew: b.status !== "leave", telehealth: zaki },
    week,
    booked,
    leaveUsed: zaki ? 9 : b.key === "qahtani" ? 8 : 4 + (i % 8),
  }
}

export const DOCTORS: Doctor[] = [...DESIGN, ...OTHER].map(profile)

/**
 * A doctor made with New doctor: no weekly hours yet (the checklist asks for them, so they can't be booked), only the
 * SCFHS licence on file (issued today, 3 years), today and this month at 0.
 */
export function blankDoctor(key: string, f: Partial<Doctor> & { scfhs: string }): Doctor {
  const { scfhs, ...rest } = f
  const none: Record<Weekday, number> = { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 }
  const expires = `${Number(DOCTORS_TODAY.slice(0, 4)) + 3}${DOCTORS_TODAY.slice(4)}`
  return {
    key,
    initials: "",
    name: { en: "", ar: "" },
    title: { en: "", ar: "" },
    grade: "specialist",
    female: false,
    clinic: "",
    room: "",
    status: "off",
    statusLabel: bi("Not bookable yet", "ما ينحجز للحين"),
    today: { seen: 0, booked: 0, nextFree: "" },
    month: { visits: 0, rating: "–", reviews: 0, consult: 0, noShow: 0, utilisation: 0, revenue: 0, delta: 0, wait: 0, returnRate: 0 },
    credentials: [{ type: "scfhs", number: scfhs, issuer: SCFHS, issued: DOCTORS_TODAY, expires, required: true }],
    active: true,
    ext: "",
    yearsExp: 0,
    languages: bi("Arabic", "عربي"),
    ages: null,
    booking: { visitMin: null, maxPerDay: 20, online: true, acceptsNew: true, telehealth: false },
    week: { sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] },
    booked: none,
    leaveUsed: 0,
    ...rest,
  }
}
export const doctorByKey = (key: string) => DOCTORS.find((d) => d.key === key)
/** Head of a clinic (Clinics key). */
export const headOf = (clinic: string) => DOCTORS.find((d) => d.headOf === clinic)
/** A clinic's doctors, head first. */
export const doctorsIn = (clinic: string) =>
  DOCTORS.filter((d) => d.clinic === clinic).sort((a, b) => Number(b.headOf === clinic) - Number(a.headOf === clinic))
/** Appointments board doctor ids → roster keys (Book preselects these doctors). */
export const APPT_DOCTOR_KEY: Record<"km" | "az" | "so" | "hf", string> = { km: "mansour", az: "zaki", so: "odeh", hf: "fares" }
/** Doctor by English name (Clinics rows carry names). */
export const doctorByName = (en: string) => DOCTORS.find((d) => d.name.en === en)

/* ---------------------------------------------------------------- credentials */
export type CredStatus = "expired" | "due" | "soon" | "valid"
const DAY = 86_400_000
export const daysUntil = (iso: string, today = DOCTORS_TODAY) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY)
/**
 * Expired → destructive; ≤ 45 days → warning (the design's PALS 38 d / insurance 43 d / SCFHS 21 d); ≤ 60 days → info
 * (MOH licence 55 d); later → valid. Reminders go out at 60, 30 and 7 days.
 */
export function credStatus(c: Credential): CredStatus {
  const n = daysUntil(c.expires)
  return n < 0 ? "expired" : n <= 45 ? "due" : n <= 60 ? "soon" : "valid"
}
export const CRED_TONE = { expired: "destructive", due: "warning", soon: "info", valid: "success" } as const
/** Credentials expired or expiring within 60 days, most urgent first. */
export const dueCredentials = (d: Doctor) =>
  d.credentials.filter((c) => credStatus(c) !== "valid").sort((a, b) => a.expires.localeCompare(b.expires))
/** The card alert: the most urgent expired / ≤ 45-day credential. */
export const cardAlert = (d: Doctor) => dueCredentials(d).find((c) => credStatus(c) !== "soon")
/** An expired required credential blocks booking. */
export const isBlocked = (d: Doctor) => d.credentials.some((c) => c.required && credStatus(c) === "expired")

/* ---------------------------------------------------------------- New doctor checklist */
export const SETUP_STEPS = ["personal", "licence", "clinic", "hours", "account"] as const
export type SetupStep = (typeof SETUP_STEPS)[number]
/** SCFHS registration number, e.g. RM-10-0045821 (placeholder XX-00-0000000). */
export const SCFHS_PATTERN = /^[A-Z]{2}-\d{2}-\d{7}$/
/** "Before they can be booked": personal details · SCFHS licence checked · main clinic & room · weekly hours · system account. */
export function setupOf(d: Doctor): Record<SetupStep, boolean> {
  const scfhs = d.credentials.find((c) => c.type === "scfhs")
  const c = contactOf(d)
  return {
    personal: !!d.name.en.trim() && !!d.name.ar.trim(),
    licence: !!scfhs && SCFHS_PATTERN.test(scfhs.number),
    clinic: !!d.clinic && !!d.room,
    hours: WEEKDAYS.some((w) => d.week[w].length > 0),
    account: !!c.email && /@/.test(c.email),
  }
}
/** A doctor can't be booked until every step is done. */
export const setupDone = (d: Doctor) => Object.values(setupOf(d)).every(Boolean)

/* ---------------------------------------------------------------- list KPIs */
export const isAway = (d: Doctor) => d.status === "off" || d.status === "leave"
export const isInClinic = (d: Doctor) => d.status === "in" || d.status === "late"

export function doctorKpis(list: Doctor[]) {
  const active = list.filter((d) => d.active)
  const due = active.flatMap(dueCredentials)
  return {
    doctors: active.length,
    onDuty: active.filter((d) => !isAway(d)).length,
    booked: active.reduce((s, d) => s + d.today.booked, 0),
    /** vs last Wednesday (design figure). */
    bookedDelta: 6,
    away: active.filter(isAway).length,
    onLeave: active.filter((d) => d.status === "leave").length,
    offToday: active.filter((d) => d.status === "off").length,
    due: due.length,
    expired: due.filter((c) => credStatus(c) === "expired").length,
  }
}

/* ---------------------------------------------------------------- today's patients */
export type VisitState = "done" | "inRoom" | "waiting" | "checkedIn" | "free" | "booked"
export type Visit = { time: string; patient?: Bi; reason: Bi; state: VisitState; waited?: number }

const ZAKI_TODAY: Visit[] = [
  { time: "08:30", patient: bi("Yousef Al-Amri", "يوسف العمري"), reason: bi("Follow-up", "متابعة"), state: "done" },
  { time: "08:45", patient: bi("Jana Al-Harthi", "جنى الحارثي"), reason: bi("Vaccination", "تطعيم"), state: "done" },
  { time: "10:20", patient: bi("Lina Haddad", "لينا حداد"), reason: bi("Follow-up", "متابعة"), state: "inRoom" },
  { time: "10:40", patient: bi("Omar Al-Harbi", "عمر الحربي"), reason: bi("Fever · urgent", "حرارة · مستعجل"), state: "waiting", waited: 18 },
  { time: "11:00", patient: bi("Sara Ahmed", "سارة أحمد"), reason: bi("New patient", "مريض جديد"), state: "checkedIn" },
  { time: "11:30", reason: bi("Free slot", "موعد فاضي"), state: "free" },
  { time: "11:45", patient: bi("Fahad Al-Dosari", "فهد الدوسري"), reason: bi("Asthma follow-up", "متابعة الربو"), state: "booked" },
]
const POOL: Bi[] = [
  bi("Huda Al-Ghamdi", "هدى الغامدي"),
  bi("Nasser Al-Qahtani", "ناصر القحطاني"),
  bi("Reema Al-Shahri", "ريما الشهري"),
  bi("Abdulaziz Al-Otaibi", "عبدالعزيز العتيبي"),
  bi("Maha Saleh", "مها صالح"),
  bi("Khalid Al-Zahrani", "خالد الزهراني"),
  bi("Dana Al-Mutlaq", "دانة المطلق"),
  bi("Saleh Al-Juhani", "صالح الجهني"),
  bi("Ghada Al-Harbi", "غادة الحربي"),
]
const REASONS: Bi[] = [bi("Follow-up", "متابعة"), bi("New patient", "مريض جديد"), bi("Results review", "مراجعة نتايج"), bi("Consultation", "استشارة")]
const at = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

/** Today's list: the design's for Dr. Ahmed Zaki, a steady pattern around 10:40 for the others (none when away). */
export function todayOf(d: Doctor): Visit[] {
  if (d.key === "zaki") return ZAKI_TODAY
  if (d.status === "off" || d.status === "leave") return []
  const n = DOCTORS.findIndex((x) => x.key === d.key)
  const step = d.booking.visitMin ?? 20
  const states: VisitState[] =
    d.status === "later"
      ? ["booked", "booked", "booked", "booked", "booked"]
      : d.status === "late"
        ? ["done", "inRoom", "waiting", "waiting", "waiting", "checkedIn", "booked"]
        : ["done", "done", "inRoom", "waiting", "checkedIn", "booked", "booked"]
  const start = d.status === "later" ? 14 * 60 : 10 * 60 + 40 - step * states.indexOf("inRoom")
  return states.map((state, i) => ({
    time: at(start + i * step),
    patient: POOL[(n + i) % POOL.length],
    reason: REASONS[(n + i) % REASONS.length],
    state,
    ...(state === "waiting" ? { waited: 6 + i * 4 } : {}),
  }))
}

/* ---------------------------------------------------------------- leave */
export type LeaveType = "annual" | "sick" | "conference" | "training" | "dayOff"
export type LeaveStatus = "pending" | "approved" | "declined"
export type Leave = {
  id: string
  doctor: string
  type: LeaveType
  from: string
  to: string
  /** Cover doctor (roster key), or a name for a doctor outside the roster. */
  cover?: string
  coverName?: Bi
  status: LeaveStatus
  /** Bookings that fall in these dates. */
  bookings: number
  place?: Bi
  note?: Bi
  /** Requested with "Cancel bookings" instead of moving them to the cover. */
  cancelBookings?: boolean
}
export const LEAVES: Leave[] = [
  { id: "lv-zaki-annual", doctor: "zaki", type: "annual", from: "2026-12-22", to: "2026-12-26", cover: "saud", status: "approved", bookings: 0 },
  { id: "lv-zaki-conf", doctor: "zaki", type: "conference", from: "2027-02-10", to: "2027-02-10", cover: "saud", status: "pending", bookings: 6, place: bi("Riyadh", "الرياض") },
  { id: "lv-qahtani", doctor: "qahtani", type: "annual", from: "2026-12-07", to: "2026-12-11", cover: "harbi", status: "pending", bookings: 19 },
  { id: "lv-shehri", doctor: "shehri", type: "conference", from: "2027-01-14", to: "2027-01-16", coverName: bi("Dr. Waleed Saeed", "د. وليد سعيد"), status: "pending", bookings: 11 },
  { id: "lv-hamdan", doctor: "hamdan", type: "annual", from: "2026-11-08", to: "2026-11-19", coverName: bi("Dr. Waleed Saeed", "د. وليد سعيد"), status: "approved", bookings: 12 },
  { id: "lv-whassan", doctor: "whassan", type: "annual", from: "2026-11-16", to: "2026-11-24", cover: "mutairi", status: "approved", bookings: 9 },
  // Days off and training this week (Leave & cover · "Who's away this week")
  { id: "lv-fares-off", doctor: "fares", type: "dayOff", from: "2026-11-18", to: "2026-11-18", cover: "harbi", status: "approved", bookings: 4 },
  { id: "lv-fares-trn", doctor: "fares", type: "training", from: "2026-11-19", to: "2026-11-19", status: "approved", bookings: 0, place: bi("Riyadh", "الرياض") },
  { id: "lv-kamal-off", doctor: "kamal", type: "dayOff", from: "2026-11-15", to: "2026-11-15", status: "approved", bookings: 0 },
  { id: "lv-saud-off", doctor: "saud", type: "dayOff", from: "2026-11-19", to: "2026-11-19", cover: "kamal", status: "approved", bookings: 0 },
  { id: "lv-bqahtani-off", doctor: "bqahtani", type: "dayOff", from: "2026-11-18", to: "2026-11-18", cover: "otaibi", status: "approved", bookings: 0 },
  { id: "lv-nharthi-off", doctor: "nharthi", type: "dayOff", from: "2026-11-18", to: "2026-11-18", cover: "ghamdi", status: "approved", bookings: 0 },
]
/** Calendar days in a leave. */
export const leaveDays = (l: { from: string; to: string }) => Math.round((Date.parse(`${l.to}T12:00:00Z`) - Date.parse(`${l.from}T12:00:00Z`)) / 86_400_000) + 1
/** Annual and sick leave come out of the 21-day balance; the rest doesn't. */
export const countsAgainstBalance = (t: LeaveType) => t === "annual"
/** "Who's away" cell kind for a leave type. */
export const awayKind = (t: LeaveType) => (t === "dayOff" ? "off" : t === "training" || t === "conference" ? "training" : "leave")
/** This week on the Leave & cover board: Sun 15 – Thu 19 Nov. */
export const AWAY_WEEK = ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]

/* ---------------------------------------------------------------- patients (Patients tab) */
/** next: ISO date, null (none booked) or "overdue". */
export type DoctorPatient = { initials: string; name: Bi; mrn: string; age: Bi; last: string; next: string | null | "overdue"; condition: Bi; payer: Bi; isNew?: boolean }

const BUPA = bi("Bupa", "بوبا")
const TAW = bi("Tawuniya", "التعاونية")
const ZAKI_PATIENTS: DoctorPatient[] = [
  { initials: "YA", name: bi("Yousef Al-Amri", "يوسف العمري"), mrn: "MRN-20418", age: bi("8 y", "8 سنوات"), last: "2026-11-18", next: "2026-12-16", condition: bi("Asthma", "ربو"), payer: BUPA },
  { initials: "JH", name: bi("Jana Al-Harthi", "جنى الحارثي"), mrn: "MRN-21877", age: bi("14 m", "14 شهر"), last: "2026-11-18", next: "2027-01-18", condition: bi("Vaccines due", "تطعيمات مستحقة"), payer: TAW },
  { initials: "LH", name: bi("Lina Haddad", "لينا حداد"), mrn: "MRN-19022", age: bi("6 y", "6 سنوات"), last: "2026-11-18", next: null, condition: bi("Iron deficiency", "نقص حديد"), payer: bi("Cash", "كاش") },
  { initials: "OH", name: bi("Omar Al-Harbi", "عمر الحربي"), mrn: "MRN-22310", age: bi("3 y", "3 سنوات"), last: "2026-11-02", next: null, condition: bi("Recurrent fever", "حرارة متكررة"), payer: bi("MedGulf", "ميدغلف") },
  { initials: "FD", name: bi("Fahad Al-Dosari", "فهد الدوسري"), mrn: "MRN-17654", age: bi("11 y", "11 سنة"), last: "2026-10-21", next: "2026-11-18", condition: bi("Asthma", "ربو"), payer: BUPA },
  { initials: "RM", name: bi("Reem Al-Mutairi", "ريم المطيري"), mrn: "MRN-23001", age: bi("5 m", "5 شهور"), last: "2026-11-09", next: "2026-12-09", condition: bi("Growth check", "متابعة نمو"), payer: BUPA, isNew: true },
  { initials: "AS", name: bi("Abdullah Al-Shammari", "عبدالله الشمري"), mrn: "MRN-15530", age: bi("13 y", "13 سنة"), last: "2026-09-28", next: "overdue", condition: bi("Type 1 diabetes", "سكري نوع 1"), payer: TAW },
]
const CONDITIONS: Bi[] = [bi("Follow-up", "متابعة"), bi("Hypertension", "ضغط"), bi("Type 2 diabetes", "سكري نوع 2"), bi("Check-up", "فحص دوري"), bi("Post-op review", "مراجعة بعد العملية")]
const PAYERS: Bi[] = [BUPA, TAW, bi("Cash", "كاش"), bi("MedGulf", "ميدغلف")]

/** The doctor's patients (last 12 months): the design's list for Dr. Ahmed Zaki, a short sample for the others. */
export function patientsOf(d: Doctor): DoctorPatient[] {
  if (d.key === "zaki") return ZAKI_PATIENTS
  const n = DOCTORS.findIndex((x) => x.key === d.key)
  const lasts = ["2026-11-16", "2026-11-10", "2026-11-03", "2026-10-27", "2026-10-12", "2026-09-30"]
  const nexts: DoctorPatient["next"][] = ["2026-12-14", null, "2026-12-01", "overdue", "2027-01-05", null]
  return lasts.map((last, i) => {
    const name = POOL[(n + i) % POOL.length]
    const age = 24 + ((n + i * 7) % 50)
    return {
      initials: name.en.replace(/Al-/g, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join(""),
      name,
      mrn: `MRN-${16000 + n * 211 + i * 37}`,
      age: bi(`${age} y`, `${age} سنة`),
      last,
      next: nexts[i],
      condition: CONDITIONS[(n + i) % CONDITIONS.length],
      payer: PAYERS[(n + i) % PAYERS.length],
      ...(i === 1 ? { isNew: true } : {}),
    }
  })
}
/** Panel figures behind the filter (the design's 1,240 / 23 / 18 for Dr. Ahmed Zaki). */
export const panelOf = (d: Doctor) =>
  d.key === "zaki" ? { all: 1240, due: 23, newMonth: 18 } : { all: d.month.visits * 3, due: Math.round(d.month.visits / 18), newMonth: Math.round(d.month.visits / 23) }
/** Follow-up due: overdue, or the next visit within 30 days. */
export const isFollowUpDue = (p: DoctorPatient) => p.next === "overdue" || (!!p.next && daysUntil(p.next) <= 30)

/* ---------------------------------------------------------------- performance */
export type Review = { stars: number; text: Bi; by: Bi; date: string }
const ZAKI_REVIEWS: Review[] = [
  { stars: 5, text: bi("Explained everything to us calmly. My son wasn't scared at all.", "شرح لنا كل شي بهدوء، وولدي ما خاف أبد."), by: bi("Parent of Yousef", "أم يوسف"), date: "2026-11-18" },
  { stars: 5, text: bi("On time and very thorough with the vaccine plan.", "على الموعد ودقيق مرة في جدول التطعيمات."), by: bi("Parent of Jana", "أبو جنى"), date: "2026-11-12" },
  { stars: 4, text: bi("Great doctor, but we waited 25 minutes.", "دكتور ممتاز، بس انتظرنا 25 دقيقة."), by: bi("Parent of Omar", "أم عمر"), date: "2026-11-02" },
]
/** Recent patient reviews: the design's for Dr. Ahmed Zaki, three general ones for the others. */
export function reviewsOf(d: Doctor): Review[] {
  if (d.key === "zaki") return ZAKI_REVIEWS
  const n = DOCTORS.findIndex((x) => x.key === d.key)
  const first = (v: Bi) => ({ en: v.en.split(" ")[0], ar: v.ar.split(" ")[0] })
  return [
    { stars: 5, text: bi("Listened carefully and explained the plan clearly.", "سمعني زين وشرح الخطة بوضوح."), by: first(POOL[n % POOL.length]), date: "2026-11-15" },
    { stars: 5, text: bi("Very professional, and the follow-up call was a nice touch.", "محترف مرة، وحلوة مكالمة المتابعة."), by: first(POOL[(n + 2) % POOL.length]), date: "2026-11-08" },
    { stars: 4, text: bi("Good visit, but the clinic was running late.", "الزيارة زينة، بس العيادة كانت متأخرة."), by: first(POOL[(n + 4) % POOL.length]), date: "2026-10-30" },
  ]
}
/** Visits per month, Jun → Nov (Nov so far). */
export const historyOf = (d: Doctor) =>
  d.key === "zaki" ? [588, 402, 455, 640, 676, 412] : [1.42, 0.98, 1.1, 1.55, 1.64, 1].map((f) => Math.round(d.month.visits * f))
export const HISTORY_MONTHS = ["2026-06-15", "2026-07-15", "2026-08-15", "2026-09-15", "2026-10-15", "2026-11-15"]

/* ---------------------------------------------------------------- leave helpers */
const addDay = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysIn = (from: string, to: string) => {
  const out: string[] = []
  for (let x = from; x <= to && out.length < 400; x = addDay(x, 1)) out.push(x)
  return out
}
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]
/** Days in a range the doctor normally works in clinic. */
export const workingDays = (d: Doctor, from: string, to: string) => daysIn(from, to).filter((x) => d.week[weekdayOf(x)].some((s) => !s.telehealth)).length
/**
 * Booked visits that fall in a range: this week's per-day figures, thinned out the further ahead the day is (most
 * bookings are made in the last few weeks).
 */
export function bookingsBetween(d: Doctor, from: string, to: string) {
  return daysIn(from, to).reduce((n, x) => {
    const ahead = daysUntil(x)
    if (ahead < 0) return n
    const fill = ahead <= 1 ? 1 : Math.max(0.1, 1 - ahead / 52)
    return n + Math.round(d.booked[weekdayOf(x)] * fill)
  }, 0)
}

/* ---------------------------------------------------------------- CME and clinical privileges (Credentials tab) */
export type Cme = { cycle: string; required: number; courses: { name: Bi; hours: number }[] }
export type Privilege = { name: Bi; status: "approved" | "underReview" }

const ZAKI_CME: Cme = {
  cycle: "2026",
  required: 50,
  courses: [
    { name: bi("Saudi Pediatric Conference", "المؤتمر السعودي لطب الأطفال"), hours: 12 },
    { name: bi("Asthma update · online", "مستجدات الربو · أونلاين"), hours: 6 },
    { name: bi("Neonatal resuscitation", "إنعاش حديثي الولادة"), hours: 8 },
    { name: bi("Grand rounds · Pediatrics", "الاجتماعات العلمية · الأطفال"), hours: 8 },
  ],
}
/** CME hours this cycle (50 needed for SCFHS renewal). The design lists 3 of Dr. Ahmed's courses; the 4th makes up his 34 hours. */
export function cmeOf(d: Doctor): Cme {
  if (d.key === "zaki") return ZAKI_CME
  const n = DOCTORS.findIndex((x) => x.key === d.key)
  return {
    cycle: "2026",
    required: 50,
    courses: [
      { name: bi("Annual scientific meeting", "الملتقى العلمي السنوي"), hours: 10 + (n % 5) },
      { name: bi("Infection control · online", "مكافحة العدوى · أونلاين"), hours: 4 },
      { name: bi("Grand rounds", "الاجتماعات العلمية"), hours: 6 + (n % 9) },
    ],
  }
}
export const cmeEarned = (c: Cme) => c.courses.reduce((s, x) => s + x.hours, 0)

const PRIVILEGES: Record<string, Privilege[]> = {
  peds: [
    { name: bi("General pediatrics", "طب الأطفال العام"), status: "approved" },
    { name: bi("Procedural sedation", "التخدير الخفيف للإجراءات"), status: "approved" },
    { name: bi("Neonatal care", "رعاية حديثي الولادة"), status: "approved" },
    { name: bi("Allergy testing", "فحوصات الحساسية"), status: "underReview" },
  ],
}
/** Clinical privileges: the design's for Pediatrics, the clinic's core privilege otherwise. */
export function privilegesOf(d: Doctor, clinicName: Bi): Privilege[] {
  if (PRIVILEGES[d.clinic]) return d.key === "zaki" ? PRIVILEGES[d.clinic] : PRIVILEGES[d.clinic].slice(0, 2)
  return [
    { name: bi(`General ${clinicName.en.toLowerCase()}`, `${clinicName.ar} العام`), status: "approved" },
    { name: bi("Procedural sedation", "التخدير الخفيف للإجراءات"), status: d.grade === "consultant" ? "approved" : "underReview" },
  ]
}

/* ---------------------------------------------------------------- credentials board */
/** Board buckets: expired · within 30 days · within 60 days · valid. */
export type CredBucket = "expired" | "d30" | "d60" | "valid"
export function credBucket(c: Credential): CredBucket {
  const n = daysUntil(c.expires)
  return n < 0 ? "expired" : n <= 30 ? "d30" : n <= 60 ? "d60" : "valid"
}
/** "Renewals due" window: expired and everything expiring in the next 120 days. */
export const RENEWAL_WINDOW = 120
