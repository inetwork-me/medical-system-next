import type { Bi } from "@/lib/mock/bi"
import { ORG_DEFAULT } from "@/lib/org"

/**
 * Settings seed data (design v9.0). The demo clock matches the other modules (Wed 25 Nov 2026). Later build steps replace
 * the summary numbers here with the real lists (users, roles, integrations, rules, plan usage) they are counted from.
 */
export const SET_TODAY = "2026-11-25"
export const SET_NOW = "2026-11-25T11:00"

const bi = (en: string, ar: string): Bi => ({ en, ar })

/** The center (General): names per language; the short name is the SMS sender. Saved changes: lib/org. */
export const ORG = {
  name: ORG_DEFAULT.name,
  short: ORG_DEFAULT.short,
}

/** Any branch key ("olaya", "malaz", "jeddah", "diriyah", and branches added in Settings). */
export type BranchKey = string
export type BranchStatus = "open" | "draft" | "closed"
/** Fridays: closed, evening only (16:00 to closing), or open all day. */
export type FridayRule = "closed" | "evening" | "open"
export type Branch = {
  key: BranchKey
  name: Bi
  city: Bi
  address: Bi
  phone: string
  status: BranchStatus
  main?: boolean
  /** Hours Saturday–Thursday; Fridays follow `friday`. */
  opens?: string
  closes?: string
  friday: FridayRule
  /** Shown on patient booking (patient app / website). */
  booking: boolean
  /** A draft's planned opening ("Opening Feb 2027"). */
  opening?: string
}

export const CITIES: Bi[] = [bi("Riyadh", "الرياض"), bi("Jeddah", "جدة"), bi("Dammam", "الدمام"), bi("Khobar", "الخبر"), bi("Makkah", "مكة"), bi("Madinah", "المدينة")]

/**
 * Branches (design): Olaya (main, King Fahd Rd), Malaz (Salah Al-Din St) and Jeddah (Al Rawdah) are open; Diriyah is a draft
 * opening Feb 2027.
 */
export const SET_BRANCHES: Branch[] = [
  {
    key: "olaya", name: bi("Olaya", "العليا"), city: bi("Riyadh", "الرياض"), address: bi("King Fahd Rd", "طريق الملك فهد"), phone: "0112345600",
    status: "open", main: true, opens: "07:00", closes: "23:00", friday: "evening", booking: true,
  },
  {
    key: "malaz", name: bi("Malaz", "الملز"), city: bi("Riyadh", "الرياض"), address: bi("Salah Al-Din St", "شارع صلاح الدين"), phone: "0114789200",
    status: "open", opens: "08:00", closes: "22:00", friday: "closed", booking: true,
  },
  {
    key: "jeddah", name: bi("Jeddah", "جدة"), city: bi("Jeddah", "جدة"), address: bi("Al Rawdah", "الروضة"), phone: "0126654300",
    status: "open", opens: "08:00", closes: "22:00", friday: "evening", booking: true,
  },
  {
    key: "diriyah", name: bi("Diriyah", "الدرعية"), city: bi("Riyadh", "الرياض"), address: bi("Al Bujairi", "البجيري"), phone: "0112345678",
    status: "draft", friday: "closed", booking: false, opening: "2027-02-01",
  },
]

/** ZATCA EGS units: one per open branch; Jeddah's certificate lapses on 7 Dec (12 days from the demo date). */
export type ZatcaUnit = { branch: BranchKey; unit: string; certUntil: string; today: number }
export const ZATCA_UNITS: ZatcaUnit[] = [
  { branch: "olaya", unit: "EGS-OLY-01", certUntil: "2027-08-14", today: 212 },
  { branch: "malaz", unit: "EGS-MLZ-01", certUntil: "2027-03-02", today: 96 },
  { branch: "jeddah", unit: "EGS-JED-01", certUntil: "2026-12-07", today: 74 },
]
/** Today across the units: standard (B2B) invoices are cleared before sending, simplified ones reported within 24 h. */
export const ZATCA_TODAY = { cleared: 41, reported: 341, rejected: 0 }
/** Accepted with a warning — fix on the next invoice (rule code, invoice, when). */
export const ZATCA_WARNINGS: { rule: string; invoice: string; what: Bi; at: string }[] = [
  { rule: "BR-KSA-F-06", invoice: "INV-2611-0241", what: bi("Buyer address missing a building number", "عنوان المشتري ناقصه رقم المبنى"), at: "2026-11-25T10:05" },
  { rule: "BR-KSA-08", invoice: "INV-2611-0236", what: bi("Buyer VAT number format", "صيغة الرقم الضريبي للمشتري"), at: "2026-11-24T16:20" },
]

/** Integration facts the cards show (live ones — ZATCA, mada, mail, SMS — are computed). */
export const INTEGRATION_FACTS = {
  nphiesChecked: "2026-11-25T10:58",
  sehaMonth: 214,
  yakeenMonth: 1240,
  nafathKeyRenewed: "2026-11-24T21:05",
  mada: { terminals: 6, offline: [{ branch: "malaz", name: { en: "Malaz 2", ar: "الملز 2" } }] },
  analyzers: 4,
}
/** A certificate this close to expiry is a warning on Overview and Integrations. */
export const CERT_WARN_DAYS = 30

/** 2-step becomes required for doctors and billing from this date (the required roles live in Security). */
export const TWO_STEP_FROM = "2026-12-01"

/** Integrations: nine cards. */
export const INTEGRATION_COUNT = 9

