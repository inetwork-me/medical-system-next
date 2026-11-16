import type { Bi } from "@/lib/mock/bi"
import type { IconName } from "@/components/ds/icon"
import type { Collection, PatientChanges } from "../store"
import { TODAY, missingOf, patientDetails, type MissingField, type Patient, type PatientDetails } from "../data"

/**
 * Patient page data (Overview + Visits / Payments / Medical / Files / Activity tabs).
 * Fahad Al-Dosari (MRN 004891) carries the design's sample file word for word. Every other patient gets
 * a record derived from their list data: visits, invoices and activity follow their visit history;
 * clinical sections (allergies, diagnoses, medications, labs, notes, files) stay empty — no invented clinical facts.
 */

const FAHAD = "004891"

/** "since" = "Since Jan 2024", "day" = "02 Oct 2026", "month" = "Sep 2026". */
export type When = {
  kind: "since" | "sinceDay" | "day" | "month"
  date: string
}

export type VisitStatus = "upcoming" | "completed" | "cancelled"
export type Visit = {
  id: string
  date: string
  time: string
  clinic: Bi
  doctor: Bi
  reason: Bi
  dx: Bi | null
  status: VisitStatus
  amount: number
}

export type InvoiceStatus = "pending" | "paid" | "void"
export type Invoice = {
  no: string
  date: string
  service: Bi
  method: Bi | null
  total: number
  insurance: number
  share: number
  status: InvoiceStatus
}

export type Allergy = { name: Bi; detail: Bi; severity: "severe" | "moderate" }
export type Diagnosis = {
  name: Bi
  when: When
  status: "active" | "treated" | "resolved"
}
export type Medication = {
  name: Bi
  dose: Bi
  when: When
  by: Bi
  status: "active" | "stopped"
}
export type LabResult = {
  name: Bi
  value: string
  range: string
  flag: "normal" | "high" | "low"
}

export type FileCategory = "lab" | "imaging" | "insurance" | "prescription" | "referral" | "consent"
export type FileGroup = "lab" | "imaging" | "prescriptions" | "documents"
export const FILE_GROUP: Record<FileCategory, FileGroup> = {
  lab: "lab",
  imaging: "imaging",
  prescription: "prescriptions",
  insurance: "documents",
  referral: "documents",
  consent: "documents",
}
export type PatientFile = {
  icon: IconName
  name: string
  title: Bi
  category: FileCategory
  ext: string
  size: string
  bytes: number
  date: string
  by: Bi
}

export type ActivityKind = "added" | "edited" | "flagged"
export type ActivityItem = {
  date: string
  time: string
  initials: string
  by: Bi
  kind: ActivityKind
  text: Bi
}

export type Note = { title: Bi; by: Bi; date: string; body: Bi }
export type Appointment = { date: string; kind: "booked" | "requested"; time?: string; clinic?: Bi; doctor?: Bi; reason?: Bi; visitId?: string }
export type BillingLine = { label: Bi; amount: number }

export type PatientRecord = {
  details: PatientDetails
  visits: Visit[]
  invoices: Invoice[]
  allergies: Allergy[]
  diagnoses: Diagnosis[]
  medications: Medication[]
  vitals: {
    weight: number | null
    height: number | null
    bmi: number | null
    spo2: number | null
    history: { date: string; kg: number }[]
  }
  labs: { date: string; panel: Bi; results: LabResult[] } | null
  files: PatientFile[]
  activity: ActivityItem[]
  notes: Note[]
  weight: { month: string; kg: number }[]
  weightNote: Bi | null
  appointments: Appointment[]
  billing: {
    services: BillingLine[]
    coverage: BillingLine[]
    balance: number
    since: string
  }
  /** Personal-info completeness: 10 fields, missing ones listed. */
  missing: MissingField[]
}

/* ---------------------------------------------------------------- shared people */

const AZ: Bi = { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }
const SO: Bi = { en: "Dr. Sami Odeh", ar: "د. سامي عودة" }
const HF: Bi = { en: "Huda Fares", ar: "هدى فارس" }
const RA: Bi = { en: "Reem Alotaibi", ar: "ريم العتيبي" }
const SYS: Bi = { en: "System", ar: "النظام" }

