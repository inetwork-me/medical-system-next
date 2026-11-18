import type { IconName } from "@/components/ds/icon"
import type { Bi } from "@/lib/mock/bi"

/**
 * Clinics module mock data — figures from design-scripts/clinic_widgets.py (CLINICS, DOCS, QUEUE, ROOMS, PRICES,
 * HOURS, BOARD, REP) and build_clinics.py (KPIS). "Today" on every Clinics screen is Wed 18 Nov 2026, 10:40.
 */
export const CLINICS_TODAY = "2026-11-18"
export const CLINICS_NOW = "10:40"
/** Month figures run from the 1st to today. */
export const MONTH_FROM = "2026-11-01"

export type ClinicStatus = "open" | "busy" | "paused"
export type TileTone = "info" | "accent" | "success" | "destructive" | "warning" | "muted"
export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
export const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

export type Payer = "cash" | "bupa" | "tawuniya" | "medgulf"
/** Payer columns keep this order everywhere. */
export const PAYERS: Payer[] = ["cash", "bupa", "tawuniya", "medgulf"]

export type Service = { id: string; name: Bi; code: string; minutes: number; prices: Record<Payer, number>; active: boolean }
export type RoomStatus = "inUse" | "free" | "cleaning" | "closed"
export type Room = { number: string; type: Bi; status: RoomStatus; occupant?: Bi; since?: string; readyIn?: number; equipment: Bi[] }
export type DoctorTone = "info" | "success" | "neutral"
export type ClinicDoctor = {
  initials: string
  name: Bi
  role: Bi
  days: Bi
  hours: string
  today: { tone: DoctorTone; label: Bi }
  month: number
  rating: string
}
export type BookingRules = { slotMin: number; gapMin: number; maxDaysAhead: number; online: boolean; walkIns: boolean; walkInsPerHour: number }
export type Closure = { date: string; reason: Bi; kind: "halfDay" | "holiday" }

export type Clinic = {
  key: string
  name: Bi
  /** Shorter name for chart axes. */
  short: Bi
  specialty: Bi
  icon: IconName
  tone: TileTone
  head: Bi
  headInitials: string
  floor: number
  wing: string
  ext: string
  whatsapp: string
  branch: Bi
  ages: [number, number] | null
  status: ClinicStatus
  /** Paused clinics: back on this day, with the reason shown on the card. */
  pausedUntil?: string
  pauseNote?: Bi
  closesAt: string
  doctorCount: number
  roomCount: number
  /** Today: seen, booked, waiting now, average wait (min). */
  today: { seen: number; booked: number; waiting: number; avgWait: number }
  /** This month (1st → today): visits, utilisation %, no-show %, rating, revenue (SAR thousands). */
  month: { visits: number; utilisation: number; noShow: number; rating: string; reviews: number; revenue: number; insuredPct: number; visitsDelta: number; noShowDelta: number }
  doctors: ClinicDoctor[]
  rooms: Room[]
  hours: Record<Weekday, string[]>
  rules: BookingRules
  closures: Closure[]
  services: Service[]
  specialtyTools: { eyes: boolean; dental: boolean }
}

export const BRANCHES: { key: string; name: Bi }[] = [{ key: "malqa", name: { en: "Riyadh · Al Malqa", ar: "الرياض · الملقا" } }]
const RIYADH: Bi = { en: "Riyadh branch", ar: "فرع الرياض" }

const bi = (en: string, ar: string): Bi => ({ en, ar })

/* ---------------------------------------------------------------- Pediatrics (the clinic every clinic-page screen shows) */
const PEDS_DOCTORS: ClinicDoctor[] = [
  {
    initials: "AZ",
    name: bi("Dr. Ahmed Zaki", "د. أحمد زكي"),
    role: bi("Consultant · head of clinic", "استشاري · رئيس العيادة"),
    days: bi("Sun–Thu", "الأحد–الخميس"),
    hours: "08:00–16:00",
    today: { tone: "info", label: bi("In session · Room 101", "مع مريض · غرفة 101") },
    month: 412,
    rating: "4.8",
  },
  {
    initials: "LS",
    name: bi("Dr. Lama Al-Saud", "د. لمى آل سعود"),
    role: bi("Specialist", "أخصائية"),
    days: bi("Sun–Thu", "الأحد–الخميس"),
    hours: "14:00–22:00",
    today: { tone: "success", label: bi("Available", "متاحة") },
    month: 356,
    rating: "4.9",
  },
  {
    initials: "YK",
    name: bi("Dr. Yasser Kamal", "د. ياسر كمال"),
    role: bi("Specialist", "أخصائي"),
    days: bi("Sat–Wed", "السبت–الأربعاء"),
    hours: "08:00–16:00",
    today: { tone: "neutral", label: bi("On break · back 1:30 PM", "استراحة · يرجع 1:30 م") },
    month: 280,
    rating: "4.6",
  },
]

