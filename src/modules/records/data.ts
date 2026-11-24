import { bi as pick, type Bi } from "@/lib/mock/bi"

/*
 * Medical records (design v6.0): the clinical record (encounters, visit notes + addenda, diagnoses, orders,
 * prescriptions + lines, documents), the records office (requests for copies, chart completion, duplicate files)
 * and the privacy side (access events, restricted files). Sample rows are the design's; aggregates (OTHER_*) stand
 * for the rest of the month so tabs, filters, tiles and KPIs agree with each other and move when a row changes.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })
export { pick }

/* ------------------------------------------------------------------ clock + rules of the record */

/** The demo clock: Monday 23 Nov 2026, late morning (Fahad's 09:40 draft is "2 h" old). */
export const REC_TODAY = "2026-11-23"
export const REC_NOW = `${REC_TODAY}T11:40`

/** A visit note left unsigned this long is overdue (brief §4). */
export const OVERDUE_HOURS = 24
/** Over this, an incomplete chart shows red in Chart completion. */
export const CHART_RED_HOURS = 48
/** Requests for records are due this many days after receipt (configurable per center). */
export const REQUEST_DUE_DAYS = 30
/** "Due this week" and the amber due date. */
export const REQUEST_SOON_DAYS = 7
/** Break the glass gives access for this long. */
export const BREAK_GLASS_HOURS = 4
/** A merge can be undone for this long. */
export const MERGE_UNDO_DAYS = 30
/** The access log is kept this long (read-only). */
export const LOG_KEEP_YEARS = 10
/** A prescription is valid this long. */
export const RX_VALID_DAYS = 30
/** Shared report links expire after this long. */
export const SHARE_LINK_DAYS = 7

/** Hours from a to b (ISO date-times), whole hours rounded down. */
export function hoursBetween(a: string, b: string = REC_NOW) {
  return Math.floor((Date.parse(b + "Z") - Date.parse(a + "Z")) / 3_600_000)
}
/** Whole calendar days from a to b (ISO dates or date-times). */
export function daysBetween(a: string, b: string = REC_TODAY) {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((d(b) - d(a)) / 86_400_000)
}
export function addDays(iso: string, n: number) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n))
  return d.toISOString().slice(0, 10)
}
export function addHours(iso: string, n: number) {
  return new Date(Date.parse(iso + "Z") + n * 3_600_000).toISOString().slice(0, 16)
}

/* ------------------------------------------------------------------ center */

export const CENTER = {
  name: bi("Al Noor Medical Center", "مجمع النور الطبي"),
  short: bi("Al Noor", "النور"),
  clinic: bi("Cardiology clinic", "عيادة القلب"),
  cr: "1010567890",
  city: bi("Riyadh", "الرياض"),
  verifyHost: "alnoor.sa/verify",
}

/* ------------------------------------------------------------------ people */

/**
 * Who does what (brief §4 · Permissions): doctors write and sign their own notes and documents; nurses enter vitals;
 * the records office handles requests, completion reminders and merges; the privacy officer reviews access.
 */
export type RecRole = "doctor" | "nurse" | "records" | "privacy" | "reception" | "pharmacy"

export type RecUser = {
  id: string
  initials: string
  name: Bi
  /** What the Access log prints under the name ("Cardiology", "ER · on call", "Reception"). */
  role: Bi
  kind: RecRole
  email?: string
  female?: boolean
  /** Doctors: their clinic and title, and the SCFHS licence (no hyphens). */
  clinic?: Bi
  title?: Bi
  scfhs?: string
}

const u = (id: string, initials: string, en: string, ar: string, kind: RecRole, role: Bi, extra: Partial<RecUser> = {}): RecUser => ({
  id,
  initials,
  name: bi(en, ar),
  kind,
  role,
  ...extra,
})

export const USERS = {
  khaled: u("u-khaled", "KM", "Dr. Khaled Mansour", "د. خالد منصور", "doctor", bi("Cardiology", "القلب"), {
    email: "khaled.m@clinic.sa",
    clinic: bi("Cardiology", "القلب"),
    title: bi("Consultant cardiologist", "استشاري قلب"),
    scfhs: "09R0021455",
  }),
  sami: u("u-sami", "SO", "Dr. Sami Al-Otaibi", "د. سامي العتيبي", "doctor", bi("Cardiology", "القلب"), { clinic: bi("Cardiology", "القلب") }),
  zaki: u("u-zaki", "AZ", "Dr. Ahmed Zaki", "د. أحمد زكي", "doctor", bi("Pediatrics", "الأطفال"), { clinic: bi("Pediatrics", "الأطفال") }),
  hala: u("u-hala", "HN", "Dr. Hala Nasser", "د. هالة ناصر", "doctor", bi("Dermatology", "الجلدية"), { female: true, clinic: bi("Dermatology", "الجلدية") }),
  rayan: u("u-rayan", "RH", "Dr. Rayan Al-Harbi", "د. ريان الحربي", "doctor", bi("ER · on call", "الطوارئ · مناوب"), { clinic: bi("Emergency", "الطوارئ") }),
  amal: u("u-amal", "AM", "Amal Al-Ghamdi", "أمل الغامدي", "nurse", bi("Nurse", "تمريض"), { female: true }),
  nora: u("u-nora", "NF", "Nora Al-Fahad", "نورة الفهد", "reception", bi("Reception", "الاستقبال"), { female: true }),
  majed: u("u-majed", "MS", "Majed Al-Sahli", "ماجد السهلي", "pharmacy", bi("Pharmacy", "الصيدلية")),
  privacy: u("u-privacy", "PO", "Privacy officer", "مسؤول الخصوصية", "privacy", bi("Privacy officer", "مسؤول الخصوصية")),
} satisfies Record<string, RecUser>
export type UserKey = keyof typeof USERS
export const userOf = (k: UserKey): RecUser => USERS[k]

/* ------------------------------------------------------------------ patients */

/** Restricted files: opening one when you're not in the care team needs "break the glass". */
export type Restriction = "vip" | "staff" | "sensitive"

export type RecPatient = {
  initials: string
  name: Bi
  mrn: string
  /** Patients module id, when the design's patient exists there (the banner's name opens the patient page). */
  patientId?: string
  age: number
  sex: "m" | "f"
  /** "Bupa Arabia · class B" on the banner. */
  insurer?: Bi
  /** National ID: only the last 3 digits are ever shown ("الهوية تنتهي بـ 482"). */
  nationalIdLast3?: string
  mobile?: string
  birthDate?: string
  restricted?: Restriction
  /** Doctors treating the patient (no break the glass for them). */
  careTeam: UserKey[]
  allergies: Bi[]
  /** Under 18: a guardian consents to releases. */
  guardian?: Bi
}

const p = (initials: string, en: string, ar: string, mrn: string, age: number, sex: "m" | "f", extra: Partial<RecPatient> = {}): RecPatient => ({
  initials,
  name: bi(en, ar),
  mrn,
  age,
  sex,
  careTeam: [],
  allergies: [],
  ...extra,
})

