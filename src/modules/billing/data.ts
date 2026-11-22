import type { Bi } from "@/lib/mock/bi"

const bi = (en: string, ar: string): Bi => ({ en, ar })

/*
 * Billing & contracts data (design v5.0, CODE_CHAT_BILLING.md §4). Sample records come from the Billing frames and the
 * "Billing widgets · components" sets. The module shares only core entities: patients (MRN / Patients ids), doctors
 * (Doctors keys) and lab orders (Labs order numbers). Everything else (invoices, payments, claims, insurers, documents,
 * contracts) lives here.
 *
 * Money is SAR as numbers (2 decimals). Times are local Riyadh wall-clock ISO strings without a zone.
 * Lists show the design's rows; the totals the design prints (214 invoices, 64 contracts, …) come from the
 * OTHER_* aggregates so counts and KPIs stay consistent while the rows change in the session.
 */

/* ------------------------------------------------------------------ clock */

/**
 * The demo clock. Sunday 22 Nov 2026: MedGulf's agreement (31 Dec 2026) "ends in 39 days", claims "updated 11:40",
 * the Overview compares "vs last Sunday".
 */
export const BILL_TODAY = "2026-11-22"
export const BILL_NOW = `${BILL_TODAY}T11:40`

/** Whole days from a to b (ISO dates or date-times). */
export function daysBetween(a: string, b: string = BILL_TODAY) {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((d(b) - d(a)) / 86_400_000)
}

/* ------------------------------------------------------------------ the center */

/** The tax-invoice and contract letterhead (seller details reported to ZATCA). */
export const CENTER = {
  name: bi("Al Noor Medical Center", "مجمع النور الطبي"),
  short: bi("Al Noor", "النور"),
  vatNo: "300512456700003",
  cr: "1010567890",
  city: bi("Riyadh", "الرياض"),
  billingEmail: "billing@alnoor.sa",
  hrEmail: "hr@alnoor.sa",
  verifyUrl: "alnoor.sa/verify",
  refundDays: 14,
}

/* ------------------------------------------------------------------ VAT */

/**
 * VAT rules (ZATCA). 15% standard; exemptions / zero-rating are the finance team's configuration, never hard-coded
 * in screens: each invoice line stores the rate it was issued with, so changing the rules never edits an issued invoice.
 */
export type VatRule = { key: string; label: Bi; rate: number }
export const VAT_STANDARD = 0.15
export const VAT_RULES: VatRule[] = [
  { key: "standard", label: bi("Standard 15%", "قياسية 15%"), rate: VAT_STANDARD },
  { key: "citizen", label: bi("Saudi citizen · borne by the state", "مواطن سعودي · تتحملها الدولة"), rate: 0 },
  { key: "zero", label: bi("Zero-rated", "نسبة صفرية"), rate: 0 },
]
export const vatRuleOf = (key: string) => VAT_RULES.find((r) => r.key === key) ?? VAT_RULES[0]

/* ------------------------------------------------------------------ insurers */

export type InsurerStatus = "active" | "ending" | "awaitingSignature" | "ended"
export type InsurerClass = "VIP" | "A" | "B" | "C"

export type DocKind = "agreement" | "priceList" | "networkLetter" | "cchiCertificate" | "bankForm" | "licence" | "offerLetter" | "accreditation" | "other"
export type DocStatus = "valid" | "renew" | "expired" | "checking"

/** A kept paper (agreement, annex, certificate, licence …). Kept for the life of the agreement / contract with versions. */
export type BillDocument = {
  id: string
  kind: DocKind
  title: Bi
  file: string
  format: "PDF" | "XLSX" | "DOCX"
  pages?: number
  /** Extra fact after the format: "1,842 services", "IBAN ends 4471", "1.2 MB" … */
  detail?: Bi
  validTo?: string
  /** Stored status (uploads wait for a manager); "renew" also derives from validTo. */
  status: DocStatus
  uploadedBy?: string
  uploadedAt?: string
  signedVia?: { method: "nafath"; at: string }
  version: number
}

export type Contact = { role: Bi; name?: Bi; phone?: string; email?: string }

export type Insurer = {
  id: string
  initials: string
  name: Bi
  /** Short name in sentences ("Bupa pays · 80%", "Sent to Bupa through NPHIES"). */
  short: Bi
  agreementNo: string
  /** The provider agreement (Contracts) behind this partner. */
  contractNo?: string
  /** Stored state; "ending" / "ended" derive from validTo (insurerStatus). */
  signed: boolean
  validFrom?: string
  validTo?: string
  discountPct: number
  copay: { pct: number; capPerVisit?: number; classes: InsurerClass[] }
  /** Pre-authorization rule: amount threshold and/or service kinds. */
  preauthRule: { above?: number; imaging?: boolean }
  claimDeadlineDays: number
  paymentDays: number
  noticeDays: number
  classes: InsurerClass[]
  allBranches: boolean
  documents: BillDocument[]
  contacts: Contact[]
  /** Headline figures the design prints (claims system totals beyond the sample claims). */
  stats: {
    owed: number
    owedOverdueClaims: number
    claimsThisMonth: number
    claimsThisMonthAmount: number
    approvedPct?: number
    targetPct?: number
    paysInDays?: number
    /** Last 6 months (Jun → Nov), SAR thousands. */
    months: number[]
    split: { approved: number; part: number; rejected: number }
  }
  /** "Who paid this month" share (Overview), percent. */
  paidShare: number
  /** NPHIES payer id (stub). */
  nphiesId: string
}

const months = (a: number[]) => a

