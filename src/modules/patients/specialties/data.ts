import type { Bi } from "@/lib/mock/bi"
import { patientById, patientDetails } from "../data"

/**
 * Eyes & Dental (FigCraft page "Eyes & Dental", design v4.1). Copy and figures come from design-scripts/spec_widgets.py.
 * Only Fahad Al-Dosari (MRN 004891) has specialty records; every other patient shows the empty states.
 * Clinical codes (FDI, M/O/D/B/L, CDT, ICD-10, LR…, OD/OS, Δ) stay Latin in both languages.
 */

export const FAHAD = "004891"

/* ================================================================== eyes */

export type Eye = "OD" | "OS"
export type MuscleKey = "LR" | "MR" | "SR" | "IR" | "SO" | "IO"
export const MUSCLES: { key: MuscleKey; name: Bi; action: Bi }[] = [
  { key: "LR", name: { en: "Lateral rectus", ar: "المستقيمة الخارجية" }, action: { en: "Turns the eye out", ar: "تلف العين لبرّا" } },
  { key: "MR", name: { en: "Medial rectus", ar: "المستقيمة الداخلية" }, action: { en: "Turns the eye in", ar: "تلف العين لجوّا" } },
  { key: "SR", name: { en: "Superior rectus", ar: "المستقيمة العلوية" }, action: { en: "Up and in", ar: "لفوق ولجوّا" } },
  { key: "IR", name: { en: "Inferior rectus", ar: "المستقيمة السفلية" }, action: { en: "Down and in", ar: "لتحت ولجوّا" } },
  { key: "SO", name: { en: "Superior oblique", ar: "المائلة العلوية" }, action: { en: "Down and out", ar: "لتحت ولبرّا" } },
  { key: "IO", name: { en: "Inferior oblique", ar: "المائلة السفلية" }, action: { en: "Up and out", ar: "لفوق ولبرّا" } },
]

/** −4 (can't move) … 0 (normal) … +4 (overacting), per muscle per eye. */
export type Grades = Record<Eye, Record<MuscleKey, number>>
const grades = (od: Partial<Record<MuscleKey, number>>, os: Partial<Record<MuscleKey, number>>): Grades => {
  const zero = { LR: 0, MR: 0, SR: 0, IR: 0, SO: 0, IO: 0 }
  return { OD: { ...zero, ...od }, OS: { ...zero, ...os } }
}

/** Nine gaze positions, as you face the patient (row by row, patient's right first). */
export const GAZES = ["upR", "up", "upL", "right", "primary", "left", "downR", "down", "downL"] as const
export type Gaze = (typeof GAZES)[number]
/** Render file per gaze (public/specialties/eye_9_*.png). */
export const GAZE_IMG: Record<Gaze, string> = {
  upR: "up_r",
  up: "up_c",
  upL: "up_l",
  right: "mid_r",
  primary: "mid_c",
  left: "mid_l",
  downR: "down_r",
  down: "down_c",
  downL: "down_l",
}

export type Diplopia = "none" | "right" | "left" | "vertical" | "most"
export type HeadPosture = { kind: "none" | "turnRight" | "turnLeft" | "tiltRight" | "tiltLeft"; deg: number }
export type Nystagmus = "none" | "horizontal" | "vertical"
export type CoverTest = "esotropia" | "exotropia" | "ortho"

export type EyeExam = {
  id: string
  date: string
  doctor: Bi
  status: "draft" | "signed"
  /** History row caption + badge. */
  kind: "first" | "followUp" | "today"
  trend: "draft" | "improving" | "baseline"
  grades: Grades
  icd10: string
  coverTest: CoverTest
  /** Prism dioptres (Δ). */
  deviation: { near: number; far: number }
  diplopia: Diplopia
  headPosture: HeadPosture
  nystagmus: Nystagmus
  acuity: Record<Eye, string>
  /** Gaze positions where the movement is limited (highlighted on the nine-gaze grid). */
  limited: Gaze[]
  notes: Bi
}

/** ICD-10 codes offered on the eye exam (Latin code + name). */
export const EYE_ICD: { code: string; name: Bi }[] = [
  { code: "Z01.00", name: { en: "Routine eye exam, normal", ar: "فحص عيون روتيني · طبيعي" } },
  { code: "H49.21", name: { en: "Sixth nerve palsy, right eye", ar: "شلل العصب السادس · العين اليمنى" } },
  { code: "H49.22", name: { en: "Sixth nerve palsy, left eye", ar: "شلل العصب السادس · العين اليسرى" } },
  { code: "H49.11", name: { en: "Fourth nerve palsy, right eye", ar: "شلل العصب الرابع · العين اليمنى" } },
  { code: "H50.00", name: { en: "Esotropia, unspecified", ar: "حَوَل للداخل" } },
  { code: "H50.10", name: { en: "Exotropia, unspecified", ar: "حَوَل للخارج" } },
]
export const icdName = (code: string) => EYE_ICD.find((x) => x.code === code)?.name ?? { en: code, ar: code }