export const PATIENTS = {
  dosari: p("FD", "Fahad Al-Dosari", "فهد الدوسري", "MRN-17654", 54, "m", {
    patientId: "004891",
    insurer: bi("Bupa Arabia · class B", "بوبا العربية · فئة B"),
    nationalIdLast3: "482",
    mobile: "+966 55 404 7712",
    careTeam: ["khaled"],
    allergies: [bi("Penicillin", "البنسلين")],
  }),
  otaibi: p("NA", "Nasser Al-Otaibi", "ناصر العتيبي", "MRN-24110", 47, "m", { insurer: bi("Tawuniya · class A", "التعاونية · فئة A"), mobile: "+966 50 611 2093", careTeam: ["khaled"] }),
  khaldi: p("AK", "Abdulaziz Al-Khaldi", "عبدالعزيز الخالدي", "MRN-00412", 61, "m", {
    insurer: bi("Cash", "كاش"),
    nationalIdLast3: "907",
    mobile: "+966 55 300 0412",
    restricted: "staff",
    careTeam: ["khaled"],
  }),
  shehri: p("HS", "Huda Al-Shehri", "هدى الشهري", "MRN-22987", 38, "f", { nationalIdLast3: "317", mobile: "+966 55 781 6620", careTeam: ["khaled"] }),
  qahtani: p("MQ", "Mona Al-Qahtani", "منى القحطاني", "MRN-14402", 58, "f", { mobile: "+966 56 902 3318", careTeam: ["khaled"] }),
  ahmed: p("SA", "Sara Ahmed", "سارة أحمد", "MRN-23118", 34, "f", {
    patientId: "004812",
    insurer: bi("MedGulf · class B", "ميدغلف · فئة B"),
    nationalIdLast3: "903",
    mobile: "+966 53 640 1187",
    birthDate: "1992-03-14",
    careTeam: ["khaled"],
  }),
  /** The duplicate file the merge suggests (same name, birth date and mobile as MRN-23118). */
  ahmed2: p("SA", "Sara Ahmed", "سارة أحمد", "MRN-24007", 34, "f", { mobile: "+966 53 640 1187", birthDate: "1992-03-14" }),
  harbi: p("OH", "Omar Al-Harbi", "عمر الحربي", "MRN-22310", 52, "m", { patientId: "004833", mobile: "+966 54 120 9931", careTeam: ["sami"] }),
  haddad: p("LH", "Lina Haddad", "لينا حداد", "MRN-19022", 29, "f", {
    patientId: "004857",
    insurer: bi("Tawuniya · class A", "التعاونية · فئة A"),
    mobile: "+966 50 771 2045",
    careTeam: ["hala"],
  }),
  shammari: p("AS", "Abdullah Al-Shammari", "عبدالله الشمري", "MRN-15530", 9, "m", { mobile: "+966 55 218 4410", guardian: bi("Father", "الأب"), careTeam: ["zaki"] }),
  subaie: p("KS", "Khalid Al-Subaie", "خالد السبيعي", "MRN-18840", 44, "m", { mobile: "+966 50 552 1490", careTeam: ["sami"] }),
  mutairi: p("RM", "Reem Al-Mutairi", "ريم المطيري", "MRN-23001", 31, "f", { mobile: "+966 50 318 6604", careTeam: ["hala"] }),
  amri: p("YA", "Yousef Al-Amri", "يوسف العمري", "MRN-20418", 12, "m", { mobile: "+966 59 233 0871", guardian: bi("Father", "الأب"), careTeam: ["zaki"] }),
  saud: p("TS", "Turki Al-Saud", "تركي آل سعود", "MRN-00027", 66, "m", { restricted: "vip", careTeam: ["sami"] }),
} satisfies Record<string, RecPatient>
/** A patient's key: the design's patients above, or an older file from archive.ts (lookup.ts finds either). */
export type PatientKey = string
export type DesignPatientKey = keyof typeof PATIENTS

/* ------------------------------------------------------------------ encounters */

export type Encounter = {
  id: string
  patient: PatientKey
  doctor: UserKey
  /** Clinic (Cardiology) and the kind of visit (Follow-up, New patient, Echo review). */
  clinic: Bi
  kind: Bi
  /** Short reason for the Notes-to-sign line ("hypertension", "chest pain"). */
  reason: Bi
  at: string
}

const CARDIO = bi("Cardiology", "القلب")
const enc = (id: string, patient: PatientKey, doctor: UserKey, kind: Bi, reason: Bi, at: string, clinic: Bi = CARDIO): Encounter => ({ id, patient, doctor, clinic, kind, reason, at })
const FOLLOW = bi("Follow-up", "متابعة")

export const ENCOUNTERS: Encounter[] = [
  enc("V-2611-08412", "dosari", "khaled", FOLLOW, bi("hypertension", "ضغط الدم"), "2026-11-23T09:40"),
  enc("V-2611-08419", "otaibi", "khaled", bi("New patient", "مريض جديد"), bi("chest pain", "ألم بالصدر"), "2026-11-23T10:20"),
  enc("V-2611-08405", "khaldi", "khaled", FOLLOW, bi("atrial fibrillation", "رجفان أذيني"), "2026-11-23T08:55"),
  enc("V-2611-08397", "shehri", "khaled", FOLLOW, bi("coronary disease", "مرض الشريان التاجي"), "2026-11-23T08:30"),
  enc("V-2611-08311", "qahtani", "khaled", bi("Echo review", "مراجعة إيكو"), bi("echo review", "مراجعة إيكو"), "2026-11-22T16:10"),
  enc("V-2611-08256", "ahmed", "khaled", FOLLOW, bi("palpitations", "خفقان"), "2026-11-22T11:30"),
  enc("V-2611-07802", "harbi", "sami", bi("Cardiac cath", "قسطرة قلبية"), bi("cardiac cath", "قسطرة قلبية"), "2026-11-20T09:00"),
  enc("V-2611-07533", "amri", "zaki", FOLLOW, bi("follow-up", "متابعة"), "2026-11-19T10:30", bi("Pediatrics", "الأطفال")),
  enc("V-2611-08364", "saud", "rayan", bi("ER visit", "زيارة طوارئ"), bi("chest pain", "ألم بالصدر"), "2026-11-23T02:05", bi("Emergency", "الطوارئ")),
  enc("V-2611-07041", "mutairi", "hala", bi("Dermatology", "الجلدية"), bi("skin biopsy", "خزعة جلد"), "2026-11-17T12:00", bi("Dermatology", "الجلدية")),
]

/* ------------------------------------------------------------------ ICD-10 */

export type Icd = {
  code: string
  name: Bi
  /** Short name for lists ("I10 · Hypertension"); the note shows the full name. */
  short?: Bi
  /** Unspecified codes get rejected by insurers: the search warns on them. */
  unspecified?: boolean
  /** Needs a test to confirm (shown as a hint in Add diagnosis). */
  confirm?: Bi
  /** Other words people search it by ("palpitations" finds SVT and arrhythmia too). */
  terms?: string[]
}