export const INSURERS: Insurer[] = [
  {
    id: "bupa",
    initials: "BU",
    name: bi("Bupa Arabia", "بوبا العربية"),
    short: bi("Bupa", "بوبا"),
    agreementNo: "BUP-2024-118",
    signed: true,
    validFrom: "2025-01-01",
    validTo: "2027-12-31",
    discountPct: 15,
    copay: { pct: 20, capPerVisit: 75, classes: ["B", "C"] },
    preauthRule: { above: 1000, imaging: true },
    claimDeadlineDays: 30,
    paymentDays: 45,
    noticeDays: 90,
    classes: ["VIP", "A", "B", "C"],
    allBranches: true,
    documents: [
      { id: "bupa-agr", kind: "agreement", title: bi("Signed provider agreement", "اتفاقية مقدم الخدمة الموقعة"), file: "BUP-2024-118.pdf", format: "PDF", pages: 24, status: "valid", signedVia: { method: "nafath", at: "2024-12-12" }, version: 1 },
      { id: "bupa-price", kind: "priceList", title: bi("Price list annex 2026", "ملحق قائمة الأسعار 2026"), file: "Bupa-price-list-2026.xlsx", format: "XLSX", detail: bi("1,842 services", "1,842 خدمة"), validTo: "2026-12-31", status: "valid", version: 3 },
      { id: "bupa-net", kind: "networkLetter", title: bi("Network inclusion letter", "خطاب الانضمام للشبكة"), file: "Bupa-network-letter.pdf", format: "PDF", pages: 2, status: "valid", version: 1 },
      { id: "bupa-cchi", kind: "cchiCertificate", title: bi("CCHI accreditation certificate", "شهادة اعتماد مجلس الضمان الصحي"), file: "CCHI-certificate.pdf", format: "PDF", validTo: "2027-06-30", status: "valid", version: 2 },
      { id: "bupa-bank", kind: "bankForm", title: bi("Bank details form", "نموذج بيانات البنك"), file: "Bupa-bank-form.pdf", format: "PDF", detail: bi("IBAN ends 4471", "الآيبان ينتهي بـ 4471"), status: "valid", version: 1 },
    ],
    contacts: [
      { role: bi("Provider relations", "علاقات مقدمي الخدمة"), name: bi("Nawaf Al-Harbi", "نواف الحربي"), phone: "+966 11 455 0120" },
      { role: bi("Claims desk", "قسم المطالبات"), email: "claims.providers@bupa.example" },
      { role: bi("Pre-authorization · 24/7", "الموافقات المسبقة · 24 ساعة"), phone: "800 244 0307" },
    ],
    stats: {
      owed: 84200,
      owedOverdueClaims: 18,
      claimsThisMonth: 412,
      claimsThisMonthAmount: 288400,
      approvedPct: 96,
      targetPct: 95,
      paysInDays: 38,
      months: months([214, 236, 228, 262, 251, 288]),
      split: { approved: 96, part: 3, rejected: 1 },
    },
    paidShare: 27,
    nphiesId: "NPHIES-INS-7001",
  },
  {
    id: "tawuniya",
    initials: "TW",
    name: bi("Tawuniya", "التعاونية"),
    short: bi("Tawuniya", "التعاونية"),
    agreementNo: "TAW-2023-342",
    signed: true,
    validFrom: "2023-07-01",
    validTo: "2027-06-30",
    discountPct: 12,
    copay: { pct: 10, classes: ["A", "B", "C"] },
    preauthRule: { above: 1500, imaging: true },
    claimDeadlineDays: 30,
    paymentDays: 60,
    noticeDays: 90,
    classes: ["VIP", "A", "B", "C"],
    allBranches: true,
    documents: [],
    contacts: [],
    stats: { owed: 41600, owedOverdueClaims: 0, claimsThisMonth: 0, claimsThisMonthAmount: 0, approvedPct: 93, months: months([0, 0, 0, 0, 0, 0]), split: { approved: 93, part: 0, rejected: 0 } },
    paidShare: 16,
    nphiesId: "NPHIES-INS-7002",
  },
  {
    id: "medgulf",
    initials: "MG",
    name: bi("MedGulf", "ميدغلف"),
    short: bi("MedGulf", "ميدغلف"),
    agreementNo: "MDG-2022-077",
    contractNo: "CTR-25-118",
    signed: true,
    validFrom: "2025-01-01",
    validTo: "2026-12-31",
    discountPct: 10,
    copay: { pct: 10, classes: ["A", "B", "C"] },
    preauthRule: { above: 1000, imaging: true },
    claimDeadlineDays: 30,
    paymentDays: 60,
    noticeDays: 60,
    classes: ["A", "B", "C"],
    allBranches: true,
    documents: [],
    contacts: [],
    stats: { owed: 22950, owedOverdueClaims: 0, claimsThisMonth: 0, claimsThisMonthAmount: 0, approvedPct: 88, months: months([0, 0, 0, 0, 0, 0]), split: { approved: 88, part: 0, rejected: 0 } },
    paidShare: 9,
    nphiesId: "NPHIES-INS-7003",
  },
  {
    id: "alrajhi",
    initials: "RT",
    name: bi("Al Rajhi Takaful", "تكافل الراجحي"),
    short: bi("Al Rajhi", "الراجحي"),
    agreementNo: "ART-2025-019",
    signed: true,
    validFrom: "2025-04-01",
    validTo: "2027-03-31",
    discountPct: 12,
    copay: { pct: 10, classes: ["A", "B", "C"] },
    preauthRule: { above: 1000, imaging: true },
    claimDeadlineDays: 30,
    paymentDays: 45,
    noticeDays: 60,
    classes: ["A", "B", "C"],
    allBranches: true,
    documents: [],
    contacts: [],
    stats: { owed: 13400, owedOverdueClaims: 0, claimsThisMonth: 0, claimsThisMonthAmount: 0, approvedPct: 91, months: months([0, 0, 0, 0, 0, 0]), split: { approved: 91, part: 0, rejected: 0 } },
    paidShare: 6,
    nphiesId: "NPHIES-INS-7004",
  },
  {
    id: "malath",
    initials: "ML",
    name: bi("Malath", "ملاذ"),
    short: bi("Malath", "ملاذ"),
    agreementNo: "MLT-2026-004",
    contractNo: "CTR-26-029",
    signed: false,
    validFrom: "2027-01-01",
    validTo: "2028-12-31",
    discountPct: 10,
    copay: { pct: 10, classes: ["A", "B", "C"] },
    preauthRule: { above: 1000, imaging: true },
    claimDeadlineDays: 30,
    paymentDays: 45,
    noticeDays: 60,
    classes: ["A", "B", "C"],
    allBranches: true,
    documents: [],
    contacts: [],
    stats: { owed: 0, owedOverdueClaims: 0, claimsThisMonth: 0, claimsThisMonthAmount: 0, months: months([0, 0, 0, 0, 0, 0]), split: { approved: 0, part: 0, rejected: 0 } },
    paidShare: 0,
    nphiesId: "NPHIES-INS-7005",
  },
]

export const insurerOf = (id: string) => INSURERS.find((i) => i.id === id)

/** "Ending" shows from 60 days before validTo (brief §4). */
export const ENDING_DAYS = 60

/* ------------------------------------------------------------------ patients (core entity refs) */

export type BillPatient = {
  initials: string
  name: Bi
  mrn: string
  /** Patients module id, when the design's patient exists there. */
  patientId?: string
  /** SMS receipts go here (guardian for children). */
  mobile?: string
  mobileOwner?: Bi
  /** Receipts / invoices go to the guardian (children). */
  guardian?: boolean
}

const pt = (initials: string, en: string, ar: string, mrn: string, extra: Partial<BillPatient> = {}): BillPatient => ({ initials, name: bi(en, ar), mrn, ...extra })

