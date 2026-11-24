import type { Bi } from "@/lib/mock/bi"
import { ARCHIVE_ENCOUNTERS, ARCHIVE_PATIENTS } from "./archive"
import { ENCOUNTERS, PATIENTS, REC_NOW, REC_TODAY, type Encounter, type PatientKey, type RecPatient, type UserKey, type VisitNote } from "./data"

/*
 * Visits (design v7.1). A visit is one encounter: booked → checked in → vitals → with the doctor → checked out, plus
 * everything made during it. The visit note, its orders, the prescription and the documents carry the visit's id
 * (`encounter` on those records is the visit_id); Billing invoices carry it as `visitId` and claims through their
 * invoice. Status comes from the timestamps (visitStatus). Sample rows are the design's; the rest of November is
 * generated from a fixed seed so the tab's counts (Today 142 · Still here 23 · Not checked out 6 · This month 8,412)
 * and the missing-data view (38 visits from 21 patients without a nationality) agree with each other and with the
 * MOH return ("Outpatient visits 8,412").
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

/* ------------------------------------------------------------------ vocabularies */

export type ClinicId = "cardiology" | "dermatology" | "pediatrics" | "urgent" | "dental" | "family" | "lab" | "emergency"
export const CLINICS: Record<ClinicId, Bi> = {
  cardiology: bi("Cardiology", "القلب"),
  dermatology: bi("Dermatology", "الجلدية"),
  pediatrics: bi("Pediatrics", "الأطفال"),
  urgent: bi("Urgent care", "الرعاية العاجلة"),
  dental: bi("Dental", "الأسنان"),
  family: bi("Family medicine", "طب الأسرة"),
  lab: bi("Lab", "المختبر"),
  emergency: bi("Emergency", "الطوارئ"),
}
export const CLINIC_IDS = Object.keys(CLINICS) as ClinicId[]

/** The clinic a doctor works in (doctors see the Visits tab for their own clinic). */
export const DOCTOR_CLINIC: Partial<Record<UserKey, ClinicId>> = {
  khaled: "cardiology",
  sami: "urgent",
  zaki: "pediatrics",
  hala: "dermatology",
  rayan: "emergency",
}

/** Branch names as visits show them ("Riyadh main"). */
export const BRANCH_NAMES: Record<string, Bi> = {
  "riyadh-main": bi("Riyadh main", "الرياض الرئيسي"),
  "riyadh-north": bi("Riyadh north", "شمال الرياض"),
  jeddah: bi("Jeddah", "جدة"),
}

export type VisitType = "followUp" | "new" | "urgent" | "procedure" | "labOnly"
export type Payer = "bupa" | "tawuniya" | "medgulf" | "rajhi" | "self"
export const PAYERS: Record<Payer, Bi> = {
  bupa: bi("Bupa Arabia", "بوبا العربية"),
  tawuniya: bi("Tawuniya", "التعاونية"),
  medgulf: bi("MedGulf", "ميدغلف"),
  rajhi: bi("Al Rajhi Takaful", "تكافل الراجحي"),
  self: bi("Self-pay", "على حسابه"),
}
/** "Bupa · class B" (For official returns) uses the short insurer name. */
export const PAYER_SHORT: Record<Payer, Bi> = { bupa: bi("Bupa", "بوبا"), tawuniya: bi("Tawuniya", "التعاونية"), medgulf: bi("MedGulf", "ميدغلف"), rajhi: bi("Al Rajhi Takaful", "تكافل الراجحي"), self: bi("Self-pay", "على حسابه") }

export type IdType = "national" | "iqama" | "border" | "passport" | "gcc"
/** Add nationality offers these; Add ID number offers National ID · Iqama · Border no. · Passport. */
export const ID_TYPES: IdType[] = ["national", "iqama", "passport", "gcc"]
export const ID_TYPES_ADD: IdType[] = ["national", "iqama", "border", "passport"]

/** Nationalities offered in Add nationality (ISO 3166 alpha-2). */
export const NATIONALITIES: Record<string, Bi> = {
  SA: bi("Saudi", "سعودي"),
  EG: bi("Egyptian", "مصري"),
  IN: bi("Indian", "هندي"),
  PK: bi("Pakistani", "باكستاني"),
  BD: bi("Bangladeshi", "بنغلاديشي"),
  PH: bi("Filipino", "فلبيني"),
  YE: bi("Yemeni", "يمني"),
  SD: bi("Sudanese", "سوداني"),
  JO: bi("Jordanian", "أردني"),
  SY: bi("Syrian", "سوري"),
  ID: bi("Indonesian", "إندونيسي"),
  NP: bi("Nepali", "نيبالي"),
  LK: bi("Sri Lankan", "سريلانكي"),
  NG: bi("Nigerian", "نيجيري"),
  KE: bi("Kenyan", "كيني"),
  KW: bi("Kuwaiti", "كويتي"),
  AE: bi("Emirati", "إماراتي"),
  BH: bi("Bahraini", "بحريني"),
  OM: bi("Omani", "عماني"),
  QA: bi("Qatari", "قطري"),
  US: bi("American", "أمريكي"),
  GB: bi("British", "بريطاني"),
}
export const GCC = ["KW", "AE", "BH", "OM", "QA"]