export const ICD10: Icd[] = [
  { code: "I10", name: bi("Essential hypertension", "ارتفاع ضغط الدم الأساسي"), short: bi("Hypertension", "ارتفاع ضغط الدم") },
  { code: "I11.9", name: bi("Hypertensive heart disease without heart failure", "مرض القلب الناتج عن الضغط بدون فشل قلبي") },
  { code: "I48", name: bi("Atrial fibrillation", "رجفان أذيني") },
  { code: "I48.91", name: bi("Atrial fibrillation, unspecified", "رجفان أذيني غير محدد"), unspecified: true },
  { code: "I25.1", name: bi("Coronary disease", "مرض الشريان التاجي") },
  { code: "I34.0", name: bi("Mitral valve", "الصمام الميترالي") },
  { code: "I47.1", name: bi("Supraventricular tachycardia", "تسرّع القلب فوق البطيني"), confirm: bi("Needs an ECG or Holter to confirm", "يبي تخطيط أو هولتر يأكده"), terms: ["palpitations", "svt", "خفقان"] },
  { code: "I49.9", name: bi("Cardiac arrhythmia, unspecified", "اضطراب نظم القلب، غير محدد"), unspecified: true, terms: ["palpitations", "خفقان"] },
  { code: "R00.2", name: bi("Palpitations", "خفقان") },
  { code: "R07.4", name: bi("Chest pain", "ألم بالصدر"), unspecified: true },
  { code: "E78.5", name: bi("Hyperlipidaemia", "ارتفاع الدهون") },
  { code: "E11.9", name: bi("Type 2 diabetes without complications", "سكري النوع الثاني بدون مضاعفات"), confirm: bi("Needs HbA1c to confirm", "يبي تحليل HbA1c للتأكيد") },
  { code: "M54.5", name: bi("Lower back pain", "ألم أسفل الظهر") },
  { code: "L98.9", name: bi("Skin disorder, unspecified", "مرض جلدي غير محدد"), unspecified: true },
]
export const icdOf = (code: string) => ICD10.find((x) => x.code === code)

/* ------------------------------------------------------------------ visit notes */

export type DiagnosisType = "main" | "secondary" | "suspected"
export type Diagnosis = { code: string; type: DiagnosisType }

export type OrderKind = "ecg" | "lab" | "imaging" | "holter" | "procedure"
export type OrderStatus = "done" | "inLab" | "booked"
/** `short` is how the Sign dialog lists it ("ECG, lipid panel, HbA1c, Holter"). */
export type Order = { id: string; kind: OrderKind; name: Bi; short: Bi; status: OrderStatus; detail: Bi }

/** Vitals come from nursing (nurses enter them; the doctor reads them in the note). */
export type Vitals = {
  takenBy: UserKey
  at: string
  bp: [number, number]
  pulse: number
  temp: number
  spo2: number
  weight: number
  bmi: number
}

export type NoteMedicine = { drug: string; sig: Bi; isNew?: boolean }

export type AddendumReason = "correction" | "lateResult" | "moreInfo" | "patientCall"
export type Addendum = { by: UserKey; at: string; why: AddendumReason; text: Bi }

export type FollowUp = "none" | "w1" | "w2" | "w4" | "w4r" | "m3" | "asNeeded"
export type Outcome = "home" | "admitted" | "referred" | "er"

export type VisitNote = {
  id: string
  encounter: string
  author: UserKey
  createdAt: string
  /** Signing needs the doctor's PIN, locks the note and timestamps it. After that only addenda. */
  signedAt?: string
  subjective: Bi
  objective: Bi
  vitals?: Vitals
  diagnoses: Diagnosis[]
  orders: Order[]
  medicines: NoteMedicine[]
  followUp?: FollowUp
  outcome?: Outcome
  advice: Bi
  addenda: Addendum[]
}

const EMPTY_TEXT = bi("", "")
const note = (id: string, encounter: string, createdAt: string, main: string, extra: Partial<VisitNote> = {}): VisitNote => ({
  id,
  encounter,
  author: "khaled",
  createdAt,
  subjective: EMPTY_TEXT,
  objective: EMPTY_TEXT,
  diagnoses: [{ code: main, type: "main" }],
  orders: [],
  medicines: [],
  advice: EMPTY_TEXT,
  addenda: [],
  ...extra,
})

export const NOTES: VisitNote[] = [
  note("VN-2611-2041", "V-2611-08412", "2026-11-23T09:40", "I10", {
    subjective: bi(
      "Follow-up for high blood pressure. Home readings 140–150 over 90. Palpitations twice this month, a few minutes each, no chest pain or fainting. Takes ibuprofen for back pain.",
      "متابعة لارتفاع الضغط. قراءات البيت 140–150 على 90. جاه خفقان مرتين هالشهر، كل مرة دقايق، بدون ألم صدر أو إغماء. ياخذ آيبوبروفين لألم الظهر."
    ),
    objective: bi("Regular pulse. Heart sounds normal, no murmur. Chest clear. No leg swelling.", "النبض منتظم. أصوات القلب طبيعية بدون لغط. الصدر سليم. ما فيه تورم بالرجلين."),
    vitals: { takenBy: "amal", at: "2026-11-23T09:31", bp: [148, 92], pulse: 88, temp: 36.8, spo2: 98, weight: 92, bmi: 30.1 },
    diagnoses: [
      { code: "I10", type: "main" },
      { code: "R00.2", type: "secondary" },
      { code: "E78.5", type: "secondary" },
    ],
    orders: [
      { id: "o1", kind: "ecg", name: bi("ECG · 12-lead", "تخطيط قلب · 12 قطب"), short: bi("ECG", "تخطيط"), status: "done", detail: bi("Done 09:52 · sinus rhythm", "انسوّى 09:52 · نظم جيبي") },
      { id: "o2", kind: "lab", name: bi("Lipid panel", "الدهون"), short: bi("lipid panel", "دهون"), status: "inLab", detail: bi("Sample taken 09:58", "انسحبت العينة 09:58") },
      { id: "o3", kind: "lab", name: bi("HbA1c", "HbA1c"), short: bi("HbA1c", "HbA1c"), status: "inLab", detail: bi("Sample taken 09:58", "انسحبت العينة 09:58") },
      { id: "o4", kind: "holter", name: bi("Holter · 24 h", "هولتر · 24 ساعة"), short: bi("Holter", "هولتر"), status: "booked", detail: bi("Booked 25 Nov", "محجوز 25 نوفمبر") },
    ],
    medicines: [
      { drug: "amlodipine5", sig: bi("1 tablet daily · 30 days", "حبة يومياً · 30 يوم"), isNew: true },
      { drug: "atorvastatin20", sig: bi("1 tablet at night · 30 days", "حبة بالليل · 30 يوم") },
      { drug: "aspirin81", sig: bi("1 tablet daily · 30 days", "حبة يومياً · 30 يوم") },
    ],
    followUp: "w4r",
    outcome: "home",
    advice: bi(
      "Cut salt, walk 30 minutes a day. Take aspirin 30 minutes before any ibuprofen. Check blood pressure at home and bring the readings.",
      "قلّل الملح وامشِ 30 دقيقة يومياً. خذ الأسبرين قبل الآيبوبروفين بـ 30 دقيقة. قِس ضغطك في البيت وجيب القراءات معك."
    ),
  }),
  note("VN-2611-2047", "V-2611-08419", "2026-11-23T10:20", "R07.4"),
  note("VN-2611-2036", "V-2611-08405", "2026-11-23T08:55", "I48", { signedAt: "2026-11-23T09:10" }),
  note("VN-2611-2033", "V-2611-08397", "2026-11-23T08:30", "I25.1", {
    signedAt: "2026-11-23T08:48",
    addenda: [{ by: "khaled", at: "2026-11-23T10:05", why: "lateResult", text: bi("Troponin came back normal.", "التروبونين طلع طبيعي.") }],
  }),
  note("VN-2611-1988", "V-2611-08311", "2026-11-22T16:10", "I34.0"),
  note("VN-2611-1962", "V-2611-08256", "2026-11-22T11:30", "R00.2"),
  // Other clinics' notes ("All clinics"): signed, though their charts still miss a procedure note, a code or a review.
  note("VN-2611-1890", "V-2611-07802", "2026-11-20T09:00", "I25.1", { author: "sami", signedAt: "2026-11-20T13:20" }),
  { ...note("VN-2611-1851", "V-2611-07533", "2026-11-19T10:30", "", { author: "zaki", signedAt: "2026-11-19T12:05" }), diagnoses: [] },
  note("VN-2611-1777", "V-2611-07041", "2026-11-17T12:00", "L98.9", { author: "hala", signedAt: "2026-11-17T14:40" }),
  note("VN-2611-2001", "V-2611-08364", "2026-11-23T02:05", "R07.4", { author: "rayan", signedAt: "2026-11-23T03:10" }),
]