export const PATIENTS = {
  shammari: pt("AS", "Abdullah Al-Shammari", "عبدالله الشمري", "MRN-15530", { mobile: "+966 55 218 4410", mobileOwner: bi("father", "الأب"), guardian: true }),
  haddad: pt("LH", "Lina Haddad", "لينا حداد", "MRN-19022", { patientId: "004857", mobile: "+966 50 771 2045" }),
  harbi: pt("OH", "Omar Al-Harbi", "عمر الحربي", "MRN-22310", { mobile: "+966 54 120 9931", mobileOwner: bi("mother", "الأم"), guardian: true }),
  ahmed: pt("SA", "Sara Ahmed", "سارة أحمد", "MRN-23118", { patientId: "004812", mobile: "+966 53 640 1187" }),
  qahtani: pt("MQ", "Mona Al-Qahtani", "منى القحطاني", "MRN-14402", { mobile: "+966 56 902 3318" }),
  dosari: pt("FD", "Fahad Al-Dosari", "فهد الدوسري", "MRN-17654", { patientId: "004891", mobile: "+966 55 404 7712", mobileOwner: bi("father", "الأب"), guardian: true }),
  mutairi: pt("RM", "Reem Al-Mutairi", "ريم المطيري", "MRN-23001", { mobile: "+966 50 318 6604", mobileOwner: bi("mother", "الأم"), guardian: true }),
  amri: pt("YA", "Yousef Al-Amri", "يوسف العمري", "MRN-20418", { mobile: "+966 59 233 0871", mobileOwner: bi("father", "الأب"), guardian: true }),
  subaie: pt("KS", "Khalid Al-Subaie", "خالد السبيعي", "MRN-18840", { mobile: "+966 50 552 1490" }),
} satisfies Record<string, BillPatient>

export type PatientKey = keyof typeof PATIENTS

/** Staff who act in Billing (payments, drafting). */
export const STAFF = {
  nora: { name: bi("Nora Al-Fahad", "نورة الفهد"), role: bi("HR", "الموارد البشرية") },
  faisal: { name: bi("Faisal Al-Qahtani", "فيصل القحطاني"), role: bi("CEO", "الرئيس التنفيذي") },
} as const
export type StaffKey = keyof typeof STAFF

/* ------------------------------------------------------------------ invoices */

export type InvoiceStatus = "unpaid" | "part" | "paid" | "refunded"
export type PayMethod = "cash" | "mada" | "card" | "applepay" | "transfer"
export type ZatcaStatus = "pending" | "reported" | "cleared" | "failed"

export type InvoiceLine = {
  serviceCode: string
  item: Bi
  qty: number
  /** Unit price before VAT. */
  price: number
  /** The rate the line was issued with (from VAT_RULES). */
  vatRate: number
  vatRule: string
  /** Where the line came from: the visit's consultation, a lab order, a procedure. */
  source?: { kind: "consult" | "lab" | "procedure"; ref?: string }
}

export type Payment = {
  invoiceNo: string
  amount: number
  method: PayMethod
  terminal?: string
  approvalCode?: string
  by: string
  byName: Bi
  at: string
  smsReceipt?: boolean
}

export type ZatcaRecord = {
  uuid: string
  hash: string
  /** TLV base64 QR payload (seller, VAT no., time, total, VAT). */
  qr: string
  reportedAt?: string
  status: ZatcaStatus
  /** simplified (B2C, reported) or standard (B2B / insurer, cleared). */
  type: "simplified" | "standard"
}

/**
 * Invoice history. The design's events carry their text; events recorded in the session carry their facts
 * (amount, method, who) and are worded in the reader's language.
 */
export type InvoiceEvent = {
  at: string
  kind: "paid" | "issued" | "claimSent" | "sent" | "refunded"
  text?: Bi
  paid?: { amount: number; method: PayMethod; byName: Bi }
  sent?: { to: "guardian" | "patient" }
}

export type Invoice = {
  no: string
  issuedAt: string
  patient: PatientKey
  visitId: string
  visitAt: string
  clinic: Bi
  doctor: string
  /** "cash" or an insurer id. */
  payer: "cash" | string
  class?: InsurerClass
  lines: InvoiceLine[]
  /** Insurer share percent applied at issue (from the agreement's co-pay). */
  insurerPct: number
  payments: Payment[]
  zatca: ZatcaRecord
  claimNo?: string
  /** Credit note that refunded it (refund flow is a known gap). */
  creditNote?: string
  /** A refunded invoice keeps its numbers; the refund is a credit note. */
  refunded?: boolean
  events: InvoiceEvent[]
}

const line = (serviceCode: string, en: string, ar: string, price: number, vatRule = "standard", source?: InvoiceLine["source"]): InvoiceLine => ({
  serviceCode,
  item: bi(en, ar),
  qty: 1,
  price,
  vatRate: vatRuleOf(vatRule).rate,
  vatRule,
  source,
})

const zatca = (uuid: string, at: string, type: ZatcaRecord["type"] = "standard"): ZatcaRecord => ({
  uuid,
  hash: `sha256:${uuid.replace(/-/g, "").slice(0, 16)}`,
  qr: `AQ1BbCBOb29yIE1lZGljYWwgQ2VudGVyAg8zMDA1MTI0NTY3MDAwMDM=${uuid.slice(0, 8)}`,
  reportedAt: at,
  status: type === "standard" ? "cleared" : "reported",
  type,
})

const pay = (invoiceNo: string, amount: number, method: PayMethod, at: string, extra: Partial<Payment> = {}): Payment => ({
  invoiceNo,
  amount,
  method,
  at,
  by: "nora",
  byName: STAFF.nora.name,
  ...extra,
})

const PEDS = bi("Pediatrics", "الأطفال")
const GP = bi("General practice", "الطب العام")
const DERM = bi("Dermatology", "الجلدية")
const IM = bi("Internal medicine", "الباطنة")