const PEDS: Bi = { en: "Pediatrics", ar: "الأطفال" }
const DENTAL: Bi = { en: "Dental", ar: "الأسنان" }
const LAB: Bi = { en: "Lab", ar: "التحاليل" }

/* ---------------------------------------------------------------- Fahad (design sample) */

const FAHAD_RECORD: Omit<PatientRecord, "details" | "missing"> = {
  visits: [
    {
      id: "v5",
      date: "2026-11-18",
      time: "10:30",
      clinic: PEDS,
      doctor: AZ,
      reason: { en: "Asthma follow-up", ar: "متابعة الربو" },
      dx: null,
      status: "upcoming",
      amount: 350,
    },
    {
      id: "v4",
      date: "2026-10-28",
      time: "10:00",
      clinic: PEDS,
      doctor: AZ,
      reason: { en: "Asthma follow-up", ar: "متابعة الربو" },
      dx: { en: "J45.20 · Mild asthma", ar: "J45.20 · ربو خفيف" },
      status: "completed",
      amount: 350,
    },
    {
      id: "v3",
      date: "2026-10-02",
      time: "16:30",
      clinic: DENTAL,
      doctor: SO,
      reason: { en: "Cleaning & check-up", ar: "تنظيف وكشف" },
      dx: { en: "K02.9 · Dental caries", ar: "K02.9 · تسوس أسنان" },
      status: "completed",
      amount: 520,
    },
    {
      id: "v2",
      date: "2026-09-15",
      time: "09:00",
      clinic: PEDS,
      doctor: AZ,
      reason: { en: "Fever & cough", ar: "حرارة وكحة" },
      dx: null,
      status: "cancelled",
      amount: 0,
    },
    {
      id: "v1",
      date: "2026-08-21",
      time: "11:15",
      clinic: LAB,
      doctor: HF,
      reason: { en: "CBC · Vitamin D", ar: "CBC · فيتامين د" },
      dx: { en: "Lab only", ar: "تحاليل فقط" },
      status: "completed",
      amount: 280,
    },
  ],
  invoices: [
    {
      no: "INV-24990",
      date: "2026-10-28",
      service: { en: "Pediatrics visit", ar: "زيارة الأطفال" },
      method: { en: "Insurance + cash", ar: "تأمين + كاش" },
      total: 350,
      insurance: 170,
      share: 180,
      status: "pending",
    },
    {
      no: "INV-24811",
      date: "2026-10-02",
      service: { en: "Dental · cleaning", ar: "الأسنان · تنظيف" },
      method: { en: "Mada", ar: "مدى" },
      total: 520,
      insurance: 0,
      share: 520,
      status: "paid",
    },
    {
      no: "INV-24577",
      date: "2026-09-15",
      service: { en: "Pediatrics visit", ar: "زيارة الأطفال" },
      method: null,
      total: 0,
      insurance: 0,
      share: 0,
      status: "void",
    },
    {
      no: "INV-24302",
      date: "2026-08-21",
      service: { en: "Lab · CBC, Vitamin D", ar: "التحاليل · CBC، فيتامين د" },
      method: { en: "Cash", ar: "كاش" },
      total: 280,
      insurance: 0,
      share: 280,
      status: "paid",
    },
  ],
  allergies: [
    {
      name: { en: "Penicillin", ar: "البنسلين" },
      detail: { en: "Severe · rash, swelling", ar: "شديدة · طفح وتورّم" },
      severity: "severe",
    },
    {
      name: { en: "Peanuts", ar: "الفول السوداني" },
      detail: { en: "Moderate · hives", ar: "متوسطة · شرى" },
      severity: "moderate",
    },
  ],
  diagnoses: [
    {
      name: {
        en: "J45.20 · Mild intermittent asthma",
        ar: "J45.20 · ربو خفيف متقطع",
      },
      when: { kind: "since", date: "2024-01-02" },
      status: "active",
    },
    {
      name: { en: "K02.9 · Dental caries", ar: "K02.9 · تسوس أسنان" },
      when: { kind: "day", date: "2026-10-02" },
      status: "treated",
    },
    {
      name: {
        en: "J06.9 · Acute upper respiratory infection",
        ar: "J06.9 · التهاب حاد في الجهاز التنفسي العلوي",
      },
      when: { kind: "month", date: "2026-09-15" },
      status: "resolved",
    },
  ],
  medications: [
    {
      name: {
        en: "Salbutamol inhaler 100 mcg",
        ar: "بخاخ سالبوتامول 100 ميكروغرام",
      },
      dose: { en: "2 puffs as needed", ar: "بختين عند الحاجة" },
      when: { kind: "since", date: "2024-01-02" },
      by: AZ,
      status: "active",
    },
    {
      name: {
        en: "Budesonide inhaler 200 mcg",
        ar: "بخاخ بوديسونيد 200 ميكروغرام",
      },
      dose: { en: "1 puff twice daily", ar: "بخة مرتين باليوم" },
      when: { kind: "sinceDay", date: "2026-10-28" },
      by: AZ,
      status: "active",
    },
    {
      name: { en: "Vitamin D3 1000 IU", ar: "فيتامين د3 1000 وحدة" },
      dose: { en: "Once daily · 3 months", ar: "مرة باليوم · 3 شهور" },
      when: { kind: "sinceDay", date: "2026-08-21" },
      by: AZ,
      status: "active",
    },
    {
      name: { en: "Amoxicillin", ar: "أموكسيسيلين" },
      dose: { en: "Stopped · allergy suspected", ar: "انوقف · اشتباه حساسية" },
      when: { kind: "month", date: "2026-09-15" },
      by: AZ,
      status: "stopped",
    },
  ],
  vitals: {
    weight: 52,
    height: 162,
    bmi: 19.8,
    spo2: 98,
    history: [
      { date: "2026-01-15", kg: 46 },
      { date: "2026-04-15", kg: 47.5 },
      { date: "2026-08-21", kg: 49 },
      { date: "2026-09-15", kg: 50 },
      { date: "2026-10-28", kg: 52 },
    ],
  },
  labs: {
    date: "2026-08-21",
    panel: { en: "CBC, Vitamin D", ar: "CBC، فيتامين د" },
    results: [
      {
        name: { en: "Hemoglobin", ar: "الهيموغلوبين" },
        value: "13.8 g/dL",
        range: "12 – 16",
        flag: "normal",
      },
      {
        name: { en: "WBC", ar: "كريات الدم البيضاء" },
        value: "11.2 ×10³/µL",
        range: "4 – 10",
        flag: "high",
      },
      {
        name: { en: "Platelets", ar: "الصفائح الدموية" },
        value: "260 ×10³/µL",
        range: "150 – 400",
        flag: "normal",
      },
      {
        name: { en: "Vitamin D", ar: "فيتامين د" },
        value: "18 ng/mL",
        range: "30 – 100",
        flag: "low",
      },
    ],
  },
  files: [
    {
      icon: "document-text",
      name: "lab-results-cbc-vitd.pdf",
      title: { en: "CBC & Vitamin D results", ar: "نتائج CBC وفيتامين د" },
      category: "lab",
      ext: "PDF",
      size: "412 KB",
      bytes: 412_000,
      date: "2026-08-21",
      by: HF,
    },
    {
      icon: "gallery",
      name: "chest-xray-sep-2026.jpg",
      title: { en: "Chest X-ray", ar: "أشعة صدر" },
      category: "imaging",
      ext: "JPG",
      size: "2.4 MB",
      bytes: 2_400_000,
      date: "2026-09-15",
      by: AZ,
    },
    {
      icon: "shield-tick",
      name: "bupa-insurance-card.png",
      title: { en: "Insurance card", ar: "بطاقة التأمين" },
      category: "insurance",
      ext: "PNG",
      size: "860 KB",
      bytes: 860_000,
      date: "2024-01-02",
      by: RA,
    },
    {
      icon: "note-2",
      name: "prescription-28-oct.pdf",
      title: { en: "Prescription · 28 Oct", ar: "وصفة · 28 أكتوبر" },
      category: "prescription",
      ext: "PDF",
      size: "96 KB",
      bytes: 96_000,
      date: "2026-10-28",
      by: AZ,
    },
    {
      icon: "document-text",
      name: "referral-letter-dental.pdf",
      title: { en: "Referral letter · Dental", ar: "خطاب تحويل · الأسنان" },
      category: "referral",
      ext: "PDF",
      size: "180 KB",
      bytes: 180_000,
      date: "2026-09-28",
      by: AZ,
    },
    {
      icon: "tick-square",
      name: "guardian-consent-form.pdf",
      title: { en: "Guardian consent form", ar: "إقرار ولي الأمر" },
      category: "consent",
      ext: "PDF",
      size: "240 KB",
      bytes: 240_000,
      date: "2024-01-02",
      by: RA,
    },
  ],
  activity: [
    {
      date: "2026-10-28",
      time: "10:41",
      initials: "AZ",
      by: AZ,
      kind: "edited",
      text: { en: "Weight: 50 → 52 kg", ar: "الوزن: 50 ← 52 كجم" },
    },
    {
      date: "2026-10-28",
      time: "10:38",
      initials: "AZ",
      by: AZ,
      kind: "added",
      text: {
        en: "Prescription: Budesonide inhaler",
        ar: "وصفة: بخاخ بوديسونيد",
      },
    },
    {
      date: "2026-10-28",
      time: "09:52",
      initials: "RA",
      by: RA,
      kind: "added",
      text: { en: "Insurance: Bupa · Class B", ar: "التأمين: بوبا · فئة B" },
    },
    {
      date: "2026-09-15",
      time: "08:30",
      initials: "RA",
      by: RA,
      kind: "edited",
      text: { en: "Visit cancelled by guardian", ar: "ولي الأمر ألغى الزيارة" },
    },
    {
      date: "2026-08-21",
      time: "13:05",
      initials: "HF",
      by: HF,
      kind: "added",
      text: {
        en: "Lab results: CBC, Vitamin D",
        ar: "نتائج تحاليل: CBC، فيتامين د",
      },
    },
    {
      date: "2026-06-14",
      time: "08:00",
      initials: "SY",
      by: SYS,
      kind: "flagged",
      text: {
        en: "Possible duplicate of MRN 004520",
        ar: "مكرر محتمل مع ملف 004520",
      },
    },
    {
      date: "2024-01-02",
      time: "11:20",
      initials: "RA",
      by: RA,
      kind: "added",
      text: {
        en: "Patient registered · Main branch",
        ar: "تسجيل المريض · الفرع الرئيسي",
      },
    },
  ],
  notes: [
    {
      title: { en: "Asthma follow-up", ar: "متابعة الربو" },
      by: AZ,
      date: "2026-10-28",
      body: {
        en: "Symptoms improved. Added budesonide 200 mcg twice daily. Review in 3 weeks with an ACT score.",
        ar: "الأعراض تحسنت. أضفنا بوديسونيد 200 ميكروغرام مرتين باليوم. نراجع بعد 3 أسابيع مع اختبار السيطرة على الربو.",
      },
    },
    {
      title: { en: "Nursing note", ar: "ملاحظة تمريض" },
      by: HF,
      date: "2026-08-21",
      body: {
        en: "Vitamin D low (18 ng/mL). Family informed and the supplement started.",
        ar: "فيتامين د منخفض (18 ng/mL). بلّغنا الأهل وبدأ المكمّل.",
      },
    },
  ],
  weight: [44, 44.5, 45, 45.5, 46, 46.5, 47.5, 48, 49, 50, 51, 52].map((kg, i) => ({ month: monthIso(i - 11), kg })),
  weightNote: { en: "healthy growth", ar: "نمو طبيعي" },
  appointments: [
    { date: "2026-11-18", kind: "booked", time: "10:30", clinic: PEDS, doctor: AZ, reason: { en: "Asthma follow-up", ar: "متابعة الربو" }, visitId: "v5" },
    { date: "2026-11-25", kind: "requested", time: "16:00", clinic: DENTAL, doctor: SO, reason: { en: "Check-up", ar: "كشف" } },
    { date: "2026-11-28", kind: "booked", time: "09:30", clinic: LAB, doctor: HF, reason: { en: "Vitamin D re-test", ar: "إعادة تحليل فيتامين د" } },
  ],
  billing: {
    since: "2024-01-02",
    services: [
      { label: { en: "Pediatrics visit", ar: "زيارة الأطفال" }, amount: 350 },
      {
        label: { en: "Dental · cleaning", ar: "الأسنان · تنظيف" },
        amount: 520,
      },
      {
        label: { en: "Lab · CBC, Vitamin D", ar: "التحاليل · CBC، فيتامين د" },
        amount: 280,
      },
    ],
    coverage: [
      { label: { en: "Insurance · Bupa", ar: "التأمين · بوبا" }, amount: -170 },
      {
        label: { en: "Paid · Mada, cash", ar: "مدفوع · مدى، كاش" },
        amount: -800,
      },
    ],
    balance: 180,
  },
}