/** Anatomy view: what each muscle does, its nerve, and what the patient notices when it's weak. */
export const MUSCLE_INFO: Record<MuscleKey, { moves: Bi; nerve: Bi; notices: Bi }> = {
  LR: {
    moves: { en: "Out, away from the nose", ar: "لبرّا، بعيد عن الأنف" },
    nerve: { en: "Cranial nerve VI (abducens)", ar: "العصب القحفي السادس (المبعِّد)" },
    notices: { en: "Double vision when looking to that side", ar: "يشوف الشي شيئين لما يطالع لهالجهة" },
  },
  MR: {
    moves: { en: "In, towards the nose", ar: "لجوّا، باتجاه الأنف" },
    nerve: { en: "Cranial nerve III (oculomotor)", ar: "العصب القحفي الثالث (المحرّك للعين)" },
    notices: { en: "Double vision when looking across", ar: "يشوف الشي شيئين لما يطالع للجهة الثانية" },
  },
  SR: {
    moves: { en: "Up, and a little in", ar: "لفوق، وشوي لجوّا" },
    nerve: { en: "Cranial nerve III (oculomotor)", ar: "العصب القحفي الثالث (المحرّك للعين)" },
    notices: { en: "Double vision when looking up", ar: "يشوف الشي شيئين لما يطالع فوق" },
  },
  IR: {
    moves: { en: "Down, and a little in", ar: "لتحت، وشوي لجوّا" },
    nerve: { en: "Cranial nerve III (oculomotor)", ar: "العصب القحفي الثالث (المحرّك للعين)" },
    notices: { en: "Double vision when looking down", ar: "يشوف الشي شيئين لما يطالع تحت" },
  },
  SO: {
    moves: { en: "Down and out, turns the top of the eye in", ar: "لتحت ولبرّا، ويلف أعلى العين لجوّا" },
    nerve: { en: "Cranial nerve IV (trochlear)", ar: "العصب القحفي الرابع (البَكَري)" },
    notices: { en: "Double vision reading or going downstairs", ar: "يشوف الشي شيئين لما يقرا أو ينزل الدرج" },
  },
  IO: {
    moves: { en: "Up and out", ar: "لفوق ولبرّا" },
    nerve: { en: "Cranial nerve III (oculomotor)", ar: "العصب القحفي الثالث (المحرّك للعين)" },
    notices: { en: "Double vision when looking up and in", ar: "يشوف الشي شيئين لما يطالع فوق ولجوّا" },
  },
}

const REEM: Bi = { en: "Dr. Reem Al-Otaibi", ar: "د. ريم العتيبي" }

/** Newest first. The latest signed exam feeds the tab summary; today's draft is still being recorded. */
const FAHAD_EYE: EyeExam[] = [
  {
    id: "eye-2026-11-17",
    date: "2026-11-17",
    doctor: REEM,
    status: "draft",
    kind: "today",
    trend: "draft",
    grades: grades({ LR: -3 }, { MR: 1 }),
    icd10: "H49.21",
    coverTest: "esotropia",
    deviation: { near: 12, far: 16 },
    diplopia: "right",
    headPosture: { kind: "turnRight", deg: 10 },
    nystagmus: "none",
    acuity: { OD: "6/6", OS: "6/6" },
    limited: ["right"],
    notes: {
      en: "Abduction of the right eye improved since July. Recheck in 6 weeks; prisms if diplopia persists.",
      ar: "حركة العين اليمنى لبرّا تحسنت من يوليو. نعيد الفحص بعد 6 أسابيع، ونشوف النظارة المنشورية لو استمرت الرؤية المزدوجة.",
    },
  },
  {
    id: "eye-2026-10-28",
    date: "2026-10-28",
    doctor: REEM,
    status: "signed",
    kind: "followUp",
    trend: "improving",
    grades: grades({ LR: -3 }, { MR: 1 }),
    icd10: "H49.21",
    coverTest: "esotropia",
    deviation: { near: 12, far: 16 },
    diplopia: "right",
    headPosture: { kind: "turnRight", deg: 10 },
    nystagmus: "none",
    acuity: { OD: "6/6", OS: "6/6" },
    limited: ["right"],
    notes: { en: "Lateral rectus improving. Keep patching the left eye 2 hours a day.", ar: "المستقيمة الخارجية قاعدة تتحسن. يكمل تغطية العين اليسرى ساعتين باليوم." },
  },
  {
    id: "eye-2026-07-29",
    date: "2026-07-29",
    doctor: REEM,
    status: "signed",
    kind: "first",
    trend: "baseline",
    grades: grades({ LR: -4 }, { MR: 1 }),
    icd10: "H49.21",
    coverTest: "esotropia",
    deviation: { near: 20, far: 24 },
    diplopia: "most",
    headPosture: { kind: "turnRight", deg: 15 },
    nystagmus: "none",
    acuity: { OD: "6/9", OS: "6/6" },
    limited: ["upR", "right", "downR"],
    notes: { en: "Sudden double vision after a viral illness. MRI normal.", ar: "رؤية مزدوجة فجأة بعد التهاب فيروسي. الرنين طبيعي." },
  },
]

/* ================================================================== dental */

/** FDI rows as you face the patient: patient's right (Q1 / Q4) on the viewer's left. Never mirrored. */
export const FDI_ROWS = {
  upper: [
    [18, 17, 16, 15, 14, 13, 12, 11],
    [21, 22, 23, 24, 25, 26, 27, 28],
  ],
  lower: [
    [48, 47, 46, 45, 44, 43, 42, 41],
    [31, 32, 33, 34, 35, 36, 37, 38],
  ],
} as const