export const INVOICES: Invoice[] = [
  {
    no: "INV-2611-0241",
    issuedAt: "2026-11-19T10:58",
    patient: "shammari",
    visitId: "V-2611-1042",
    visitAt: "2026-11-19T09:40",
    clinic: PEDS,
    doctor: "zaki",
    payer: "bupa",
    class: "B",
    lines: [
      line("CONS-PED", "Consultation · Pediatrics", "كشفية · الأطفال", 300, "standard", { kind: "consult" }),
      line("LAB-HBA1C", "HbA1c", "HbA1c", 90, "standard", { kind: "lab", ref: "LAB-0142" }),
      line("LAB-KFT", "Kidney function", "وظائف الكلى", 95, "standard", { kind: "lab", ref: "LAB-0142" }),
      line("LAB-LYTES", "Electrolytes", "الأملاح", 80, "standard", { kind: "lab", ref: "LAB-0142" }),
      line("LAB-LIPID", "Lipid panel", "الدهون", 120, "standard", { kind: "lab", ref: "LAB-0142" }),
      line("LAB-UA", "Urinalysis", "تحليل البول", 40, "standard", { kind: "lab", ref: "LAB-0142" }),
    ],
    insurerPct: 80,
    payments: [pay("INV-2611-0241", 100, "cash", "2026-11-19T10:30")],
    zatca: { ...zatca("8f3c41d2-7b0e-4c55-9a1e-2f6d0b7ea21e", "2026-11-19T10:58"), status: "reported" },
    claimNo: "CLM-26-01842",
    events: [
      { at: "2026-11-19T10:30", kind: "paid", text: bi("SAR 100 paid in cash · Nora Al-Fahad", "انتدفع 100 ر.س كاش · نورة الفهد") },
      { at: "2026-11-19T10:58", kind: "issued", text: bi("Invoice issued and reported to ZATCA", "صدرت الفاتورة وانرفعت للهيئة") },
      { at: "2026-11-19T11:20", kind: "claimSent", text: bi("Claim sent to Bupa", "انرسلت المطالبة لبوبا") },
      { at: "2026-11-19T11:21", kind: "sent", text: bi("Invoice sent to the guardian by SMS", "انرسلت الفاتورة لولي الأمر برسالة") },
    ],
  },
  {
    no: "INV-2611-0240",
    issuedAt: "2026-11-19T10:12",
    patient: "haddad",
    visitId: "V-2611-1038",
    visitAt: "2026-11-19T09:20",
    clinic: GP,
    doctor: "odeh",
    payer: "tawuniya",
    class: "A",
    lines: [line("CONS-GP", "Consultation · General practice", "كشفية · الطب العام", 250, "citizen", { kind: "consult" }), line("LAB-CBC", "Complete blood count", "صورة الدم الكاملة", 90, "citizen", { kind: "lab" }), line("LAB-TSH", "TSH", "TSH", 80, "citizen", { kind: "lab" })],
    insurerPct: 90,
    payments: [pay("INV-2611-0240", 42, "mada", "2026-11-19T10:14", { terminal: "POS-2", approvalCode: "551203" })],
    zatca: zatca("1b7e9c20-3d41-4f8a-8c2b-6e0f1a9d4c40", "2026-11-19T10:12"),
    claimNo: "CLM-26-01841",
    events: [],
  },
  {
    no: "INV-2611-0239",
    issuedAt: "2026-11-19T09:47",
    patient: "harbi",
    visitId: "V-2611-1031",
    visitAt: "2026-11-19T09:00",
    clinic: PEDS,
    doctor: "zaki",
    payer: "cash",
    lines: [line("CONS-PED", "Consultation · Pediatrics", "كشفية · الأطفال", 200, "standard", { kind: "consult" }), line("LAB-CBC", "Complete blood count", "صورة الدم الكاملة", 70, "standard", { kind: "lab" })],
    insurerPct: 0,
    payments: [],
    zatca: zatca("c4a0d1e8-92f3-4b6d-a7c1-5e2b8f3d0239", "2026-11-19T09:47", "simplified"),
    events: [],
  },
  {
    no: "INV-2611-0238",
    issuedAt: "2026-11-18T16:20",
    patient: "ahmed",
    visitId: "V-2611-0990",
    visitAt: "2026-11-18T15:30",
    clinic: DERM,
    doctor: "otaibi",
    payer: "medgulf",
    class: "B",
    lines: [line("CONS-DERM", "Consultation · Dermatology", "كشفية · الجلدية", 300, "standard", { kind: "consult" }), line("PROC-CRYO", "Cryotherapy", "علاج بالتبريد", 200, "standard", { kind: "procedure" })],
    insurerPct: 90,
    payments: [pay("INV-2611-0238", 57.5, "card", "2026-11-18T16:22", { terminal: "POS-1", approvalCode: "309114" })],
    zatca: zatca("e7f21c09-6a4d-4e3b-91c8-0d5a2b6f0238", "2026-11-18T16:20"),
    claimNo: "CLM-26-01839",
    events: [],
  },
  {
    no: "INV-2611-0237",
    issuedAt: "2026-11-18T12:05",
    patient: "qahtani",
    visitId: "V-2611-0961",
    visitAt: "2026-11-18T11:30",
    clinic: IM,
    doctor: "mansour",
    payer: "cash",
    lines: [line("CONS-IM", "Consultation · Internal medicine", "كشفية · الباطنة", 240, "citizen", { kind: "consult" })],
    insurerPct: 0,
    payments: [pay("INV-2611-0237", 240, "cash", "2026-11-18T12:06")],
    zatca: zatca("5d9b3e7a-0c18-4f62-b4a9-7e1d2c3f0237", "2026-11-18T12:05", "simplified"),
    refunded: true,
    creditNote: "CN-2611-0012",
    events: [],
  },
  {
    no: "INV-2611-0236",
    issuedAt: "2026-11-18T10:40",
    patient: "dosari",
    visitId: "V-2611-0948",
    visitAt: "2026-11-18T09:10",
    clinic: PEDS,
    doctor: "zaki",
    payer: "bupa",
    class: "B",
    lines: [line("LAB-IGE", "Allergy panel (IgE)", "لوحة الحساسية (IgE)", 1000, "standard", { kind: "lab" })],
    insurerPct: 80,
    payments: [pay("INV-2611-0236", 230, "mada", "2026-11-18T10:42", { terminal: "POS-2", approvalCode: "118270" })],
    zatca: zatca("a3c5e1f0-7d2b-4c98-8e61-9b0f4d2a0236", "2026-11-18T10:40"),
    claimNo: "CLM-26-01836",
    events: [],
  },
  {
    no: "INV-2611-0235",
    issuedAt: "2026-11-17T13:15",
    patient: "mutairi",
    visitId: "V-2611-0902",
    visitAt: "2026-11-17T12:30",
    clinic: PEDS,
    doctor: "saud",
    payer: "alrajhi",
    class: "A",
    lines: [line("CONS-PED", "Consultation · Pediatrics", "كشفية · الأطفال", 300, "standard", { kind: "consult" }), line("PROC-NEB", "Nebulizer session", "جلسة بخار", 300, "standard", { kind: "procedure" })],
    insurerPct: 90,
    payments: [],
    zatca: zatca("f0b8d2c6-4e1a-4a7f-b3d5-2c9e6a1f0235", "2026-11-17T13:15"),
    claimNo: "CLM-26-01835",
    events: [],
  },
  {
    no: "INV-2611-0234",
    issuedAt: "2026-11-17T11:02",
    patient: "amri",
    visitId: "V-2611-0889",
    visitAt: "2026-11-17T10:30",
    clinic: GP,
    doctor: "odeh",
    payer: "cash",
    lines: [line("CONS-GP", "Consultation · General practice", "كشفية · الطب العام", 160, "citizen", { kind: "consult" })],
    insurerPct: 0,
    payments: [pay("INV-2611-0234", 160, "applepay", "2026-11-17T11:03", { terminal: "POS-1", approvalCode: "772415" })],
    zatca: zatca("2e6f9a1b-8c3d-4b70-a5e2-1d4c7b9e0234", "2026-11-17T11:02", "simplified"),
    events: [],
  },
]

/** Invoices beyond the design's rows (November: 214 in all). */
export const OTHER_INVOICES: Record<InvoiceStatus, number> = { unpaid: 7, part: 3, paid: 195, refunded: 1 }
/** Patient balances on those other unpaid invoices (KPI "Unpaid by patients" SAR 6,420; 3 over 30 days). */
export const OTHER_UNPAID = { balance: 6040.5, over30: 3 }
/** Collected today (cash + cards + insurers' remittances) before this session's payments; last Sunday for the trend. */
export const COLLECTED = { today: 24860, lastSunday: 22196 }