/* ---------------------------------------------------------------- generic derivation */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}
function iso(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
/** First day of the month `offset` months from the current one (TODAY). */
function monthIso(offset: number) {
  const d = new Date(Date.UTC(Number(TODAY.slice(0, 4)), Number(TODAY.slice(5, 7)) - 1 + offset, 1))
  return iso(d)
}

const REASONS: Bi[] = [
  { en: "Consultation", ar: "استشارة" },
  { en: "Follow-up visit", ar: "زيارة متابعة" },
  { en: "Check-up", ar: "كشف" },
]
const METHODS: Bi[] = [
  { en: "Mada", ar: "مدى" },
  { en: "Cash", ar: "كاش" },
  { en: "Card", ar: "بطاقة" },
]

/** Typical weight for an age (rough growth curve) — only to draw the template's trend for sample patients. */
function baseWeight(age: number, gender: Patient["gender"], r: number) {
  const adult = gender === "female" ? 64 : 76
  const kg = age < 2 ? 9 + age * 3 : age < 13 ? 8 + age * 3 : age < 18 ? 40 + (age - 13) * (gender === "female" ? 3 : 5) : adult
  return Math.round((kg + (r - 0.5) * (age < 13 ? 4 : 14)) * 2) / 2
}

function derive(p: Patient, details: PatientDetails): Omit<PatientRecord, "details" | "missing"> {
  const rand = mulberry32(Number(p.mrn) * 31 + 11)
  // Visit history: the side sheet's latest visits first, then older ones down to the registration date.
  const visits: Visit[] = []
  const total = Math.max(p.visits, details.visitsList.length)
  let last = Date.parse(p.lastVisit)
  for (let i = 0; i < Math.min(total, 24); i++) {
    const src = details.visitsList[i]
    const date = src ? src.date : iso(new Date((last -= (25 + Math.floor(rand() * 40)) * 86400000)))
    if (src) last = Date.parse(src.date)
    if (date < p.registered) break
    const service = src?.service ??
      details.visitsList[i % Math.max(details.visitsList.length, 1)]?.service ?? {
        en: "Family medicine · Dr. Reem Alotaibi",
        ar: "طب الأسرة · د. ريم العتيبي",
      }
    const [clinicEn, doctorEn = ""] = service.en.split(" · ")
    const [clinicAr, doctorAr = ""] = service.ar.split(" · ")
    const cancelled = src ? src.status === "cancelled" : rand() < 0.08
    visits.push({
      id: `v${i}`,
      date,
      time: `${pad(8 + Math.floor(rand() * 9))}:${["00", "15", "30", "45"][Math.floor(rand() * 4)]}`,
      clinic: { en: clinicEn, ar: clinicAr },
      doctor: { en: doctorEn, ar: doctorAr },
      reason: REASONS[Math.floor(rand() * REASONS.length)],
      dx: null,
      status: cancelled ? "cancelled" : "completed",
      amount: cancelled ? 0 : src ? src.amount : 150 + Math.floor(rand() * 8) * 50,
    })
  }
  const insured = !!details.insurance
  const invoices: Invoice[] = visits.map((v, i) => {
    const ins = insured && v.status !== "cancelled" ? Math.round((v.amount * 0.4) / 10) * 10 : 0
    return {
      no: `INV-${String(20000 + ((Number(p.mrn) * 7 + i * 13) % 9000)).padStart(5, "0")}`,
      date: v.date,
      service: { en: `${v.clinic.en} visit`, ar: `زيارة ${v.clinic.ar}` },
      method: v.status === "cancelled" ? null : ins ? { en: "Insurance + Mada", ar: "تأمين + مدى" } : METHODS[i % METHODS.length],
      total: v.amount,
      insurance: ins,
      share: v.amount - ins,
      status: v.status === "cancelled" ? "void" : "paid",
    }
  })
  const billed = invoices.filter((i) => i.status !== "void")
  const byClinic = new Map<string, BillingLine>()
  for (const inv of billed) {
    const cur = byClinic.get(inv.service.en)
    if (cur) cur.amount += inv.total
    else byClinic.set(inv.service.en, { label: inv.service, amount: inv.total })
  }
  const insTotal = billed.reduce((s, i) => s + i.insurance, 0)
  const paidTotal = billed.reduce((s, i) => s + i.share, 0)
  const coverage: BillingLine[] = []
  if (insTotal)
    coverage.push({
      label: {
        en: `Insurance · ${details.insurance!.en.split(" · ")[0]}`,
        ar: `التأمين · ${details.insurance!.ar.split(" · ")[0]}`,
      },
      amount: -insTotal,
    })
  if (paidTotal) coverage.push({ label: { en: "Paid", ar: "مدفوع" }, amount: -paidTotal })

  // Weight: template trend for the last 12 months around a typical weight for the age.
  const w0 = baseWeight(p.age, p.gender, rand())
  const growing = p.age < 18
  // No completed visit yet (e.g. a file created today) → no measurements at all.
  const measured = visits.some((v) => v.status === "completed")
  const weight = Array.from({ length: measured ? 12 : 0 }, (_, i) => ({
    month: monthIso(i - 11),
    kg: Math.round((w0 - (growing ? (11 - i) * 0.4 : 0) + (growing ? 0 : Math.sin(i * 1.3 + rand()) * 0.8)) * 2) / 2,
  }))
  const recentVisits = visits
    .filter((v) => v.status === "completed")
    .slice(0, 5)
    .reverse()
  const history = recentVisits.map((v) => {
    const m = weight.find((w) => w.month.slice(0, 7) === v.date.slice(0, 7))
    return { date: v.date, kg: m?.kg ?? weight[0]?.kg ?? 0 }
  })

  const activity: ActivityItem[] = [
    ...visits.slice(0, 6).map<ActivityItem>((v) => ({
      date: v.date,
      time: v.time,
      initials: "RA",
      by: RA,
      kind: v.status === "cancelled" ? "edited" : "added",
      text:
        v.status === "cancelled"
          ? {
              en: `Visit cancelled · ${v.clinic.en}`,
              ar: `انلغت زيارة · ${v.clinic.ar}`,
            }
          : {
              en: `Visit: ${v.clinic.en} · ${v.doctor.en}`,
              ar: `زيارة: ${v.clinic.ar} · ${v.doctor.ar}`,
            },
    })),
    ...(p.duplicateOf
      ? [
          {
            date: p.lastVisit,
            time: "08:00",
            initials: "SY",
            by: SYS,
            kind: "flagged" as const,
            text: {
              en: `Possible duplicate of MRN ${p.duplicateOf}`,
              ar: `مكرر محتمل مع ملف ${p.duplicateOf}`,
            },
          },
        ]
      : []),
    {
      date: p.registered,
      time: "09:00",
      initials: "RA",
      by: RA,
      kind: "added" as const,
      text: { en: "Patient registered", ar: "تسجيل المريض" },
    },
  ].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))

  return {
    visits,
    invoices,
    allergies: [],
    diagnoses: [],
    medications: [],
    vitals: {
      weight: weight.at(-1)?.kg ?? null,
      height: null,
      bmi: null,
      spo2: null,
      history,
    },
    labs: null,
    files: [],
    activity,
    notes: [],
    weight,
    weightNote: null,
    appointments: [],
    billing: {
      since: p.registered,
      services: [...byClinic.values()],
      coverage,
      balance: 0,
    },
  }
}