/** Baby (primary) teeth: FDI quadrants 5–8, positions 1–5. Mixed: permanent incisors + first molars, baby canines and molars. */
export type Dentition = "permanent" | "mixed" | "baby"
type Rows = { upper: readonly (readonly number[])[]; lower: readonly (readonly number[])[] }
export const DENTITION_ROWS: Record<Dentition, Rows> = {
  permanent: FDI_ROWS,
  mixed: {
    upper: [
      [16, 55, 54, 53, 12, 11],
      [21, 22, 63, 64, 65, 26],
    ],
    lower: [
      [46, 85, 84, 83, 42, 41],
      [31, 32, 73, 74, 75, 36],
    ],
  },
  baby: {
    upper: [
      [55, 54, 53, 52, 51],
      [61, 62, 63, 64, 65],
    ],
    lower: [
      [85, 84, 83, 82, 81],
      [71, 72, 73, 74, 75],
    ],
  },
}

export type ToothType = "incisor" | "canine" | "premolar" | "molar"
export const toothType = (fdi: number): ToothType => {
  const p = fdi % 10
  if (Math.floor(fdi / 10) >= 5) return p <= 2 ? "incisor" : p === 3 ? "canine" : "molar"
  return p <= 2 ? "incisor" : p === 3 ? "canine" : p <= 5 ? "premolar" : "molar"
}
/** Q1, Q2 (permanent) and Q5, Q6 (baby teeth) are the upper arch. */
export const isUpper = (fdi: number) => [1, 2, 5, 6].includes(Math.floor(fdi / 10))

export type Surface = "M" | "O" | "D" | "B" | "L"
export const SURFACES: Surface[] = ["M", "O", "D", "B", "L"]
export type SurfaceState = "decay" | "existing" | "done"
export type ToothMark = "crown" | "rootCanal" | "implant" | "bridge" | "sealant" | "fracture"
export type ToothRecord = {
  state?: "missing" | "unerupted"
  surfaces?: Partial<Record<Surface, SurfaceState>>
  /** Treatment planned on this tooth (orange dot under the number). */
  planned?: true
  /** Planned work drawn on the tooth (crown outline, root canal line). */
  marks?: ToothMark[]
}
export type DentalChart = { teeth: Record<number, ToothRecord>; selected: number }

const FAHAD_TEETH: DentalChart = {
  selected: 36,
  teeth: {
    18: { state: "unerupted" },
    28: { state: "unerupted" },
    38: { state: "unerupted" },
    48: { state: "unerupted" },
    35: { state: "missing" },
    16: { surfaces: { O: "decay" }, planned: true },
    26: { surfaces: { O: "existing", M: "existing" } },
    36: { surfaces: { O: "decay", D: "decay" }, planned: true, marks: ["rootCanal", "crown"] },
    46: { surfaces: { O: "existing" } },
    11: { surfaces: { M: "done" } },
    17: { planned: true, marks: ["sealant"] },
    27: { planned: true, marks: ["sealant"] },
    37: { planned: true, marks: ["sealant"] },
    47: { planned: true, marks: ["sealant"] },
  },
}

/** "Lower left first molar" — built from the FDI number (jaw, side, position). */
const POS_NAME: Record<number, Bi> = {
  1: { en: "central incisor", ar: "القاطع الأوسط" },
  2: { en: "lateral incisor", ar: "القاطع الجانبي" },
  3: { en: "canine", ar: "الناب" },
  4: { en: "first premolar", ar: "الضاحك الأول" },
  5: { en: "second premolar", ar: "الضاحك الثاني" },
  6: { en: "first molar", ar: "الضرس الأول" },
  7: { en: "second molar", ar: "الضرس الثاني" },
  8: { en: "third molar (wisdom)", ar: "ضرس العقل" },
}
const BABY_POS: Record<number, Bi> = { ...POS_NAME, 4: { en: "first molar", ar: "الضرس الأول" }, 5: { en: "second molar", ar: "الضرس الثاني" } }
export function toothName(fdi: number): Bi {
  const q = Math.floor(fdi / 10)
  const baby = q >= 5
  const up = isUpper(fdi)
  const right = [1, 4, 5, 8].includes(q)
  const pos = (baby ? BABY_POS : POS_NAME)[fdi % 10]
  const en = `${up ? "Upper" : "Lower"} ${right ? "right" : "left"} ${pos.en}${baby ? " (baby)" : ""}`
  const ar = `${pos.ar} ${up ? "العلوي" : "السفلي"} ${right ? "اليمين" : "اليسار"}${baby ? " (لبني)" : ""}`
  return { en: en.charAt(0).toUpperCase() + en.slice(1), ar }
}

/* ---------------------------------------------------------------- procedures (CDT) */