/** Payment terminals at the center. */
export const TERMINALS = [
  { key: "POS-2", label: bi("POS-2 · reception", "POS-2 · الاستقبال") },
  { key: "POS-1", label: bi("POS-1 · pharmacy", "POS-1 · الصيدلية") },
  { key: "POS-3", label: bi("POS-3 · lab", "POS-3 · المختبر") },
]

/* ------------------------------------------------------------------ claims */

export type ClaimStatus = "ready" | "review" | "approved" | "part" | "rejected" | "needsPreauth"

export type Attachment = { name: string; format: "PDF" | "JPG" | "PNG"; size: string }

export type Claim = {
  no: string
  createdAt: string
  invoiceNo: string
  patient: PatientKey
  insurer: string
  amount: number
  status: ClaimStatus
  /** The service the insurer's answer is about. */
  service: Bi
  visitAt: string
  doctor: string
  reasonCode?: string
  reasonText?: Bi
  preauthNo?: string
  submittedAt?: string
  answeredAt?: string
  paidAt?: string
  approvedAmount?: number
  attachments: Attachment[]
  note?: string
  /** NPHIES bundle / request id (stub). */
  nphiesId?: string
}

export const CLAIMS: Claim[] = [
  {
    no: "CLM-26-01836",
    createdAt: "2026-11-18T10:41",
    invoiceNo: "INV-2611-0236",
    patient: "dosari",
    insurer: "bupa",
    amount: 920,
    status: "rejected",
    service: bi("Allergy panel (IgE)", "لوحة الحساسية (IgE)"),
    visitAt: "2026-11-18T09:10",
    doctor: "zaki",
    reasonCode: "BE-1-4",
    reasonText: bi("Pre-authorization missing", "ما فيه موافقة مسبقة"),
    submittedAt: "2026-11-18T11:00",
    answeredAt: "2026-11-19T08:30",
    attachments: [],
    nphiesId: "nph-bundle-58120",
  },
  {
    no: "CLM-26-01842",
    createdAt: "2026-11-19T11:20",
    invoiceNo: "INV-2611-0241",
    patient: "shammari",
    insurer: "bupa",
    amount: 667,
    status: "review",
    service: bi("Consultation and lab tests", "كشفية وتحاليل"),
    visitAt: "2026-11-19T09:40",
    doctor: "zaki",
    submittedAt: "2026-11-19T11:20",
    attachments: [],
    nphiesId: "nph-bundle-58177",
  },
  {
    no: "CLM-26-01841",
    createdAt: "2026-11-19T10:13",
    invoiceNo: "INV-2611-0240",
    patient: "haddad",
    insurer: "tawuniya",
    amount: 378,
    status: "approved",
    service: bi("Consultation and lab tests", "كشفية وتحاليل"),
    visitAt: "2026-11-19T09:20",
    doctor: "odeh",
    submittedAt: "2026-11-19T11:20",
    answeredAt: "2026-11-20T09:00",
    paidAt: "2026-11-21",
    approvedAmount: 378,
    attachments: [],
    nphiesId: "nph-bundle-58176",
  },
  {
    no: "CLM-26-01839",
    createdAt: "2026-11-18T16:21",
    invoiceNo: "INV-2611-0238",
    patient: "ahmed",
    insurer: "medgulf",
    amount: 517.5,
    status: "part",
    service: bi("Consultation and cryotherapy", "كشفية وعلاج بالتبريد"),
    visitAt: "2026-11-18T15:30",
    doctor: "otaibi",
    submittedAt: "2026-11-18T17:00",
    answeredAt: "2026-11-20T10:15",
    approvedAmount: 460,
    reasonCode: "CV-2-1",
    reasonText: bi("Cryotherapy priced above the agreement", "التبريد أغلى من سعر الاتفاقية"),
    attachments: [],
    nphiesId: "nph-bundle-58141",
  },
  {
    no: "CLM-26-01835",
    createdAt: "2026-11-17T13:16",
    invoiceNo: "INV-2611-0235",
    patient: "mutairi",
    insurer: "alrajhi",
    amount: 621,
    status: "ready",
    service: bi("Consultation and nebulizer", "كشفية وجلسة بخار"),
    visitAt: "2026-11-17T12:30",
    doctor: "saud",
    attachments: [],
  },
  {
    no: "CLM-26-01833",
    createdAt: "2026-11-17T09:31",
    invoiceNo: "INV-2611-0231",
    patient: "subaie",
    insurer: "bupa",
    amount: 1480,
    status: "needsPreauth",
    service: bi("MRI knee", "رنين مغناطيسي للركبة"),
    visitAt: "2026-11-17T08:40",
    doctor: "mansour",
    attachments: [],
  },
]

/**
 * Claims beyond the design's rows (November). Ready claims per insurer make the Submit batch add up:
 * Bupa 7 · SAR 10,950, Tawuniya 3 · SAR 4,860, Al Rajhi 2 · SAR 2,610 (one of them is CLM-26-01835).
 */
export const OTHER_CLAIMS = {
  ready: [
    { insurer: "bupa", count: 7, amount: 10950 },
    { insurer: "tawuniya", count: 3, amount: 4860 },
    { insurer: "alrajhi", count: 1, amount: 1989 },
  ],
  review: { count: 30, amount: 46233 },
  rejected: 6,
  needsPreauth: 0,
  approved: 120,
  part: 4,
  /** Paid this month, SAR, from 5 insurers. */
  paidAmount: 211922,
  answerDays: 2.1,
  rejectedPct: 3.2,
}

/** NPHIES rejection codes the center sees most (Fix claim shows the insurer's code + text). */
export const REJECTION_CODES: Record<string, Bi> = {
  "BE-1-4": bi("pre-authorization needed for the allergy panel", "تحتاج موافقة مسبقة للوحة الحساسية"),
  "CV-2-1": bi("price above the agreement", "السعر فوق الاتفاقية"),
}

/* ------------------------------------------------------------------ contracts */

export type ContractKind = "staff" | "partner" | "insurer"
export type ContractStatus = "draft" | "awaitingYou" | "awaitingThem" | "signed" | "ending" | "ended"
export type SignerStatus = "waiting" | "signed"

export type Signer = {
  order: number
  initials: string
  name: Bi
  role: Bi
  /** Arabic verb agreement ("وقّعت" / "وقّع"). */
  female?: boolean
  /** "center" = signs for Al Noor (only the authorized signatory); "party" = the other side. */
  side: "center" | "party"
  /** The signatory key when side is "center" (signing permission). */
  signatory?: StaffKey
  mobile: string
  /** Stored in full, shown masked to its last 3 digits. */
  nationalId: string
  status: SignerStatus
  signedAt?: string
  method: "nafath"
  /** Nafath transaction id and the signed PDF hash (stored per signature). */
  nafathTxn?: string
  pdfHash?: string
}

export type Clause = { key: string; title: Bi; text: Bi }

export type ContractEvent = { at: string; text: Bi }

