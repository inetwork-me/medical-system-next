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
  /** The authorized signatory new contracts route to (center settings); the signed-in user when they are one. */
  signatory: "khaled" as const,
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
  preauthRule: { above?: number; imaging?: boolean; dental?: boolean }
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
      months: months([245, 262, 250, 270, 280, 288]),
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
    copay: { pct: 10, capPerVisit: 75, classes: ["A", "B", "C"] },
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
  /** For sentences about the patient ("He paid in cash", "his new share"). */
  sex?: "m" | "f"
  /**
   * From the patient's file: who pays and the VAT rule (New invoice fills "Who pays" from it). Insurance carries the
   * insurer, the member's class and the policy no.; company carries the company account.
   */
  file?: { payer: "insurance" | "cash" | "company"; insurer?: string; class?: InsurerClass; policyNo?: string; company?: string; vat?: string }
}

const pt = (initials: string, en: string, ar: string, mrn: string, extra: Partial<BillPatient> = {}): BillPatient => ({ initials, name: bi(en, ar), mrn, ...extra })

export const PATIENTS = {
  shammari: pt("AS", "Abdullah Al-Shammari", "عبدالله الشمري", "MRN-15530", { mobile: "+966 55 218 4410", mobileOwner: bi("father", "الأب"), guardian: true, sex: "m", file: { payer: "insurance", insurer: "bupa", class: "B", policyNo: "BUP-4410-7731", vat: "standard" } }),
  haddad: pt("LH", "Lina Haddad", "لينا حداد", "MRN-19022", { patientId: "004857", mobile: "+966 50 771 2045", sex: "f", file: { payer: "insurance", insurer: "tawuniya", class: "A", policyNo: "TAW-2045-0193", vat: "citizen" } }),
  harbi: pt("OH", "Omar Al-Harbi", "عمر الحربي", "MRN-22310", { mobile: "+966 54 120 9931", mobileOwner: bi("mother", "الأم"), guardian: true, sex: "m", file: { payer: "cash", vat: "citizen" } }),
  ahmed: pt("SA", "Sara Ahmed", "سارة أحمد", "MRN-23118", { patientId: "004812", mobile: "+966 53 640 1187", sex: "f", file: { payer: "insurance", insurer: "medgulf", class: "B", policyNo: "MGF-1187-5520", vat: "standard" } }),
  qahtani: pt("MQ", "Mona Al-Qahtani", "منى القحطاني", "MRN-14402", { mobile: "+966 56 902 3318", sex: "f", file: { payer: "cash", vat: "citizen" } }),
  dosari: pt("FD", "Fahad Al-Dosari", "فهد الدوسري", "MRN-17654", { patientId: "004891", mobile: "+966 55 404 7712", mobileOwner: bi("father", "الأب"), guardian: true, sex: "m", file: { payer: "insurance", insurer: "bupa", class: "B", policyNo: "BUP-7712-0418", vat: "standard" } }),
  mutairi: pt("RM", "Reem Al-Mutairi", "ريم المطيري", "MRN-23001", { mobile: "+966 50 318 6604", mobileOwner: bi("mother", "الأم"), guardian: true, sex: "f", file: { payer: "insurance", insurer: "alrajhi", class: "A", policyNo: "ART-7781-2290", vat: "standard" } }),
  amri: pt("YA", "Yousef Al-Amri", "يوسف العمري", "MRN-20418", { mobile: "+966 59 233 0871", mobileOwner: bi("father", "الأب"), guardian: true, file: { payer: "cash", vat: "citizen" } }),
  subaie: pt("KS", "Khalid Al-Subaie", "خالد السبيعي", "MRN-18840", { mobile: "+966 50 552 1490", file: { payer: "company", company: "sec", vat: "citizen" } }),
  shehri: pt("HS", "Huda Al-Shehri", "هدى الشهري", "MRN-21907", { mobile: "+966 55 781 6620", sex: "f", file: { payer: "cash", vat: "citizen" } }),
} satisfies Record<string, BillPatient>

export type PatientKey = keyof typeof PATIENTS

/**
 * The center's users who act in Billing (the users table once the backend exists). `email` links a record to the
 * signed-in session; `signatory` marks the authorized signatories (CEO / medical director) — the only users who sign
 * for the center. National IDs are stored in full for Nafath and only ever shown masked.
 */
export type BillUser = {
  id: string
  email?: string
  initials: string
  name: Bi
  /** Job title, shown as the signer's role ("CEO", "Medical director"). */
  role: Bi
  nationalId: string
  mobile: string
  signatory: boolean
  /** Arabic verb agreement ("طلبته" / "طلبه", "توافق" / "يوافق"). */
  female?: boolean
}

export const STAFF = {
  nora: { id: "u-nora", email: "nora.f@clinic.sa", initials: "NF", name: bi("Nora Al-Fahad", "نورة الفهد"), role: bi("HR", "الموارد البشرية"), nationalId: "1066102338", mobile: "+966 55 410 2338", signatory: false, female: true },
  faisal: { id: "u-faisal", email: "faisal.q@clinic.sa", initials: "FQ", name: bi("Faisal Al-Qahtani", "فيصل القحطاني"), role: bi("CEO", "الرئيس التنفيذي"), nationalId: "1029384482", mobile: "+966 50 100 2482", signatory: true, female: false },
  // Finance manager: approves refunds over REFUND_APPROVAL_LIMIT (Needs attention · Refund to approve).
  abeer: { id: "u-abeer", email: "abeer.s@clinic.sa", initials: "AS", name: bi("Abeer Al-Sulami", "عبير السلمي"), role: bi("Finance manager", "المدير المالي"), nationalId: "1052907714", mobile: "+966 55 902 1146", signatory: false, female: true },
  khaled: { id: "u-khaled", email: "khaled.m@clinic.sa", initials: "KM", name: bi("Dr. Khaled Mansour", "د. خالد منصور"), role: bi("Medical director", "المدير الطبي"), nationalId: "1031457726", mobile: "+966 55 123 4287", signatory: true, female: false },
} satisfies Record<string, BillUser>
export type StaffKey = keyof typeof STAFF

export const userById = (id: string | undefined): BillUser | undefined => Object.values(STAFF).find((u) => u.id === id)

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
  /** Card payments: the card's last 4 digits (a refund goes back to it: "mada card ending in 4410"). */
  last4?: string
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
  kind: "paid" | "issued" | "claimSent" | "sent" | "refunded" | "credited"
  text?: Bi
  paid?: { amount: number; method: PayMethod; byName: Bi }
  sent?: { to: "guardian" | "patient" }
  credited?: { cn: string; total: number; byName: Bi }
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
  /**
   * The patient's co-pay as issued, from the insurer agreement (percentage, and the per-visit cap when the member's class
   * has one — Bupa: 20%, up to SAR 75 a visit for classes B and C). An issued invoice keeps it even if the agreement
   * changes. Cash invoices: the patient pays everything.
   */
  copay: { pct: number; cap?: number }
  payments: Payment[]
  zatca: ZatcaRecord
  claimNo?: string
  /**
   * Credit notes issued against it. The invoice's own lines and totals never change: each credit note is a separate
   * ZATCA document (type 381) that reverses some lines; this list only links them and keeps what they took off.
   */
  credits?: InvoiceCredit[]
  events: InvoiceEvent[]
  /** New invoice (by hand): the note printed on the invoice, and the company that pays (payer "company"). */
  note?: Bi
  manual?: boolean
  company?: string
}

