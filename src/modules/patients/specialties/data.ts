import type { Bi } from "@/lib/mock/bi"

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

export type EyeExam = {
  id: string
  date: string
  doctor: Bi
  status: "draft" | "signed"
  /** History row caption + badge. */
  kind: "first" | "followUp" | "today"
  trend: "draft" | "improving" | "baseline"
  grades: Grades
  icd10: { code: string; name: Bi }
  coverTest: "esotropia" | "exotropia" | "ortho"
  /** Prism dioptres (Δ). */
  deviation: { near: number; far: number }
  diplopia: Bi | null
  headPosture: Bi | null
  nystagmus: Bi | null
  acuity: Record<Eye, string>
  /** Gaze positions where the movement is limited (highlighted on the nine-gaze grid). */
  limited: Gaze[]
  notes: Bi
}

const REEM: Bi = { en: "Dr. Reem Al-Otaibi", ar: "د. ريم العتيبي" }
const PALSY = { code: "H49.21", name: { en: "Sixth nerve palsy, right eye", ar: "شلل العصب السادس · العين اليمنى" } }
const DIPLOPIA: Bi = { en: "Horizontal, worse looking right", ar: "أفقية، تزيد لما يطالع يمين" }
const NONE: Bi = { en: "None", ar: "ما فيه" }

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
    icd10: PALSY,
    coverTest: "esotropia",
    deviation: { near: 12, far: 16 },
    diplopia: DIPLOPIA,
    headPosture: { en: "Turns face to the right · 10°", ar: "يلف وجهه يمين · 10°" },
    nystagmus: NONE,
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
    icd10: PALSY,
    coverTest: "esotropia",
    deviation: { near: 12, far: 16 },
    diplopia: DIPLOPIA,
    headPosture: { en: "Turns face to the right · 10°", ar: "يلف وجهه يمين · 10°" },
    nystagmus: NONE,
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
    icd10: PALSY,
    coverTest: "esotropia",
    deviation: { near: 20, far: 24 },
    diplopia: DIPLOPIA,
    headPosture: { en: "Turns face to the right · 15°", ar: "يلف وجهه يمين · 15°" },
    nystagmus: NONE,
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

export type Procedure = { cdt: string; name: Bi; fee: number; coveragePct: number; preApproval: boolean; mark?: ToothMark; condition?: Condition }
export const PROCEDURES: Procedure[] = [
  { cdt: "D3330", name: { en: "Root canal · molar", ar: "علاج عصب · ضرس" }, fee: 1800, coveragePct: 80, preApproval: true, mark: "rootCanal", condition: "rootCanal" },
  { cdt: "D3310", name: { en: "Root canal · front tooth", ar: "علاج عصب · سن أمامي" }, fee: 1200, coveragePct: 80, preApproval: true, mark: "rootCanal", condition: "rootCanal" },
  { cdt: "D2740", name: { en: "Porcelain crown", ar: "تلبيسة بورسلان" }, fee: 2200, coveragePct: 50, preApproval: true, mark: "crown", condition: "crown" },
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

export type InsuranceStatus = "pending" | "covered" | "claimSent"
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

export type DentalInsurance = { payer: Bi; payerShort: Bi; className: string; policy: string; annualLimit: number; used: number }
const FAHAD_INSURANCE: DentalInsurance = { payer: { en: "Bupa Arabia", ar: "بوبا العربية" }, payerShort: { en: "Bupa", ar: "بوبا" }, className: "B", policy: "BP-2210 4471", annualLimit: 5000, used: 820 }

export type PreApprovalStep = "prepared" | "xrays" | "sent" | "decision"
export type PreApproval = {
  items: string[]
  teeth: number[]
  diagnosis: string
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
export type DentalRecord = {
  chart: DentalChart
  plan: PlanItem[]
  insurance: DentalInsurance
  preApproval: PreApproval | null
  history: DentalVisit[]
  gums: Record<number, GumSite>
}

/** Eye exams for a patient (null = none recorded yet). */
export function eyeRecord(patientId: string): EyeRecord | null {
  return patientId === FAHAD ? { exams: FAHAD_EYE } : null
}

/** Dental file for a patient (null = no dental visits yet). */
export function dentalRecord(patientId: string): DentalRecord | null {
  if (patientId !== FAHAD) return null
  return {
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