const PEDS_ROOMS: Room[] = [
  {
    number: "101",
    type: bi("Consultation", "كشف"),
    status: "inUse",
    occupant: bi("Dr. Ahmed Zaki", "د. أحمد زكي"),
    since: "10:20",
    equipment: [bi("Exam bed", "سرير كشف"), bi("Otoscope", "منظار أذن"), bi("Baby scale", "ميزان أطفال")],
  },
  { number: "102", type: bi("Consultation", "كشف"), status: "free", equipment: [bi("Exam bed", "سرير كشف"), bi("Otoscope", "منظار أذن")] },
  { number: "103", type: bi("Procedures", "إجراءات"), status: "cleaning", readyIn: 5, equipment: [bi("Nebulizer", "جهاز بخار"), bi("Oxygen", "أكسجين")] },
  {
    number: "104",
    type: bi("Vaccination", "تطعيمات"),
    status: "inUse",
    occupant: bi("Nurse Huda", "الممرضة هدى"),
    since: "10:32",
    equipment: [bi("Vaccine fridge", "ثلاجة لقاحات"), bi("Baby scale", "ميزان أطفال")],
  },
]

const svc = (id: string, name: Bi, code: string, minutes: number, cash: number, bupa: number, tawuniya: number, medgulf: number): Service => ({
  id,
  name,
  code,
  minutes,
  prices: { cash, bupa, tawuniya, medgulf },
  active: true,
})

const PEDS_SERVICES: Service[] = [
  svc("peds-new", bi("New patient consultation", "كشف مريض جديد"), "99203", 20, 350, 300, 290, 310),
  svc("peds-fu", bi("Follow-up visit", "زيارة متابعة"), "99213", 15, 250, 220, 210, 220),
  svc("peds-urgent", bi("Urgent visit", "زيارة مستعجلة"), "99214", 20, 400, 350, 340, 360),
  svc("peds-vacc", bi("Vaccination · per dose", "تطعيم · للجرعة"), "90460", 10, 120, 100, 100, 100),
  svc("peds-neb", bi("Nebulizer session", "جلسة بخار"), "94640", 15, 150, 130, 125, 130),
  svc("peds-growth", bi("Growth & development check", "فحص النمو والتطور"), "96110", 30, 300, 260, 250, 260),
  svc("peds-tele", bi("Telehealth follow-up", "متابعة عن بُعد"), "99442", 15, 200, 180, 170, 180),
]

const DAY = ["08:00–14:00", "16:00–22:00"]
const PEDS_HOURS: Record<Weekday, string[]> = { sun: DAY, mon: DAY, tue: DAY, wed: DAY, thu: ["08:00–14:00", "16:00–20:00"], fri: [], sat: ["16:00–22:00"] }
// Other clinics also run Saturday mornings (Appointments: Dr. Khaled Mansour and Dr. Sami Odeh work Saturdays 09–13).
const STD_HOURS: Record<Weekday, string[]> = { sun: DAY, mon: DAY, tue: DAY, wed: DAY, thu: DAY, fri: [], sat: DAY }
const STD_RULES: BookingRules = { slotMin: 15, gapMin: 5, maxDaysAhead: 30, online: true, walkIns: true, walkInsPerHour: 2 }
/** Visit length + gap = the Appointments slot of the clinic's doctors (Pediatrics 15 + 5 = Dr. Ahmed Zaki's 20 min). */
const RULES: Record<string, Partial<BookingRules>> = {
  cardio: { slotMin: 25 },
  dental: { slotMin: 40 },
  ortho: { slotMin: 25 },
}

/** Appointments doctors (data shared with that module) → their clinic. */
export const APPT_DOCTOR_CLINIC: Record<string, string> = { az: "peds", so: "dental", km: "cardio", hf: "ortho" }
const STD_CLOSURES: Closure[] = [
  { date: "2026-12-01", reason: bi("Staff training · until 12 PM", "تدريب الموظفين · لين 12 الظهر"), kind: "halfDay" },
  { date: "2027-02-22", reason: bi("Founding Day", "يوم التأسيس"), kind: "holiday" },
]