/** A credit note as the invoice sees it: which lines it reversed, the amount with VAT, and the patient's refund. */
/** A credit note on the invoice: `refund` is money actually paid back (a refund waiting for approval counts 0). */
export type InvoiceCredit = {
  cn: string
  lines: number[]
  total: number
  refund: number
  /** A refund waiting for the finance manager: promised, not paid (a later credit note can't refund it again). */
  pending?: number
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
const DENT = bi("Dentistry", "الأسنان")

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
    copay: { pct: 20, cap: 75 },
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
    copay: { pct: 10 },
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
    copay: { pct: 100 },
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
    copay: { pct: 10 },
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
    copay: { pct: 100 },
    payments: [pay("INV-2611-0237", 240, "cash", "2026-11-18T12:06")],
    zatca: zatca("5d9b3e7a-0c18-4f62-b4a9-7e1d2c3f0237", "2026-11-18T12:05", "simplified"),
    credits: [{ cn: "CN-2611-0011", lines: [0], total: 240, refund: 240 }],
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
    lines: [line("LAB-IGE", "Allergy panel (IgE)", "تحليل الحساسية (IgE)", 1000, "standard", { kind: "lab" })],
    copay: { pct: 20, cap: 75 },
    payments: [pay("INV-2611-0236", 75, "mada", "2026-11-18T10:42", { terminal: "POS-2", approvalCode: "118270" })],
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
    copay: { pct: 10 },
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
    copay: { pct: 100 },
    payments: [pay("INV-2611-0234", 160, "applepay", "2026-11-17T11:03", { terminal: "POS-1", approvalCode: "772415" })],
    zatca: zatca("2e6f9a1b-8c3d-4b70-a5e2-1d4c7b9e0234", "2026-11-17T11:02", "simplified"),
    events: [],
  },
  // Refund approval (v5.2): Huda paid SAR 1,380 by mada; the CBCT scan wasn't done (scanner down), so Nora issued
  // CN-2611-0013 for SAR 920 this morning. Over SAR 500, it waits for Abeer (finance manager).
  {
    no: "INV-2611-0229",
    issuedAt: "2026-11-18T09:15",
    patient: "shehri",
    visitId: "V-2611-0902",
    visitAt: "2026-11-18T08:30",
    clinic: DENT,
    doctor: "odeh",
    payer: "cash",
    lines: [
      line("CONS-DEN", "Consultation · Dentistry", "كشفية · الأسنان", 460, "citizen", { kind: "consult" }),
      line("IMG-CBCT", "CBCT scan", "أشعة CBCT", 920, "citizen", { kind: "procedure" }),
    ],
    copay: { pct: 100 },
    payments: [pay("INV-2611-0229", 1380, "mada", "2026-11-18T09:16", { terminal: "POS-2", approvalCode: "604418", last4: "4410" })],
    zatca: zatca("7a4c1e90-2b6d-4f13-9e58-c0d3b1a80229", "2026-11-18T09:15", "simplified"),
    credits: [{ cn: "CN-2611-0013", lines: [1], total: 920, refund: 0, pending: 920 }],
    events: [],
  },
]

/* ------------------------------------------------------------------ new invoice (by hand) */

/**
 * The center's price list as New invoice searches it ("Add a service · search the price list by name or code"). Each
 * service carries its price before VAT; the VAT rule comes from the patient's file. Codes stay Latin.
 */
export type PriceItem = { code: string; item: Bi; price: number; kind: "consult" | "lab" | "procedure" }
export const PRICE_LIST: PriceItem[] = [
  { code: "CONS-DER", item: bi("Consultation · Dermatology", "كشفية · الجلدية"), price: 350, kind: "consult" },
  { code: "CONS-GP", item: bi("Consultation · General practice", "كشفية · الطب العام"), price: 250, kind: "consult" },
  { code: "CONS-IM", item: bi("Consultation · Internal medicine", "كشفية · الباطنة"), price: 240, kind: "consult" },
  { code: "CONS-PED", item: bi("Consultation · Pediatrics", "كشفية · الأطفال"), price: 300, kind: "consult" },
  { code: "CONS-DEN", item: bi("Consultation · Dentistry", "كشفية · الأسنان"), price: 460, kind: "consult" },
  { code: "PROC-BX", item: bi("Skin biopsy", "خزعة جلد"), price: 450, kind: "procedure" },
  { code: "LAB-HIS", item: bi("Histopathology", "فحص الأنسجة"), price: 280, kind: "lab" },
  { code: "PROC-CRY", item: bi("Cryotherapy · per lesion", "علاج بالتبريد · لكل آفة"), price: 220, kind: "procedure" },
  { code: "PROC-NEB", item: bi("Nebulizer session", "جلسة بخار"), price: 300, kind: "procedure" },
  { code: "PROC-DRS", item: bi("Wound dressing", "غيار جرح"), price: 120, kind: "procedure" },
  { code: "IMG-CBCT", item: bi("CBCT scan", "أشعة CBCT"), price: 920, kind: "procedure" },
  { code: "LAB-CBC", item: bi("Complete blood count", "صورة الدم الكاملة"), price: 90, kind: "lab" },
  { code: "LAB-TSH", item: bi("TSH", "TSH"), price: 80, kind: "lab" },
  { code: "LAB-VITD", item: bi("Vitamin D", "فيتامين د"), price: 160, kind: "lab" },
  { code: "LAB-IGE", item: bi("Allergy panel (IgE)", "تحليل الحساسية (IgE)"), price: 1000, kind: "lab" },
]

/** Company accounts that pay for their staff (payer "Company" on New invoice). */
export const COMPANY_ACCOUNTS: { id: string; name: Bi }[] = [
  { id: "sec", name: bi("Saudi Electricity Company", "الشركة السعودية للكهرباء") },
  { id: "almarai", name: bi("Almarai", "المراعي") },
]

/**
 * Visits with nothing billed yet (New invoice · Visit). The doctor is named on the visit: Dr. Hala Nasser isn't in the
 * Doctors roster of this branch (a visiting consultant).
 */
export type OpenVisit = { id: string; patient: PatientKey; at: string; clinic: Bi; doctor: string; doctorName: Bi }
export const OPEN_VISITS: OpenVisit[] = [
  { id: "V-2611-1012", patient: "mutairi", at: "2026-11-17T16:10", clinic: DERM, doctor: "hnasser", doctorName: bi("Dr. Hala Nasser", "د. هالة ناصر") },
  { id: "V-2611-1047", patient: "subaie", at: "2026-11-19T10:30", clinic: GP, doctor: "odeh", doctorName: bi("Dr. Sami Odeh", "د. سامي عودة") },
]

/* ------------------------------------------------------------------ credit notes */