/** Problem list, current medicines (incl. outside pharmacies) and past visits: the patient's record around the note. */
export type Problem = { name: Bi; since: Bi }
export type CurrentMed = { drug: string; how: Bi; risky?: boolean; outside?: boolean }
export type PastVisit = { date: string; text: Bi }

export const PROBLEMS: Record<PatientKey, Problem[]> = {
  dosari: [
    { name: bi("Hypertension", "ارتفاع الضغط"), since: bi("Since 2019", "من 2019") },
    { name: bi("Hyperlipidaemia", "ارتفاع الدهون"), since: bi("Since 2021", "من 2021") },
    { name: bi("Lower back pain", "ألم أسفل الظهر"), since: bi("On and off", "يروح ويجي") },
  ],
}
export const CURRENT_MEDS: Record<PatientKey, CurrentMed[]> = {
  dosari: [
    { drug: "atorvastatin20", how: bi("At night", "بالليل") },
    { drug: "aspirin81", how: bi("Daily", "يومياً") },
    { drug: "ibuprofen400", how: bi("When needed · from a pharmacy", "عند الحاجة · من صيدلية"), risky: true, outside: true },
  ],
}
export const PAST_VISITS: Record<PatientKey, PastVisit[]> = {
  dosari: [
    { date: "2026-08-24", text: bi("BP 152/94 · amlodipine discussed", "الضغط 152/94 · ناقشنا الأملوديبين") },
    { date: "2026-03-12", text: bi("Lipids high · atorvastatin up to 20", "الدهون عالية · رفعنا الأتورفاستاتين لـ 20") },
    { date: "2026-01-03", text: bi("Yearly check · ECG normal", "فحص سنوي · التخطيط طبيعي") },
  ],
}

/* ------------------------------------------------------------------ medicines + prescriptions */

export type Drug = {
  id: string
  /** Generic first ("Amlodipine"), Arabic name + Latin strength in Arabic ("أملوديبين 5 ملغ"). */
  generic: Bi
  strength: string
  brand: Bi
  form: Bi
  route: Bi
  /** What the checks look at: allergy groups it belongs to and interaction classes. */
  groups: string[]
}

const drug = (id: string, en: string, ar: string, strength: string, brand: Bi, groups: string[], form = bi("tablet", "حبوب"), route = bi("by mouth", "بالفم")): Drug => ({
  id,
  generic: bi(en, ar),
  strength,
  brand,
  form,
  route,
  groups,
})

export const DRUGS: Drug[] = [
  drug("amlodipine5", "Amlodipine", "أملوديبين", "5 mg", bi("Norvasc", "نورفاسك"), ["ccb"]),
  drug("atorvastatin20", "Atorvastatin", "أتورفاستاتين", "20 mg", bi("Lipitor", "ليبيتور"), ["statin"]),
  drug("aspirin81", "Aspirin", "أسبرين", "81 mg", bi("Aspocid", "أسبوسيد"), ["antiplatelet", "nsaid-sensitive"]),
  drug("ibuprofen400", "Ibuprofen", "آيبوبروفين", "400 mg", bi("Brufen", "بروفين"), ["nsaid"]),
  drug("bisoprolol5", "Bisoprolol", "بيسوبرولول", "5 mg", bi("Concor", "كونكور"), ["betablocker"]),
  drug("amoxicillin500", "Amoxicillin", "أموكسيسيلين", "500 mg", bi("Amoxil", "أموكسيل"), ["penicillin"], bi("capsule", "كبسولات")),
  drug("paracetamol500", "Paracetamol", "باراسيتامول", "500 mg", bi("Panadol", "بنادول"), []),
  drug("omeprazole20", "Omeprazole", "أوميبرازول", "20 mg", bi("Losec", "لوسك"), ["ppi"], bi("capsule", "كبسولات")),
]
export const drugOf = (id: string) => DRUGS.find((d) => d.id === id)
/** "Amlodipine 5 mg" / "أملوديبين 5 ملغ" (the strength stays Latin; "mg" reads ملغ in Arabic). */
export const drugLabel = (d: Drug, locale: string) => `${pick(d.generic, locale)} ${locale === "ar" ? d.strength.replace("mg", "ملغ") : d.strength}`

export type Dose = "half" | "one" | "two"
export type Frequency = "morning" | "night" | "afterFood" | "twice" | "thrice" | "asNeeded"
export type RxLine = { drug: string; dose: Dose; freq: Frequency; days: number; qty: number; isNew?: boolean }

export type RxStatus = "draft" | "sent" | "dispensed" | "expired"
export type Prescription = {
  no: string
  encounter: string
  patient: PatientKey
  doctor: UserKey
  createdAt: string
  status: RxStatus
  lines: RxLine[]
  pharmacistNote: Bi
  /** Months of refills after the first fill. */
  refills: number
  validDays: number
  /** Interaction warnings the doctor acknowledged (added to the advice). */
  acknowledged: string[]
  sentAt?: string
  /** The SMS code any pharmacy scans. */
  code?: string
  /** Dispensing status from the pharmacy link (stub). */
  dispensedAt?: string
}