export type Procedure = { cdt: string; name: Bi; short?: Bi; fee: number; coveragePct: number; preApproval: boolean; mark?: ToothMark; condition?: Condition }
export const PROCEDURES: Procedure[] = [
  { cdt: "D3330", name: { en: "Root canal · molar", ar: "علاج عصب · ضرس" }, short: { en: "root canal", ar: "علاج عصب" }, fee: 1800, coveragePct: 80, preApproval: true, mark: "rootCanal", condition: "rootCanal" },
  { cdt: "D3310", name: { en: "Root canal · front tooth", ar: "علاج عصب · سن أمامي" }, fee: 1200, coveragePct: 80, preApproval: true, mark: "rootCanal", condition: "rootCanal" },
  { cdt: "D2740", name: { en: "Porcelain crown", ar: "تلبيسة بورسلان" }, short: { en: "crown", ar: "تلبيسة" }, fee: 2200, coveragePct: 50, preApproval: true, mark: "crown", condition: "crown" },
  { cdt: "D2391", name: { en: "Composite filling · 1 surface", ar: "حشوة تجميلية · سطح واحد" }, fee: 350, coveragePct: 80, preApproval: false, condition: "filling" },
  { cdt: "D2392", name: { en: "Composite filling · 2 surfaces", ar: "حشوة تجميلية · سطحين" }, fee: 450, coveragePct: 80, preApproval: false, condition: "filling" },
  { cdt: "D2330", name: { en: "Composite filling · front", ar: "حشوة أمامية" }, fee: 300, coveragePct: 80, preApproval: false, condition: "filling" },
  { cdt: "D1351", name: { en: "Fissure sealant", ar: "سد الشقوق" }, fee: 150, coveragePct: 100, preApproval: false, mark: "sealant", condition: "sealant" },
  { cdt: "D7140", name: { en: "Extraction", ar: "خلع" }, fee: 400, coveragePct: 80, preApproval: false, condition: "extraction" },
  { cdt: "D6010", name: { en: "Implant", ar: "زراعة" }, fee: 5500, coveragePct: 30, preApproval: true, mark: "implant", condition: "implant" },
  { cdt: "D6240", name: { en: "Bridge pontic", ar: "جسر" }, fee: 3200, coveragePct: 50, preApproval: true, mark: "bridge", condition: "bridge" },
]
export const procedureBy = (cdt: string) => PROCEDURES.find((p) => p.cdt === cdt)

/** Tooth Panel condition chips. */
export const CONDITIONS = ["decay", "filling", "crown", "rootCanal", "extraction", "implant", "sealant", "fracture", "bridge", "missing"] as const
export type Condition = (typeof CONDITIONS)[number]

/** Clinical note + x-rays per tooth (design: tooth 36). */
export const TOOTH_NOTES: Record<number, Bi> = {
  36: { en: "Deep decay reaching the nerve; tender on tapping. Root canal first, then a crown.", ar: "تسوس عميق واصل للعصب ويوجعه لما ننقر عليه. نبدأ بعلاج العصب وبعدها تلبيسة." },
}
export type Xray = { src: string; label: Bi }
export const TOOTH_XRAYS: Record<number, Xray[]> = {
  36: [
    { src: "/specialties/dent_xray_bw.png", label: { en: "Bitewing · left", ar: "مجنحة · يسار" } },
    { src: "/specialties/dent_xray_pa.png", label: { en: "Periapical · 36", ar: "ذروية · 36" } },
  ],
}

/* ---------------------------------------------------------------- treatment plan */

export type InsuranceStatus = "pending" | "covered" | "claimSent" | "selfPay"
export type PlanItem = {
  id: string
  phase: "urgent" | "restore" | "prevent" | "today"
  teeth: number[]
  procedure: Bi
  cdt: string
  fee: number
  coveragePct: number
  insuranceStatus: InsuranceStatus
  status: "planned" | "done"
}
export const patientShare = (i: PlanItem) => Math.round((i.fee * (100 - i.coveragePct)) / 100)

const FAHAD_PLAN: PlanItem[] = [
  {
    id: "p1",
    phase: "urgent",
    teeth: [36],
    procedure: { en: "Root canal treatment · molar", ar: "علاج عصب · ضرس" },
    cdt: "D3330",
    fee: 1800,
    coveragePct: 80,
    insuranceStatus: "pending",
    status: "planned",
  },
  {
    id: "p2",
    phase: "urgent",
    teeth: [36],
    procedure: { en: "Porcelain crown", ar: "تلبيسة بورسلان" },
    cdt: "D2740",
    fee: 2200,
    coveragePct: 50,
    insuranceStatus: "pending",
    status: "planned",
  },
  {
    id: "p3",
    phase: "restore",
    teeth: [16],
    procedure: { en: "Composite filling · 1 surface (O)", ar: "حشوة تجميلية · سطح واحد (O)" },
    cdt: "D2391",
    fee: 350,
    coveragePct: 80,
    insuranceStatus: "covered",
    status: "planned",
  },
  {
    id: "p4",
    phase: "prevent",
    teeth: [17, 27, 37, 47],
    procedure: { en: "Fissure sealants × 4", ar: "سد الشقوق × 4" },
    cdt: "D1351",
    fee: 600,
    coveragePct: 100,
    insuranceStatus: "covered",
    status: "planned",
  },
  {
    id: "p5",
    phase: "today",
    teeth: [11],
    procedure: { en: "Composite filling · front (M)", ar: "حشوة أمامية (M)" },
    cdt: "D2330",
    fee: 300,
    coveragePct: 80,
    insuranceStatus: "claimSent",
    status: "done",
  },
]