/**
 * Credit notes (brief §4): an issued invoice is never edited. A credit note (ZATCA type 381) references the invoice,
 * lists the credited lines with VAT, gets its own CN-YYMM-NNNN number and is reported to ZATCA. The credit is split by
 * the invoice's co-pay rule; the insurer's part goes to NPHIES as a claim adjustment, and the patient gets back what
 * they paid above their new share. Every credit note keeps who issued it and why.
 */
export type CreditReason = "testsNotDone" | "notGiven" | "billedTwice" | "wrongPrice" | "other"
export const CREDIT_REASONS: CreditReason[] = ["testsNotDone", "notGiven", "billedTwice", "wrongPrice", "other"]

/** card: back to the card they paid with, through the terminal; visitCredit: kept as credit for the next visit. */
export type RefundMethod = "card" | "cash" | "transfer" | "visitCredit"

/**
 * Refunds above this (SAR) need the finance manager's approval: the credit note is issued right away, the money waits.
 * One setting for the whole module (configurable per center once settings exist).
 */
export const REFUND_APPROVAL_LIMIT = 500
/** Who approves refunds over the limit (the finance manager). */
export const REFUND_APPROVER: StaffKey = "abeer"

/** The money of a credit note, fixed when it is issued. */
export type CreditAmounts = {
  subtotal: number
  vat: number
  /** Credited, with VAT. */
  total: number
  /** Off the insurer's claim / the patient's part of the credit. */
  insurer: number
  patient: number
  /** The invoice before and after this credit note (total, insurer, patient). */
  before: { total: number; insurer: number; patient: number }
  after: { total: number; insurer: number; patient: number }
  /** What the patient had paid (net of earlier refunds) and what goes back now. */
  paid: number
  refund: number
}

export type CreditEvent = {
  at: string
  kind: "issued" | "claimAdjusted" | "refunded" | "approvalRequested" | "refundApproved" | "refundRejected"
  /** The design's wording; session events carry facts instead. */
  text?: Bi
  byName?: Bi
  insurer?: string
  refund?: { amount: number; method: RefundMethod; receipt: boolean }
}

export type CreditNote = {
  no: string
  invoiceNo: string
  issuedAt: string
  /** Indexes of the invoice lines it reverses (the invoice keeps them). */
  lines: number[]
  reason: CreditReason
  by: string
  byName: Bi
  amounts: CreditAmounts
  /** The refund due. With `approval` it only goes out once the finance manager approves it. */
  refund?: { amount: number; method: RefundMethod; receipt: boolean; at: string; byName: Bi }
  /**
   * Over REFUND_APPROVAL_LIMIT: the request to the finance manager and the answer. Approved → the money goes back
   * (card: through the terminal provider, 3 to 5 working days). Rejected → no money goes back; the credit stays with
   * the patient (lowers what they owe next) and the approver's note goes to the requester.
   */
  approval?: {
    status: "pending" | "approved" | "rejected"
    approver: StaffKey
    askedAt: string
    askedBy: Bi
    /** The requester's role when they asked ("reception"). */
    askedRole: Bi
    /** The requester's note for the approver (shown as the reason on Approve the refund); typed notes keep one text. */
    note: Bi
    decidedAt?: string
    decisionNote?: Bi
  }
  /** The insurer's claim, adjusted through NPHIES (old → new amount). */
  claim?: { no: string; from: number; to: number; sentAt?: string }
  zatca: ZatcaRecord
  events: CreditEvent[]
}

/** November's earlier credit note: Mona Al-Qahtani's consultation was billed twice; refunded in cash. */
export const CREDIT_NOTES: CreditNote[] = [
  {
    no: "CN-2611-0011",
    invoiceNo: "INV-2611-0237",
    issuedAt: "2026-11-18T12:40",
    lines: [0],
    reason: "billedTwice",
    by: "u-nora",
    byName: STAFF.nora.name,
    amounts: {
      subtotal: 240,
      vat: 0,
      total: 240,
      insurer: 0,
      patient: 240,
      before: { total: 240, insurer: 0, patient: 240 },
      after: { total: 0, insurer: 0, patient: 0 },
      paid: 240,
      refund: 240,
    },
    refund: { amount: 240, method: "cash", receipt: true, at: "2026-11-18T12:42", byName: STAFF.nora.name },
    zatca: zatca("9c2d7e41-5b08-4a6f-8e13-0f4b6a2d0011", "2026-11-18T12:40", "simplified"),
    events: [
      { at: "2026-11-18T12:40", kind: "issued", byName: STAFF.nora.name },
      { at: "2026-11-18T12:42", kind: "refunded", byName: STAFF.nora.name, refund: { amount: 240, method: "cash", receipt: true } },
    ],
  },
  {
    no: "CN-2611-0013",
    invoiceNo: "INV-2611-0229",
    issuedAt: `${BILL_TODAY}T09:42`,
    lines: [1],
    reason: "notGiven",
    by: "u-nora",
    byName: STAFF.nora.name,
    amounts: {
      subtotal: 920,
      vat: 0,
      total: 920,
      insurer: 0,
      patient: 920,
      before: { total: 1380, insurer: 0, patient: 1380 },
      after: { total: 460, insurer: 0, patient: 460 },
      paid: 1380,
      refund: 920,
    },
    refund: { amount: 920, method: "card", receipt: false, at: `${BILL_TODAY}T09:42`, byName: STAFF.nora.name },
    approval: {
      status: "pending",
      approver: "abeer",
      askedAt: `${BILL_TODAY}T09:42`,
      askedBy: STAFF.nora.name,
      askedRole: bi("reception", "الاستقبال"),
      note: bi("CBCT scan not done · scanner down", "ما انسوّت أشعة CBCT · الجهاز معطل"),
    },
    zatca: zatca("e3b81f5c-6a20-4d97-b1c4-58f2a9c00013", `${BILL_TODAY}T09:42`, "simplified"),
    events: [
      { at: `${BILL_TODAY}T09:42`, kind: "issued", byName: STAFF.nora.name },
      { at: `${BILL_TODAY}T09:42`, kind: "approvalRequested", byName: STAFF.nora.name },
    ],
  },
]

/** Invoices beyond the design's rows (November: 214 in all; INV-2611-0229 is one of the paid ones). */
export const OTHER_INVOICES: Record<InvoiceStatus, number> = { unpaid: 7, part: 3, paid: 194, refunded: 1 }
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
  /** Ask for approval: the pre-auth request went to the insurer (waiting for its answer). */
  preauthRequestedAt?: string
  /** Fix & resend: when the corrected claim went back. */
  resentAt?: string
  /** NPHIES bundle / request id (stub). */
  nphiesId?: string
  /** A credit note took part of it off: the amount before, and when the adjustment went to NPHIES. */
  adjusted?: { cn: string; from: number; at: string }
}

