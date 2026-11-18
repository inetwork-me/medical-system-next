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
export type Credential = { type: CredentialType; number: string; issuer: Bi; issued: string; expires: string; required: boolean }

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
  /** This month: visits, rating. */
  month: { visits: number; rating: string }
  credentials: Credential[]
  active: boolean
}

const bi = (en: string, ar: string): Bi => ({ en, ar })

const SCFHS = bi("SCFHS", "هيئة التخصصات")
const MOH = bi("Ministry of Health", "وزارة الصحة")
const SHA = bi("Saudi Heart Association", "جمعية القلب السعودية")
const TAWUNIYA = bi("Tawuniya", "التعاونية")

/** The standard set every doctor holds; a doctor's own entries replace these by type. */
function creds(n: number, own: Credential[] = []): Credential[] {
  const base: Credential[] = [
    { type: "scfhs", number: `RM-1${n % 10}-00${41200 + n * 37}`, issuer: SCFHS, issued: "2025-03-14", expires: "2028-03-14", required: true },
    { type: "moh", number: `ML-2${10 + n}-${4100 + n * 13}`, issuer: MOH, issued: "2024-06-30", expires: "2027-06-30", required: true },
    { type: "bls", number: `BLS-8${8000 + n * 11}`, issuer: SHA, issued: "2025-02-02", expires: "2027-02-02", required: true },
    { type: "malpractice", number: `TW-MP-7${7000 + n * 9}`, issuer: TAWUNIYA, issued: "2026-01-01", expires: "2027-12-31", required: true },
  ]
  return [...base.filter((b) => !own.some((o) => o.type === b.type)), ...own]
}

/* ---------------------------------------------------------------- the 9 design doctors */
const DESIGN: Doctor[] = [
  {
    key: "zaki",
    initials: "AZ",
    name: bi("Dr. Ahmed Zaki", "د. أحمد زكي"),
    title: bi("Consultant pediatrician", "استشاري طب أطفال"),
    grade: "consultant",
    female: false,
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
    credentials: creds(4),
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

const OTHER: Doctor[] = EXTRA.map(([key, name, female, clinic, room, grade, status, seen, booked, next, visits, rating], i) => ({
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
  credentials: creds(10 + i),
  active: true,
}))

export const DOCTORS: Doctor[] = [...DESIGN, ...OTHER]
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