/** Patient fields an official return needs: nationality and an ID (type + number). Kept on the patient's file. */
export type PatientIds = { nationality?: string; idType?: IdType; idNumber?: string }

/** Main diagnoses of the generated visits that aren't in the note's ICD-10 list. */
export const VISIT_DX: Record<string, Bi> = {
  "L20.9": bi("eczema", "إكزيما"),
  "L70.0": bi("acne", "حب الشباب"),
  "J06.9": bi("upper respiratory infection", "التهاب الجهاز التنفسي العلوي"),
  "A09": bi("gastroenteritis", "نزلة معوية"),
  "J02.9": bi("sore throat", "التهاب الحلق"),
  "S93.4": bi("ankle sprain", "التواء الكاحل"),
  "K02.9": bi("tooth decay", "تسوّس الأسنان"),
  "K05.1": bi("gum inflammation", "التهاب اللثة"),
  "Z01.7": bi("lab tests", "تحاليل"),
}

/* ------------------------------------------------------------------ the visit */

export type BookedVia = "app" | "phone" | "callCentre" | "reception"

export type Visit = {
  /** V-YYMM-nnnnn. */
  id: string
  patient: PatientKey
  branch: string
  clinic: ClinicId
  room?: number
  /** A Medical records user when the doctor is one (their visits open their notes); `doctorName` otherwise. */
  doctor?: UserKey
  doctorName: Bi
  type: VisitType
  payer: Payer
  payerClass?: string
  /** Insurer pre-approval for the visit; none = not needed. */
  approval?: string
  /** Main diagnosis when the visit has no visit note here (a visit note's main diagnosis wins). */
  dx?: string
  booked_at?: string
  booked_via?: BookedVia
  checked_in_at: string
  checked_in_by?: Bi
  vitals_at?: string
  vitals_by?: Bi
  seen_from?: string
  seen_to?: string
  checked_out_at?: string
  /** Who took the payment at check-out. */
  paid_by?: Bi
  /** The visit's invoice and claim (the numbers the visit shows; `opens` is the Billing sample page they open). */
  /** The visit's Billing invoice (its number; amounts come from Billing). */
  invoice?: string
  /** Insurance claim: goes out in the nightly NPHIES batch, so it has no number until then. */
  claim?: { no?: string; status: "batch" | "waiting" | "approved" | "rejected" }
}

export type VisitStatus = "waiting" | "withDoctor" | "checkedOut" | "notCheckedOut"

/** Open this long after the doctor (or the lab) finished → the patient left without checking out. */
export const LEFT_AFTER_HOURS = 2

const minutes = (a: string, b: string) => (new Date(`${b}:00Z`).getTime() - new Date(`${a}:00Z`).getTime()) / 60000

/**
 * Status from the timestamps: checked out → Checked out; still open at the end of its day (or two hours after the
 * doctor finished) → Not checked out; with a doctor (seen, not finished) → With doctor; otherwise Waiting.
 */
export function visitStatus(v: Visit, now: string = REC_NOW): VisitStatus {
  if (v.checked_out_at) return "checkedOut"
  if (v.checked_in_at.slice(0, 10) < now.slice(0, 10)) return "notCheckedOut"
  if (v.seen_to && minutes(v.seen_to, now) >= LEFT_AFTER_HOURS * 60) return "notCheckedOut"
  if (v.seen_from) return "withDoctor"
  return "waiting"
}
export const isStillHere = (v: Visit) => {
  const s = visitStatus(v)
  return v.checked_in_at.slice(0, 10) === REC_TODAY && (s === "waiting" || s === "withDoctor")
}

/** The note of a visit (visit_id = the note's `encounter`). */
export const noteOfVisit = (notes: VisitNote[], id: string) => notes.find((n) => n.encounter === id)

/* ------------------------------------------------------------------ seed */

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const at = (day: number, hm: string) => `2026-11-${String(day).padStart(2, "0")}T${hm}`
const hm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
const plus = (iso: string, m: number) => {
  const [h, mm] = iso.slice(11, 16).split(":").map(Number)
  return `${iso.slice(0, 11)}${hm(Math.min(h * 60 + mm + m, 23 * 60 + 59))}`
}

const BRANCH = "riyadh-main"
const NORA = bi("Nora Al-Fahad", "نورة الفهد")
const AMAL = bi("Amal", "أمل")
const ALI = bi("Ali Al-Zahrani", "علي الزهراني")
const RECEPTION = [NORA, bi("Sultan Al-Harthi", "سلطان الحارثي"), bi("Rawan Al-Qarni", "روان القرني")]
const NURSES = [AMAL, bi("Huda", "هدى"), bi("Joy", "جوي")]
const CASHIERS = [ALI, bi("Faris Al-Otaibi", "فارس العتيبي")]
const LAB_TEAM = bi("Lab team", "فريق المختبر")