/* ---------------------------------------------------------------- rooms board (design BOARD) */
type BoardRoom = { number: string; status: RoomStatus; clinic: string }
const board = (rows: [string, RoomStatus, string][]): BoardRoom[] => rows.map(([number, status, clinic]) => ({ number, status, clinic }))
export const BOARD: { floor: number; rooms: BoardRoom[] }[] = [
  {
    floor: 1,
    rooms: board([
      ["101", "inUse", "peds"],
      ["102", "free", "peds"],
      ["103", "cleaning", "peds"],
      ["104", "inUse", "peds"],
      ["110", "inUse", "internal"],
      ["111", "inUse", "internal"],
      ["112", "free", "internal"],
      ["113", "inUse", "internal"],
      ["120", "inUse", "ortho"],
      ["121", "free", "ortho"],
    ]),
  },
  {
    floor: 2,
    rooms: board([
      ["201", "inUse", "dental"],
      ["202", "inUse", "dental"],
      ["203", "inUse", "dental"],
      ["204", "cleaning", "dental"],
      ["205", "free", "dental"],
      ["210", "inUse", "eyes"],
      ["211", "inUse", "eyes"],
      ["220", "inUse", "obgyn"],
      ["221", "free", "obgyn"],
      ["222", "cleaning", "obgyn"],
    ]),
  },
  {
    floor: 3,
    rooms: board([
      ["301", "inUse", "cardio"],
      ["302", "inUse", "cardio"],
      ["303", "free", "cardio"],
      ["310", "inUse", "derma"],
      ["311", "free", "derma"],
      ["320", "closed", "ent"],
      ["321", "closed", "ent"],
    ]),
  },
]

/* ---------------------------------------------------------------- other clinics' details (derived; the design details Pediatrics only) */
const OTHER_DOCTORS: Record<string, Bi[]> = {
  dental: [bi("Dr. Faisal Al-Harbi", "د. فيصل الحربي"), bi("Dr. Rawan Al-Zahrani", "د. روان الزهراني"), bi("Dr. Omar Nasser", "د. عمر ناصر")],
  eyes: [bi("Dr. Bandar Al-Qahtani", "د. بندر القحطاني")],
  cardio: [bi("Dr. Hessa Al-Dossary", "د. حصة الدوسري")],
  internal: [bi("Dr. Saad Al-Mutairi", "د. سعد المطيري"), bi("Dr. Amal Al-Shammari", "د. أمل الشمري"), bi("Dr. Waleed Hassan", "د. وليد حسن")],
  derma: [bi("Dr. Lulwa Al-Rashid", "د. لولوة الرشيد")],
  ortho: [bi("Dr. Turki Al-Anazi", "د. تركي العنزي")],
  obgyn: [bi("Dr. Abeer Al-Sulami", "د. عبير السلمي"), bi("Dr. Nouf Al-Harthi", "د. نوف الحارثي")],
}
const FEMALE = /Rawan|Amal|Hessa|Lulwa|Abeer|Nouf|Reem|Nora|Huda|Mona|Lama/

function doctorsOf(key: string, head: Bi, status: ClinicStatus): ClinicDoctor[] {
  const rooms = roomsOf(key)
  return [head, ...(OTHER_DOCTORS[key] ?? [])].map((name, i) => {
    const she = FEMALE.test(name.en)
    const room = rooms[i]?.number
    const today: ClinicDoctor["today"] =
      status === "paused"
        ? { tone: "neutral", label: bi("On leave", "في إجازة") }
        : i % 3 === 0 && room
          ? { tone: "info", label: bi(`In session · Room ${room}`, `مع مريض · غرفة ${room}`) }
          : i % 3 === 1
            ? { tone: "success", label: bi("Available", she ? "متاحة" : "متاح") }
            : { tone: "neutral", label: bi("On break · back 1:30 PM", she ? "استراحة · ترجع 1:30 م" : "استراحة · يرجع 1:30 م") }
    return {
      initials: initialsOf(name.en),
      name,
      role: i === 0 ? bi("Consultant · head of clinic", she ? "استشارية · رئيسة العيادة" : "استشاري · رئيس العيادة") : bi("Specialist", she ? "أخصائية" : "أخصائي"),
      days: i % 2 ? bi("Sat–Wed", "السبت–الأربعاء") : bi("Sun–Thu", "الأحد–الخميس"),
      hours: i % 2 ? "14:00–22:00" : "08:00–16:00",
      today,
      month: 380 - i * 47,
      rating: ["4.8", "4.7", "4.9", "4.6"][i % 4],
    }
  })
}