export type Party = {
  kind: "employee" | "company"
  initials: string
  name: Bi
  /** List subtitle: job title or what the company does. */
  role: Bi
  /** Company CR, or the employee's national ID (masked in the UI). */
  cr?: string
  nationalId?: string
  /** SCFHS licence (staff). */
  licence?: { no: string; validTo: string }
  city?: Bi
  contact?: { name: Bi; role: Bi; mobile: string }
  /** Insurer partner id or Doctors key, where the party exists elsewhere. */
  ref?: string
}

export type StaffTerms = {
  basic: number
  housing: number
  transport: number
  allowances: { label: Bi; amount: number }[]
  probationDays: number
  hoursPerWeek: number
  leaveDays: number
  payDay: number
}
export type PartnerTerms = { pricing: Bi; paymentDays: number; serviceLevel?: Bi; accreditation?: Bi; liabilityInsurance?: boolean }
export type InsurerTerms = { discountPct: number; copayPct: number; capPerVisit?: number; preauthAbove?: number; preauthImaging?: boolean; paymentDays: number; claimDeadlineDays: number }

export type Contract = {
  no: string
  kind: ContractKind
  /** Detail line under the type ("employment", "provider agreement", …). */
  kindDetail: Bi
  party: Party
  template: string
  version: number
  draftedAt: string
  draftedBy: StaffKey
  department?: Bi
  start: string
  end: string
  autoRenew: boolean
  noticeDays: number
  terms: { staff?: StaffTerms; partner?: PartnerTerms; insurer?: InsurerTerms }
  clauses: Clause[]
  files: BillDocument[]
  signers: Signer[]
  /** True once sent for signature (draft before). */
  sent: boolean
  /** Locked after the last signature: no edits, copies sent, filed with the party. */
  locked: boolean
  pages: number
  verifyCode: string
  events: ContractEvent[]
}

const signer = (order: number, s: Omit<Signer, "order" | "method">): Signer => ({ order, method: "nafath", ...s })
const faisal = (order: number, status: SignerStatus, signedAt?: string): Signer =>
  signer(order, {
    initials: "FQ",
    name: STAFF.faisal.name,
    role: STAFF.faisal.role,
    side: "center",
    signatory: "faisal",
    mobile: "+966 50 100 2482",
    nationalId: "1029384482",
    status,
    signedAt,
    ...(signedAt ? { nafathTxn: `NFD-${signedAt.replace(/\D/g, "").slice(2, 12)}`, pdfHash: `sha256:${signedAt.replace(/\D/g, "")}f0` } : {}),
  })

const signedBy = (s: Omit<Signer, "order" | "method" | "status">, order: number, at: string) =>
  signer(order, { ...s, status: "signed", signedAt: at, nafathTxn: `NFD-${at.replace(/\D/g, "").slice(2, 12)}`, pdfHash: `sha256:${at.replace(/\D/g, "")}a1` })

/** Clause library per contract kind (template clauses; New contract's checklist). */
export const CLAUSES: Record<ContractKind, Clause[]> = {
  staff: [
    { key: "job", title: bi("The job", "الوظيفة"), text: bi("", "") },
    { key: "term", title: bi("Term", "المدة"), text: bi("", "") },
    { key: "pay", title: bi("Pay", "الراتب"), text: bi("", "") },
    { key: "hours", title: bi("Hours and leave", "الدوام والإجازات"), text: bi("", "") },
    { key: "pdpl", title: bi("Patient data", "بيانات المرضى"), text: bi("Keeps patient information private under the PDPL and the center's policies.", "تحافظ على سرية بيانات المرضى حسب نظام حماية البيانات الشخصية وسياسات المجمع.") },
    { key: "end", title: bi("Ending the contract", "إنهاء العقد"), text: bi("", "") },
  ],
  partner: [
    { key: "pdpl", title: bi("Patient data protection (PDPL)", "حماية بيانات المرضى (نظام حماية البيانات)"), text: bi("", "") },
    { key: "confidentiality", title: bi("Confidentiality", "السرية"), text: bi("", "") },
    { key: "accreditation", title: bi("CBAHI or CAP accreditation required", "لازم اعتماد سباهي أو CAP"), text: bi("", "") },
    { key: "liability", title: bi("Liability insurance", "تأمين المسؤولية"), text: bi("", "") },
    { key: "nonCompete", title: bi("No working with competitors", "عدم العمل مع المنافسين"), text: bi("", "") },
  ],
  insurer: [],
}