/** `insured: false` = self-pay (no coverage, no pre-approval, no annual limit). */
export type DentalInsurance = { insured: boolean; payer: Bi; payerShort: Bi; className: string; policy: string; annualLimit: number; used: number }
const FAHAD_INSURANCE: DentalInsurance = { insured: true, payer: { en: "Bupa Arabia", ar: "بوبا العربية" }, payerShort: { en: "Bupa", ar: "بوبا" }, className: "B", policy: "BP-2210 4471", annualLimit: 5000, used: 820 }

export type PreApprovalStep = "prepared" | "xrays" | "sent" | "decision"
export type PreApproval = {
  items: string[]
  teeth: number[]
  diagnosis: string
  diagnosisName: Bi
  attachments: ("xrays" | "chart" | "note")[]
  steps: { key: PreApprovalStep; at?: string }[]
  /** Current step (the next one to happen). */
  current: PreApprovalStep
  status: "pending" | "approved" | "declined"
  notifyGuardian: boolean
}
const FAHAD_PREAPPROVAL: PreApproval = {
  items: ["p1", "p2"],
  teeth: [36],
  diagnosis: "K04.0",
  diagnosisName: { en: "Pulpitis", ar: "التهاب العصب" },
  attachments: ["xrays", "chart", "note"],
  steps: [{ key: "prepared", at: "2026-11-17T10:42" }, { key: "xrays", at: "2026-11-17T10:44" }, { key: "sent" }, { key: "decision" }],
  current: "sent",
  status: "pending",
  notifyGuardian: true,
}

export type DentalVisit = { date: string; title: Bi; doctor: Bi }
const SAMI: Bi = { en: "Dr. Sami Odeh", ar: "د. سامي عودة" }
const FAHAD_DENTAL_HISTORY: DentalVisit[] = [
  { date: "2026-11-17", title: { en: "Composite filling · 11 (M)", ar: "حشوة أمامية · 11 (M)" }, doctor: SAMI },
  { date: "2026-10-02", title: { en: "Cleaning & check-up", ar: "تنظيف وكشف" }, doctor: SAMI },
  { date: "2026-04-14", title: { en: "Fissure sealant · 46", ar: "سد الشقوق · 46" }, doctor: SAMI },
  { date: "2026-01-10", title: { en: "Composite filling · 26 (O, M)", ar: "حشوة · 26 (O, M)" }, doctor: { en: "Dr. Hala Saeed", ar: "د. هالة سعيد" } },
]

/* ---------------------------------------------------------------- gum chart */

/** Pocket depth (mm) at 3 buccal sites, bleeding per site, recession (mm), mobility (grade). Missing teeth have none. */
export type GumSite = { depth: [number, number, number]; bleeding: [boolean, boolean, boolean]; recession: number; mobility: number }
export const GUM_UPPER = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]
export const GUM_LOWER = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37]
const DEPTH: Record<number, [number, number, number]> = { 36: [3, 5, 4], 46: [2, 3, 3], 16: [3, 4, 3], 26: [2, 3, 2] }
const BLEED: Record<number, [boolean, boolean, boolean]> = { 36: [false, true, true], 16: [false, true, false], 46: [false, false, true] }
const fahadGums = (): Record<number, GumSite> => {
  const out: Record<number, GumSite> = {}
  for (const fdi of [...GUM_UPPER, ...GUM_LOWER]) {
    if (FAHAD_TEETH.teeth[fdi]?.state === "missing") continue
    out[fdi] = {
      depth: DEPTH[fdi] ?? (fdi % 2 ? [2, 2, 2] : [2, 1, 2]),
      bleeding: BLEED[fdi] ?? [false, false, false],
      recession: 0,
      mobility: 0,
    }
  }
  return out
}

/* ================================================================== per patient */

export type EyeRecord = { exams: EyeExam[] }
/** Patients under 18: the guardian signs the treatment consent (on the device or through a WhatsApp link). */
export type Consent = { guardian: { name: Bi; initials: string; relation: Bi; mobile: string } | null; status: "unsigned" | "sent" | "signed" }
/** Gum health summary (Gums workspace). Plaque comes from the hygienist's index, not the pocket chart. */
export type GumHealth = { plaquePct: number; risk: "low" | "moderate" | "high"; nextCleaning: string; watch: Bi | null; advice: Bi[] }

export type DentalRecord = {
  consent: Consent
  gumHealth: GumHealth
  chart: DentalChart
  plan: PlanItem[]
  insurance: DentalInsurance
  preApproval: PreApproval | null
  history: DentalVisit[]
  gums: Record<number, GumSite>
}

/* ---------------------------------------------------------------- sample patients (testing) */

/** "Today" for the specialty screens (the design's exam / visit date). */
export const SPEC_TODAY = "2026-11-17"

/**
 * Test data: besides Fahad (the design file), patients get one of a few sample histories, picked from the MRN
 * (MRN mod 5): 0 normal eye check-up + dental, 1 dental only, 2 exotropia + dental, 3 fourth-nerve palsy + dental,
 * 4 nothing (to try the empty states and starting a first exam / chart). Children get the teen dental sample.
 */