/** Doctors of the clinics that aren't Medical records users. */
const OTHER_DOCTORS: Partial<Record<ClinicId, Bi[]>> = {
  dental: [bi("Dr. Lama Al-Rasheed", "د. لمى الرشيد"), bi("Dr. Waleed Al-Saif", "د. وليد السيف")],
  family: [bi("Dr. Mona Al-Ali", "د. منى العلي"), bi("Dr. Tariq Al-Hamad", "د. طارق الحمد")],
  dermatology: [],
}
const DOCTOR_NAMES: Partial<Record<UserKey, Bi>> = {
  khaled: bi("Dr. Khaled Mansour", "د. خالد منصور"),
  sami: bi("Dr. Sami Al-Otaibi", "د. سامي العتيبي"),
  zaki: bi("Dr. Ahmed Zaki", "د. أحمد زكي"),
  hala: bi("Dr. Hala Nasser", "د. هالة ناصر"),
  rayan: bi("Dr. Rayan Al-Harbi", "د. ريان الحربي"),
}
const doctorFor = (clinic: ClinicId, r: number): { doctor?: UserKey; doctorName: Bi } => {
  if (clinic === "lab") return { doctorName: LAB_TEAM }
  const users = (Object.keys(DOCTOR_CLINIC) as UserKey[]).filter((k) => DOCTOR_CLINIC[k] === clinic)
  const others = OTHER_DOCTORS[clinic] ?? []
  const pool: { doctor?: UserKey; doctorName: Bi }[] = [...users.map((k) => ({ doctor: k, doctorName: DOCTOR_NAMES[k]! })), ...others.map((n) => ({ doctorName: n }))]
  return pool[Math.floor(r * pool.length)]
}
const DX_BY_CLINIC: Record<ClinicId, string[]> = {
  cardiology: ["I10", "I25.1", "I48", "E78.5", "R00.2"],
  dermatology: ["L20.9", "L70.0", "L98.9"],
  pediatrics: ["J06.9", "A09"],
  urgent: ["J02.9", "S93.4", "J06.9", "R07.4"],
  dental: ["K02.9", "K05.1"],
  family: ["E11.9", "I10", "J06.9", "M54.5"],
  lab: ["Z01.7"],
  emergency: ["R07.4", "S93.4"],
}

/* ------------------------------------------------------------------ patients of the Visits screens */

const vp = (initials: string, en: string, ar: string, mrn: string, age: number, sex: "m" | "f"): RecPatient => ({ initials, name: bi(en, ar), mrn, age, sex, careTeam: [], allergies: [] })

/** The design's patients without a nationality (Visits · Missing nationality) and the other undrawn gaps. */
export const VISIT_PATIENTS: Record<string, RecPatient> = {
  kumar: vp("RK", "Rakesh Kumar", "راكيش كومار", "MRN-25102", 41, "m"),
  abdelrahman: vp("MA", "Mohammed Abdelrahman", "محمد عبدالرحمن", "MRN-24788", 36, "m"),
  santos: vp("JS", "Jose Santos", "خوسيه سانتوس", "MRN-25230", 33, "m"),
  hassan: vp("AH", "Ahmed Hassan", "أحمد حسن", "MRN-24976", 7, "m"),
  fkhan: vp("FK", "Fatima Khan", "فاطمة خان", "MRN-25011", 29, "f"),
  smutairi: vp("SM", "Sultan Al-Mutairi", "سلطان المطيري", "MRN-25311", 63, "m"),
  begum: vp("NB", "Noor Begum", "نور بيغم", "MRN-25088", 45, "f"),
  // The other 14 of the 21 (older visits this month, so they list after the drawn rows).
  patel: vp("RP", "Ravi Patel", "رافي باتيل", "MRN-24611", 38, "m"),
  yusuf: vp("AY", "Amina Yusuf", "أمينة يوسف", "MRN-24630", 27, "f"),
  okafor: vp("SO", "Samuel Okafor", "صامويل أوكافور", "MRN-24652", 44, "m"),
  mahmoud: vp("HM", "Hassan Mahmoud", "حسن محمود", "MRN-24677", 52, "m"),
  delacruz: vp("GD", "Grace Dela Cruz", "غريس ديلا كروز", "MRN-24690", 31, "f"),
  qureshi: vp("BQ", "Bilal Qureshi", "بلال قريشي", "MRN-24702", 35, "m"),
  msaleh: vp("MS", "Mariam Saleh", "مريم صالح", "MRN-24715", 24, "f"),
  aziz: vp("TA", "Tariq Aziz", "طارق عزيز", "MRN-24731", 48, "m"),
  rai: vp("SR", "Shanti Rai", "شانتي راي", "MRN-24744", 30, "f"),
  hossain: vp("KH", "Kamal Hossain", "كمال حسين", "MRN-24758", 39, "m"),
  lhaddad: vp("LH", "Leila Haddad", "ليلى حداد", "MRN-24763", 26, "f"),
  mwangi: vp("PM", "Peter Mwangi", "بيتر موانغي", "MRN-24780", 42, "m"),
  zali: vp("ZA", "Zainab Ali", "زينب علي", "MRN-24796", 33, "f"),
  farouk: vp("OF", "Omar Farouk", "عمر فاروق", "MRN-24805", 57, "m"),
  // A nationality but no ID number on file (Visits · Missing ID number, with Nasser Al-Otaibi).
  ymahmoud: vp("YM", "Yasser Mahmoud", "ياسر محمود", "MRN-25140", 39, "m"),
  tqahtani: vp("TQ", "Tariq Al-Qahtani", "طارق القحطاني", "MRN-25333", 28, "m"),
  abakr: vp("AB", "Ali Bakr", "علي بكر", "MRN-25019", 46, "m"),
}