const cache = new Map<string, PatientRecord>()

export function patientRecord(p: Patient): PatientRecord {
  const hit = cache.get(p.id)
  if (hit) return hit
  const details = patientDetails(p)
  const missing = [...missingOf(p)]
  if (!p.mobile && !missing.includes("phone")) missing.push("phone")
  const rec: PatientRecord = {
    details,
    missing,
    ...(p.id === FAHAD ? FAHAD_RECORD : derive(p, details)),
  }
  cache.set(p.id, rec)
  return rec
}

/* ---------------------------------------------------------------- summaries used across the page */

export function recordSummary(r: PatientRecord) {
  const done = r.visits.filter((v) => v.status === "completed").length
  const planned = r.visits.filter((v) => v.status !== "cancelled").length
  const billed = r.invoices.filter((i) => i.status !== "void")
  const total = billed.reduce((s, i) => s + i.total, 0)
  const insurance = billed.reduce((s, i) => s + i.insurance, 0)
  const due = r.billing.balance
  const paid = billed.reduce((s, i) => s + i.share, 0) - due
  const labsNormal = r.labs?.results.filter((x) => x.flag === "normal").length ?? 0
  return {
    visits: { done, planned },
    labs: { normal: labsNormal, total: r.labs?.results.length ?? 0 },
    money: { total, insurance, paid, due, payable: total - insurance },
    profile: { complete: 10 - r.missing.length, total: 10 },
    filesBytes: r.files.reduce((s, f) => s + f.bytes, 0),
  }
}