const bucket = (id: string) => Number(id) % 5

const zero = { LR: 0, MR: 0, SR: 0, IR: 0, SO: 0, IO: 0 }
const sampleExam = (e: Partial<EyeExam> & Pick<EyeExam, "id" | "date" | "kind" | "trend">): EyeExam => ({
  doctor: REEM,
  status: "signed",
  grades: { OD: { ...zero }, OS: { ...zero } },
  icd10: "Z01.00",
  coverTest: "ortho",
  deviation: { near: 0, far: 0 },
  diplopia: "none",
  headPosture: { kind: "none", deg: 0 },
  nystagmus: "none",
  acuity: { OD: "6/6", OS: "6/6" },
  limited: [],
  notes: { en: "", ar: "" },
  ...e,
})

function sampleEyes(id: string): EyeExam[] | null {
  const b = bucket(id)
  if (b === 0)
    return [
      sampleExam({
        id: `eye-${id}-1`,
        date: "2026-09-14",
        kind: "first",
        trend: "baseline",
        notes: { en: "Full movement in all nine positions. No deviation.", ar: "الحركة كاملة في الاتجاهات التسعة. ما فيه انحراف." },
      }),
    ]
  if (b === 2)
    return [
      sampleExam({
        id: `eye-${id}-2`,
        date: "2026-10-12",
        kind: "followUp",
        trend: "improving",
        grades: { OD: { ...zero }, OS: { ...zero, MR: -1 } },
        icd10: "H50.10",
        coverTest: "exotropia",
        deviation: { near: 10, far: 12 },
        diplopia: "right",
        headPosture: { kind: "turnRight", deg: 5 },
        acuity: { OD: "6/6", OS: "6/9" },
        limited: ["right"],
        notes: { en: "Convergence exercises helping. Recheck in 3 months.", ar: "تمارين التقريب قاعدة تفيد. نعيد الفحص بعد 3 شهور." },
      }),
      sampleExam({
        id: `eye-${id}-1`,
        date: "2026-06-02",
        kind: "first",
        trend: "baseline",
        grades: { OD: { ...zero }, OS: { ...zero, MR: -2 } },
        icd10: "H50.10",
        coverTest: "exotropia",
        deviation: { near: 18, far: 20 },
        diplopia: "most",
        headPosture: { kind: "turnRight", deg: 10 },
        acuity: { OD: "6/6", OS: "6/9" },
        limited: ["upR", "right", "downR"],
        notes: { en: "Left eye drifts out when tired. Start convergence exercises.", ar: "العين اليسرى تطلع لبرّا لما يتعب. نبدأ تمارين التقريب." },
      }),
    ]
  if (b === 3)
    return [
      sampleExam({
        id: `eye-${id}-1`,
        date: "2026-08-20",
        kind: "first",
        trend: "baseline",
        grades: { OD: { ...zero, SO: -2, IO: 1 }, OS: { ...zero } },
        icd10: "H49.11",
        coverTest: "ortho",
        diplopia: "vertical",
        headPosture: { kind: "tiltLeft", deg: 10 },
        limited: ["downL"],
        notes: { en: "Vertical double vision reading. Prism glasses trial.", ar: "رؤية مزدوجة عمودية وقت القراية. نجرّب نظارة منشورية." },
      }),
    ]
  return null
}

/** Today's new exam, started from the latest one (or a normal baseline). */
export function newEyeExam(latest: EyeExam | undefined): EyeExam {
  return {
    ...(latest ?? sampleExam({ id: "", date: SPEC_TODAY, kind: "today", trend: "draft" })),
    id: `eye-${SPEC_TODAY}`,
    date: SPEC_TODAY,
    status: "draft",
    kind: "today",
    trend: "draft",
    notes: { en: "", ar: "" },
  }
}

/** Patient's insurance from the profile ("Tawuniya · Class A"), or self-pay. */
function insuranceOf(id: string, used: number): DentalInsurance {
  const p = patientById(id)
  const ins = p ? patientDetails(p).insurance : null
  if (!ins) return { insured: false, payer: { en: "Self-pay", ar: "على حسابه" }, payerShort: { en: "Self-pay", ar: "على حسابه" }, className: "—", policy: "—", annualLimit: 0, used: 0 }
  const [en, enCls] = ins.en.split(" · ")
  const [ar] = ins.ar.split(" · ")
  return {
    insured: true,
    payer: { en, ar },
    payerShort: { en, ar },
    className: (enCls ?? "").replace("Class ", "") || "A",
    policy: `TW-${id.slice(-4)} ${String(Number(id) * 7).slice(-4)}`,
    annualLimit: 5000,
    used,
  }
}

const planItem = (ins: DentalInsurance, i: Omit<PlanItem, "coveragePct" | "insuranceStatus" | "procedure" | "fee"> & { insuranceStatus?: InsuranceStatus }): PlanItem => {
  const proc = procedureBy(i.cdt)!
  return {
    ...i,
    procedure: proc.name,
    fee: proc.fee,
    coveragePct: ins.insured ? proc.coveragePct : 0,
    insuranceStatus: !ins.insured ? "selfPay" : (i.insuranceStatus ?? (proc.preApproval && i.status === "planned" ? "pending" : i.status === "done" ? "claimSent" : "covered")),
  }
}