/** The 14 undrawn patients missing a nationality: [key, clinic, visits (day of November)]. */
const MISSING_MORE: [string, ClinicId, number[]][] = [
  ["patel", "family", [1, 3]],
  ["yusuf", "dental", [2, 3]],
  ["okafor", "urgent", [1, 3]],
  ["mahmoud", "cardiology", [2, 3]],
  ["delacruz", "dermatology", [1, 2]],
  ["qureshi", "family", [1, 2]],
  ["msaleh", "pediatrics", [2, 3]],
  ["aziz", "dental", [1, 2]],
  ["rai", "lab", [1, 3]],
  ["hossain", "urgent", [3]],
  ["lhaddad", "family", [2]],
  ["mwangi", "dental", [2]],
  ["zali", "dermatology", [1]],
  ["farouk", "cardiology", [1]],
]

const idNo = (lead: "1" | "2", key: string, last3: string) => {
  let h = 7
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 1000003
  return `${lead}${String(h).padStart(6, "0").slice(0, 6)}${last3}`
}

/** Nationality and ID on file (the design's patients; generated ones are built with theirs). */
export const BASE_IDS: Record<PatientKey, PatientIds> = {
  dosari: { nationality: "SA", idType: "national", idNumber: idNo("1", "dosari", "482") },
  // New patient: checked in without an ID card (Visit · In progress).
  otaibi: { nationality: "SA" },
  khaldi: { nationality: "SA", idType: "national", idNumber: idNo("1", "khaldi", "907") },
  shehri: { nationality: "SA", idType: "national", idNumber: idNo("1", "shehri", "317") },
  qahtani: { nationality: "SA", idType: "national", idNumber: idNo("1", "qahtani", "640") },
  ahmed: { nationality: "SA", idType: "national", idNumber: idNo("1", "ahmed", "903") },
  ahmed2: { nationality: "SA", idType: "national", idNumber: idNo("1", "ahmed", "903") },
  harbi: { nationality: "SA", idType: "national", idNumber: idNo("1", "harbi", "526") },
  haddad: { nationality: "JO", idType: "iqama", idNumber: idNo("2", "haddad", "774") },
  shammari: { nationality: "SA", idType: "national", idNumber: idNo("1", "shammari", "209") },
  subaie: { nationality: "SA", idType: "national", idNumber: idNo("1", "subaie", "351") },
  mutairi: { nationality: "SA", idType: "national", idNumber: idNo("1", "mutairi", "468") },
  amri: { nationality: "SA", idType: "national", idNumber: idNo("1", "amri", "092") },
  saud: { nationality: "SA", idType: "national", idNumber: idNo("1", "saud", "001") },
  kumar: { idType: "iqama", idNumber: "2398104441" },
  abdelrahman: { idType: "iqama", idNumber: idNo("2", "abdelrahman", "902") },
  santos: { idType: "passport", idNumber: "P7731904" },
  hassan: {},
  fkhan: { idType: "iqama", idNumber: idNo("2", "fkhan", "317") },
  smutairi: { idType: "national", idNumber: idNo("1", "smutairi", "205") },
  begum: {},
  patel: { idType: "iqama", idNumber: idNo("2", "patel", "615") },
  yusuf: { idType: "iqama", idNumber: idNo("2", "yusuf", "330") },
  okafor: { idType: "passport", idNumber: "A0981734" },
  mahmoud: { idType: "iqama", idNumber: idNo("2", "mahmoud", "477") },
  delacruz: { idType: "iqama", idNumber: idNo("2", "delacruz", "158") },
  qureshi: { idType: "iqama", idNumber: idNo("2", "qureshi", "702") },
  msaleh: { idType: "iqama", idNumber: idNo("2", "msaleh", "541") },
  aziz: { idType: "iqama", idNumber: idNo("2", "aziz", "236") },
  rai: { idType: "iqama", idNumber: idNo("2", "rai", "883") },
  hossain: { idType: "iqama", idNumber: idNo("2", "hossain", "419") },
  lhaddad: { idType: "iqama", idNumber: idNo("2", "lhaddad", "067") },
  mwangi: { idType: "passport", idNumber: "AK209331" },
  zali: { idType: "iqama", idNumber: idNo("2", "zali", "794") },
  farouk: { idType: "iqama", idNumber: idNo("2", "farouk", "350") },
  ymahmoud: { nationality: "EG" },
  tqahtani: { nationality: "SA" },
  abakr: { nationality: "SD" },
}

/* ------------------------------------------------------------------ generated patients */