export const PRESCRIPTIONS: Prescription[] = [
  {
    no: "RX-2611-0388",
    encounter: "V-2611-08412",
    patient: "dosari",
    doctor: "khaled",
    createdAt: "2026-11-23T10:02",
    status: "draft",
    lines: [
      { drug: "amlodipine5", dose: "one", freq: "morning", days: 30, qty: 30, isNew: true },
      { drug: "atorvastatin20", dose: "one", freq: "night", days: 30, qty: 30 },
      { drug: "aspirin81", dose: "one", freq: "afterFood", days: 30, qty: 30 },
    ],
    pharmacistNote: bi("Patient also takes ibuprofen as needed. Please remind him about timing with aspirin.", "المريض ياخذ آيبوبروفين عند الحاجة. ذكّره بتوقيته مع الأسبرين لو سمحت."),
    refills: 2,
    validDays: RX_VALID_DAYS,
    acknowledged: ["aspirin+ibuprofen"],
  },
  {
    no: "RX-2611-0361",
    encounter: "V-2611-08256",
    patient: "ahmed",
    doctor: "khaled",
    createdAt: "2026-11-22T11:52",
    status: "dispensed",
    lines: [{ drug: "bisoprolol5", dose: "one", freq: "morning", days: 30, qty: 30 }],
    pharmacistNote: bi("", ""),
    refills: 0,
    validDays: RX_VALID_DAYS,
    acknowledged: [],
    sentAt: "2026-11-22T11:55",
    code: "7Q4-RX8",
    dispensedAt: "2026-11-22T13:20",
  },
]

/* ------------------------------------------------------------------ documents */

export type DocKind = "prescription" | "sickLeave" | "report" | "referral" | "discharge"
export type DocStatus = "draft" | "issued" | "sent" | "waiting" | "expired"

export type ShareTo = "patient" | "employer" | "insurer" | "hospital"
/** Who a document went to: by SMS link (the patient) or a secure link with an expiry (anyone else). */
export type Share = { to: ShareTo; name: Bi; via: "sms" | "link"; expires?: string; openedAt?: string }
export type DocSection = "diagnosis" | "findings" | "fitness" | "followUp" | "medicines" | "leave" | "reason" | "summary"
export type Sector = "private" | "government" | "none"
export type Soon = "routine" | "week" | "urgent"

export type RecDocument = {
  no: string
  kind: DocKind
  patient: PatientKey
  at: string
  status: DocStatus
  details: Bi
  encounter?: string
  doctor: UserKey
  /** The paper: who it's for and its sections, in order (only what the patient agreed to share). */
  for?: Bi
  sections?: { key: DocSection; text: Bi }[]
  signedAt?: string
  /** Verify page code ("Check it at alnoor.sa/verify · code 7Q4-KM2"). */
  verifyCode?: string
  consent?: { at: string; via: "nafath" | "form" }
  shares?: Share[]
  verified?: { count: number; last: string; by: Bi }
  history?: { at: string; text: Bi }[]
  /** Sick leave (Seha). */
  seha?: { ref: string; from: string; days: number; sector: Sector; showDiagnosis: boolean }
  /** Referral. */
  referral?: { inside: boolean; to: Bi; doctor?: Bi; soon: Soon; attach: boolean }
}

export const DOCUMENTS: RecDocument[] = [
  {
    no: "RX-2611-0388",
    kind: "prescription",
    patient: "dosari",
    at: "2026-11-23T10:02",
    status: "draft",
    details: bi("3 medicines · SMS to the patient", "3 أدوية · برسالة للمريض"),
    encounter: "V-2611-08412",
    doctor: "khaled",
  },
  {
    no: "MR-2611-0057",
    kind: "report",
    patient: "khaldi",
    at: "2026-11-23T09:15",
    status: "sent",
    details: bi("For his employer · 2 pages", "لجهة عمله · صفحتين"),
    encounter: "V-2611-08405",
    doctor: "khaled",
    for: bi("His employer · SABIC HR", "جهة عمله · موارد سابك البشرية"),
    sections: [
      { key: "diagnosis", text: bi("I48 · Atrial fibrillation, controlled on treatment.", "I48 · رجفان أذيني، مستقر على العلاج.") },
      {
        key: "findings",
        text: bi(
          "Heart rate 72, regular on treatment. Echo 10 Nov: normal pump function (EF 58%). No signs of heart failure.",
          "النبض 72 ومنتظم على العلاج. الإيكو 10 نوفمبر: وظيفة الضخ طبيعية (EF 58%). ما فيه علامات هبوط بالقلب."
        ),
      },
      {
        key: "fitness",
        text: bi("Fit for office work. Avoid heavy lifting over 20 kg and night shifts for 3 months.", "لائق للعمل المكتبي. يتجنب رفع أكثر من 20 كيلو والمناوبات الليلية لمدة 3 شهور."),
      },
      { key: "followUp", text: bi("Cardiology clinic every 3 months.", "عيادة القلب كل 3 شهور.") },
    ],
    signedAt: "2026-11-23T09:15",
    verifyCode: "7Q4-KM2",
    consent: { at: "2026-11-23T08:58", via: "nafath" },
    shares: [
      { to: "patient", name: bi("Patient", "المريض"), via: "sms", openedAt: "2026-11-23T09:20" },
      { to: "employer", name: bi("SABIC HR", "موارد سابك"), via: "link", expires: "2026-11-30" },
    ],
    verified: { count: 1, last: "2026-11-23T11:02", by: bi("SABIC HR", "موارد سابك") },
    history: [
      { at: "2026-11-23T09:05", text: bi("Drafted from today's visit note", "انكتب من ملاحظة زيارة اليوم") },
      { at: "2026-11-23T09:15", text: bi("Signed by Dr. Khaled Mansour", "وقّعه د. خالد منصور") },
      { at: "2026-11-23T09:16", text: bi("Sent to the patient and SABIC HR", "انرسل للمريض وموارد سابك") },
      { at: "2026-11-23T11:02", text: bi("Verified by SABIC HR", "تحققت منه موارد سابك") },
    ],
  },
  {
    no: "SL-2611-0091",
    kind: "sickLeave",
    patient: "shehri",
    at: "2026-11-23T08:50",
    status: "issued",
    details: bi("2 days · Seha ref. 4471902", "يومين · مرجع صحة 4471902"),
    encounter: "V-2611-08397",
    doctor: "khaled",
    for: bi("Her employer", "جهة عملها"),
    seha: { ref: "4471902", from: "2026-11-23", days: 2, sector: "private", showDiagnosis: false },
    signedAt: "2026-11-23T08:50",
    verifyCode: "SH4-091",
    shares: [{ to: "patient", name: bi("Patient", "المريضة"), via: "sms", openedAt: "2026-11-23T08:55" }],
    history: [
      { at: "2026-11-23T08:50", text: bi("Issued and registered in Seha", "صدرت وانسجلت في منصة صحة") },
      { at: "2026-11-23T08:51", text: bi("SMS sent to the patient", "انرسلت رسالة للمريضة") },
    ],
  },
  {
    no: "RF-2611-0024",
    kind: "referral",
    patient: "qahtani",
    at: "2026-11-22T17:05",
    status: "waiting",
    details: bi("Cardiac surgery · King Faisal Specialist", "جراحة القلب · التخصصي"),
    encounter: "V-2611-08311",
    doctor: "khaled",
    for: bi("King Faisal Specialist · cardiac surgery", "التخصصي · جراحة القلب"),
    referral: { inside: false, to: bi("King Faisal Specialist · cardiac surgery", "التخصصي · جراحة القلب"), soon: "week", attach: true },
    sections: [
      { key: "diagnosis", text: bi("I34.0 · Mitral valve regurgitation, moderate to severe.", "I34.0 · ارتجاع الصمام الميترالي، متوسط لشديد.") },
      { key: "reason", text: bi("Echo shows worsening mitral regurgitation. Please assess for valve repair.", "الإيكو يبيّن إن ارتجاع الصمام زاد. نبي تقييم لإصلاح الصمام.") },
    ],
    signedAt: "2026-11-22T17:05",
    shares: [{ to: "hospital", name: bi("King Faisal Specialist", "التخصصي"), via: "link", expires: "2026-12-06" }],
    history: [
      { at: "2026-11-22T17:05", text: bi("Sent with the visit note and the echo", "انرسل مع ملاحظة الزيارة والإيكو") },
      { at: "2026-11-22T17:20", text: bi("King Faisal Specialist asked for the file (REQ-2611-017)", "التخصصي طلب الملف (REQ-2611-017)") },
    ],
  },
  {
    no: "RX-2611-0361",
    kind: "prescription",
    patient: "ahmed",
    at: "2026-11-22T11:52",
    status: "sent",
    details: bi("1 medicine · picked up", "دواء واحد · استلمته"),
    encounter: "V-2611-08256",
    doctor: "khaled",
  },
  {
    no: "DS-2611-0012",
    kind: "discharge",
    patient: "harbi",
    at: "2026-11-20T15:30",
    status: "issued",
    details: bi("Day case · cardiac cath", "يوم واحد · قسطرة قلبية"),
    encounter: "V-2611-07802",
    doctor: "sami",
    sections: [
      { key: "diagnosis", text: bi("I25.1 · Coronary disease.", "I25.1 · مرض الشريان التاجي.") },
      {
        key: "summary",
        text: bi(
          "Day-case cardiac cath through the right wrist. One stent to the LAD. Went home the same evening.",
          "قسطرة قلبية يوم واحد من الرسغ اليمين. دعامة وحدة في الشريان الأمامي. روّح نفس اليوم بالليل."
        ),
      },
      { key: "followUp", text: bi("Cardiology clinic in 2 weeks. Aspirin and clopidogrel for 12 months.", "عيادة القلب بعد أسبوعين. أسبرين وكلوبيدوقريل لمدة 12 شهر.") },
    ],
    signedAt: "2026-11-20T15:30",
    verifyCode: "DS7-012",
    shares: [{ to: "patient", name: bi("Patient", "المريض"), via: "sms", openedAt: "2026-11-20T18:02" }],
    history: [{ at: "2026-11-20T15:30", text: bi("Signed by Dr. Sami Al-Otaibi", "وقّعه د. سامي العتيبي") }],
  },
  {
    no: "RX-2610-1204",
    kind: "prescription",
    patient: "haddad",
    at: "2026-10-21T12:10",
    status: "expired",
    details: bi("Not picked up in 30 days", "ما انصرفت خلال 30 يوم"),
    doctor: "hala",
  },
]