const healthyGums = (teeth: Record<number, ToothRecord>): Record<number, GumSite> => {
  const out: Record<number, GumSite> = {}
  for (const fdi of [...GUM_UPPER, ...GUM_LOWER]) {
    if (teeth[fdi]?.state === "missing") continue
    out[fdi] = { depth: fdi % 2 ? [2, 2, 2] : [2, 1, 2], bleeding: [false, false, false], recession: 0, mobility: 0 }
  }
  return out
}
const GENERIC_HEALTH: GumHealth = {
  plaquePct: 12,
  risk: "low",
  nextCleaning: "2027-05-17",
  watch: null,
  advice: [
    { en: "Brush twice a day", ar: "فرّش مرتين باليوم" },
    { en: "Floss daily", ar: "خيط الأسنان يومياً" },
    { en: "Fluoride toothpaste", ar: "معجون فيه فلورايد" },
  ],
}
const DOC_SAMI: Bi = { en: "Dr. Sami Odeh", ar: "د. سامي عودة" }

function consentFor(id: string): Consent {
  const p = patientById(id)
  const minor = !!p && p.age < 18
  return {
    guardian: minor ? { name: { en: "Guardian", ar: "ولي الأمر" }, initials: "G", relation: { en: "Parent · guardian", ar: "الوالد · ولي الأمر" }, mobile: p!.mobile ?? "" } : null,
    status: "unsigned",
  }
}

/** A blank chart for a patient's first dental visit (all teeth healthy; wisdom teeth not erupted under 18). */
export function newDentalRecord(id: string): DentalRecord {
  const p = patientById(id)
  const teeth: Record<number, ToothRecord> = p && p.age < 18 ? { 18: { state: "unerupted" }, 28: { state: "unerupted" }, 38: { state: "unerupted" }, 48: { state: "unerupted" } } : {}
  return {
    consent: consentFor(id),
    gumHealth: GENERIC_HEALTH,
    chart: { teeth, selected: 36 },
    plan: [],
    insurance: insuranceOf(id, 0),
    preApproval: null,
    history: [],
    gums: healthyGums(teeth),
  }
}

function sampleDental(id: string): DentalRecord | null {
  const b = bucket(id)
  if (b === 4) return null
  const p = patientById(id)
  const base = newDentalRecord(id)
  const teen = !!p && p.age < 18
  if (teen) {
    const ins = insuranceOf(id, 300)
    const teeth: Record<number, ToothRecord> = {
      ...base.chart.teeth,
      16: { surfaces: { O: "existing" } },
      26: { surfaces: { O: "existing" } },
      36: { surfaces: { O: "existing" } },
      46: { surfaces: { O: "existing" } },
      24: { surfaces: { D: "decay" }, planned: true },
    }
    return {
      ...base,
      insurance: ins,
      chart: { teeth, selected: 24 },
      plan: [planItem(ins, { id: "s1", phase: "restore", teeth: [24], cdt: "D2391", status: "planned" })],
      history: [{ date: "2026-03-08", title: { en: "Fissure sealants · 16, 26, 36, 46", ar: "سد الشقوق · 16، 26، 36، 46" }, doctor: DOC_SAMI }],
      gums: healthyGums(teeth),
    }
  }
  if (b === 1) {
    const ins = insuranceOf(id, 1450)
    const teeth: Record<number, ToothRecord> = {
      46: { state: "missing" },
      36: { surfaces: { O: "existing", M: "existing", D: "existing", B: "existing", L: "existing" } },
      17: { surfaces: { O: "existing" } },
    }
    const implant = planItem(ins, { id: "s1", phase: "restore", teeth: [46], cdt: "D6010", status: "planned" })
    return {
      ...base,
      insurance: ins,
      chart: { teeth: { ...teeth, 46: { state: "missing", planned: true, marks: ["implant"] } }, selected: 46 },
      plan: [implant],
      preApproval: ins.insured
        ? {
            items: ["s1"],
            teeth: [46],
            diagnosis: "K08.1",
            diagnosisName: { en: "Loss of a tooth", ar: "فقدان سن" },
            attachments: ["xrays", "chart", "note"],
            steps: [{ key: "prepared", at: "2026-11-15T09:20" }, { key: "xrays" }, { key: "sent" }, { key: "decision" }],
            current: "xrays",
            status: "pending",
            notifyGuardian: false,
          }
        : null,
      history: [
        { date: "2026-02-11", title: { en: "Extraction · 46", ar: "خلع · 46" }, doctor: DOC_SAMI },
        { date: "2025-06-20", title: { en: "Porcelain crown · 36", ar: "تلبيسة بورسلان · 36" }, doctor: DOC_SAMI },
      ],
      gums: healthyGums(teeth),
    }
  }
  const ins = insuranceOf(id, 600)
  const teeth: Record<number, ToothRecord> = {
    36: { surfaces: { O: "existing" } },
    46: { surfaces: { O: "existing", D: "existing" } },
    14: { surfaces: { O: "decay" }, planned: true },
  }
  return {
    ...base,
    insurance: ins,
    chart: { teeth, selected: 14 },
    plan: [
      planItem(ins, { id: "s1", phase: "restore", teeth: [14], cdt: "D2391", status: "planned" }),
      planItem(ins, { id: "s2", phase: "today", teeth: [46], cdt: "D2392", status: "done" }),
    ],
    history: [
      { date: SPEC_TODAY, title: { en: "Composite filling · 46 (O, D)", ar: "حشوة · 46 (O, D)" }, doctor: DOC_SAMI },
      { date: "2026-04-03", title: { en: "Cleaning & check-up", ar: "تنظيف وكشف" }, doctor: DOC_SAMI },
    ],
    gums: healthyGums(teeth),
  }
}