const M_SA: [string, string][] = [["Abdullah", "عبدالله"], ["Mohammed", "محمد"], ["Faisal", "فيصل"], ["Saad", "سعد"], ["Khalid", "خالد"], ["Turki", "تركي"], ["Bandar", "بندر"], ["Nawaf", "نواف"], ["Saleh", "صالح"], ["Ibrahim", "إبراهيم"], ["Yousef", "يوسف"], ["Hamad", "حمد"], ["Ziyad", "زياد"], ["Meshal", "مشعل"]]
const F_SA: [string, string][] = [["Nora", "نورة"], ["Sara", "سارة"], ["Lama", "لمى"], ["Hessa", "حصة"], ["Maha", "مها"], ["Ghada", "غادة"], ["Haya", "هيا"], ["Dana", "دانة"], ["Abeer", "عبير"], ["Munira", "منيرة"], ["Shahad", "شهد"], ["Jawaher", "جواهر"]]
const FAM_SA: [string, string][] = [["Al-Qahtani", "القحطاني"], ["Al-Ghamdi", "الغامدي"], ["Al-Zahrani", "الزهراني"], ["Al-Otaibi", "العتيبي"], ["Al-Harbi", "الحربي"], ["Al-Shehri", "الشهري"], ["Al-Dossary", "الدوسري"], ["Al-Anazi", "العنزي"], ["Al-Shammari", "الشمري"], ["Al-Malki", "المالكي"], ["Al-Juhani", "الجهني"], ["Al-Rashidi", "الرشيدي"], ["Al-Balawi", "البلوي"], ["Al-Asmari", "الأسمري"]]
const EXPATS: [string, [string, string, "m" | "f"][]][] = [
  ["EG", [["Ahmed Mostafa", "أحمد مصطفى", "m"], ["Mona Saeed", "منى سعيد", "f"], ["Karim Adel", "كريم عادل", "m"], ["Heba Fathy", "هبة فتحي", "f"]]],
  ["IN", [["Rahul Sharma", "راهول شارما", "m"], ["Priya Nair", "بريا ناير", "f"], ["Arjun Menon", "أرجون مينون", "m"], ["Anil Kumar", "أنيل كومار", "m"]]],
  ["PK", [["Imran Ali", "عمران علي", "m"], ["Ayesha Khan", "عائشة خان", "f"], ["Bilal Ahmed", "بلال أحمد", "m"]]],
  ["PH", [["Maria Cruz", "ماريا كروز", "f"], ["John Reyes", "جون رييس", "m"], ["Ana Santos", "آنا سانتوس", "f"]]],
  ["BD", [["Rahim Uddin", "رحيم الدين", "m"], ["Nasrin Akter", "نسرين أختر", "f"]]],
  ["YE", [["Abdulrahman Saleh", "عبدالرحمن صالح", "m"], ["Amal Qassem", "أمل قاسم", "f"]]],
  ["SD", [["Osman Hamid", "عثمان حامد", "m"], ["Sumaya Idris", "سمية إدريس", "f"]]],
  ["JO", [["Rami Khalil", "رامي خليل", "m"], ["Dima Nasser", "ديما ناصر", "f"]]],
]

const GEN_PATIENTS = 2600
const genPatients: RecPatient[] = []
const genIds: PatientIds[] = []
{
  const r = rng(4417)
  for (let i = 0; i < GEN_PATIENTS; i++) {
    const saudi = r() < 0.71
    let en: string, ar: string, sex: "m" | "f", nat: string
    if (saudi) {
      sex = r() < 0.5 ? "m" : "f"
      const [fe, fa] = (sex === "m" ? M_SA : F_SA)[Math.floor(r() * (sex === "m" ? M_SA.length : F_SA.length))]
      const [le, la] = FAM_SA[Math.floor(r() * FAM_SA.length)]
      en = `${fe} ${le}`
      ar = `${fa} ${la}`
      nat = "SA"
    } else {
      const [code, names] = EXPATS[Math.floor(r() * EXPATS.length)]
      const [ne, na, s] = names[Math.floor(r() * names.length)]
      en = ne
      ar = na
      sex = s
      nat = code
    }
    const initials = en
      .split(" ")
      .map((w) => w.replace("Al-", "")[0])
      .join("")
      .slice(0, 2)
    const mrn = `MRN-${String(10400 + i * 5 + Math.floor(r() * 5)).padStart(5, "0")}`
    genPatients.push({ initials, name: bi(en, ar), mrn, age: 3 + Math.floor(r() * 75), sex, careTeam: [], allergies: [] })
    const last3 = String(Math.floor(r() * 1000)).padStart(3, "0")
    genIds.push({ nationality: nat, idType: saudi ? "national" : "iqama", idNumber: idNo(saudi ? "1" : "2", `g${i}`, last3) })
  }
}
/** Generated patients are keyed "g<n>". */
export function generatedPatient(k: PatientKey): RecPatient | undefined {
  if (!/^g\d+$/.test(k)) return undefined
  return genPatients[Number(k.slice(1))]
}
export function baseIdsOf(k: PatientKey): PatientIds {
  if (/^g\d+$/.test(k)) return genIds[Number(k.slice(1))] ?? {}
  if (k in BASE_IDS) return BASE_IDS[k]
  // Dr. Khaled's older notes (archive.ts): Saudi files with a national ID.
  return { nationality: "SA", idType: "national", idNumber: idNo("1", k, String(k.length * 137).slice(-3).padStart(3, "0")) }
}

/* ------------------------------------------------------------------ the design's visits */

