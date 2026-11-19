import type { Bi } from "@/lib/mock/bi"

const bi = (en: string, ar: string): Bi => ({ en, ar })

/*
 * Labs module data (design v4.9, CODE_CHAT_LABS.md §4). Sample data comes from the design scripts
 * (lab_widgets.py, lab_order_widgets.py, build_labs.py). The module shares only core doctors (Doctors keys),
 * clinics (Clinics keys) and patients (Patients ids, when the design's lab patient exists there).
 *
 * Times are local Riyadh wall-clock ISO strings without a zone ("2026-11-19T10:52"), like the rest of the mock data.
 */

/* ------------------------------------------------------------------ clock */

/**
 * The demo clock: "now" for waiting times, due times and the critical call-by deadline. 11:24 matches the
 * design's "Waiting for validation" list (LAB-0142 resulted 10:52 → waiting 32 min) and the collection queue.
 */
export const LAB_TODAY = "2026-11-19"
export const LAB_NOW = `${LAB_TODAY}T11:24`

/** Minutes since midnight of an ISO local time. */
export const minsOf = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16))
/** "10:52" from an ISO local time. */
export const timeOf = (iso: string) => iso.slice(11, 16)
/** ISO local time + minutes (same day; the lab day never crosses midnight in the mock). */
export function addMins(iso: string, m: number) {
  const t = Math.max(0, Math.min(23 * 60 + 59, minsOf(iso) + m))
  return `${iso.slice(0, 11)}${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
}
/** Whole minutes from a to b (b defaults to the demo clock). */
export const minsBetween = (a: string, b: string = LAB_NOW) => minsOf(b) - minsOf(a) + (a.slice(0, 10) === b.slice(0, 10) ? 0 : 24 * 60)

/* ------------------------------------------------------------------ tubes */

/**
 * Tube cap colours are physical standards and the only hard-coded colours in the module (brief §4).
 * Always shown as a dot paired with its name. `name` = short colour name, `full` = colour · additive.
 */
export const TUBES = {
  gold: { hex: "#EAB308", name: bi("Gold", "ذهبي"), full: bi("Gold · SST", "ذهبي · SST") },
  lav: { hex: "#A78BFA", name: bi("Lavender", "بنفسجي"), full: bi("Lavender · EDTA", "بنفسجي · EDTA") },
  blue: { hex: "#7DD3FC", name: bi("Light blue", "أزرق فاتح"), full: bi("Light blue · Citrate", "أزرق فاتح · سترات") },
  grey: { hex: "#9CA3AF", name: bi("Grey", "رمادي"), full: bi("Grey · Fluoride", "رمادي · فلورايد") },
  green: { hex: "#22C55E", name: bi("Green", "أخضر"), full: bi("Green · Heparin", "أخضر · هيبارين") },
  red: { hex: "#EF4444", name: bi("Red", "أحمر"), full: bi("Red · Plain", "أحمر · سادة") },
  urine: { hex: "#FDE68A", name: bi("Urine cup", "علبة بول"), full: bi("Urine cup", "علبة بول") },
  bottle: { hex: "#64748B", name: bi("Culture bottles", "قناني المزرعة"), full: bi("Culture bottles", "قناني المزرعة") },
} as const satisfies Record<string, { hex: string; name: Bi; full: Bi }>

export type TubeKey = keyof typeof TUBES

/** Tube guide: order of draw (Samples tab). */
export const ORDER_OF_DRAW: { tube: TubeKey; use: Bi }[] = [
  { tube: "blue", use: bi("Coagulation", "التخثر") },
  { tube: "red", use: bi("Serology", "الأمصال") },
  { tube: "gold", use: bi("Chemistry, lipids, hormones", "الكيمياء والدهون والهرمونات") },
  { tube: "green", use: bi("STAT chemistry", "الكيمياء العاجلة") },
  { tube: "lav", use: bi("CBC, HbA1c", "CBC و HbA1c") },
  { tube: "grey", use: bi("Glucose, lactate", "السكر واللاكتات") },
]

/* ------------------------------------------------------------------ catalog */

export type Section = "hematology" | "chemistry" | "hormones" | "microbiology" | "urine"

export type Sex = "male" | "female"

/** A reference band; the first band that matches the patient's age (months) and sex is used. */
export type RefBand = { sex?: Sex; minMonths?: number; maxMonths?: number; low?: number; high?: number }

export type Analyte = {
  key: string
  /** Abbreviations (HbA1c, LDL) are the same Latin text in both languages. */
  name: Bi
  unit: string
  /** Decimals shown/entered. */
  dp: number
  ref: RefBand[]
  /** Critical limits are separate from the reference range (brief §4: e.g. K+ < 2.8 or > 6.2). */
  critLow?: number
  critHigh?: number
  /** Delta check: warn when the value changes more than this % from the previous result (LDL 30%). */
  deltaPct?: number
}

export type TestDef = {
  key: string
  code: string
  name: Bi
  section: Section
  tube: TubeKey
  /** Turnaround: hours, or days when ≥ 24. */
  tatH: number
  /** SAR, before VAT. */
  price: number
  active: boolean
  /** Analytes the lab enters for this test (empty: not designed yet, e.g. urinalysis fields). */
  analytes: Analyte[]
  /** Volume drawn, mL (tube cards and the order summary). */
  volumeMl?: number
}

const A = (key: string, en: string, ar: string, unit: string, dp: number, ref: RefBand[], extra: Partial<Analyte> = {}): Analyte => ({
  key,
  name: bi(en, ar),
  unit,
  dp,
  ref,
  ...extra,
})

/** The design's reference ranges (pediatric patient LAB-0142); age/sex bands get added as the lab supplies them. */
export const TESTS: TestDef[] = [
  { key: "cbc", code: "1001", name: bi("CBC", "CBC"), section: "hematology", tube: "lav", tatH: 2, price: 45, active: true, analytes: [], volumeMl: 3 },
  {
    key: "hba1c",
    code: "2010",
    name: bi("HbA1c", "HbA1c"),
    section: "chemistry",
    tube: "lav",
    tatH: 4,
    price: 90,
    active: true,
    volumeMl: 3,
    analytes: [A("hba1c", "HbA1c", "HbA1c", "%", 1, [{ low: 4.0, high: 5.6 }])],
  },
  {
    key: "lipid",
    code: "2020",
    name: bi("Lipid panel", "الدهون"),
    section: "chemistry",
    tube: "gold",
    tatH: 4,
    price: 120,
    active: true,
    volumeMl: 5,
    analytes: [
      A("chol", "Total cholesterol", "الكوليسترول الكلي", "mg/dL", 0, [{ high: 170 }]),
      A("ldl", "LDL", "LDL", "mg/dL", 0, [{ high: 110 }], { deltaPct: 30 }),
      A("hdl", "HDL", "HDL", "mg/dL", 0, [{ low: 45 }]),
      A("tg", "Triglycerides", "الدهون الثلاثية", "mg/dL", 0, [{ high: 90 }]),
    ],
  },
  {
    key: "kidney",
    code: "2031",
    name: bi("Kidney function", "وظائف الكلى"),
    section: "chemistry",
    tube: "gold",
    tatH: 3,
    price: 95,
    active: true,
    volumeMl: 5,
    analytes: [A("urea", "Urea", "اليوريا", "mg/dL", 0, [{ low: 5, high: 18 }]), A("creat", "Creatinine", "الكرياتينين", "mg/dL", 1, [{ low: 0.3, high: 0.7 }])],
  },
  {
    key: "lytes",
    code: "2032",
    name: bi("Electrolytes", "الأملاح"),
    section: "chemistry",
    tube: "gold",
    tatH: 1,
    price: 80,
    active: true,
    volumeMl: 5,
    analytes: [
      A("na", "Sodium", "الصوديوم", "mmol/L", 0, [{ low: 135, high: 145 }]),
      A("k", "Potassium", "البوتاسيوم", "mmol/L", 1, [{ low: 3.5, high: 5.1 }], { critLow: 2.8, critHigh: 6.2 }),
      A("cl", "Chloride", "الكلورايد", "mmol/L", 0, [{ low: 98, high: 107 }]),
      A("hco3", "Bicarbonate", "البيكربونات", "mmol/L", 0, [{ low: 22, high: 29 }]),
    ],
  },
  { key: "tsh", code: "3005", name: bi("TSH", "TSH"), section: "hormones", tube: "gold", tatH: 6, price: 110, active: true, analytes: [], volumeMl: 5 },
  { key: "vitd", code: "3011", name: bi("Vitamin D", "فيتامين د"), section: "hormones", tube: "gold", tatH: 24, price: 160, active: true, analytes: [], volumeMl: 5 },
  { key: "culture", code: "4002", name: bi("Blood culture", "مزرعة دم"), section: "microbiology", tube: "bottle", tatH: 120, price: 220, active: true, analytes: [] },
  { key: "urine", code: "5001", name: bi("Urinalysis", "تحليل البول"), section: "urine", tube: "urine", tatH: 1, price: 40, active: true, analytes: [], volumeMl: 20 },
  { key: "ammonia", code: "2090", name: bi("Ammonia", "الأمونيا"), section: "chemistry", tube: "green", tatH: 1, price: 130, active: false, analytes: [] },
  /*
   * Tests the orders use that aren't in the designed catalog rows (the catalog shows 10 of them). Code, TAT and price
   * are placeholders until the catalog is filled (listed as a design gap).
   */
  {
    key: "fbg",
    code: "2001",
    name: bi("Fasting glucose", "السكر الصايم"),
    section: "chemistry",
    tube: "grey",
    tatH: 1,
    price: 0,
    active: true,
    analytes: [A("glu", "Fasting glucose", "السكر الصايم", "mg/dL", 0, [{ low: 70, high: 99 }])],
  },
  { key: "ferritin", code: "3020", name: bi("Ferritin", "مخزون الحديد"), section: "hormones", tube: "gold", tatH: 6, price: 0, active: true, analytes: [] },
  { key: "iron", code: "2050", name: bi("Iron studies", "الحديد"), section: "chemistry", tube: "gold", tatH: 4, price: 0, active: true, analytes: [] },
  { key: "crp", code: "6001", name: bi("CRP", "CRP"), section: "chemistry", tube: "gold", tatH: 2, price: 0, active: true, analytes: [] },
  { key: "ft4", code: "3006", name: bi("Free T4", "Free T4"), section: "hormones", tube: "gold", tatH: 6, price: 0, active: true, analytes: [] },
  { key: "bili", code: "2060", name: bi("Bilirubin", "البيليروبين"), section: "chemistry", tube: "gold", tatH: 2, price: 0, active: true, analytes: [] },
  { key: "ige", code: "6010", name: bi("Total IgE", "Total IgE"), section: "chemistry", tube: "gold", tatH: 24, price: 0, active: true, analytes: [] },
  { key: "coag", code: "1010", name: bi("Coagulation", "التخثر"), section: "hematology", tube: "blue", tatH: 2, price: 0, active: true, analytes: [] },
]

export const testOf = (key: string) => TESTS.find((t) => t.key === key)
export function analyteOf(key: string): Analyte | undefined {
  for (const t of TESTS) {
    const a = t.analytes.find((x) => x.key === key)
    if (a) return a
  }
}

/** Ready panels on the New lab order form. */
export const READY_PANELS: { key: string; name: Bi; tests: string[] }[] = [
  { key: "diabetes", name: bi("Diabetes follow-up", "متابعة السكري"), tests: ["hba1c", "kidney", "lytes", "lipid", "urine"] },
  { key: "annual", name: bi("Annual check-up", "الفحص السنوي"), tests: [] },
  { key: "anemia", name: bi("Anemia", "فقر الدم"), tests: [] },
  { key: "thyroid", name: bi("Thyroid", "الغدة الدرقية"), tests: ["tsh", "ft4"] },
]

/* ------------------------------------------------------------------ staff */

/** Lab roles (brief §4 permissions). "lead" is the demo login: every lab permission (no user model in the design yet). */
export type LabRole = "phlebotomy" | "tech" | "pathologist" | "doctor" | "patient" | "lead"

export type LabStaff = { key: string; name: Bi; role: Exclude<LabRole, "doctor" | "patient" | "lead">; title: Bi }

export const LAB_STAFF: LabStaff[] = [
  { key: "hanan", name: bi("Hanan Al-Otaibi", "حنان العتيبي"), role: "phlebotomy", title: bi("Phlebotomist", "أخصائية سحب دم") },
  { key: "ali", name: bi("Ali Hassan", "علي حسن"), role: "tech", title: bi("Lab technician", "فني مختبر") },
  { key: "salma", name: bi("Dr. Salma Al-Harbi", "د. سلمى الحربي"), role: "pathologist", title: bi("Clinical pathologist", "استشارية علم الأمراض") },
]
export const staffOf = (key: string) => LAB_STAFF.find((s) => s.key === key)

/** Where the design's analyzer results come from. */
export const ANALYZER = "Cobas c311"

/* ------------------------------------------------------------------ orders */

export type Priority = "routine" | "stat"
export type OrderStatus = "collect" | "lab" | "validate" | "ready" | "rejected"
export type Flag = "H" | "L" | "C"
export type RejectReason = "hemolyzed" | "clotted" | "qns" | "wrongTube" | "label"
export type CollectionPlace = "room" | "clinic" | "home"

/** The patient as the lab order shows it (snapshot at ordering), linked to the core patient file when it exists. */
export type LabPatient = {
  /** Core Patients id, when the patient has a file there. */
  patientId?: string
  initials: string
  name: Bi
  mrn: string
  sex: Sex
  /** Age in months (ranges are age-specific; shown as "5 m" under 2 years, else years). */
  ageMonths: number
  payer?: Bi
  /** Clinical side card ("From the doctor's order"). */
  medicines?: Bi
  allergies?: Bi
}

export type TubeState = "pending" | "collected" | "received" | "analyzer" | "resulted" | "rejected"

export type Rejection = { reason: RejectReason; at: string; by: string; recollect: boolean; toldDoctor: boolean }

export type Tube = {
  /** Tube number on the order: barcode suffix -01, -02… */
  no: number
  type: TubeKey
  /** Test keys this tube carries. */
  tests: string[]
  volumeMl?: number
  state: TubeState
  collectedAt?: string
  collectedBy?: string
  receivedAt?: string
  /** Rack / storage note once resulted ("stored rack B4"). */
  rack?: string
  /** Every time this tube was rejected; the latest one with recollect = true puts the order back to collect. */
  rejections?: Rejection[]
}

export type Result = {
  analyte: string
  /** null = not entered yet (draft, or the analyzer didn't send it). */
  value: number | null
  unit: string
  refLow?: number
  refHigh?: number
  flag: Flag | null
  previous?: { value: number; date: string }
  instrument?: string
  /** Typed by the tech instead of imported from the analyzer. */
  manual?: boolean
  resultedAt?: string
}

/** A test on the order is reported as one panel; results move through it together (release can be partial, per panel). */
export type PanelState = "waiting" | "analyzer" | "draft" | "validate" | "released"

export type Panel = {
  test: string
  /** Report heading when it isn't the test name (the design reports HbA1c + fasting glucose as "Diabetes"). */
  title?: Bi
  state: PanelState
  results: Result[]
  /** Expected result time while in the lab. */
  dueAt?: string
  resultedAt?: string
  submittedBy?: string
  comment?: string
  validatedBy?: string
  validatedAt?: string
  releasedAt?: string
  /** Results shown in the patient app once released (Validate & release switch). */
  inPatientApp?: boolean
  /** Flag counts for sample orders whose individual results aren't in the design (validation queue). */
  mockFlags?: { C?: number; H?: number; L?: number }
}

export type CriticalCall = {
  analyte: string
  /** Doctors key, or a free name for someone else. */
  spokeTo: string
  how: "phone" | "inPerson" | "secureMessage"
  at: string
  readBack: boolean
  instruction?: string
  by: string
}

export type LabEventKind = "ordered" | "collected" | "received" | "analyzer" | "resulted" | "submitted" | "critical" | "validated" | "released" | "rejected" | "sent"

export type LabEvent = { at: string; kind: LabEventKind; by?: string; note?: Bi }

export type LabOrder = {
  /** "LAB-0142" */
  no: string
  patient: LabPatient
  /** Doctors key. */
  doctorId: string
  /** Clinics key (from the doctor). */
  clinicId: string
  priority: Priority
  tests: string[]
  tubes: Tube[]
  panels: Panel[]
  fasting: boolean
  fastingHours?: number
  diagnosisIcd10?: string
  diagnosis?: Bi
  note?: Bi
  place: CollectionPlace
  createdAt: string
  /** Collection queue ticket while waiting to be collected (C-07…). */
  ticket?: string
  queuedAt?: string
  calls: CriticalCall[]
  events: LabEvent[]
  /** Report verification code (patient report footer). */
  verifyCode?: string
  sentAt?: string
}

/** "S" + yymmdd + order seq + "-" + tube no (S2611190142-01). The leading letter keeps it from flipping inside Arabic. */
export function barcodeOf(o: Pick<LabOrder, "no" | "createdAt">, tubeNo: number) {
  const d = o.createdAt
  return `S${d.slice(2, 4)}${d.slice(5, 7)}${d.slice(8, 10)}${o.no.replace(/\D/g, "").padStart(4, "0")}-${String(tubeNo).padStart(2, "0")}`
}

/* ------------------------------------------------------------------ sample orders */

const P = (p: LabPatient) => p
const T = (time: string) => `${LAB_TODAY}T${time}`

const ABDULLAH = P({
  initials: "AS",
  name: bi("Abdullah Al-Shammari", "عبدالله الشمري"),
  mrn: "MRN-15530",
  sex: "male",
  ageMonths: 13 * 12,
  payer: bi("Bupa", "بوبا"),
  medicines: bi("Insulin glargine, aspart", "إنسولين جلارجين وأسبارت"),
  allergies: bi("None known", "ما فيه"),
})

const r = (analyte: string, value: number | null, flag: Flag | null, previous?: [number, string], extra: Partial<Result> = {}): Result => {
  const a = analyteOf(analyte)!
  const band = a.ref[0]
  return {
    analyte,
    value,
    unit: a.unit,
    refLow: band?.low,
    refHigh: band?.high,
    flag,
    previous: previous && { value: previous[0], date: previous[1] },
    ...extra,
  }
}

/** LAB-0142: the design's sample order (STAT, critical potassium, 3 of 5 tests resulted, waiting for validation). */
const LAB_0142: LabOrder = {
  no: "LAB-0142",
  patient: ABDULLAH,
  doctorId: "zaki",
  clinicId: "peds",
  priority: "stat",
  tests: ["hba1c", "kidney", "lytes", "lipid", "urine"],
  tubes: [
    { no: 1, type: "gold", tests: ["kidney", "lytes", "lipid"], volumeMl: 5, state: "analyzer", collectedAt: T("10:14"), collectedBy: "hanan", receivedAt: T("10:21") },
    { no: 2, type: "lav", tests: ["hba1c"], volumeMl: 3, state: "resulted", collectedAt: T("10:14"), collectedBy: "hanan", receivedAt: T("10:21"), rack: "B4" },
    { no: 3, type: "urine", tests: ["urine"], volumeMl: 20, state: "received", collectedAt: T("10:16"), collectedBy: "hanan", receivedAt: T("10:23") },
  ],
  panels: [
    {
      test: "hba1c",
      title: bi("Diabetes", "السكري"),
      state: "validate",
      resultedAt: T("10:52"),
      results: [
        r("hba1c", 9.1, "H", [8.4, "2026-08-21"], { instrument: ANALYZER, resultedAt: T("10:52") }),
        r("glu", 212, "H", [188, "2026-08-21"], { instrument: ANALYZER, resultedAt: T("10:52") }),
      ],
    },
    {
      test: "lytes",
      state: "validate",
      resultedAt: T("10:52"),
      results: [
        r("na", 136, null, [138, "2026-08-21"], { instrument: ANALYZER, resultedAt: T("10:52") }),
        r("k", 6.8, "C", [4.3, "2026-08-21"], { instrument: ANALYZER, resultedAt: T("10:52") }),
        r("cl", 101, null, [102, "2026-08-21"], { instrument: ANALYZER, resultedAt: T("10:52") }),
        r("hco3", 20, "L", [24, "2026-08-21"], { instrument: ANALYZER, resultedAt: T("10:52") }),
      ],
    },
    {
      test: "kidney",
      state: "validate",
      resultedAt: T("10:48"),
      results: [
        r("urea", 16, null, [14, "2026-08-21"], { instrument: ANALYZER, resultedAt: T("10:48") }),
        r("creat", 0.6, null, [0.5, "2026-08-21"], { instrument: ANALYZER, resultedAt: T("10:48") }),
      ],
    },
    {
      test: "lipid",
      state: "analyzer",
      dueAt: T("12:30"),
      // Enter results: 3 of 4 values imported; triglycerides missing (Focus state). LDL up 32% → delta check.
      results: [
        r("chol", 182, "H", [165, "2026-08-21"], { instrument: ANALYZER }),
        r("ldl", 118, "H", [89, "2026-08-21"], { instrument: ANALYZER }),
        r("hdl", 48, null, [50, "2026-08-21"], { instrument: ANALYZER }),
        r("tg", null, null, [84, "2026-08-21"]),
      ],
    },
    { test: "urine", state: "waiting", dueAt: T("11:40"), results: [] },
  ],
  fasting: true,
  fastingHours: 10,
  diagnosisIcd10: "E10.9",
  diagnosis: bi("Type 1 diabetes", "سكري نوع 1"),
  note: bi("Poor control since August. Please add urine ketones if glucose is over 250.", "السكر مو منضبط من أغسطس. أضيفوا كيتونات البول لو السكر فوق 250."),
  place: "room",
  createdAt: T("10:05"),
  calls: [],
  events: [
    { at: T("10:05"), kind: "ordered", by: "zaki" },
    { at: T("10:14"), kind: "collected", by: "hanan", note: bi("Collection room 2 · ID checked", "غرفة السحب 2 · تأكدت من الهوية") },
    { at: T("10:21"), kind: "received", by: "ali", note: bi("Scanned at reception", "انمسح عند الاستقبال") },
    { at: T("10:24"), kind: "analyzer", note: bi("Cobas c311 · rack 12", "Cobas c311 · الرف 12") },
    { at: T("10:52"), kind: "resulted", note: bi("Auto-verified 6 · held 2 for review", "6 انعتمدت تلقائياً · 2 تنتظر مراجعة") },
  ],
  verifyCode: "7Q4-K2M",
}

type Lite = {
  no: string
  patient: LabPatient
  doctorId: string
  clinicId: string
  priority?: Priority
  tests: string[]
  tubes: [TubeKey, string[]][]
  createdAt: string
  status: "collect" | "lab" | "validate" | "ready" | "rejected"
  /** collect: queue ticket + queued time; lab: due; validate: resulted; ready: released. */
  ticket?: string
  queuedAt?: string
  collectedAt?: string
  receivedAt?: string | null
  dueAt?: string
  resultedAt?: string
  releasedAt?: string
  mockFlags?: Panel["mockFlags"]
  rejection?: Rejection
}

/** Builds the lighter sample orders (worklist rows, queue, tracker, validation queue) in a consistent state. */
function lite(o: Lite): LabOrder {
  const collected = o.status !== "collect" && o.status !== "rejected"
  const tubes: Tube[] = o.tubes.map(([type, tests], i) => ({
    no: i + 1,
    type,
    tests,
    volumeMl: testOf(tests[0])?.volumeMl,
    state: collected ? (o.receivedAt === null ? "collected" : o.status === "lab" ? "analyzer" : "resulted") : "pending",
    collectedAt: collected ? o.collectedAt : undefined,
    collectedBy: collected ? "hanan" : undefined,
    receivedAt: collected && o.receivedAt !== null ? o.receivedAt : undefined,
  }))
  if (o.rejection) {
    tubes[0] = { ...tubes[0], collectedAt: o.collectedAt, receivedAt: o.receivedAt ?? undefined, state: "pending", rejections: [o.rejection] }
  }
  const panelState: PanelState = o.status === "validate" ? "validate" : o.status === "ready" ? "released" : o.status === "lab" ? "analyzer" : "waiting"
  const panels: Panel[] = o.tests.map((test, i) => ({
    test,
    state: panelState,
    results: [],
    dueAt: o.dueAt,
    resultedAt: o.resultedAt ?? (o.status === "ready" ? o.releasedAt : undefined),
    releasedAt: o.releasedAt,
    validatedBy: o.status === "ready" ? "salma" : undefined,
    validatedAt: o.releasedAt,
    inPatientApp: o.status === "ready" ? true : undefined,
    mockFlags: i === 0 ? o.mockFlags : undefined,
  }))
  const events: LabEvent[] = [{ at: o.createdAt, kind: "ordered", by: o.doctorId }]
  if (o.collectedAt) events.push({ at: o.collectedAt, kind: "collected", by: "hanan" })
  if (o.receivedAt) events.push({ at: o.receivedAt, kind: "received", by: "ali" })
  if (o.rejection) events.push({ at: o.rejection.at, kind: "rejected", by: o.rejection.by })
  if (o.resultedAt) events.push({ at: o.resultedAt, kind: "resulted" })
  if (o.releasedAt) events.push({ at: o.releasedAt, kind: "validated", by: "salma" }, { at: o.releasedAt, kind: "released", by: "salma" })
  return {
    no: o.no,
    patient: o.patient,
    doctorId: o.doctorId,
    clinicId: o.clinicId,
    priority: o.priority ?? "routine",
    tests: o.tests,
    tubes,
    panels,
    fasting: false,
    place: "room",
    createdAt: o.createdAt,
    ticket: o.ticket,
    queuedAt: o.queuedAt,
    calls: [],
    events,
  }
}

const pt = (initials: string, en: string, ar: string, mrn: string, sex: Sex, ageMonths: number, patientId?: string): LabPatient => ({
  initials,
  name: bi(en, ar),
  mrn,
  sex,
  ageMonths,
  patientId,
})

/** Today's orders, newest first (worklist order). */
export const ORDERS: LabOrder[] = [
  lite({
    no: "LAB-0143",
    patient: pt("KS", "Khalid Al-Subaie", "خالد السبيعي", "MRN-21877", "male", 9 * 12),
    doctorId: "zaki",
    clinicId: "peds",
    tests: ["coag", "cbc"],
    tubes: [
      ["blue", ["coag"]],
      ["lav", ["cbc"]],
    ],
    createdAt: T("11:20"),
    status: "collect",
    ticket: "C-10",
    queuedAt: T("11:22"),
  }),
  LAB_0142,
  lite({
    no: "LAB-0141",
    patient: pt("LH", "Lina Haddad", "لينا حداد", "MRN-19022", "female", 6 * 12, "004857"),
    doctorId: "zaki",
    clinicId: "peds",
    tests: ["cbc", "ferritin", "iron"],
    tubes: [["lav", ["cbc", "ferritin", "iron"]]],
    createdAt: T("09:55"),
    collectedAt: T("10:02"),
    receivedAt: T("10:09"),
    status: "lab",
    dueAt: T("12:15"),
  }),
  lite({
    no: "LAB-0140",
    patient: pt("OH", "Omar Al-Harbi", "عمر الحربي", "MRN-22310", "male", 3 * 12),
    doctorId: "saud",
    clinicId: "peds",
    priority: "stat",
    tests: ["cbc", "crp", "culture"],
    tubes: [
      ["lav", ["cbc"]],
      ["gold", ["crp"]],
      ["bottle", ["culture"]],
    ],
    createdAt: T("11:02"),
    status: "collect",
    ticket: "C-07",
    queuedAt: T("11:05"),
  }),
  lite({
    no: "LAB-0139",
    patient: pt("SA", "Sara Ahmed", "سارة أحمد", "MRN-23118", "female", 34 * 12, "004812"),
    doctorId: "shehri",
    clinicId: "internal",
    tests: ["tsh", "ft4"],
    tubes: [["gold", ["tsh", "ft4"]]],
    createdAt: T("11:12"),
    status: "collect",
    ticket: "C-08",
    queuedAt: T("11:16"),
  }),
  lite({
    no: "LAB-0138",
    patient: pt("MQ", "Mona Al-Qahtani", "منى القحطاني", "MRN-14402", "female", 52 * 12),
    doctorId: "mansour",
    clinicId: "cardio",
    tests: ["lipid", "hba1c"],
    tubes: [
      ["gold", ["lipid"]],
      ["lav", ["hba1c"]],
    ],
    createdAt: T("09:58"),
    collectedAt: T("10:05"),
    receivedAt: T("10:12"),
    status: "rejected",
    ticket: "C-09",
    queuedAt: T("11:19"),
    rejection: { reason: "hemolyzed", at: T("10:20"), by: "ali", recollect: true, toldDoctor: true },
  }),
  lite({
    no: "LAB-0137",
    patient: pt("RM", "Reem Al-Mutairi", "ريم المطيري", "MRN-23001", "female", 5),
    doctorId: "saud",
    clinicId: "peds",
    priority: "stat",
    tests: ["bili"],
    tubes: [["gold", ["bili"]]],
    createdAt: T("10:28"),
    collectedAt: T("10:35"),
    receivedAt: null,
    status: "lab",
    dueAt: T("11:20"),
  }),
  lite({
    no: "LAB-0136",
    patient: pt("FD", "Fahad Al-Dosari", "فهد الدوسري", "MRN-17654", "male", 11 * 12, "004891"),
    doctorId: "zaki",
    clinicId: "peds",
    tests: ["cbc", "ige"],
    tubes: [
      ["lav", ["cbc"]],
      ["gold", ["ige"]],
    ],
    createdAt: T("08:05"),
    collectedAt: T("08:12"),
    receivedAt: T("08:20"),
    resultedAt: T("09:25"),
    status: "ready",
    releasedAt: T("09:40"),
  }),
  lite({
    no: "LAB-0135",
    patient: pt("YA", "Yousef Al-Amri", "يوسف العمري", "MRN-20418", "male", 8 * 12),
    doctorId: "zaki",
    clinicId: "peds",
    tests: ["vitd"],
    tubes: [["gold", ["vitd"]]],
    createdAt: T("07:50"),
    collectedAt: T("07:58"),
    receivedAt: T("08:04"),
    resultedAt: T("09:05"),
    status: "ready",
    releasedAt: T("09:15"),
  }),
  // Waiting for validation (Results tab), behind the first worklist page.
  lite({
    no: "LAB-0133",
    patient: pt("NB", "Nouf Al-Barrak", "نوف البراك", "MRN-18840", "female", 29 * 12),
    doctorId: "shehri",
    clinicId: "internal",
    tests: ["cbc", "ferritin"],
    tubes: [["lav", ["cbc", "ferritin"]]],
    createdAt: T("09:30"),
    collectedAt: T("09:38"),
    receivedAt: T("09:45"),
    resultedAt: T("10:40"),
    status: "validate",
    mockFlags: { L: 1 },
  }),
  lite({
    no: "LAB-0131",
    patient: pt("TS", "Turki Al-Saleh", "تركي الصالح", "MRN-16205", "male", 41 * 12),
    doctorId: "shehri",
    clinicId: "internal",
    tests: ["tsh", "ft4"],
    tubes: [["gold", ["tsh", "ft4"]]],
    createdAt: T("09:12"),
    collectedAt: T("09:20"),
    receivedAt: T("09:27"),
    resultedAt: T("10:31"),
    status: "validate",
  }),
  lite({
    no: "LAB-0129",
    patient: pt("GM", "Ghada Al-Mansour", "غادة المنصور", "MRN-12977", "female", 47 * 12),
    doctorId: "mansour",
    clinicId: "cardio",
    tests: ["lipid"],
    tubes: [["gold", ["lipid"]]],
    createdAt: T("08:55"),
    collectedAt: T("09:03"),
    receivedAt: T("09:10"),
    resultedAt: T("10:18"),
    status: "validate",
    mockFlags: { H: 2 },
  }),
  lite({
    no: "LAB-0127",
    patient: pt("AH", "Ali Hakami", "علي حكمي", "MRN-21140", "male", 36 * 12),
    doctorId: "shehri",
    clinicId: "internal",
    tests: ["urine"],
    tubes: [["urine", ["urine"]]],
    createdAt: T("08:40"),
    collectedAt: T("08:46"),
    receivedAt: T("08:52"),
    resultedAt: T("10:05"),
    status: "validate",
  }),
]

/** Previous orders for the order page side card (last 12 months, from the design). */
export const PREVIOUS_ORDERS: Record<string, { date: string; no: string; summary: Bi }[]> = {
  "MRN-15530": [
    { date: "2026-08-21", no: "LAB-0098", summary: bi("HbA1c 8.4% · glucose 188", "HbA1c 8.4% · السكر 188") },
    { date: "2026-05-18", no: "LAB-0061", summary: bi("HbA1c 7.9% · lipids normal", "HbA1c 7.9% · الدهون طبيعية") },
    { date: "2026-02-12", no: "LAB-0017", summary: bi("HbA1c 7.6% · kidney normal", "HbA1c 7.6% · الكلى طبيعية") },
  ],
}