const ROOM_TYPE: Record<string, [Bi, Bi[]]> = {
  dental: [bi("Dental chair", "كرسي أسنان"), [bi("Dental unit", "وحدة أسنان"), bi("X-ray sensor", "حساس أشعة")]],
  eyes: [bi("Eye exam", "فحص عيون"), [bi("Slit lamp", "مصباح شقي"), bi("Eye chart", "لوحة نظر")]],
  cardio: [bi("Consultation", "كشف"), [bi("ECG", "جهاز تخطيط"), bi("Exam bed", "سرير كشف")]],
  ent: [bi("Consultation", "كشف"), [bi("Endoscope", "منظار"), bi("Exam chair", "كرسي كشف")]],
}
const DEFAULT_ROOM: [Bi, Bi[]] = [bi("Consultation", "كشف"), [bi("Exam bed", "سرير كشف")]]

function roomsOf(key: string): Room[] {
  const [type, equipment] = ROOM_TYPE[key] ?? DEFAULT_ROOM
  return BOARD.flatMap((f) => f.rooms)
    .filter((r) => r.clinic === key)
    .map((r) => ({
      number: r.number,
      type,
      status: r.status,
      equipment,
      ...(r.status === "inUse" ? { since: "10:15" } : {}),
      ...(r.status === "cleaning" ? { readyIn: 5 } : {}),
    }))
}

const SERVICES_BY_CLINIC: Record<string, Service[]> = {
  dental: [
    svc("dental-clean", bi("Cleaning & check-up", "تنظيف وكشف"), "D1120", 45, 400, 320, 300, 330),
    svc("dental-rc", bi("Root canal · molar", "علاج عصب · ضرس"), "D3330", 90, 1800, 1440, 1400, 1500),
  ],
  eyes: [svc("eyes-move", bi("Eye movement exam", "فحص حركة العين"), "92060", 30, 450, 380, 360, 390)],
  cardio: [
    svc("cardio-ecg", bi("ECG", "تخطيط القلب"), "93000", 15, 200, 170, 160, 175),
    svc("cardio-echo", bi("Echocardiogram", "إيكو القلب"), "93306", 40, 950, 800, 780, 820),
  ],
}
function servicesOf(key: string): Service[] {
  return [
    svc(`${key}-new`, bi("New patient consultation", "كشف مريض جديد"), "99203", 20, 350, 300, 290, 310),
    svc(`${key}-fu`, bi("Follow-up visit", "زيارة متابعة"), "99213", 15, 250, 220, 210, 220),
    ...(SERVICES_BY_CLINIC[key] ?? []),
  ]
}

/* ---------------------------------------------------------------- the 9 clinics */
type Row = [
  key: string,
  icon: IconName,
  name: Bi,
  short: Bi,
  specialty: Bi,
  tone: TileTone,
  head: Bi,
  docs: number,
  rooms: number,
  seen: number,
  booked: number,
  waiting: number,
  wait: number,
  status: ClinicStatus,
  floor: number,
  wing: string,
  ext: string,
  // REP: visits, utilisation, no-show, revenue (K)
  rep: [number, number, number, number],
]