const DESIGN_TODAY: Visit[] = [
  {
    id: "V-2611-08412",
    patient: "dosari",
    branch: BRANCH,
    clinic: "cardiology",
    room: 4,
    doctor: "khaled",
    doctorName: DOCTOR_NAMES.khaled!,
    type: "followUp",
    payer: "bupa",
    payerClass: "B",
    booked_at: "2026-11-18T19:05",
    booked_via: "app",
    checked_in_at: at(23, "09:18"),
    checked_in_by: NORA,
    vitals_at: at(23, "09:31"),
    vitals_by: AMAL,
    seen_from: at(23, "09:40"),
    seen_to: at(23, "10:05"),
    checked_out_at: at(23, "10:15"),
    paid_by: ALI,
    invoice: "INV-2611-0236",
    claim: { status: "batch" },
  },
  {
    id: "V-2611-08419",
    patient: "otaibi",
    branch: BRANCH,
    clinic: "cardiology",
    room: 2,
    doctor: "khaled",
    doctorName: DOCTOR_NAMES.khaled!,
    type: "new",
    payer: "tawuniya",
    payerClass: "A",
    booked_at: "2026-11-21T12:30",
    booked_via: "callCentre",
    checked_in_at: at(23, "09:52"),
    checked_in_by: NORA,
    vitals_at: at(23, "10:01"),
    vitals_by: AMAL,
    seen_from: at(23, "10:20"),
  },
  {
    id: "V-2611-08423",
    patient: "mutairi",
    branch: BRANCH,
    clinic: "dermatology",
    room: 2,
    doctor: "hala",
    doctorName: DOCTOR_NAMES.hala!,
    type: "followUp",
    payer: "rajhi",
    booked_at: "2026-11-17T12:40",
    booked_via: "reception",
    checked_in_at: at(23, "10:05"),
    checked_in_by: NORA,
  },
  {
    id: "V-2611-08426",
    patient: "shammari",
    branch: BRANCH,
    clinic: "pediatrics",
    room: 6,
    doctor: "zaki",
    doctorName: DOCTOR_NAMES.zaki!,
    type: "urgent",
    payer: "medgulf",
    payerClass: "B",
    checked_in_at: at(23, "10:11"),
    checked_in_by: RECEPTION[1],
    vitals_at: at(23, "10:19"),
    vitals_by: NURSES[1],
    seen_from: at(23, "10:31"),
  },
  {
    id: "V-2611-08431",
    patient: "kumar",
    branch: BRANCH,
    clinic: "urgent",
    room: 1,
    doctor: "sami",
    doctorName: DOCTOR_NAMES.sami!,
    type: "urgent",
    payer: "self",
    checked_in_at: at(23, "10:24"),
    checked_in_by: NORA,
    vitals_at: at(23, "10:33"),
    vitals_by: NURSES[2],
  },
  {
    id: "V-2611-08397",
    patient: "shehri",
    branch: BRANCH,
    clinic: "cardiology",
    room: 4,
    doctor: "khaled",
    doctorName: DOCTOR_NAMES.khaled!,
    type: "followUp",
    payer: "bupa",
    payerClass: "B",
    booked_at: "2026-10-26T10:00",
    booked_via: "app",
    checked_in_at: at(23, "08:20"),
    checked_in_by: NORA,
    vitals_at: at(23, "08:26"),
    vitals_by: AMAL,
    seen_from: at(23, "08:30"),
    seen_to: at(23, "08:48"),
    checked_out_at: at(23, "08:58"),
    paid_by: ALI,
  },
  {
    id: "V-2611-08390",
    patient: "harbi",
    branch: BRANCH,
    clinic: "lab",
    doctorName: LAB_TEAM,
    type: "labOnly",
    payer: "self",
    dx: "Z01.7",
    booked_at: "2026-11-20T13:10",
    booked_via: "reception",
    checked_in_at: at(23, "08:15"),
    checked_in_by: RECEPTION[1],
    seen_from: at(23, "08:41"),
    seen_to: at(23, "09:05"),
  },
]
/**
 * Visits whose main diagnosis isn't coded yet (Visits · Missing diagnosis code): the doctor still has to code them
 * in the visit note.
 */
export const UNCODED = new Set(["V-2611-08377", "V-2611-08105", "V-2611-07950"])

/** A visit for an encounter that already has a visit note (timestamps around the note's time). */
function fromEncounter(e: Encounter, id: string): Visit {
  const p = (PATIENTS as Record<string, RecPatient>)[e.patient] ?? ARCHIVE_PATIENTS[e.patient]
  const clinic: ClinicId = e.clinic.en === "Pediatrics" ? "pediatrics" : e.clinic.en === "Dermatology" ? "dermatology" : e.clinic.en === "Emergency" ? "emergency" : "cardiology"
  const insurer = p?.insurer?.en ?? ""
  const payer: Payer = insurer.startsWith("Bupa") ? "bupa" : insurer.startsWith("Tawuniya") ? "tawuniya" : insurer.startsWith("MedGulf") ? "medgulf" : "self"
  const type: VisitType = e.kind.en === "New patient" ? "new" : e.kind.en === "Cardiac cath" ? "procedure" : e.kind.en === "ER visit" ? "urgent" : "followUp"
  return {
    id,
    patient: e.patient,
    branch: BRANCH,
    clinic,
    room: clinic === "cardiology" ? 4 : clinic === "pediatrics" ? 6 : clinic === "dermatology" ? 2 : 1,
    doctor: e.doctor,
    doctorName: DOCTOR_NAMES[e.doctor] ?? bi(e.doctor, e.doctor),
    type,
    payer,
    payerClass: insurer.match(/class (\w)/)?.[1],
    approval: type === "procedure" ? "PA-2611-3307" : undefined,
    booked_at: type === "urgent" ? undefined : plus(`${e.at.slice(0, 10)}T08:00`, -60 * 24 * 3),
    booked_via: type === "urgent" ? undefined : "app",
    // Today's earlier visits (Khaldi 08:55, the 02:05 ER visit) checked in before the drawn first page (08:15).
    checked_in_at: e.at.slice(0, 10) === REC_TODAY && e.at.slice(11) > "08:15" ? at(23, "08:05") : plus(e.at, -14),
    checked_in_by: NORA,
    vitals_at: plus(e.at, -7),
    vitals_by: AMAL,
    seen_from: e.at,
    seen_to: plus(e.at, 20),
    checked_out_at: plus(e.at, 30),
    paid_by: ALI,
  }
}