/* ------------------------------------------------------------------ referrals */

/** Inside Al Noor: clinics that take referrals and their doctors (`short` is how the referral-sent toast names it). */
export const REFERRAL_CLINICS: { id: string; name: Bi; short: Bi; doctors: UserKey[] }[] = [
  { id: "echo", name: bi("Echocardiography lab", "معمل الإيكو"), short: bi("Echo lab", "معمل الإيكو"), doctors: ["sami", "khaled"] },
  { id: "cardiology", name: bi("Cardiology clinic", "عيادة القلب"), short: bi("The cardiology clinic", "عيادة القلب"), doctors: ["sami", "khaled"] },
  { id: "dermatology", name: bi("Dermatology clinic", "عيادة الجلدية"), short: bi("The dermatology clinic", "عيادة الجلدية"), doctors: ["hala"] },
  { id: "pediatrics", name: bi("Pediatrics clinic", "عيادة الأطفال"), short: bi("The pediatrics clinic", "عيادة الأطفال"), doctors: ["zaki"] },
]
/** Another hospital: the ones Al Noor sends to. */
export const HOSPITALS: { id: string; name: Bi }[] = [
  { id: "kfsh", name: bi("King Faisal Specialist", "التخصصي") },
  { id: "kfmc", name: bi("King Fahad Medical City", "مدينة الملك فهد الطبية") },
  { id: "pscc", name: bi("Prince Sultan Cardiac Center", "مركز الأمير سلطان للقلب") },
]

/* ------------------------------------------------------------------ requests for records */

export type RequestFrom = "patient" | "insurer" | "court" | "hospital"
export type RequestStatus = "new" | "consent" | "preparing" | "ready" | "released" | "rejected"
/** What can go in a copy. Mental health notes need a court order. */
export type CopyPart = "notes" | "labs" | "prescriptions" | "imaging" | "mental"
export type ReleaseVia = "link" | "printed" | "email"

/** The steps of a release (brief §4): identity check → patient consent → prepare → doctor review → release. */
export type RequestStep = "received" | "identity" | "consent" | "prepared" | "review" | "released"
export const REQUEST_STEPS: RequestStep[] = ["received", "identity", "consent", "prepared", "review", "released"]
/** A done step: when, the line under it in Progress, and the Activity line (defaults to the step's name). */
export type StepDone = { at: string; text: Bi; activity?: Bi }
export type Paper = { id: string; name: Bi; meta: Bi; kind: "letter" | "consent" | "copy" | "id" | "court" }

export type RecordsRequest = {
  no: string
  from: RequestFrom
  patient: PatientKey
  /** Who asked ("Tawuniya · medical review team", "His father · Saad Al-Shammari"). */
  requester: Bi
  /** Short name for sentences ("Tawuniya", "the father"). */
  requesterShort: Bi
  /** What and why, as the list prints it. */
  summary: Bi
  purpose: Bi
  receivedAt: string
  /** Received + REQUEST_DUE_DAYS unless the requester set an earlier date. */
  due: string
  /** Each step once done (the status follows from them; rules.requestStatus). */
  steps: Partial<Record<RequestStep, StepDone>>
  /** Turned down (identity not confirmed, no consent…). */
  rejected?: { at: string; why: Bi }
  /** What was asked for, what the consent covers (only these can be ticked) and what's ticked. */
  asked: CopyPart[]
  consentCovers: CopyPart[]
  parts: CopyPart[]
  /** Pages per part once prepared; visits counted for the notes. */
  pages?: Partial<Record<CopyPart, number>>
  visits?: number
  period?: { from: string; to: string }
  courtOrder?: boolean
  /** Where the copy goes (email or mobile) and how it went. */
  sendTo?: string
  release?: { at: string; via: ReleaseVia; expiresDays?: number; passwordSms?: boolean }
  papers: Paper[]
}