const ROWS: Row[] = [
  ["peds", "happyemoji", bi("Pediatrics", "الأطفال"), bi("Peds", "أطفال"), bi("Pediatrics", "طب الأطفال"), "info", bi("Dr. Ahmed Zaki", "د. أحمد زكي"), 3, 4, 42, 56, 4, 11, "open", 1, "A", "1120", [1048, 82, 5.8, 312]],
  ["dental", "health", bi("Dental", "الأسنان"), bi("Dental", "أسنان"), bi("Dentistry", "طب الأسنان"), "accent", bi("Dr. Sami Odeh", "د. سامي عودة"), 4, 5, 31, 38, 3, 9, "open", 2, "B", "1210", [702, 88, 4.1, 486]],
  ["eyes", "eye", bi("Ophthalmology", "العيون"), bi("Eyes", "عيون"), bi("Ophthalmology", "طب العيون"), "success", bi("Dr. Reem Al-Otaibi", "د. ريم العتيبي"), 2, 3, 18, 24, 2, 14, "open", 2, "A", "1230", [418, 74, 6.2, 168]],
  ["cardio", "heart", bi("Cardiology", "القلب"), bi("Cardio", "قلب"), bi("Cardiology", "طب القلب"), "destructive", bi("Dr. Khaled Mansour", "د. خالد منصور"), 2, 3, 22, 26, 6, 23, "busy", 3, "A", "1310", [506, 91, 3.9, 402]],
  ["internal", "health", bi("Internal medicine", "الباطنية"), bi("Internal", "باطنية"), bi("Internal medicine", "الطب الباطني"), "accent", bi("Dr. Majed Al-Shehri", "د. ماجد الشهري"), 4, 5, 48, 60, 5, 15, "open", 1, "B", "1140", [1210, 79, 7.4, 338]],
  ["derma", "brush-2", bi("Dermatology", "الجلدية"), bi("Derma", "جلدية"), bi("Dermatology", "الأمراض الجلدية"), "warning", bi("Dr. Nora Al-Qahtani", "د. نورة القحطاني"), 2, 2, 19, 22, 1, 8, "open", 3, "B", "1330", [455, 85, 5.1, 221]],
  ["ortho", "activity", bi("Orthopedics", "العظام"), bi("Ortho", "عظام"), bi("Orthopedics", "جراحة العظام"), "info", bi("Dr. Huda Fares", "د. هدى فارس"), 2, 3, 14, 20, 2, 12, "open", 1, "C", "1160", [330, 68, 6.8, 190]],
  ["obgyn", "lovely", bi("Obstetrics & gynecology", "النساء والولادة"), bi("OB/GYN", "نساء"), bi("Obstetrics & gynecology", "النساء والولادة"), "destructive", bi("Dr. Mona Al-Ghamdi", "د. منى الغامدي"), 3, 4, 25, 30, 3, 10, "open", 2, "C", "1250", [590, 81, 4.4, 260]],
  ["ent", "sound", bi("Ear, nose & throat", "الأنف والأذن والحنجرة"), bi("ENT", "أنف"), bi("Otolaryngology", "الأنف والأذن والحنجرة"), "muted", bi("Dr. Tariq Hamdan", "د. طارق حمدان"), 1, 2, 0, 0, 0, 0, "paused", 3, "C", "1350", [96, 22, 0, 31]],
]

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\. /, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

export const CLINICS: Clinic[] = ROWS.map(([key, icon, name, short, specialty, tone, head, docs, rooms, seen, booked, waiting, wait, status, floor, wing, ext, rep]) => {
  const peds = key === "peds"
  return {
    key,
    name,
    short,
    specialty,
    icon,
    tone,
    head,
    headInitials: initialsOf(head.en),
    floor,
    wing,
    ext,
    whatsapp: `+966 11 520 ${ext}`,
    branch: RIYADH,
    ages: peds ? [0, 14] : null,
    status,
    ...(status === "paused"
      ? {
          pausedUntil: "2026-11-20",
          pauseNote: bi("Dr. Tariq is on leave. 12 bookings moved to 20–24 Nov.", "د. طارق في إجازة، وانتقلت 12 حجوزات لـ 20–24 نوفمبر."),
        }
      : {}),
    closesAt: "22:00",
    doctorCount: docs,
    roomCount: roomsOf(key).length || rooms,
    today: { seen, booked, waiting, avgWait: wait },
    month: {
      visits: rep[0],
      utilisation: rep[1],
      noShow: rep[2],
      rating: peds ? "4.7" : "4.6",
      reviews: peds ? 312 : Math.round(rep[0] * 0.3),
      revenue: rep[3],
      insuredPct: 62,
      visitsDelta: 6,
      noShowDelta: -0.9,
    },
    doctors: peds ? PEDS_DOCTORS : doctorsOf(key, head, status),
    rooms: peds ? PEDS_ROOMS : roomsOf(key),
    hours: peds ? PEDS_HOURS : STD_HOURS,
    rules: { ...STD_RULES, ...RULES[key] },
    closures: STD_CLOSURES,
    services: peds ? PEDS_SERVICES : servicesOf(key),
    specialtyTools: { eyes: key === "eyes", dental: key === "dental" },
  }
})

export const clinicByKey = (key: string) => CLINICS.find((c) => c.key === key)