/* ------------------------------------------------------------------ November */

const LAST_DAY = 23
/** Visits a day: Fridays are quiet; today (23 Nov) has 142 so far. Adds up to 8,412. */
function dayTarget(day: number) {
  if (day === LAST_DAY) return 142
  if (new Date(Date.UTC(2026, 10, day)).getUTCDay() === 5) return 120
  return day <= 7 ? 417 : 416
}
const CLINIC_MIX: [ClinicId, number][] = [
  ["family", 0.24],
  ["urgent", 0.17],
  ["dental", 0.14],
  ["pediatrics", 0.13],
  ["cardiology", 0.11],
  ["dermatology", 0.09],
  ["lab", 0.12],
]
const pickClinic = (x: number) => {
  let acc = 0
  for (const [c, w] of CLINIC_MIX) {
    acc += w
    if (x < acc) return c
  }
  return "family"
}
const typeFor = (clinic: ClinicId, x: number): VisitType =>
  clinic === "lab" ? "labOnly" : clinic === "urgent" ? "urgent" : clinic === "dental" && x < 0.5 ? "procedure" : x < 0.62 ? "followUp" : x < 0.9 ? "new" : "urgent"
const payerFor = (x: number): Payer => (x < 0.38 ? "bupa" : x < 0.62 ? "tawuniya" : x < 0.78 ? "medgulf" : "self")

/** The patients + missing data the generator has to place (named rows that aren't in the design's today list). */
type Placed = { patient: PatientKey; clinic: ClinicId; day: number; noDx?: boolean }