/* ------------------------------------------------------------------ plan and subscription */

export type PlanId = "basic" | "pro" | "hospital"
export const PLANS: Record<PlanId, { name: Bi; monthly: number; branches: number | null; users: number; inpatients?: boolean }> = {
  basic: { name: bi("Clinic Basic", "عيادة أساسي"), monthly: 2900, branches: 1, users: 40 },
  pro: { name: bi("Clinic Pro", "عيادة برو"), monthly: 4800, branches: 5, users: 120 },
  hospital: { name: bi("Hospital", "مستشفى"), monthly: 9500, branches: null, users: 400, inpatients: true },
}
/** Yearly billing: 12 months for the price of 10. */
export const YEARLY_MONTHS = 10

/** The center's subscription (design): Clinic Pro, yearly, renews 1 Mar 2027. Usage resets on the 1st. */
export const PLAN = {
  id: "pro" as PlanId,
  billing: "yearly" as "yearly" | "monthly",
  name: PLANS.pro.name,
  renews: "2027-03-01",
  sms: { used: 8420, quota: 10000 },
  whatsapp: { used: 1930, quota: 3000 },
  storageGb: { used: 412, quota: 1024 },
}

export type AddonId = "eyesDental" | "extraBranch" | "smsBundle"
export const ADDONS: { id: AddonId; icon: "eye" | "location" | "sms"; name: Bi; price: number; per: "month" | "monthEach" | "once"; on?: boolean }[] = [
  { id: "eyesDental", icon: "eye", name: bi("Eyes and dental pack", "باقة العيون والأسنان"), price: 600, per: "month", on: true },
  { id: "extraBranch", icon: "location", name: bi("Extra branch", "فرع إضافي"), price: 900, per: "monthEach" },
  { id: "smsBundle", icon: "sms", name: bi("SMS bundle · 10,000", "باقة رسائل · 10,000"), price: 350, per: "once" },
]

export type SubInvoice = { no: string; amount: number; date: Bi | string; what: Bi; paid: boolean }
export const SUB_INVOICES: SubInvoice[] = [
  { no: "SUB-2603-001", amount: 57600, date: "2026-03-01", what: bi("Clinic Pro · yearly", "عيادة برو · سنوي"), paid: true },
  { no: "SUB-2609-014", amount: 350, date: "2026-09-12", what: bi("SMS bundle · 10,000", "باقة رسائل · 10,000"), paid: true },
  { no: "SUB-2611-022", amount: 350, date: "2026-11-18", what: bi("SMS bundle · 10,000", "باقة رسائل · 10,000"), paid: true },
]
export const PAYMENT = { method: bi("Bank transfer · SADAD", "تحويل بنكي · سداد"), email: "finance@alnoor.sa" }

/* ------------------------------------------------------------------ my account */

/** The signed-in user's own settings (My account): profile, preferences, sign-in, personal alerts, devices. */
export const ACCOUNT_DEFAULT = {
  name: bi("Khaled Mansour", "خالد منصور"),
  title: bi("Consultant cardiologist", "استشاري قلب"),
  headline: bi("Medical director · head of cardiology", "المدير الطبي · رئيس قسم القلب"),
  mobile: "0551234567",
  photo: undefined as string | undefined,
  /** Unset until chosen: follows the language the app is in. */
  language: undefined as "en" | "ar" | undefined,
  startPage: "/dashboard",
  calendar: "day" as "day" | "week" | "month" | "list",
  passwordChanged: "2026-09-21",
  mentions: true,
  daily: false,
}
export type Account = typeof ACCOUNT_DEFAULT

/** Usage over this share shows on Overview (brief §4 · Plan). */
export const USAGE_WARN = 0.8

/* ------------------------------------------------------------------ modules per branch */

/** What each branch has switched off (module ids, and "<module>.<tab>" incl. the record tabs "patients.eyes" / "patients.dental"). */
export type BranchModules = { hiddenModules: string[]; hiddenTabs: string[] }

/**
 * Seed (design): Olaya, the main branch, runs everything. Malaz has no Finance or Official returns reports (the main branch
 * files them) and no eye or dental clinic (referred to Olaya); Jeddah has no eye or dental clinic either. Diriyah, a draft,
 * has nothing switched on yet beyond Dashboard and Patients.
 */
export const OFF_ALL = ["appointments", "doctors", "clinics", "lab", "billing", "records", "reports", "messages"]
export const BRANCH_MODULES: Record<BranchKey, BranchModules> = {
  olaya: { hiddenModules: [], hiddenTabs: [] },
  malaz: { hiddenModules: [], hiddenTabs: ["reports.finance", "reports.returns", "patients.eyes", "patients.dental"] },
  jeddah: { hiddenModules: [], hiddenTabs: ["patients.eyes", "patients.dental"] },
  diriyah: { hiddenModules: OFF_ALL, hiddenTabs: ["patients.eyes", "patients.dental"] },
}

/** Open work per branch that must finish or move before a module turns off (Lab orders at Malaz: 12). */
export const OPEN_ITEMS: Record<BranchKey, Partial<Record<string, number>>> = {
  olaya: { lab: 37, appointments: 214, billing: 9, records: 18, messages: 7 },
  malaz: { lab: 12 },
  jeddah: { lab: 19, appointments: 96, billing: 4, records: 6, messages: 3 },
  diriyah: {},
}

/** Scheduled turn-offs run tonight at this time. */
export const TONIGHT = "23:00"