/* ---------------------------------------------------------------- today: next in line, patients by hour */
export type QueueState = "waiting" | "checkedIn" | "booked"
export type QueueItem = { time: string; patient: Bi; reason: Bi; state: QueueState; waited?: number }

const PEDS_QUEUE: QueueItem[] = [
  { time: "10:40", patient: bi("Lina Haddad", "لينا حداد"), reason: bi("Follow-up", "متابعة"), state: "waiting", waited: 18 },
  { time: "10:50", patient: bi("Omar Al-Harbi", "عمر الحربي"), reason: bi("Vaccination", "تطعيم"), state: "waiting", waited: 9 },
  { time: "11:00", patient: bi("Sara Ahmed", "سارة أحمد"), reason: bi("New patient", "مريض جديد"), state: "checkedIn" },
  { time: "11:15", patient: bi("Fahad Al-Dosari", "فهد الدوسري"), reason: bi("Asthma follow-up", "متابعة الربو"), state: "booked" },
]
const PATIENT_POOL: Bi[] = [
  bi("Noura Al-Saleh", "نورة الصالح"),
  bi("Yousef Al-Amri", "يوسف العمري"),
  bi("Maha Khalil", "مها خليل"),
  bi("Abdullah Al-Faraj", "عبدالله الفرج"),
  bi("Reem Saad", "ريم سعد"),
  bi("Hamad Al-Ali", "حمد العلي"),
  bi("Dana Al-Harbi", "دانة الحربي"),
]
const REASONS: Bi[] = [bi("Follow-up", "متابعة"), bi("New patient", "مريض جديد"), bi("Check-up", "كشف دوري")]

/** Next in line: the patients waiting now (longest first), then the next booking. */
export function queueOf(c: Clinic): QueueItem[] {
  if (c.key === "peds") return PEDS_QUEUE
  if (c.status === "paused") return []
  const n = Math.min(c.today.waiting, 3)
  const seed = c.key.length
  const at = (i: number) => {
    const m = 10 * 60 + 40 + i * 10
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`
  }
  const pick = (i: number) => ({ patient: PATIENT_POOL[(seed + i) % PATIENT_POOL.length], reason: REASONS[(seed + i) % REASONS.length] })
  return [
    ...Array.from({ length: n }, (_, i): QueueItem => ({ time: at(i), ...pick(i), state: "waiting", waited: Math.max(2, c.today.avgWait + 6 - i * 7) })),
    { time: at(n), ...pick(n), state: "booked" },
  ]
}

/** Clinic hours on the flow chart: 8 AM → 9 PM. */
export const FLOW_HOURS = Array.from({ length: 14 }, (_, i) => 8 + i)
const PEDS_FLOW = [3, 6, 7, 6, 5, 2, 0, 0, 4, 5, 3, 1, 0, 0]
/** Patients by hour today (seen so far + booked). Other clinics follow the Pediatrics profile scaled to their bookings. */
export function flowOf(c: Clinic): number[] {
  if (c.key === "peds") return PEDS_FLOW
  const total = PEDS_FLOW.reduce((s, v) => s + v, 0)
  return PEDS_FLOW.map((v) => Math.round((v * c.today.booked) / total))
}
/** The current hour (10 AM) is highlighted on the chart. */
export const NOW_HOUR = 10

/** Doctors on duty today across all clinics (design KPI: 18 of 23). */
export const DOCTORS_ON_DUTY = 18
/** Patients seen on the same weekday last week (design KPI: +8% vs last Wed). */
export const PATIENTS_LAST_WEEK = 203

/** Module KPIs, computed from the clinics where the design figures allow it. */
export function clinicKpis(list: Clinic[] = CLINICS) {
  const running = list.filter((c) => c.status !== "paused")
  const seen = list.reduce((s, c) => s + c.today.seen, 0)
  const longest = [...running].sort((a, b) => b.today.avgWait - a.today.avgWait)[0]
  return {
    clinics: list.length,
    open: running.length,
    doctors: list.reduce((s, c) => s + c.doctorCount, 0),
    onDuty: DOCTORS_ON_DUTY,
    seen,
    seenDelta: Math.round(((seen - PATIENTS_LAST_WEEK) / PATIENTS_LAST_WEEK) * 100),
    avgWait: Math.floor(running.reduce((s, c) => s + c.today.avgWait, 0) / Math.max(1, running.length)),
    longest,
  }
}

/** Average wait over 20 min shows in warning text (brief §5). */
export const LONG_WAIT = 20