function build(): Visit[] {
  const fixed: Visit[] = [...DESIGN_TODAY]
  const linkedIds = new Map<string, string>()
  // Encounters with notes (the design's and Dr. Khaled's older ones), keeping their visit numbers.
  for (const e of [...ENCOUNTERS, ...ARCHIVE_ENCOUNTERS]) {
    if (fixed.some((v) => v.id === e.id)) continue
    if (e.at.slice(0, 7) !== "2026-11") continue
    linkedIds.set(e.id, e.id)
    fixed.push(fromEncounter(e, e.id))
  }
  const placed: Placed[] = [
    // Rakesh's other three urgent-care visits; today's is drawn.
    { patient: "kumar", clinic: "urgent", day: 19 },
    { patient: "kumar", clinic: "urgent", day: 14 },
    { patient: "kumar", clinic: "urgent", day: 6 },
    { patient: "abdelrahman", clinic: "dental", day: 20 },
    { patient: "abdelrahman", clinic: "dental", day: 15 },
    { patient: "abdelrahman", clinic: "dental", day: 10 },
    { patient: "santos", clinic: "dermatology", day: 18 },
    { patient: "santos", clinic: "dermatology", day: 4 },
    { patient: "hassan", clinic: "pediatrics", day: 17 },
    { patient: "hassan", clinic: "pediatrics", day: 8 },
    { patient: "fkhan", clinic: "family", day: 12 },
    { patient: "fkhan", clinic: "family", day: 5 },
    { patient: "smutairi", clinic: "cardiology", day: 9 },
    { patient: "begum", clinic: "lab", day: 4 },
    ...MISSING_MORE.flatMap(([patient, clinic, days]) => days.map((day) => ({ patient, clinic, day }))),
    { patient: "ymahmoud", clinic: "family", day: 21 },
    { patient: "ymahmoud", clinic: "family", day: 14 },
    { patient: "tqahtani", clinic: "urgent", day: 16 },
    { patient: "tqahtani", clinic: "urgent", day: 9 },
    { patient: "abakr", clinic: "dental", day: 6 },
  ]
  const reserved = new Set(fixed.map((v) => Number(v.id.slice(7))))
  let seq = 0
  const nextId = () => {
    do seq++
    while (reserved.has(seq))
    return `V-2611-${String(seq).padStart(5, "0")}`
  }
  const r = rng(9031)
  const all: Visit[] = []
  // Not checked out · 6: today's lab visit (drawn) + five earlier ones.
  const notOut = new Set([5, 11, 16, 19, 21])
  for (let day = 1; day <= LAST_DAY; day++) {
    const today = day === LAST_DAY
    const dayFixed = fixed.filter((v) => Number(v.checked_in_at.slice(8, 10)) === day)
    const dayPlaced = placed.filter((p) => p.day === day)
    const n = dayTarget(day) - dayFixed.length
    const rows: Visit[] = []
    // Today: 19 still here among the generated rows (23 with the drawn ones). The list is newest first and its first
    // page is drawn (10:24 → 08:15), so the rest of today checked in from 07:00 to 08:14 (procedures, long waits).
    let stillHere = today ? 19 : 0
    for (let i = 0; i < n; i++) {
      const pl = dayPlaced[i]
      const clinic: ClinicId = pl?.clinic ?? pickClinic(r())
      const tx = r()
      const type = typeFor(clinic, tx)
      const doc = doctorFor(clinic, r())
      const payer = pl ? "self" : payerFor(r())
      // Clinics open 07:30–21:30 (today: 07:30–11:35 so far).
      const span = today ? [420, 494] : [450, 1290]
      const start = Math.floor(span[0] + r() * (span[1] - span[0]))
      const inAt = at(day, hm(start))
      const patient = pl?.patient ?? `g${Math.floor(r() * GEN_PATIENTS)}`
      const lab = clinic === "lab"
      const v: Visit = {
        id: "",
        patient,
        branch: BRANCH,
        clinic,
        room: lab ? undefined : 1 + Math.floor(r() * 9),
        ...doc,
        type,
        payer,
        payerClass: payer === "self" ? undefined : ["A", "B", "C"][Math.floor(r() * 3)],
        approval: type === "procedure" && payer !== "self" ? `PA-2611-${String(1000 + Math.floor(r() * 8999))}` : undefined,
        dx: DX_BY_CLINIC[clinic][Math.floor(r() * DX_BY_CLINIC[clinic].length)],
        booked_at: type === "urgent" || r() < 0.25 ? undefined : plus(inAt, -60 * 24 * (1 + Math.floor(r() * 9))),
        checked_in_at: inAt,
        checked_in_by: RECEPTION[Math.floor(r() * RECEPTION.length)],
      }
      if (v.booked_at) v.booked_via = (["app", "app", "phone", "reception"] as BookedVia[])[Math.floor(r() * 4)]
      const here = today && i >= n - 19 && stillHere-- > 0
      if (!lab) {
        v.vitals_at = plus(inAt, 5 + Math.floor(r() * 10))
        v.vitals_by = NURSES[Math.floor(r() * NURSES.length)]
      }
      if (here) {
        // The first eight are with the doctor, the rest wait.
        if (stillHere >= 11) v.seen_from = at(day, hm(600 + Math.floor(r() * 95)))
        if (v.seen_from && v.seen_from > REC_NOW) v.seen_from = REC_NOW
      } else {
        const from = plus(inAt, lab ? 6 : 15 + Math.floor(r() * 25))
        v.seen_from = from
        v.seen_to = plus(from, lab ? 8 : 10 + Math.floor(r() * 20))
        const leftOpen = !today && notOut.has(day) && i === n - 1
        if (!leftOpen) {
          v.checked_out_at = plus(v.seen_to, 4 + Math.floor(r() * 10))
          v.paid_by = CASHIERS[Math.floor(r() * CASHIERS.length)]
        }
      }
      rows.push(v)
    }
    rows.push(...dayFixed)
    rows.sort((a, b) => a.checked_in_at.localeCompare(b.checked_in_at))
    for (const v of rows) {
      if (!v.id) v.id = nextId()
      all.push(v)
    }
  }
  return all
}

let built: Visit[] | null = null
/** Every visit of November (8,412), oldest first. */
export function allVisits(): Visit[] {
  if (!built) built = build()
  return built
}
export const visitById = (id: string) => allVisits().find((v) => v.id === id)

/** The visit's main diagnosis code: its visit note's main diagnosis, else the visit's own. */
export function mainDx(v: Visit, note?: VisitNote) {
  if (UNCODED.has(v.id)) return undefined
  // Still with the doctor: the code is the doctor's to add before the patient leaves ("The doctor adds it").
  const st = visitStatus(v)
  if (st === "waiting" || st === "withDoctor") return undefined
  if (note) return note.diagnoses.find((d) => d.type === "main")?.code || undefined
  return v.dx
}

/* ------------------------------------------------------------------ reception list */

/** Mobile and next booked visit of the patients reception calls (Visits · Reception list). */
export const RECEPTION_INFO: Record<PatientKey, { mobile: string; next?: { date: string; clinic: ClinicId } }> = {
  kumar: { mobile: "055 214 4417" },
  abdelrahman: { mobile: "050 381 2290", next: { date: "2026-11-26", clinic: "dental" } },
  santos: { mobile: "054 770 1036" },
  hassan: { mobile: "056 118 9024" },
  fkhan: { mobile: "053 662 7781" },
  smutairi: { mobile: "050 772 3815" },
  begum: { mobile: "058 904 1152", next: { date: "2026-12-01", clinic: "lab" } },
  patel: { mobile: "055 610 2284", next: { date: "2026-11-30", clinic: "family" } },
  otaibi: { mobile: "050 611 2093" },
}
/** A patient's mobile: the list above, the file, or one built from the MRN. */
export function mobileOf(k: PatientKey, fileMobile?: string) {
  if (RECEPTION_INFO[k]) return RECEPTION_INFO[k].mobile
  if (fileMobile) return fileMobile.replace(/^\+966 /, "0")
  let h = 11
  for (const c of k) h = (h * 33 + c.charCodeAt(0)) % 9999991
  const d = String(h).padStart(7, "0")
  return `05${d[0]} ${d.slice(1, 4)} ${d.slice(3, 7)}`
}