export const CONTRACTS: Contract[] = [
  {
    no: "CTR-26-031",
    kind: "staff",
    kindDetail: bi("employment", "عقد عمل"),
    party: {
      kind: "employee",
      initials: "LS",
      name: bi("Dr. Lama Al-Saud", "د. لمى آل سعود"),
      role: bi("Consultant pediatrician", "استشارية أطفال"),
      nationalId: "1048213417",
      licence: { no: "22RM0417", validTo: "2028-06-30" },
      ref: "saud",
    },
    template: "staff-employment",
    version: 2,
    draftedAt: "2026-11-18",
    draftedBy: "nora",
    department: bi("Pediatrics · Riyadh", "الأطفال · الرياض"),
    start: "2026-12-01",
    end: "2028-11-30",
    autoRenew: true,
    noticeDays: 60,
    terms: {
      staff: {
        basic: 30000,
        housing: 7500,
        transport: 3000,
        allowances: [{ label: bi("on-call", "مناوبات"), amount: 1500 }],
        probationDays: 90,
        hoursPerWeek: 48,
        leaveDays: 30,
        payDay: 27,
      },
    },
    clauses: [
      { key: "job", title: bi("The job", "الوظيفة"), text: bi("Consultant pediatrician at the Pediatrics clinic, Riyadh branch, reporting to the medical director.", "استشارية أطفال في عيادة الأطفال بفرع الرياض، وترجع للمدير الطبي.") },
      { key: "term", title: bi("Term", "المدة"), text: bi("2 years from 1 Dec 2026, with a 90-day probation. Renews for the same term unless either side gives notice.", "سنتين من 1 ديسمبر 2026، وفترة تجربة 90 يوم. يتجدد لنفس المدة إلا إذا أشعر أحد الطرفين.") },
      { key: "pay", title: bi("Pay", "الراتب"), text: bi("SAR 42,000 a month: basic 30,000, housing 7,500, transport 3,000 and on-call 1,500. Paid on the 27th.", "42,000 ر.س بالشهر: أساسي 30,000 وسكن 7,500 ونقل 3,000 ومناوبات 1,500. ينصرف يوم 27.") },
      { key: "hours", title: bi("Hours and leave", "الدوام والإجازات"), text: bi("48 hours a week, 30 days of annual leave and the official holidays.", "48 ساعة بالأسبوع، و30 يوم إجازة سنوية مع الإجازات الرسمية.") },
      { key: "pdpl", title: bi("Patient data", "بيانات المرضى"), text: bi("Keeps patient information private under the PDPL and the center's policies.", "تحافظ على سرية بيانات المرضى حسب نظام حماية البيانات الشخصية وسياسات المجمع.") },
      { key: "end", title: bi("Ending the contract", "إنهاء العقد"), text: bi("60 days' written notice from either side, as the Labor Law sets out.", "إشعار كتابي قبل 60 يوم من أي طرف، حسب نظام العمل.") },
    ],
    files: [
      { id: "031-scfhs", kind: "licence", title: bi("SCFHS licence", "رخصة الهيئة"), file: "SCFHS-22RM0417.pdf", format: "PDF", validTo: "2028-06-30", status: "valid", version: 1 },
      { id: "031-offer", kind: "offerLetter", title: bi("Signed offer letter", "خطاب العرض الموقع"), file: "Offer-letter-Lama.pdf", format: "PDF", pages: 2, status: "valid", version: 1 },
    ],
    signers: [
      signedBy(
        { initials: "LS", name: bi("Dr. Lama Al-Saud", "د. لمى آل سعود"), role: bi("Employee", "الموظفة"), female: true, side: "party", mobile: "+966 55 870 3417", nationalId: "1048213417" },
        1,
        "2026-11-20T09:14"
      ),
      faisal(2, "waiting"),
    ],
    sent: true,
    locked: false,
    pages: 4,
    verifyCode: "CTR-7KQ2",
    events: [
      { at: "2026-11-18", text: bi("Drafted by Nora Al-Fahad", "كتبته نورة الفهد") },
      { at: "2026-11-18", text: bi("Sent to Dr. Lama by SMS", "انرسل لـ د. لمى برسالة") },
      { at: "2026-11-19", text: bi("Opened by Dr. Lama", "فتحته د. لمى") },
      { at: "2026-11-20", text: bi("Signed by Dr. Lama with Nafath", "وقّعته د. لمى عبر نفاذ") },
    ],
  },
  {
    no: "CTR-26-029",
    kind: "insurer",
    kindDetail: bi("provider agreement", "اتفاقية مقدم خدمة"),
    party: { kind: "company", initials: "ML", name: bi("Malath", "ملاذ"), role: bi("Provider agreement", "اتفاقية مقدم خدمة"), cr: "1010156711", city: bi("Riyadh", "الرياض"), ref: "malath" },
    template: "insurer-provider",
    version: 1,
    draftedAt: "2026-11-15",
    draftedBy: "nora",
    start: "2027-01-01",
    end: "2028-12-31",
    autoRenew: true,
    noticeDays: 60,
    terms: { insurer: { discountPct: 10, copayPct: 10, preauthAbove: 1000, preauthImaging: true, paymentDays: 45, claimDeadlineDays: 30 } },
    clauses: [],
    files: [],
    signers: [
      faisal(1, "signed", "2026-11-16T10:05"),
      signer(2, { initials: "MA", name: bi("Malath provider relations", "علاقات مقدمي الخدمة · ملاذ"), role: bi("Malath", "ملاذ"), side: "party", mobile: "+966 11 410 5500", nationalId: "1077120539", status: "waiting" }),
    ],
    sent: true,
    locked: false,
    pages: 18,
    verifyCode: "CTR-3MX8",
    events: [
      { at: "2026-11-16", text: bi("Sent to Malath", "انرسل لملاذ") },
      { at: "2026-11-20", text: bi("Reminder sent to Malath", "انرسل تذكير لملاذ") },
    ],
  },
  {
    no: "CTR-26-030",
    kind: "partner",
    kindDetail: bi("reference lab", "مختبر مرجعي"),
    party: {
      kind: "company",
      initials: "AB",
      name: bi("Al Borg Diagnostics", "البرج للمختبرات"),
      role: bi("Reference lab", "مختبر مرجعي"),
      cr: "1010234567",
      city: bi("Riyadh", "الرياض"),
      contact: { name: bi("Majed Al-Ghamdi", "ماجد الغامدي"), role: bi("CEO", "الرئيس التنفيذي"), mobile: "+966 55 310 2290" },
    },
    template: "partner-reference-lab",
    version: 1,
    draftedAt: "2026-11-20",
    draftedBy: "nora",
    start: "2026-12-01",
    end: "2027-11-30",
    autoRenew: true,
    noticeDays: 60,
    terms: { partner: { pricing: bi("Their price list less 10%", "قائمة أسعارهم ناقص 10%"), paymentDays: 30, serviceLevel: bi("48 h for routine tests", "48 ساعة للتحاليل العادية"), accreditation: bi("CBAHI or CAP", "سباهي أو CAP"), liabilityInsurance: true } },
    clauses: CLAUSES.partner.slice(0, 4),
    files: [
      { id: "030-price", kind: "priceList", title: bi("Al Borg price list 2026", "قائمة أسعار البرج 2026"), file: "AlBorg-price-list-2026.xlsx", format: "XLSX", detail: bi("1.2 MB", "1.2 MB"), status: "valid", version: 1 },
      { id: "030-cap", kind: "accreditation", title: bi("CAP accreditation", "اعتماد CAP"), file: "CAP-accreditation.pdf", format: "PDF", detail: bi("840 KB", "840 KB"), validTo: "2027-08-31", status: "valid", version: 1 },
    ],
    signers: [
      signer(1, { initials: "MG", name: bi("Majed Al-Ghamdi", "ماجد الغامدي"), role: bi("Al Borg · CEO", "البرج · الرئيس التنفيذي"), side: "party", mobile: "+966 55 310 2290", nationalId: "1033829105", status: "waiting" }),
      faisal(2, "waiting"),
    ],
    sent: false,
    locked: false,
    pages: 6,
    verifyCode: "CTR-9BT4",
    events: [{ at: "2026-11-20", text: bi("Drafted by Nora Al-Fahad", "كتبته نورة الفهد") }],
  },
  {
    no: "CTR-25-118",
    kind: "insurer",
    kindDetail: bi("provider agreement", "اتفاقية مقدم خدمة"),
    party: { kind: "company", initials: "MG", name: bi("MedGulf", "ميدغلف"), role: bi("Provider agreement", "اتفاقية مقدم خدمة"), cr: "1010174630", city: bi("Riyadh", "الرياض"), ref: "medgulf" },
    template: "insurer-provider",
    version: 1,
    draftedAt: "2024-12-01",
    draftedBy: "nora",
    start: "2025-01-01",
    end: "2026-12-31",
    autoRenew: false,
    noticeDays: 60,
    terms: { insurer: { discountPct: 10, copayPct: 10, preauthAbove: 1000, preauthImaging: true, paymentDays: 60, claimDeadlineDays: 30 } },
    clauses: [],
    files: [],
    signers: [
      faisal(1, "signed", "2024-12-10T11:30"),
      signedBy({ initials: "MG", name: bi("MedGulf provider relations", "علاقات مقدمي الخدمة · ميدغلف"), role: bi("MedGulf", "ميدغلف"), side: "party", mobile: "+966 11 405 5566", nationalId: "1066021804" }, 2, "2024-12-14T13:02"),
    ],
    sent: true,
    locked: true,
    pages: 20,
    verifyCode: "CTR-1QF6",
    events: [],
  },
  {
    no: "CTR-26-027",
    kind: "staff",
    kindDetail: bi("employment", "عقد عمل"),
    party: { kind: "employee", initials: "HO", name: bi("Hanan Al-Otaibi", "حنان العتيبي"), role: bi("Phlebotomist", "أخصائية سحب دم"), nationalId: "1090472216", licence: { no: "23RL1182", validTo: "2027-10-31" } },
    template: "staff-employment",
    version: 1,
    draftedAt: "2026-10-20",
    draftedBy: "nora",
    department: bi("Lab · Riyadh", "المختبر · الرياض"),
    start: "2026-11-01",
    end: "2027-10-31",
    autoRenew: true,
    noticeDays: 60,
    terms: { staff: { basic: 7000, housing: 1750, transport: 700, allowances: [], probationDays: 90, hoursPerWeek: 48, leaveDays: 21, payDay: 27 } },
    clauses: [],
    files: [],
    signers: [
      signedBy({ initials: "HO", name: bi("Hanan Al-Otaibi", "حنان العتيبي"), role: bi("Employee", "الموظفة"), female: true, side: "party", mobile: "+966 54 771 2216", nationalId: "1090472216" }, 1, "2026-10-22T10:10"),
      faisal(2, "signed", "2026-10-22T14:45"),
    ],
    sent: true,
    locked: true,
    pages: 4,
    verifyCode: "CTR-5HN1",
    events: [],
  },
  {
    no: "CTR-26-022",
    kind: "partner",
    kindDetail: bi("crowns and bridges", "التيجان والجسور"),
    party: { kind: "company", initials: "SD", name: bi("Smile Dental Lab", "مختبر سمايل للأسنان"), role: bi("Crowns and bridges", "التيجان والجسور"), cr: "1010398812", city: bi("Riyadh", "الرياض") },
    template: "partner-dental-lab",
    version: 1,
    draftedAt: "2026-09-15",
    draftedBy: "nora",
    start: "2026-10-01",
    end: "2027-09-30",
    autoRenew: true,
    noticeDays: 60,
    terms: { partner: { pricing: bi("Fixed price list", "قائمة أسعار ثابتة"), paymentDays: 30 } },
    clauses: CLAUSES.partner.slice(0, 2),
    files: [],
    signers: [
      signedBy({ initials: "SD", name: bi("Smile Dental Lab", "مختبر سمايل للأسنان"), role: bi("Owner", "المالك"), side: "party", mobile: "+966 55 600 1820", nationalId: "1055418820" }, 1, "2026-09-20T12:00"),
      faisal(2, "signed", "2026-09-21T09:30"),
    ],
    sent: true,
    locked: true,
    pages: 5,
    verifyCode: "CTR-8DL3",
    events: [],
  },
  {
    no: "CTR-25-090",
    kind: "partner",
    kindDetail: bi("cleaning and waste", "النظافة والنفايات الطبية"),
    party: { kind: "company", initials: "RF", name: bi("Rawabi Facility Services", "روابي للخدمات"), role: bi("Cleaning and waste", "النظافة والنفايات الطبية"), cr: "1010287744", city: bi("Riyadh", "الرياض") },
    template: "partner-services",
    version: 1,
    draftedAt: "2025-06-10",
    draftedBy: "nora",
    start: "2025-07-01",
    end: "2027-06-30",
    autoRenew: true,
    noticeDays: 60,
    terms: { partner: { pricing: bi("Monthly fee", "رسوم شهرية"), paymentDays: 30 } },
    clauses: CLAUSES.partner.slice(0, 2),
    files: [],
    signers: [
      signedBy({ initials: "RF", name: bi("Rawabi Facility Services", "روابي للخدمات"), role: bi("Manager", "المدير"), side: "party", mobile: "+966 55 230 7744", nationalId: "1044287744" }, 1, "2025-06-18T11:00"),
      faisal(2, "signed", "2025-06-19T10:00"),
    ],
    sent: true,
    locked: true,
    pages: 6,
    verifyCode: "CTR-2RW7",
    events: [],
  },
  {
    no: "CTR-25-071",
    kind: "staff",
    kindDetail: bi("employment", "عقد عمل"),
    party: { kind: "employee", initials: "AZ", name: bi("Dr. Ahmed Zaki", "د. أحمد زكي"), role: bi("Consultant pediatrician", "استشاري أطفال"), nationalId: "2381920571", licence: { no: "19RM2210", validTo: "2027-02-28" }, ref: "zaki" },
    template: "staff-employment",
    version: 1,
    draftedAt: "2025-02-10",
    draftedBy: "nora",
    department: bi("Pediatrics · Riyadh", "الأطفال · الرياض"),
    start: "2025-03-01",
    end: "2027-02-28",
    autoRenew: true,
    noticeDays: 60,
    terms: { staff: { basic: 28000, housing: 7000, transport: 3000, allowances: [{ label: bi("on-call", "مناوبات"), amount: 1500 }], probationDays: 90, hoursPerWeek: 48, leaveDays: 30, payDay: 27 } },
    clauses: [],
    files: [],
    signers: [
      signedBy({ initials: "AZ", name: bi("Dr. Ahmed Zaki", "د. أحمد زكي"), role: bi("Employee", "الموظف"), side: "party", mobile: "+966 50 812 0571", nationalId: "2381920571" }, 1, "2025-02-14T09:00"),
      faisal(2, "signed", "2025-02-15T10:20"),
    ],
    sent: true,
    locked: true,
    pages: 4,
    verifyCode: "CTR-6ZK9",
    events: [],
  },
]