const step = (at: string, en: string, ar: string, act?: Bi): StepDone => ({ at, text: bi(en, ar), activity: act })
const PARTS_ALL: CopyPart[] = ["notes", "labs", "prescriptions", "imaging", "mental"]

export const REQUESTS: RecordsRequest[] = [
  {
    no: "REQ-2611-014",
    from: "insurer",
    patient: "haddad",
    requester: bi("Tawuniya · medical review team", "التعاونية · فريق المراجعة الطبية"),
    requesterShort: bi("Tawuniya", "التعاونية"),
    summary: bi("Tawuniya · claim review", "التعاونية · مراجعة مطالبة"),
    purpose: bi("Claim CLM-26-01790", "المطالبة CLM-26-01790"),
    receivedAt: "2026-11-20T10:12",
    due: "2026-11-26",
    steps: {
      received: step("2026-11-20T10:12", "20 Nov · by email", "20 نوفمبر · بالإيميل", bi("Received from Tawuniya", "انستلم من التعاونية")),
      identity: step("2026-11-20T11:30", "Tawuniya letter + CR", "خطاب التعاونية + السجل"),
      consent: step("2026-11-21T09:40", "Signed with Nafath 21 Nov", "انوقّعت عبر نفاذ 21 نوفمبر", bi("Consent signed by Lina", "وقّعت لينا الموافقة")),
      prepared: step("2026-11-22T13:10", "18 pages · Nora Al-Fahad", "18 صفحة · نورة الفهد", bi("18 pages prepared · Nora", "تجهّزت 18 صفحة · نورة")),
      review: step("2026-11-23T08:20", "Dr. Hala Nasser · nothing removed", "د. هالة ناصر · ما انشال شي", bi("Reviewed by Dr. Hala Nasser", "راجعته د. هالة ناصر")),
    },
    asked: ["notes", "labs", "prescriptions", "imaging"],
    consentCovers: ["notes", "labs", "prescriptions"],
    parts: ["notes", "labs", "prescriptions"],
    pages: { notes: 9, labs: 6, prescriptions: 3 },
    visits: 4,
    period: { from: "2026-09-01", to: "2026-11-20" },
    sendTo: "medical.review@tawuniya.example",
    papers: [
      { id: "letter", kind: "letter", name: bi("Tawuniya request letter", "خطاب طلب التعاونية"), meta: bi("PDF · 1 page", "PDF · صفحة") },
      { id: "consent", kind: "consent", name: bi("Patient consent", "موافقة المريضة"), meta: bi("PDF · Nafath 21 Nov", "PDF · نفاذ 21 نوفمبر") },
      { id: "copy", kind: "copy", name: bi("Prepared copy · watermarked", "النسخة الجاهزة · فيها علامة مائية"), meta: bi("PDF · 18 pages", "PDF · 18 صفحة") },
    ],
  },
  {
    no: "REQ-2611-016",
    from: "patient",
    patient: "shammari",
    requester: bi("His father · Saad Al-Shammari", "أبوه · سعد الشمري"),
    requesterShort: bi("the father", "الأب"),
    summary: bi("Father · full file copy", "الأب · نسخة كاملة"),
    purpose: bi("Full file copy", "نسخة كاملة من الملف"),
    receivedAt: "2026-11-05T09:30",
    due: "2026-12-05",
    steps: {
      received: step("2026-11-05T09:30", "5 Nov · at the front desk", "5 نوفمبر · عند الاستقبال"),
      identity: step("2026-11-05T09:40", "Father's ID + guardianship proof", "هوية الأب + إثبات الولاية"),
    },
    asked: ["notes", "labs", "prescriptions", "imaging"],
    consentCovers: [],
    parts: [],
    sendTo: "+966 55 218 4410",
    papers: [{ id: "id", kind: "id", name: bi("Father's ID and guardianship proof", "هوية الأب وإثبات الولاية"), meta: bi("PDF · 2 pages", "PDF · صفحتين") }],
  },
  {
    no: "REQ-2611-017",
    from: "hospital",
    patient: "qahtani",
    requester: bi("King Faisal Specialist · cardiac surgery", "التخصصي · جراحة القلب"),
    requesterShort: bi("King Faisal Specialist", "التخصصي"),
    summary: bi("King Faisal Specialist · referral", "التخصصي · تحويل"),
    purpose: bi("Referral RF-2611-0024", "التحويل RF-2611-0024"),
    receivedAt: "2026-11-22T17:20",
    due: "2026-11-24",
    steps: {
      received: step("2026-11-22T17:20", "22 Nov · through the referral", "22 نوفمبر · مع التحويل"),
      identity: step("2026-11-22T17:25", "Hospital request + our referral", "طلب المستشفى + تحويلنا"),
      consent: step("2026-11-22T17:40", "Signed with Nafath 22 Nov", "انوقّعت عبر نفاذ 22 نوفمبر"),
    },
    asked: ["notes", "labs", "imaging"],
    consentCovers: ["notes", "labs", "imaging"],
    parts: ["notes", "labs", "imaging"],
    period: { from: "2026-05-22", to: "2026-11-22" },
    sendTo: "records@kfsh.example",
    papers: [
      { id: "letter", kind: "letter", name: bi("Hospital request", "طلب المستشفى"), meta: bi("PDF · 1 page", "PDF · صفحة") },
      { id: "consent", kind: "consent", name: bi("Patient consent", "موافقة المريضة"), meta: bi("PDF · Nafath 22 Nov", "PDF · نفاذ 22 نوفمبر") },
    ],
  },
  {
    no: "REQ-2611-018",
    from: "court",
    patient: "subaie",
    requester: bi("Riyadh General Court", "المحكمة العامة بالرياض"),
    requesterShort: bi("the court", "المحكمة"),
    summary: bi("Riyadh General Court · case 4471", "المحكمة العامة بالرياض · قضية 4471"),
    purpose: bi("Case 4471", "القضية 4471"),
    receivedAt: "2026-11-13T11:00",
    due: "2026-12-13",
    steps: { received: step("2026-11-13T11:00", "13 Nov · court order by Najiz", "13 نوفمبر · أمر محكمة عبر ناجز") },
    asked: PARTS_ALL,
    consentCovers: [],
    parts: [],
    courtOrder: true,
    papers: [{ id: "court", kind: "court", name: bi("Court order · case 4471", "أمر المحكمة · القضية 4471"), meta: bi("PDF · 2 pages", "PDF · صفحتين") }],
  },
  {
    no: "REQ-2611-009",
    from: "patient",
    patient: "mutairi",
    requester: bi("The patient", "المريضة"),
    requesterShort: bi("the patient", "المريضة"),
    summary: bi("Lab results only", "نتائج التحاليل بس"),
    purpose: bi("Personal copy", "نسخة شخصية"),
    receivedAt: "2026-11-10T08:40",
    due: "2026-12-10",
    steps: {
      received: step("2026-11-10T08:40", "10 Nov · in the app", "10 نوفمبر · من التطبيق"),
      identity: step("2026-11-10T08:41", "Nafath", "نفاذ"),
      consent: step("2026-11-10T08:41", "Her own request", "طلبها هي"),
      prepared: step("2026-11-16T10:00", "4 pages · Nora Al-Fahad", "4 صفحات · نورة الفهد"),
      review: step("2026-11-17T09:00", "Dr. Hala Nasser · nothing removed", "د. هالة ناصر · ما انشال شي"),
      released: step("2026-11-18T12:30", "Secure link · opened 18 Nov", "رابط آمن · انفتح 18 نوفمبر"),
    },
    asked: ["labs"],
    consentCovers: ["labs"],
    parts: ["labs"],
    pages: { labs: 4 },
    release: { at: "2026-11-18T12:30", via: "link", expiresDays: 7, passwordSms: true },
    sendTo: "+966 50 318 6604",
    papers: [{ id: "copy", kind: "copy", name: bi("Released copy · watermarked", "النسخة المسلّمة · فيها علامة مائية"), meta: bi("PDF · 4 pages", "PDF · 4 صفحات") }],
  },
  {
    no: "REQ-2611-006",
    from: "insurer",
    patient: "harbi",
    requester: bi("Unknown insurer", "جهة غير معروفة"),
    requesterShort: bi("the insurer", "الجهة"),
    summary: bi("Unknown insurer · no consent", "جهة غير معروفة · بدون موافقة"),
    purpose: bi("No consent", "بدون موافقة"),
    receivedAt: "2026-11-08T14:00",
    due: "2026-11-15",
    steps: { received: step("2026-11-08T14:00", "8 Nov · by fax", "8 نوفمبر · بالفاكس") },
    rejected: { at: "2026-11-15T10:00", why: bi("Not a known insurer and no patient consent", "جهة غير معروفة وما فيه موافقة المريض") },
    asked: ["notes", "labs"],
    consentCovers: [],
    parts: [],
    papers: [{ id: "letter", kind: "letter", name: bi("Request letter", "خطاب الطلب"), meta: bi("PDF · 1 page", "PDF · صفحة") }],
  },
]