/** Eye exams for a patient (null = none recorded yet). */
export function eyeRecord(patientId: string): EyeRecord | null {
  if (patientId === FAHAD) return { exams: FAHAD_EYE }
  const exams = sampleEyes(patientId)
  return exams ? { exams } : null
}

/** Dental file for a patient (null = no dental visits yet). */
export function dentalRecord(patientId: string): DentalRecord | null {
  if (patientId !== FAHAD) return sampleDental(patientId)
  return {
    consent: {
      guardian: { name: { en: "Abdullah Al-Dosari", ar: "عبدالله الدوسري" }, initials: "AD", relation: { en: "Father · guardian", ar: "الأب · ولي الأمر" }, mobile: "059 300 1287" },
      status: "unsigned",
    },
    gumHealth: {
      plaquePct: 18,
      risk: "low",
      nextCleaning: "2027-05-17",
      watch: { en: "Tooth 36 · 5 mm pocket with bleeding", ar: "السن 36 · جيب 5 مم مع نزيف" },
      advice: [
        { en: "Floss around 36 daily", ar: "خيط الأسنان حول 36 يومياً" },
        { en: "Soft toothbrush", ar: "فرشاة ناعمة" },
        { en: "Fluoride toothpaste", ar: "معجون فيه فلورايد" },
      ],
    },
    chart: FAHAD_TEETH,
    plan: FAHAD_PLAN,
    insurance: FAHAD_INSURANCE,
    preApproval: FAHAD_PREAPPROVAL,
    history: FAHAD_DENTAL_HISTORY,
    gums: fahadGums(),
  }
}

/** Summary figures for the Dental tab tiles (computed, so they follow the chart and plan). */
export function dentalSummary(r: DentalRecord) {
  const all = [...FDI_ROWS.upper.flat(), ...FDI_ROWS.lower.flat()]
  const unerupted = all.filter((f) => r.chart.teeth[f]?.state === "unerupted").length
  const missing = all.filter((f) => r.chart.teeth[f]?.state === "missing").length
  const planned = r.plan.filter((i) => i.status === "planned")
  const fees = r.plan.reduce((s, i) => s + i.fee, 0)
  const pays = r.plan.reduce((s, i) => s + patientShare(i), 0)
  return {
    teeth: all.length - unerupted - missing,
    unerupted,
    missing,
    planned: planned.length,
    plannedFees: planned.reduce((s, i) => s + i.fee, 0),
    doneToday: r.plan.filter((i) => i.status === "done").length,
    fees,
    patientPays: pays,
    insurancePays: fees - pays,
  }
}

/** Gum chart summary tiles, computed from the sites: average depth, sites ≥ 4 mm, bleeding %. */
export function gumSummary(gums: Record<number, GumSite>) {
  const depths = Object.values(gums).flatMap((g) => g.depth)
  const bleeding = Object.values(gums).flatMap((g) => g.bleeding).filter(Boolean).length
  return {
    sites: depths.length,
    avgDepth: depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0,
    deep: depths.filter((d) => d >= 4).length,
    bleedingPct: depths.length ? Math.round((bleeding / depths.length) * 100) : 0,
  }
}

/** Insurance figures for the plan: limit used, and what's left once the planned (not yet claimed) work is paid. */
export function insuranceSummary(r: DentalRecord) {
  const planned = r.plan.filter((i) => i.status === "planned").reduce((s, i) => s + (i.fee - patientShare(i)), 0)
  const { annualLimit, used } = r.insurance
  return { annualLimit, used, usedPct: (used / annualLimit) * 100, leftAfter: annualLimit - used - planned }
}

/* ================================================================== routes (workspaces live outside the app shell) */

export const specialtyHref = {
  eyes: (id: string) => `/patients/${id}/eyes`,
  eyeExam: (id: string, exam?: string) => `/patients/${id}/eyes/exam${exam ? `?exam=${exam}` : ""}`,
  eyeAnatomy: (id: string) => `/patients/${id}/eyes/anatomy`,
  eyeCompare: (id: string) => `/patients/${id}/eyes/compare`,
  eyePatientView: (id: string) => `/patients/${id}/eyes/patient-view`,
  dental: (id: string) => `/patients/${id}/dental`,
  dentalChart: (id: string, tooth?: number) => `/patients/${id}/dental/chart${tooth ? `?tooth=${tooth}` : ""}`,
  dental3d: (id: string) => `/patients/${id}/dental/3d`,
  dentalPlan: (id: string) => `/patients/${id}/dental/plan`,
  dentalGums: (id: string) => `/patients/${id}/dental/gums`,
}
