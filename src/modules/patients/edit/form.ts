import type { Bi } from "@/lib/mock/bi"
import type { IconName } from "@/components/ds/icon"
import { TODAY, type Gender, type Patient, type RegionKey } from "../data"
import type { PatientRecord } from "../profile/record"

/**
 * Edit patient form (Patients · Patient edit). Plain state + a pure validator; the same model will back the
 * Add-patient wizard. Option values are stable keys; labels come from the bilingual lists below.
 */

export type EditForm = {
  nameEn: string
  nameAr: string
  gender: Gender
  birthDate: string // ISO day, "" when unknown
  nationality: string
  classification: string
  mobile: string
  whatsapp: string
  sameWhatsapp: boolean
  email: string
  language: string
  smsReminders: boolean
  whatsappMessages: boolean
  idType: string
  idNumber: string
  city: string
  district: string
  street: string
  postal: string
  insurer: string
  insuranceClass: string
  policy: string
  expiry: string
  selfPay: boolean
  guardianName: string
  guardianRelation: string
  guardianMobile: string
  guardianId: string
  bloodType: string
  clinic: string
  allergies: string[]
  conditions: string[]
  notes: string
}

export type FieldKey = keyof EditForm

/** Extra fields of the Add-patient wizard. */
export type NewExtras = {
  payment: "insurance" | "selfPay"
  noAllergies: boolean
  emergencyName: string
  emergencyMobile: string
  consent: boolean
  welcomeSms: boolean
}
export type FullForm = EditForm & NewExtras
export type PatientForm = EditForm & Partial<NewExtras>
export type AnyKey = keyof FullForm
export type SectionKey = "personal" | "contact" | "identity" | "address" | "insurance" | "guardian" | "medical"

export const SECTIONS: { key: SectionKey; icon: IconName; fields: FieldKey[] }[] = [
  { key: "personal", icon: "user", fields: ["nameEn", "nameAr", "gender", "birthDate", "nationality", "classification"] },
  { key: "contact", icon: "call", fields: ["mobile", "whatsapp", "email", "language"] },
  { key: "identity", icon: "personalcard", fields: ["idType", "idNumber"] },
  { key: "address", icon: "location", fields: ["city", "district", "street", "postal"] },
  { key: "insurance", icon: "shield-tick", fields: ["insurer", "insuranceClass", "policy", "expiry"] },
  { key: "guardian", icon: "people", fields: ["guardianName", "guardianRelation", "guardianMobile", "guardianId"] },
  { key: "medical", icon: "health", fields: ["bloodType", "clinic", "allergies", "conditions", "notes"] },
]

/** The 10 required profile fields behind "Profile completeness" (guardian fields are required too, for minors). */
export const CORE_REQUIRED: FieldKey[] = ["nameEn", "nameAr", "gender", "birthDate", "nationality", "mobile", "idType", "idNumber", "city", "street"]
const GUARDIAN_REQUIRED: FieldKey[] = ["guardianName", "guardianRelation", "guardianMobile"]

export const sectionOf = (f: FieldKey) => SECTIONS.find((s) => s.fields.includes(f))!.key

/* ---------------------------------------------------------------- options */

type Opt = { value: string; label: Bi }
const o = (value: string, en: string, ar: string): Opt => ({ value, label: { en, ar } })