/** Request periods and purposes (New request). */
export const PERIODS = ["m3", "m6", "m12", "all"] as const
export type Period = (typeof PERIODS)[number]
export const PURPOSES = ["secondOpinion", "insurance", "court", "care", "personal"] as const
export type Purpose = (typeof PURPOSES)[number]

/* ------------------------------------------------------------------ chart completion */

export type Missing = "unsigned" | "procedureNote" | "noCode" | "resultNotReviewed"

/**
 * A visit is complete with a signed note, a main diagnosis and reviewed results. Items linked to a note (`note`)
 * close when that note is signed.
 */
export type CompletionItem = {
  id: string
  encounter: string
  missing: Missing
  /** Waiting since (the visit, or when the result came back). */
  since: string
  note?: string
  /** What wasn't reviewed ("Biopsy result not reviewed"). */
  what?: Bi
  remindedAt?: string
  doneAt?: string
}

export const COMPLETION: CompletionItem[] = [
  { id: "cc-1988", encounter: "V-2611-08311", missing: "unsigned", since: "2026-11-22T16:10", note: "VN-2611-1988" },
  { id: "cc-1962", encounter: "V-2611-08256", missing: "unsigned", since: "2026-11-22T11:30", note: "VN-2611-1962" },
  { id: "cc-1890", encounter: "V-2611-07802", missing: "procedureNote", since: "2026-11-20T09:00" },
  { id: "cc-1851", encounter: "V-2611-07533", missing: "noCode", since: "2026-11-19T10:30", note: "VN-2611-1851" },
  { id: "cc-1777", encounter: "V-2611-07041", missing: "resultNotReviewed", since: "2026-11-17T12:00", what: bi("Biopsy", "الخزعة") },
  { id: "cc-2041", encounter: "V-2611-08412", missing: "unsigned", since: "2026-11-23T09:40", note: "VN-2611-2041" },
]

/** Chart completion tiles: done this week and the on-time rate (the rest of the week). */
export const COMPLETION_STATS = { doneThisWeek: 212, onTimePct: 94, goalPct: 95 }

/* ------------------------------------------------------------------ access log */

export type AccessAction = "open" | "print" | "export" | "breakGlass"
export type AccessFlag = "breakGlass" | "unusual" | "normal"
export type ReviewOutcome = "justified" | "askWhy" | "breach"
export type BreakGlassReason = "emergency" | "consult" | "covering" | "other"

/** Read-only: nobody can edit or delete an entry; a review is added beside it. */
export type AccessEvent = {
  id: string
  at: string
  user: UserKey
  /** The file opened; empty for actions on the log itself (an export of the access log). */
  patient: PatientKey
  action: AccessAction
  pages?: number
  why: Bi
  flag: AccessFlag
  /** Break the glass: until when the access lasts. */
  until?: string
  /** How long the file stayed open. */
  minutes?: number
  review?: { by: UserKey; at: string; outcome: ReviewOutcome; note: string }
}

export const ACCESS: AccessEvent[] = [
  {
    id: "ax-0214",
    at: "2026-11-23T02:14",
    user: "rayan",
    patient: "saud",
    action: "breakGlass",
    why: bi("Emergency care · chest pain at 02:00", "رعاية طارئة · ألم صدر الساعة 02:00"),
    flag: "breakGlass",
    until: "2026-11-23T06:14",
  },
  { id: "ax-0958", at: "2026-11-23T09:58", user: "khaled", patient: "dosari", action: "open", why: bi("Visit today", "زيارة اليوم"), flag: "normal" },
  { id: "ax-0931", at: "2026-11-23T09:31", user: "nora", patient: "haddad", action: "print", pages: 18, why: bi("Request REQ-2611-014", "الطلب REQ-2611-014"), flag: "normal" },
  { id: "ax-0847", at: "2026-11-23T08:47", user: "majed", patient: "shehri", action: "open", why: bi("Not in her care team", "مو من الفريق المعالج"), flag: "unusual", minutes: 2 },
  { id: "ax-2211", at: "2026-11-22T15:20", user: "zaki", patient: "shammari", action: "export", why: bi("For the parents", "لأهل المريض"), flag: "normal" },
]


/* ------------------------------------------------------------------ duplicate files */

/** A suggested merge: name + birth date + mobile match (brief §4). `visitNote` describes a lone visit ("ER 15 Nov"). */
export type DuplicateFile = { key: PatientKey; visits: number; visitNote?: Bi; since: string }
export type DuplicatePair = { id: string; files: [DuplicateFile, DuplicateFile]; match: ("name" | "birthDate" | "mobile")[] }

export const DUPLICATES: DuplicatePair[] = [
  {
    id: "dup-ahmed",
    files: [
      { key: "ahmed", visits: 7, since: "2023-01-01" },
      { key: "ahmed2", visits: 1, visitNote: bi("ER 15 Nov", "طوارئ 15 نوفمبر"), since: "2026-11-15" },
    ],
    match: ["name", "birthDate", "mobile"],
  },
]