export const CLAIMS: Claim[] = [
  {
    no: "CLM-26-01836",
    createdAt: "2026-11-18T10:41",
    invoiceNo: "INV-2611-0236",
    patient: "dosari",
    insurer: "bupa",
    amount: 1075,
    status: "rejected",
    service: bi("Allergy panel (IgE)", "تحليل الحساسية (IgE)"),
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
    amount: 758.75,
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
  review: { count: 30, amount: 46141.25 },
  rejected: 6,
  needsPreauth: 0,
  approved: 120,
  part: 4,
  /** Paid this month, SAR, from 5 insurers. */
  paidAmount: 211922,
  /** Insurers that paid this month (design: "from 5 insurers"). */
  paidInsurers: 5,
  answerDays: 2.1,
  rejectedPct: 3.2,
}

/** NPHIES rejection codes the center sees most (Fix claim shows the insurer's code + text). */
export const REJECTION_CODES: Record<string, Bi> = {
  "BE-1-4": bi("pre-authorization needed for the allergy panel", "لازم موافقة مسبقة لتحليل الحساسية"),
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
  /** The user who signs for the center (side "center"): matched against the signed-in user for "you" / "Your turn". */
  userId?: string
  mobile: string
  /** Stored in full, shown masked to its last 3 digits. */
  nationalId: string
  status: SignerStatus
  signedAt?: string
  method: "nafath"
  /** Nafath transaction id and the signed PDF hash (stored per signature). */
  nafathTxn?: string
  pdfHash?: string
  /** Add a signer · "Approves only": confirms in order with Nafath, but isn't a party to the contract. */
  does?: "approves"
}

export type Clause = { key: string; title: Bi; text: Bi }

/** Contract activity: the design's lines carry their text; session events carry facts, worded in the reader's language. */
export type ContractEvent = { at: string; text?: Bi; kind?: "signed" | "locked" | "copies" | "filed" | "sent" | "drafted"; who?: Bi }

export type Party = {
  kind: "employee" | "company"
  initials: string
  name: Bi
  /** Arabic agreement for an employee ("الموظفة"). */
  female?: boolean
  /** How sentences name the party ("Dr. Lama", "Al Borg"). */
  short?: Bi
  /** List subtitle: job title or what the company does. */
  role: Bi
  /** Company CR, or the employee's national ID (masked in the UI). */
  cr?: string
  nationalId?: string
  /** SCFHS licence (staff). */
  licence?: { no: string; validTo: string }
  city?: Bi
  contact?: { name: Bi; role: Bi; mobile: string; female?: boolean }
  /** Insurer partner id or Doctors key, where the party exists elsewhere. */
  ref?: string
}

export type StaffTerms = {
  /** Full time / part time / locum (Employment segmented). */
  employment?: "full" | "part" | "locum"
  jobTitle?: Bi
  /** Clinic key (Clinics core entity). */
  clinic?: string
  /** "48 h a week · Sun to Thu" as typed. */
  workingHours?: string
  /** Register with GOSI from the start date. */
  gosi?: boolean
  /** HR is reminded this many days before the end when the contract doesn't renew itself. */
  reminderDays?: number
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
export type InsurerTerms = {
  discountPct: number
  copayPct: number
  capPerVisit?: number
  /** Member classes the co-pay (and its cap) covers. */
  classes?: InsurerClass[]
  preauthAbove?: number
  preauthImaging?: boolean
  preauthDental?: boolean
  paymentDays: number
  claimDeadlineDays: number
  /** Our price list the discount applies to. */
  priceList?: string
  /** Claims go through NPHIES (one batch every evening). */
  nphies?: boolean
}

export type Contract = {
  no: string
  kind: ContractKind
  /** Detail line under the type ("employment", "provider agreement", …). */
  kindDetail: Bi
  party: Party
  /** The template (library id) and its version this contract was made from; signed contracts never change. */
  template: string
  templateVersion: number
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
  /** Add a signer · "Gets a copy": not in the signing order; gets the signed copy with the parties. */
  copies?: { name: Bi; role: Bi; mobile: string; side: "center" | "party" }[]
  /** True once sent for signature (draft before). */
  sent: boolean
  /** When it went out for signature, and the last SMS reminder (Needs attention: "Sent 16 Nov · reminded 20 Nov"). */
  sentAt?: string
  remindedAt?: string
  /** Locked after the last signature: no edits, copies sent, filed with the party. */
  locked: boolean
  pages: number
  verifyCode: string
  events: ContractEvent[]
}

const signer = (order: number, s: Omit<Signer, "order" | "method">): Signer => ({ order, method: "nafath", ...s })
/** A center signature by one of the center's users (an authorized signatory). */
export const centerSigner = (key: StaffKey, order: number, status: SignerStatus = "waiting", signedAt?: string): Signer => {
  const u = STAFF[key]
  return signer(order, {
    initials: u.initials,
    name: u.name,
    role: u.role,
    side: "center",
    userId: u.id,
    mobile: u.mobile,
    nationalId: u.nationalId,
    status,
    signedAt,
    ...(signedAt ? { nafathTxn: `NFD-${signedAt.replace(/\D/g, "").slice(2, 12)}`, pdfHash: `sha256:${signedAt.replace(/\D/g, "")}f0` } : {}),
  })
}
const faisal = (order: number, status: SignerStatus, signedAt?: string) => centerSigner("faisal", order, status, signedAt)

const signedBy = (s: Omit<Signer, "order" | "method" | "status">, order: number, at: string) =>
  signer(order, { ...s, status: "signed", signedAt: at, nafathTxn: `NFD-${at.replace(/\D/g, "").slice(2, 12)}`, pdfHash: `sha256:${at.replace(/\D/g, "")}a1` })

/**
 * Optional clauses per contract type — New contract's checklist (the template's own clauses always print; these are
 * added when ticked). Stored in Arabic and English.
 */
export const CLAUSES: Record<ContractKind, Clause[]> = {
  staff: [
    { key: "pdpl", title: bi("Patient data protection (PDPL)", "حماية بيانات المرضى (نظام حماية البيانات)"), text: bi("", "") },
    { key: "confidentiality", title: bi("Confidentiality", "السرية"), text: bi("", "") },
    { key: "licenceValid", title: bi("SCFHS licence kept valid", "رخصة الهيئة تبقى سارية"), text: bi("", "") },
    { key: "malpractice", title: bi("Malpractice insurance paid by the center", "تأمين الأخطاء الطبية على المجمع"), text: bi("", "") },
    { key: "nonCompete", title: bi("No working at other clinics · 1 year, Riyadh", "عدم العمل بعيادات ثانية · سنة، الرياض"), text: bi("", "") },
  ],
  partner: [
    { key: "pdpl", title: bi("Patient data protection (PDPL)", "حماية بيانات المرضى (نظام حماية البيانات)"), text: bi("", "") },
    { key: "confidentiality", title: bi("Confidentiality", "السرية"), text: bi("", "") },
    { key: "accreditation", title: bi("CBAHI or CAP accreditation required", "لازم اعتماد سباهي أو CAP"), text: bi("", "") },
    { key: "liability", title: bi("Liability insurance", "تأمين المسؤولية"), text: bi("", "") },
    { key: "nonCompete", title: bi("No working with competitors", "عدم العمل مع المنافسين"), text: bi("", "") },
  ],
  insurer: [
    { key: "pdpl", title: bi("Patient data protection (PDPL)", "حماية بيانات المرضى (نظام حماية البيانات)"), text: bi("", "") },
    { key: "cchiUnified", title: bi("CCHI unified policy terms", "شروط الوثيقة الموحدة لمجلس الضمان"), text: bi("", "") },
    { key: "claims15", title: bi("Claims answered within 15 days", "الرد على المطالبات خلال 15 يوم"), text: bi("", "") },
    { key: "appeals30", title: bi("Appeals on rejections within 30 days", "الاعتراض على الرفض خلال 30 يوم"), text: bi("", "") },
    { key: "pricesPrivate", title: bi("Our prices not shared with other insurers", "أسعارنا ما تنعطى لشركات ثانية"), text: bi("", "") },
  ],
}

/**
 * Add clauses · Clause library: ready clauses in Arabic and English (checked by the center's lawyer). `inTemplate` ones
 * are already in every template ("Already in this template") and can't be added again.
 */
export type LibraryClause = Clause & { summary: Bi; inTemplate?: boolean }
export const CLAUSE_LIBRARY: LibraryClause[] = [
  {
    key: "noPoaching",
    title: bi("Not taking our patients", "عدم أخذ مرضانا"),
    summary: bi("For 1 year after the contract ends", "لمدة سنة بعد نهاية العقد"),
    text: bi("Doesn't approach or take the center's patients for one year after the contract ends.", "ما يتواصل مع مرضى المجمع ولا ياخذهم لمدة سنة بعد نهاية العقد."),
  },
  {
    key: "continuity",
    title: bi("Business continuity", "استمرار الخدمة"),
    summary: bi("Backup plan if they can't deliver", "خطة بديلة إذا ما قدروا يقدمون الخدمة"),
    text: bi("Keeps a backup plan so the service carries on if they can't deliver, and tells the center straight away.", "عنده خطة بديلة عشان تستمر الخدمة إذا ما قدر يقدمها، ويبلغ المجمع على طول."),
  },
  {
    key: "antiBribery",
    title: bi("Anti-bribery", "مكافحة الرشوة"),
    summary: bi("Saudi anti-bribery law applies", "ينطبق نظام مكافحة الرشوة"),
    text: bi("Both sides follow the Saudi Anti-Bribery Law: no gifts or payments to win or keep business.", "يلتزم الطرفين بنظام مكافحة الرشوة، وما فيه هدايا أو مبالغ عشان كسب الشغل أو استمراره."),
  },
  {
    key: "forceMajeure",
    title: bi("Force majeure", "القوة القاهرة"),
    summary: bi("Already in this template", "موجود في النموذج"),
    text: bi("Neither side is liable for delays caused by events outside their control.", "ما يتحمل أي طرف التأخير بسبب ظروف خارجة عن إرادته."),
    inTemplate: true,
  },
]

export const CONTRACTS: Contract[] = [
  {
    no: "CTR-26-031",
    kind: "staff",
    kindDetail: bi("employment", "عقد عمل"),
    party: {
      kind: "employee",
      initials: "LS",
      name: bi("Dr. Lama Al-Saud", "د. لمى آل سعود"),
      short: bi("Dr. Lama", "د. لمى"),
      female: true,
      role: bi("Consultant pediatrician", "استشارية أطفال"),
      nationalId: "1048213417",
      licence: { no: "22RM0417", validTo: "2028-06-30" },
      ref: "saud",
    },
    template: "staff-doctors",
    templateVersion: 4,
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
      centerSigner(CENTER.signatory, 2),
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
    template: "insurer-cchi",
    templateVersion: 2,
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
    sentAt: "2026-11-16",
    remindedAt: "2026-11-20",
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
    templateVersion: 3,
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
      centerSigner(CENTER.signatory, 2),
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
    template: "insurer-cchi",
    templateVersion: 2,
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
    party: { kind: "employee", initials: "HO", name: bi("Hanan Al-Otaibi", "حنان العتيبي"), short: bi("Hanan", "حنان"), female: true, role: bi("Phlebotomist", "أخصائية سحب دم"), nationalId: "1090472216", licence: { no: "23RL1182", validTo: "2027-10-31" } },
    template: "staff-nurses",
    templateVersion: 3,
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
    template: "partner-supplies",
    templateVersion: 2,
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
    templateVersion: 1,
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
    party: { kind: "employee", initials: "AZ", name: bi("Dr. Ahmed Zaki", "د. أحمد زكي"), short: bi("Dr. Ahmed", "د. أحمد"), role: bi("Consultant pediatrician", "استشاري أطفال"), nationalId: "2381920571", licence: { no: "19RM2210", validTo: "2027-02-28" }, ref: "zaki" },
    template: "staff-doctors",
    templateVersion: 3,
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

/**
 * Money in · the last 2 working weeks (Sun–Thu) ending today, SAR thousands. The design's bars fill the 9 working days
 * before today (derived from BILL_TODAY, so the chart always ends on the demo clock's day); today's bar is the live
 * "Collected today".
 */
const MONEY_IN_VALUES = [38.1, 41.1, 36.1, 43.9, 31.1, 40, 46.1, 38.9, 43.1]

/** The `n` working days (Sun–Thu; Fri–Sat weekend) before `iso`, oldest first. */
export function workingDaysBefore(iso: string, n: number) {
  const out: string[] = []
  const d = new Date(`${iso}T12:00:00Z`)
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() - 1)
    const wd = d.getUTCDay()
    if (wd !== 5 && wd !== 6) out.unshift(d.toISOString().slice(0, 10))
  }
  return out
}

export const MONEY_IN_DAYS: { day: string; value: number }[] = workingDaysBefore(BILL_TODAY, MONEY_IN_VALUES.length).map((day, i) => ({ day, value: MONEY_IN_VALUES[i] }))
/** "Who paid this month": patients (cash and cards) share, percent; insurers carry their own paidShare. */
export const PATIENTS_PAID_SHARE = 38

/* ------------------------------------------------------------------ new contract */

/**
 * The contract templates library (brief §4 · Templates). A template has versions; only one is published at a time and
 * new contracts use it. Editing a published template makes a new draft version; publishing it archives the old one.
 * Clauses are stored in Arabic and English. HR owns Staff templates; the finance manager owns Partner and Insurer.
 */
export type TemplateVersion = {
  version: number
  status: "published" | "draft" | "archived"
  at: string
  by: StaffKey
  /** Signed contracts that stay on this (archived) version. */
  signedOn?: number
  /** Clauses added in this version (a draft can add to the published list). */
  extraClauses?: Bi[]
  /**
   * The version's clauses as the template editor keeps them (title + text in Arabic and English, lock, flags). Missing
   * on versions never opened in the editor: they're built from the template's clause titles.
   */
  clauses?: TemplateClause[]
  /** Drafts: the version it started from, and when it was last saved (ISO, this session). */
  basedOn?: number
  savedAt?: string
}

/** A clause in a template version (template editor). Placeholders like {basic_salary} are filled from New contract. */
export type TemplateClause = {
  key: string
  title: Bi
  text: Bi
  /** Locked in every contract: people drafting a contract can't remove or edit it. */
  locked: boolean
  /** Added in this version ("New" chip). */
  isNew?: boolean
  /** Highlight what changed since the previous version when the other side opens it. */
  showChanges?: boolean
}

export type ContractTemplate = {
  id: string
  kind: ContractKind
  name: Bi
  /** The Terms card's subtitle in New contract ("Saudi Labor Law template · you can edit"). */
  basis?: Bi
  clauses: Bi[]
  placeholders: string[]
  languages: "both" | "ar" | "en"
  firstSigner: "party" | "center"
  /** Contracts made from the published version. */
  usedIn: number
  versions: TemplateVersion[]
  /** Staff: a locum template (New contract preselects Locum). */
  locum?: boolean
  /** Copied from another template (Duplicate / New template "start from"). */
  copyOf?: string
}

const STAFF_CORE = [
  bi("The job", "الوظيفة"),
  bi("Pay and benefits", "الراتب والمزايا"),
  bi("Hours and leave", "الدوام والإجازات"),
  bi("Probation", "فترة التجربة"),
  bi("Confidentiality and patient data", "السرية وبيانات المرضى"),
  bi("Ending the contract", "إنهاء العقد"),
]
const STAFF_PH = ["{employee_name}", "{national_id}", "{job_title}", "{clinic}", "{basic_salary}", "{start_date}"]

/**
 * Template editor · "Insert a blank": the blanks New contract fills, per type (staff as drawn; partner / insurer: their
 * template placeholders).
 */
export const INSERTABLE: Record<ContractKind, string[]> = {
  staff: ["{employee_name}", "{job_title}", "{basic_salary}", "{housing}", "{transport}", "{start_date}", "{probation_days}"],
  partner: ["{company_name}", "{cr_number}", "{contact_name}", "{pricing}", "{start_date}", "{end_date}"],
  insurer: ["{insurer_name}", "{cchi_licence}", "{discount}", "{copay}", "{preauth_rule}", "{start_date}"],
}

/** Clause text as written in the published templates (keyed by the English title; others start empty). */
export const TEMPLATE_TEXTS: Record<string, Bi> = {
  "The job": bi("{employee_name} works as {job_title} at {clinic}, reporting to the medical director.", "يشتغل {employee_name} {job_title} في {clinic}، ويرجع للمدير الطبي."),
  "Pay and benefits": bi(
    "The basic salary is {basic_salary} a month, plus {housing} for housing and {transport} for transport, paid by the 25th.",
    "الراتب الأساسي {basic_salary} بالشهر، مع بدل سكن {housing} ومواصلات {transport}، وينزل قبل يوم 25."
  ),
  "Hours and leave": bi("48 hours a week, Sunday to Thursday, with 30 days of annual leave and the official holidays.", "48 ساعة بالأسبوع من الأحد للخميس، مع 30 يوم إجازة سنوية والإجازات الرسمية."),
  Probation: bi("A probation of {probation_days} days from {start_date}; either side can end the contract during it.", "فترة تجربة {probation_days} يوم من {start_date}، ويقدر أي طرف ينهي العقد خلالها."),
  "Confidentiality and patient data": bi(
    "Keeps patient information private under the PDPL and the center's policies, during and after the contract.",
    "يحافظ على سرية بيانات المرضى حسب نظام حماية البيانات الشخصية وسياسات المجمع، خلال العقد وبعده."
  ),
  "Ending the contract": bi("30 days' written notice from either side, as the Labor Law sets out.", "إشعار كتابي قبل 30 يوم من أي طرف، حسب نظام العمل."),
}
const PARTNER_PH = ["{company_name}", "{cr_number}", "{contact_name}", "{pricing}", "{start_date}", "{end_date}"]
const INSURER_PH = ["{insurer_name}", "{cchi_licence}", "{discount}", "{copay}", "{preauth_rule}", "{start_date}"]

export const TEMPLATE_LIBRARY: ContractTemplate[] = [
  {
    id: "staff-doctors",
    kind: "staff",
    name: bi("Employment · doctors", "عقد عمل · الأطباء"),
    basis: bi("Saudi Labor Law template", "نموذج نظام العمل السعودي"),
    clauses: STAFF_CORE,
    placeholders: STAFF_PH,
    languages: "both",
    firstSigner: "party",
    usedIn: 14,
    versions: [
      { version: 4, status: "published", at: "2026-11-03", by: "nora" },
      { version: 3, status: "archived", at: "2025-09-10", by: "nora", signedOn: 9 },
      { version: 2, status: "archived", at: "2025-03-01", by: "nora" },
    ],
  },
  {
    id: "staff-nurses",
    kind: "staff",
    name: bi("Employment · nurses and technicians", "عقد عمل · التمريض والفنيين"),
    basis: bi("Saudi Labor Law template", "نموذج نظام العمل السعودي"),
    clauses: STAFF_CORE,
    placeholders: STAFF_PH,
    languages: "both",
    firstSigner: "party",
    usedIn: 22,
    versions: [
      { version: 3, status: "published", at: "2026-09-12", by: "nora" },
      { version: 2, status: "archived", at: "2025-06-01", by: "nora", signedOn: 17 },
    ],
  },
  {
    id: "staff-locum",
    kind: "staff",
    name: bi("Locum doctor", "تعاقد مؤقت · طبيب"),
    basis: bi("Saudi Labor Law template", "نموذج نظام العمل السعودي"),
    clauses: [
      bi("The job", "الوظيفة"),
      bi("Sessions and fees", "الجلسات والأتعاب"),
      bi("Licence and insurance", "الرخصة والتأمين"),
      bi("Confidentiality and patient data", "السرية وبيانات المرضى"),
      bi("Ending the contract", "إنهاء العقد"),
    ],
    placeholders: STAFF_PH,
    languages: "both",
    firstSigner: "party",
    usedIn: 4,
    versions: [
      { version: 2, status: "published", at: "2026-07-30", by: "nora" },
      { version: 1, status: "archived", at: "2025-11-15", by: "nora", signedOn: 3 },
    ],
    locum: true,
  },
  {
    id: "partner-reference-lab",
    kind: "partner",
    name: bi("Reference lab services", "خدمات المختبر المرجعي"),
    clauses: [
      bi("The service", "الخدمة"),
      bi("Prices and payment", "الأسعار والدفع"),
      bi("Results and turnaround", "النتائج ومدة الإنجاز"),
      bi("Patient data protection", "حماية بيانات المرضى"),
      bi("Ending the contract", "إنهاء العقد"),
    ],
    placeholders: PARTNER_PH,
    languages: "both",
    firstSigner: "party",
    usedIn: 3,
    versions: [
      { version: 3, status: "published", at: "2026-10-18", by: "faisal" },
      { version: 2, status: "archived", at: "2025-10-01", by: "faisal", signedOn: 2 },
    ],
  },
  {
    id: "partner-supplies",
    kind: "partner",
    name: bi("Supplies and equipment", "التوريد والأجهزة"),
    clauses: [bi("What is supplied", "التوريد"), bi("Prices and payment", "الأسعار والدفع"), bi("Delivery and warranty", "التسليم والضمان"), bi("Ending the contract", "إنهاء العقد")],
    placeholders: PARTNER_PH,
    languages: "both",
    firstSigner: "party",
    usedIn: 6,
    versions: [
      { version: 2, status: "published", at: "2026-06-02", by: "faisal" },
      { version: 1, status: "archived", at: "2025-01-20", by: "faisal", signedOn: 4 },
    ],
  },
  {
    id: "partner-services",
    kind: "partner",
    name: bi("Facility services", "خدمات المرافق"),
    clauses: [bi("The service", "الخدمة"), bi("Monthly fee and payment", "الرسوم الشهرية والدفع"), bi("Service level", "مستوى الخدمة"), bi("Ending the contract", "إنهاء العقد")],
    placeholders: PARTNER_PH,
    languages: "both",
    firstSigner: "party",
    usedIn: 2,
    versions: [{ version: 1, status: "published", at: "2026-01-15", by: "faisal" }],
  },
  {
    id: "insurer-cchi",
    kind: "insurer",
    name: bi("Provider agreement · CCHI", "اتفاقية مقدم خدمة · المجلس"),
    basis: bi("CCHI provider template", "نموذج مجلس الضمان لمقدمي الخدمة"),
    clauses: [
      bi("The network", "الشبكة"),
      bi("Prices and discount", "الأسعار والخصم"),
      bi("Patient co-pay", "نسبة تحمل المريض"),
      bi("Pre-authorization", "الموافقة المسبقة"),
      bi("Claims through NPHIES", "المطالبات عبر نفيس"),
      bi("Payment", "الدفع"),
      bi("Ending the agreement", "إنهاء الاتفاقية"),
    ],
    placeholders: INSURER_PH,
    languages: "both",
    firstSigner: "party",
    usedIn: 5,
    versions: [
      // The draft adds an eighth clause (the library shows 8 clauses for v3).
      { version: 3, status: "draft", at: "2026-11-22", by: "faisal", extraClauses: [bi("Appeals on rejections", "الاعتراض على الرفض")] },
      { version: 2, status: "published", at: "2026-08-20", by: "faisal" },
      { version: 1, status: "archived", at: "2024-11-01", by: "faisal", signedOn: 4 },
    ],
  },
]

/** Insurer agreements: our price lists, and the pre-authorization rules and member classes New contract offers. */
export const PRICE_LISTS: { key: string; label: Bi }[] = [
  { key: "pl-2027", label: bi("Our 2027 price list", "قائمة أسعارنا 2027") },
  { key: "pl-2026", label: bi("Our 2026 price list", "قائمة أسعارنا 2026") },
]
export const PREAUTH_RULES: { key: string; label: Bi; above?: number; imaging?: boolean; dental?: boolean }[] = [
  { key: "over500-dental", label: bi("Over SAR 500 · all dental", "فوق 500 ر.س · وكل الأسنان"), above: 500, dental: true },
  { key: "over1000-imaging", label: bi("Over SAR 1,000 · all imaging", "فوق 1,000 ر.س · وكل الأشعة"), above: 1000, imaging: true },
  { key: "over1000", label: bi("Over SAR 1,000", "فوق 1,000 ر.س"), above: 1000 },
]
export const CLASS_OPTIONS: { key: string; label: Bi; classes: InsurerClass[] }[] = [
  { key: "all", label: bi("All classes", "كل الفئات"), classes: ["VIP", "A", "B", "C"] },
  { key: "abc", label: bi("Classes A, B and C", "الفئات A و B و C"), classes: ["A", "B", "C"] },
  { key: "bc", label: bi("Classes B and C", "الفئتين B و C"), classes: ["B", "C"] },
]
/** Staff: job titles HR offers (the HR job catalogue once it exists). */
export const JOB_TITLES: Bi[] = [
  bi("Specialist ophthalmologist", "أخصائي عيون"),
  bi("Consultant cardiologist", "استشاري قلب"),
  bi("Specialist dermatologist", "أخصائية جلدية"),
  bi("Consultant pediatrician", "استشاري أطفال"),
  bi("Staff nurse", "ممرضة"),
  bi("Phlebotomist", "أخصائي سحب دم"),
  bi("Lab technician", "فني مختبر"),
  bi("Locum dentist", "طبيب أسنان متعاقد"),
]

export const PRICING_OPTIONS: { key: string; label: Bi }[] = [
  { key: "less10", label: bi("Their price list less 10%", "قائمة أسعارهم ناقص 10%") },
  { key: "less15", label: bi("Their price list less 15%", "قائمة أسعارهم ناقص 15%") },
  { key: "fixed", label: bi("Fixed price list", "قائمة أسعار ثابتة") },
  { key: "monthly", label: bi("Monthly fee", "رسوم شهرية") },
]

/** People and companies the party picker searches (HR records and supplier / insurer registers, mocked). */
export type PartyCandidate = Party & {
  id: string
  mobile: string
  contactNationalId: string
  /** CCHI licence no. (insurers). */
  cchiLicence?: string
  /** Who signs for the company when it isn't the contact (insurers: the network director). */
  signatory?: { initials: string; name: Bi; role: Bi; mobile: string; nationalId: string; female?: boolean }
  /** Papers on file that New contract attaches (SCFHS licence, BLS certificate). */
  papers?: BillDocument[]
  /** Staff: the clinic key they work in (Clinics core entity). */
  clinic?: string
}

export const PARTY_CANDIDATES: Record<ContractKind, PartyCandidate[]> = {
  staff: [
    {
      id: "emp-yousef",
      kind: "employee",
      initials: "YH",
      name: bi("Dr. Yousef Al-Harbi", "د. يوسف الحربي"),
      short: bi("Dr. Yousef", "د. يوسف"),
      role: bi("Specialist ophthalmologist", "أخصائي عيون"),
      nationalId: "1045528831",
      licence: { no: "22R0041871", validTo: "2028-03-31" },
      mobile: "+966 50 771 3204",
      contactNationalId: "1045528831",
      clinic: "eyes",
      papers: [
        { id: "yh-scfhs", kind: "licence", title: bi("SCFHS licence", "رخصة الهيئة"), file: "SCFHS-22R0041871.pdf", format: "PDF", detail: bi("410 KB", "410 KB"), validTo: "2028-03-31", status: "valid", version: 1 },
        { id: "yh-bls", kind: "other", title: bi("BLS certificate", "شهادة الإنعاش BLS"), file: "BLS-Yousef.pdf", format: "PDF", detail: bi("220 KB", "220 KB"), validTo: "2027-06-30", status: "valid", version: 1 },
      ],
    },
    {
      id: "emp-amri",
      kind: "employee",
      initials: "YA",
      name: bi("Yousef Al-Amri", "يوسف العمري"),
      short: bi("Yousef", "يوسف"),
      role: bi("Lab technician", "فني مختبر"),
      nationalId: "1062281904",
      licence: { no: "19R0087120", validTo: "2027-08-31" },
      mobile: "+966 54 118 2203",
      contactNationalId: "1062281904",
    },
    {
      id: "emp-saleh",
      kind: "employee",
      initials: "YS",
      name: bi("Dr. Yousef Al-Saleh", "د. يوسف الصالح"),
      short: bi("Dr. Yousef", "د. يوسف"),
      role: bi("Locum dentist", "طبيب أسنان متعاقد"),
      nationalId: "1058830217",
      licence: { no: "21R0033458", validTo: "2027-11-30" },
      mobile: "+966 56 330 9182",
      contactNationalId: "1058830217",
    },
    {
      id: "emp-haddad",
      kind: "employee",
      initials: "OH",
      name: bi("Dr. Omar Haddad", "د. عمر حداد"),
      short: bi("Dr. Omar", "د. عمر"),
      role: bi("Consultant cardiologist", "استشاري قلب"),
      nationalId: "1056230118",
      licence: { no: "21RC1102", validTo: "2028-03-31" },
      mobile: "+966 50 611 2218",
      contactNationalId: "1056230118",
    },
    {
      id: "emp-harbi",
      kind: "employee",
      initials: "RH",
      name: bi("Reem Al-Harbi", "ريم الحربي"),
      short: bi("Reem", "ريم"),
      female: true,
      role: bi("Staff nurse", "ممرضة"),
      nationalId: "1077410392",
      licence: { no: "24RN3391", validTo: "2027-09-30" },
      mobile: "+966 55 902 1176",
      contactNationalId: "1077410392",
    },
    {
      id: "emp-mutlaq",
      kind: "employee",
      initials: "SM",
      name: bi("Dr. Sara Al-Mutlaq", "د. سارة المطلق"),
      short: bi("Dr. Sara", "د. سارة"),
      female: true,
      role: bi("Specialist dermatologist", "أخصائية جلدية"),
      nationalId: "1049920571",
      licence: { no: "22RS0915", validTo: "2027-12-31" },
      mobile: "+966 53 440 8812",
      contactNationalId: "1049920571",
    },
  ],
  partner: [
    {
      id: "co-alborg",
      kind: "company",
      initials: "AB",
      name: bi("Al Borg Diagnostics", "البرج للمختبرات"),
      short: bi("Al Borg", "البرج"),
      role: bi("Reference lab", "مختبر مرجعي"),
      cr: "1010234567",
      city: bi("Riyadh", "الرياض"),
      contact: { name: bi("Majed Al-Ghamdi", "ماجد الغامدي"), role: bi("CEO", "الرئيس التنفيذي"), mobile: "+966 55 310 2290" },
      mobile: "+966 55 310 2290",
      contactNationalId: "1033829105",
    },
    // Choose the partner (drawn): Delta Medical Labs and Smile Dental Lab with these CRs.
    {
      id: "co-deltalabs",
      kind: "company",
      initials: "DL",
      name: bi("Delta Medical Labs", "مختبرات دلتا الطبية"),
      short: bi("Delta Labs", "مختبرات دلتا"),
      role: bi("Reference lab", "مختبر مرجعي"),
      cr: "1010778812",
      city: bi("Riyadh", "الرياض"),
      mobile: "",
      contactNationalId: "",
    },
    {
      id: "co-smile",
      kind: "company",
      initials: "SD",
      name: bi("Smile Dental Lab", "مختبر سمايل للأسنان"),
      short: bi("Smile Dental Lab", "مختبر سمايل"),
      role: bi("Dental lab", "مختبر أسنان"),
      cr: "1010551290",
      city: bi("Riyadh", "الرياض"),
      mobile: "",
      contactNationalId: "",
    },
    {
      id: "co-delta",
      kind: "company",
      initials: "DM",
      name: bi("Delta Medical Supplies", "دلتا للمستلزمات الطبية"),
      short: bi("Delta", "دلتا"),
      role: bi("Medical supplies", "مستلزمات طبية"),
      cr: "1010455120",
      city: bi("Riyadh", "الرياض"),
      contact: { name: bi("Sami Al-Otaibi", "سامي العتيبي"), role: bi("Sales manager", "مدير المبيعات"), mobile: "+966 50 220 4410" },
      mobile: "+966 50 220 4410",
      contactNationalId: "1061183027",
    },
    {
      id: "co-radiology",
      kind: "company",
      initials: "RR",
      name: bi("Riyadh Radiology Center", "مركز الرياض للأشعة"),
      short: bi("Riyadh Radiology", "مركز الرياض للأشعة"),
      role: bi("Imaging", "الأشعة"),
      cr: "1010598841",
      city: bi("Riyadh", "الرياض"),
      contact: { name: bi("Dr. Huda Al-Shehri", "د. هدى الشهري"), role: bi("Medical director", "المديرة الطبية"), mobile: "+966 55 781 0043", female: true },
      mobile: "+966 55 781 0043",
      contactNationalId: "1052219874",
    },
  ],
  insurer: [
    {
      id: "ins-walaa",
      kind: "company",
      initials: "WL",
      name: bi("Walaa Cooperative Insurance", "ولاء للتأمين التعاوني"),
      short: bi("Walaa", "ولاء"),
      role: bi("Insurer", "شركة تأمين"),
      cr: "2050031105",
      cchiLicence: "44",
      city: bi("Al Khobar", "الخبر"),
      contact: { name: bi("Reem Al-Zahrani", "ريم الزهراني"), role: bi("Provider relations", "علاقات مقدمي الخدمة"), mobile: "+966 53 640 1187", female: true },
      // As drawn, Walaa's signatory shares the contact's mobile (reported).
      signatory: { initials: "KM", name: bi("Khalid Al-Mansour", "خالد المنصور"), role: bi("Network director", "مدير الشبكة الطبية"), mobile: "+966 53 640 1187", nationalId: "1050331877" },
      mobile: "+966 53 640 1187",
      contactNationalId: "1058812406",
    },
    {
      id: "ins-wataniya",
      kind: "company",
      initials: "WT",
      name: bi("Wataniya Insurance", "الوطنية للتأمين"),
      short: bi("Wataniya", "الوطنية"),
      role: bi("Insurer", "شركة تأمين"),
      cr: "4030177702",
      cchiLicence: "31",
      city: bi("Jeddah", "جدة"),
      mobile: "",
      contactNationalId: "",
    },
    {
      id: "ins-gig",
      kind: "company",
      initials: "GS",
      name: bi("GIG Saudi", "جي آي جي السعودية"),
      short: bi("GIG", "جي آي جي"),
      role: bi("Insurer", "شركة تأمين"),
      cr: "1010223310",
      cchiLicence: "32",
      city: bi("Riyadh", "الرياض"),
      contact: { name: bi("Khalid Al-Zahrani", "خالد الزهراني"), role: bi("Provider relations", "علاقات مقدمي الخدمة"), mobile: "+966 11 418 2200" },
      signatory: { initials: "SO", name: bi("Saad Al-Otaibi", "سعد العتيبي"), role: bi("Network director", "مدير الشبكة الطبية"), mobile: "+966 11 418 2299", nationalId: "1039920113" },
      mobile: "+966 11 418 2200",
      contactNationalId: "1044210935",
    },
  ],
}