/* ---------------------------------------------------------------- payments collected this session */

const METHOD_BI: Record<Collection["method"], Bi> = { mada: { en: "Mada", ar: "مدى" }, cash: { en: "Cash", ar: "كاش" }, card: { en: "Card", ar: "بطاقة" } }

/** Record with the session's desk payments applied: invoices paid, balance down, "Paid" line up, activity entry. */
export function applyCollections(r: PatientRecord, cols: Collection[]): PatientRecord {
  if (!cols.length) return r
  const total = cols.reduce((s, c) => s + c.amount, 0)
  const invoices = r.invoices.map((inv) => {
    const got = cols.filter((c) => c.invoice === inv.no).reduce((s, c) => s + c.amount, 0)
    if (!got || inv.status !== "pending") return inv
    const method = cols.find((c) => c.invoice === inv.no)!.method
    return {
      ...inv,
      status: got >= Math.min(inv.share, r.billing.balance) ? ("paid" as const) : inv.status,
      method: inv.insurance ? { en: `Insurance + ${METHOD_BI[method].en}`, ar: `تأمين + ${METHOD_BI[method].ar}` } : METHOD_BI[method],
    }
  })
  const coverage = [...r.billing.coverage]
  const i = coverage.findIndex((l) => l.label.en.startsWith("Paid"))
  if (i >= 0) coverage[i] = { ...coverage[i], amount: coverage[i].amount - total }
  else coverage.push({ label: { en: "Paid", ar: "مدفوع" }, amount: -total })
  const activity: ActivityItem[] = cols
    .map((c) => ({
      date: TODAY,
      time: new Date(c.at).toTimeString().slice(0, 5),
      initials: "KM",
      by: { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" },
      kind: "added" as const,
      text: { en: `Payment received: SAR ${c.amount} · ${METHOD_BI[c.method].en} · ${c.receipt}`, ar: `استلام مبلغ: ${c.amount} ر.س · ${METHOD_BI[c.method].ar} · ${c.receipt}` },
    }))
    .reverse()
  return { ...r, invoices, activity: [...activity, ...r.activity], billing: { ...r.billing, coverage, balance: Math.max(0, r.billing.balance - total) } }
}

/* ---------------------------------------------------------------- overlay changes (notes, visits, meds, files) */

export function applyChanges(r: PatientRecord, ch: PatientChanges): PatientRecord {
  if (!ch.notes.length && !ch.visits.length && !Object.keys(ch.visitEdits).length && !Object.keys(ch.apptEdits).length && !ch.meds.length && !ch.files.length && !ch.activity.length)
    return r
  const visits = [...ch.visits, ...r.visits].map((v) => ({ ...v, ...ch.visitEdits[v.id] })).sort((a, b) => b.date.localeCompare(a.date))
  const appointments: Appointment[] = [
    ...r.appointments.flatMap((a) => {
      const e = ch.apptEdits[a.date]
      return e?.cancelled ? [] : [{ ...a, date: e?.date ?? a.date, time: e?.time ?? a.time }]
    }),
    ...ch.visits
      .map((v) => ({ ...v, ...ch.visitEdits[v.id] }))
      .filter((v) => v.status === "upcoming")
      .map((v) => ({ date: v.date, kind: "booked" as const, time: v.time, clinic: v.clinic, doctor: v.doctor, reason: v.reason, visitId: v.id })),
  ]
  return {
    ...r,
    visits,
    appointments,
    notes: [...ch.notes, ...r.notes],
    medications: [...ch.meds, ...r.medications],
    files: [...ch.files, ...r.files],
    activity: [...ch.activity, ...r.activity],
  }
}