/** Contracts beyond the design's rows (64 in all: 38 staff, 17 partners, 9 insurers). */
export const OTHER_CONTRACTS = {
  staff: 35,
  partner: 14,
  insurer: 7,
  /** Of those, waiting for the other side's signature (To sign · 4 = 2 sample + 2 here). */
  awaitingThem: 2,
  awaitingYou: 0,
  /** Ending within 60 days (KPI "2 ending" = 1 sample + 1 here). */
  ending: 1,
}

/* ------------------------------------------------------------------ overview */

/** Money in · last 2 weeks (Sun–Thu), SAR thousands; the last bar is today. */
export const MONEY_IN_DAYS: { day: string; value: number }[] = [
  { day: "2026-11-08", value: 41 },
  { day: "2026-11-09", value: 44 },
  { day: "2026-11-10", value: 39 },
  { day: "2026-11-11", value: 47 },
  { day: "2026-11-12", value: 34 },
  { day: "2026-11-15", value: 43 },
  { day: "2026-11-16", value: 50 },
  { day: "2026-11-17", value: 42 },
  { day: "2026-11-18", value: 47 },
  { day: "2026-11-19", value: 28 },
]
/** "Who paid this month": patients (cash and cards) share, percent; insurers carry their own paidShare. */
export const PATIENTS_PAID_SHARE = 38