export const OPTIONS = {
  nationality: [
    o("sa", "Saudi", "سعودي"),
    o("eg", "Egyptian", "مصري"),
    o("jo", "Jordanian", "أردني"),
    o("ye", "Yemeni", "يمني"),
    o("sy", "Syrian", "سوري"),
    o("in", "Indian", "هندي"),
    o("pk", "Pakistani", "باكستاني"),
    o("ph", "Filipino", "فلبيني"),
    o("other", "Other", "أخرى"),
  ],
  classification: [o("regular", "Regular", "عادي"), o("vip", "VIP", "VIP")],
  language: [o("ar", "Arabic", "العربي"), o("en", "English", "الإنجليزي")],
  idType: [o("national", "National ID", "هوية وطنية"), o("iqama", "Iqama", "إقامة"), o("passport", "Passport", "جواز سفر")],
  city: [
    o("riyadh", "Riyadh", "الرياض"),
    o("jeddah", "Jeddah", "جدة"),
    o("dammam", "Dammam", "الدمام"),
    o("khobar", "Al Khobar", "الخبر"),
    o("makkah", "Makkah", "مكة"),
    o("madinah", "Madinah", "المدينة"),
    o("abha", "Abha", "أبها"),
    o("tabuk", "Tabuk", "تبوك"),
    o("qassim", "Qassim", "القصيم"),
    o("hail", "Hail", "حائل"),
    o("jazan", "Jazan", "جازان"),
  ],
  insurer: [o("bupa", "Bupa Arabia", "بوبا العربية"), o("tawuniya", "Tawuniya", "التعاونية"), o("medgulf", "MedGulf", "ميدغلف"), o("allianz", "Allianz", "أليانز")],
  insuranceClass: [o("a", "Class A", "فئة A"), o("b", "Class B", "فئة B"), o("c", "Class C", "فئة C"), o("vip", "VIP", "VIP")],
  guardianRelation: [o("father", "Father", "الأب"), o("mother", "Mother", "الأم"), o("brother", "Brother", "الأخ"), o("sister", "Sister", "الأخت"), o("other", "Other", "أخرى")],
  bloodType: ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"].map((v) => o(v, v, v)),
  bloodTypeOrUnknown: [o("unknown", "Unknown", "ما نعرف"), ...["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"].map((v) => o(v, v, v))],
  clinic: [
    o("pediatrics", "Pediatrics", "الأطفال"),
    o("family", "Family medicine", "طب الأسرة"),
    o("dental", "Dental", "الأسنان"),
    o("cardiology", "Cardiology", "القلب"),
    o("dermatology", "Dermatology", "الجلدية"),
  ],
} satisfies Record<string, Opt[]>

export type OptionKey = keyof typeof OPTIONS
export const optionLabel = (k: OptionKey, v: string) => OPTIONS[k].find((x) => x.value === v)?.label

export const CITY_REGION: Record<string, RegionKey> = {
  riyadh: "riyadh",
  jeddah: "jeddah",
  dammam: "eastern",
  khobar: "eastern",
  makkah: "makkah",
  madinah: "madinah",
}

/* ---------------------------------------------------------------- phone helpers */

const digits = (s: string) => s.replace(/\D/g, "")
/** "059 300 1287" → "+966 59 300 1287" (form display). */
export function toIntl(local: string | null) {
  if (!local) return ""
  const d = digits(local).replace(/^0/, "")
  return `+966 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`
}
/** "+966 59 300 1287" / "0593001287" → "059 300 1287" (list format), or null when not a Saudi mobile. */
export function toLocal(intl: string) {
  let d = digits(intl)
  if (d.startsWith("966")) d = d.slice(3)
  if (d.startsWith("0")) d = d.slice(1)
  return /^5\d{8}$/.test(d) ? `0${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : null
}

export function ageFrom(birthDate: string) {
  if (!birthDate) return null
  const [y, m, d] = birthDate.split("-").map(Number)
  const [ty, tm, td] = TODAY.split("-").map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

/* ---------------------------------------------------------------- initial values */

function hash(s: string) {
  let h = 7
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

const STREETS = ["King Fahd Rd", "Prince Sultan St", "Olaya St", "Takhassusi St", "King Abdullah Rd", "Tahlia St"]

/** Free-text values (district, guardian, allergies, notes) start in the page language; codes stay language-neutral. */
export function initialForm(p: Patient, r: PatientRecord, locale: string): EditForm {
  const L = (v: Bi) => (locale === "ar" ? v.ar : v.en)
  const d = r.details
  const fahad = p.id === "004891"
  const h = hash(p.mrn)
  const city = p.city ? (OPTIONS.city.find((c) => c.label.en === p.city!.en)?.value ?? "riyadh") : p.region === "eastern" ? "dammam" : p.region === "other" ? "riyadh" : p.region
  const insured = d.insurance
  const insurerName = insured?.en.split(" · ")[0]
  const minor = p.age < 18
  const family = L(p.name).split(" ").slice(1).join(" ")
  const FATHERS: Bi[] = [{ en: "Abdullah", ar: "عبدالله" }, { en: "Khaled", ar: "خالد" }, { en: "Saad", ar: "سعد" }, { en: "Faisal", ar: "فيصل" }]
  return {
    nameEn: p.name.en,
    nameAr: p.name.ar,
    gender: p.gender,
    birthDate: r.missing.includes("birthDate") ? "" : d.birthDate,
    nationality: r.missing.includes("nationality") ? "" : "sa",
    classification: p.tags.includes("vip") ? "vip" : "regular",
    mobile: toIntl(p.mobile),
    whatsapp: toIntl(d.whatsapp),
    sameWhatsapp: d.whatsapp === p.mobile,
    email: "",
    language: "ar",
    smsReminders: true,
    whatsappMessages: true,
    idType: "national",
    idNumber: d.nationalId ?? "",
    city,
    district: d.district ? L(d.district) : "",
    street: r.missing.includes("address") ? "" : `${STREETS[h % STREETS.length]}, Bldg ${(h % 40) + 1}`,
    postal: r.missing.includes("address") ? "" : String(11000 + (h % 8000)),
    insurer: insured ? (insurerName === "Bupa" ? "bupa" : insurerName === "Tawuniya" ? "tawuniya" : "medgulf") : "",
    insuranceClass: insured ? (insured.en.endsWith("B") ? "b" : "a") : "",
    policy: fahad ? "BP-2210 4471" : insured ? `${insurerName === "Bupa" ? "BP" : "TW"}-${String(h % 9000 + 1000)} ${String((h >> 4) % 9000 + 1000)}` : "",
    expiry: insured ? "2026-12-31" : "",
    selfPay: !insured,
    guardianName: !minor ? "" : fahad ? L({ en: "Abdullah Al-Dosari", ar: "عبدالله الدوسري" }) : `${L(FATHERS[h % 4])} ${family}`,
    guardianRelation: minor ? "father" : "",
    guardianMobile: !minor ? "" : fahad ? "+966 50 771 2045" : toIntl(p.mobile),
    guardianId: !minor ? "" : fahad ? "1022 456 781" : "",
    bloodType: d.bloodType ?? "",
    clinic: fahad ? "pediatrics" : minor ? "pediatrics" : "family",
    allergies: r.allergies.map((a) => L(a.name)),
    conditions: fahad ? [L({ en: "Asthma · mild", ar: "الربو · خفيف" })] : [],
    notes: fahad ? L({ en: "Uses his inhaler before sports. Prefers morning visits.", ar: "يستخدم البخاخ قبل الرياضة. يفضّل مواعيد الصبح." }) : "",
  }
}

/* ---------------------------------------------------------------- validation */

export type ErrorKey =
  | "required"
  | "idRequired"
  | "streetRequired"
  | "mobile"
  | "email"
  | "nationalId"
  | "iqama"
  | "passport"
  | "postal"
  | "birthFuture"
  | "nameArabic"
  | "consent"

export function validate(f: EditForm): Partial<Record<FieldKey, ErrorKey>> {
  const e: Partial<Record<FieldKey, ErrorKey>> = {}
  const age = ageFrom(f.birthDate)
  const required: FieldKey[] = [...CORE_REQUIRED, ...(age !== null && age < 18 ? GUARDIAN_REQUIRED : [])]
  for (const k of required) {
    const v = f[k]
    if (v === "" || v === "unset") e[k] = k === "idNumber" ? "idRequired" : k === "street" ? "streetRequired" : "required"
  }
  if (f.nameAr && !e.nameAr && !/[؀-ۿ]/.test(f.nameAr)) e.nameAr = "nameArabic"
  if (f.birthDate && f.birthDate > TODAY) e.birthDate = "birthFuture"
  if (f.mobile && !toLocal(f.mobile)) e.mobile = "mobile"
  if (!f.sameWhatsapp && f.whatsapp && !toLocal(f.whatsapp)) e.whatsapp = "mobile"
  if (f.guardianMobile && !toLocal(f.guardianMobile)) e.guardianMobile = "mobile"
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "email"
  const id = f.idNumber.replace(/\s/g, "")
  if (id) {
    if (f.idType === "national" && !/^1\d{9}$/.test(id)) e.idNumber = "nationalId"
    if (f.idType === "iqama" && !/^2\d{9}$/.test(id)) e.idNumber = "iqama"
    if (f.idType === "passport" && !/^[A-Za-z0-9]{6,9}$/.test(id)) e.idNumber = "passport"
  }
  if (f.postal && !/^\d{5}$/.test(f.postal)) e.postal = "postal"
  return e
}

/** Fields that differ from the initial values (for the unsaved-changes dialog). */
export function changedFields(a: EditForm, b: EditForm) {
  return (Object.keys(a) as FieldKey[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
}
