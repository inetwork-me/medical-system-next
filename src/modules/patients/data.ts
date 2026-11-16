import type { Bi } from "@/lib/mock/bi"

/**
 * Patients module sample data.
 * The first 8 records are the design's (design-scripts/patients_widgets.py · PATIENTS); the rest are generated
 * deterministically so every number in the design holds: 1,284 patients · gender 616/655/13 · age groups
 * 18/27/41/14 % · regions 46/21/14/9/6/4 % · VIP 42 · banned 9 · incomplete 128 · possible duplicates 23 ·
 * Replace with the patients API later (same shape).
 */

export type Gender = "male" | "female" | "unset"
export type Tag = "vip" | "incomplete" | "duplicate" | "banned"
export type RegionKey = "riyadh" | "jeddah" | "eastern" | "makkah" | "madinah" | "other"
export type BranchKey = "main" | "olaya" | "jeddah"
export type AgeGroup = "children" | "youth" | "adults" | "seniors"

export type Patient = {
  id: string // = MRN
  mrn: string
  initials: string
  name: Bi
  gender: Gender
  age: number
  /** null when missing (incomplete record) */
  mobile: string | null
  region: RegionKey
  /** City shown for region "other" */
  city?: Bi
  branch: BranchKey
  tags: Tag[]
  lastVisit: string // ISO date
  visits: number
  registered: string // ISO date
  /** MRN of the suspected duplicate */
  duplicateOf?: string
}

export const TODAY = "2026-11-16"

export const REGIONS: Record<RegionKey, { short: Bi; long: Bi }> = {
  riyadh: { short: { en: "Riyadh", ar: "الرياض" }, long: { en: "Riyadh", ar: "الرياض" } },
  jeddah: { short: { en: "Jeddah", ar: "جدة" }, long: { en: "Jeddah", ar: "جدة" } },
  eastern: { short: { en: "Eastern", ar: "الشرقية" }, long: { en: "Eastern Province", ar: "الشرقية" } },
  makkah: { short: { en: "Makkah", ar: "مكة" }, long: { en: "Makkah", ar: "مكة" } },
  madinah: { short: { en: "Madinah", ar: "المدينة" }, long: { en: "Madinah", ar: "المدينة" } },
  other: { short: { en: "Other", ar: "أخرى" }, long: { en: "Other", ar: "أخرى" } },
}
export const REGION_KEYS = Object.keys(REGIONS) as RegionKey[]
export const BRANCH_KEYS: BranchKey[] = ["main", "olaya", "jeddah"]

export const AGE_GROUPS: { key: AgeGroup; range: string; min: number; max: number }[] = [
  { key: "children", range: "0–12", min: 0, max: 12 },
  { key: "youth", range: "13–29", min: 13, max: 29 },
  { key: "adults", range: "30–59", min: 30, max: 59 },
  { key: "seniors", range: "60+", min: 60, max: 120 },
]
export const ageGroupOf = (age: number) => AGE_GROUPS.find((g) => age >= g.min && age <= g.max)!.key

/* ---------------------------------------------------------------- design records */

const DESIGN: Patient[] = [
  { id: "004812", mrn: "004812", initials: "SA", name: { en: "Sara Ahmed", ar: "سارة أحمد" }, gender: "female", age: 34, mobile: "050 123 4567", region: "riyadh", branch: "main", tags: ["vip"], lastVisit: "2026-11-15", visits: 12, registered: "2021-05-04" },
  { id: "004833", mrn: "004833", initials: "OH", name: { en: "Omar Al-Harbi", ar: "عمر الحربي" }, gender: "male", age: 52, mobile: "055 987 1122", region: "jeddah", branch: "jeddah", tags: [], lastVisit: "2026-11-12", visits: 5, registered: "2023-02-19" },
  { id: "004857", mrn: "004857", initials: "LH", name: { en: "Lina Haddad", ar: "لينا حداد" }, gender: "female", age: 8, mobile: null, region: "riyadh", branch: "olaya", tags: ["incomplete"], lastVisit: "2026-11-10", visits: 3, registered: "2025-09-08" },
  { id: "004861", mrn: "004861", initials: "YN", name: { en: "Yousef Nasser", ar: "يوسف ناصر" }, gender: "male", age: 67, mobile: "054 222 8890", region: "eastern", branch: "main", tags: ["duplicate"], lastVisit: "2026-11-09", visits: 21, registered: "2019-11-23", duplicateOf: "004712" },
  { id: "004870", mrn: "004870", initials: "MS", name: { en: "Maha Saleh", ar: "مها صالح" }, gender: "female", age: 29, mobile: "056 410 7733", region: "makkah", branch: "main", tags: ["banned"], lastVisit: "2026-11-02", visits: 2, registered: "2024-07-30" },
  { id: "004874", mrn: "004874", initials: "AQ", name: { en: "Abdullah Al-Qahtani", ar: "عبدالله القحطاني" }, gender: "male", age: 41, mobile: "050 771 2045", region: "riyadh", branch: "olaya", tags: ["vip"], lastVisit: "2026-11-01", visits: 9, registered: "2022-03-14" },
  { id: "004880", mrn: "004880", initials: "NR", name: { en: "Noura Al-Rashid", ar: "نورة الراشد" }, gender: "female", age: 23, mobile: "053 118 6650", region: "madinah", branch: "main", tags: [], lastVisit: "2026-10-30", visits: 1, registered: "2026-10-30" },
  { id: "004891", mrn: "004891", initials: "FD", name: { en: "Fahad Al-Dosari", ar: "فهد الدوسري" }, gender: "male", age: 15, mobile: "059 300 1287", region: "riyadh", branch: "main", tags: ["incomplete", "duplicate"], lastVisit: "2026-10-28", visits: 4, registered: "2024-01-02", duplicateOf: "004520" },
]

/* ---------------------------------------------------------------- generator */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MALE: [string, string][] = [["Omar", "عمر"], ["Yousef", "يوسف"], ["Abdullah", "عبدالله"], ["Fahad", "فهد"], ["Khaled", "خالد"], ["Sultan", "سلطان"], ["Faisal", "فيصل"], ["Saad", "سعد"], ["Turki", "تركي"], ["Majed", "ماجد"], ["Nawaf", "نواف"], ["Ahmed", "أحمد"], ["Ali", "علي"], ["Hamad", "حمد"], ["Bandar", "بندر"], ["Ziyad", "زياد"]]
const FEMALE: [string, string][] = [["Sara", "سارة"], ["Lina", "لينا"], ["Maha", "مها"], ["Noura", "نورة"], ["Reem", "ريم"], ["Huda", "هدى"], ["Amal", "أمل"], ["Hessa", "حصة"], ["Lama", "لمى"], ["Joud", "جود"], ["Rana", "رنا"], ["Dana", "دانة"], ["Asma", "أسماء"], ["Mona", "منى"], ["Shahad", "شهد"], ["Ghada", "غادة"]]
const FAMILY: [string, string][] = [["Al-Harbi", "الحربي"], ["Al-Qahtani", "القحطاني"], ["Al-Dosari", "الدوسري"], ["Al-Mutairi", "المطيري"], ["Al-Otaibi", "العتيبي"], ["Al-Rashid", "الراشد"], ["Al-Shehri", "الشهري"], ["Al-Ghamdi", "الغامدي"], ["Al-Zahrani", "الزهراني"], ["Al-Anazi", "العنزي"], ["Al-Shammari", "الشمري"], ["Al-Subaie", "السبيعي"], ["Haddad", "حداد"], ["Nasser", "ناصر"], ["Saleh", "صالح"], ["Fares", "فارس"]]
const OTHER_CITIES: Bi[] = [{ en: "Abha", ar: "أبها" }, { en: "Tabuk", ar: "تبوك" }, { en: "Qassim", ar: "القصيم" }, { en: "Hail", ar: "حائل" }, { en: "Jazan", ar: "جازان" }]

const TOTAL = 1284

function bag<T>(counts: [T, number][], rand: () => number): T[] {
  const out = counts.flatMap(([v, n]) => Array<T>(n).fill(v))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

function generate(): Patient[] {
  const rand = mulberry32(20261116)
  const n = TOTAL - DESIGN.length
  const genders = bag<Gender>([["male", 612], ["female", 651], ["unset", 13]], rand)
  const groups = bag<AgeGroup>([["children", 230], ["youth", 344], ["adults", 523], ["seniors", 179]], rand)
  const regions = bag<RegionKey>([["riyadh", 587], ["jeddah", 269], ["eastern", 179], ["makkah", 115], ["madinah", 76], ["other", 50]], rand)
  const tagRoll = bag<Tag | "none">([["vip", 40], ["banned", 8], ["incomplete", 126], ["duplicate", 21], ["none", n - 195]], rand)

  const out: Patient[] = []
  const lastStart = Date.UTC(2026, 9, 27) // 27 Oct 2026, then older
  for (let i = 0; i < n; i++) {
    const g = genders[i]
    const pool = g === "female" ? FEMALE : g === "male" ? MALE : rand() < 0.5 ? MALE : FEMALE
    const first = pool[Math.floor(rand() * pool.length)]
    const fam = FAMILY[Math.floor(rand() * FAMILY.length)]
    const grp = AGE_GROUPS.find((a) => a.key === groups[i])!
    const age = grp.min + Math.floor(rand() * (Math.min(grp.max, 92) - grp.min + 1))
    const region = regions[i]
    const tag = tagRoll[i]
    const tags: Tag[] = tag === "none" ? [] : [tag]
    const mrn = String(1000 + i * 3).padStart(6, "0")
    rand() // (kept so the random sequence — and every generated value — stays the same; phones are cleared by MISSING below)
    const phone = `05${Math.floor(rand() * 10)} ${String(Math.floor(rand() * 1000)).padStart(3, "0")} ${String(Math.floor(rand() * 10000)).padStart(4, "0")}`
    const last = new Date(lastStart - Math.floor(i * 0.55) * 86400000)
    const regDate = new Date(Date.UTC(2019 + Math.floor(rand() * 7), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)))
    out.push({
      id: mrn,
      mrn,
      initials: `${first[0][0]}${fam[0].replace("Al-", "")[0]}`,
      name: { en: `${first[0]} ${fam[0]}`, ar: `${first[1]} ${fam[1]}` },
      gender: g,
      age,
      mobile: phone,
      region,
      city: region === "other" ? OTHER_CITIES[i % OTHER_CITIES.length] : undefined,
      branch: region === "jeddah" ? "jeddah" : rand() < 0.65 ? "main" : "olaya",
      tags,
      lastVisit: iso(last),
      visits: 1 + Math.floor(rand() * 24),
      registered: iso(regDate < last ? regDate : last),
    })
  }
  // The design's "duplicate found" sample: an existing file for Sultan Al-Mutairi (Add-patient wizard, step 1).
  const k = out.findIndex((p) => p.gender === "male" && p.age >= 30 && p.age <= 45 && p.region === "riyadh" && !p.tags.length)
  out[k] = {
    ...out[k],
    id: "004650",
    mrn: "004650",
    initials: "SM",
    name: { en: "Sultan Al-Mutairi", ar: "سلطان المطيري" },
    age: 38,
    branch: "olaya",
    lastVisit: "2025-03-12",
    registered: "2023-06-04",
  }
  // The design's merge sample: an older file for the same boy, MRN 004520 (same mobile as 004891).
  const j = out.findIndex((p) => p.gender === "male" && ageGroupOf(p.age) === ageGroupOf(15) && p.region === "riyadh" && !p.tags.length)
  out[j] = {
    ...out[j],
    id: "004520",
    mrn: "004520",
    initials: "FA",
    name: { en: "Fahad Aldosari", ar: "فهد الدوسري" },
    age: 15,
    mobile: "059 300 1287",
    branch: "olaya",
    visits: 7,
    lastVisit: "2026-06-14",
    registered: "2022-09-14",
  }
  // Duplicate-report samples: the older files paired with Yousef Nasser (004861) and Noura Al-Rashid (004880).
  const pick = (f: (p: Patient) => boolean, taken: number[]) => out.findIndex((p, i) => !taken.includes(i) && !p.tags.length && f(p))
  const y = pick((p) => p.gender === "male" && p.age >= 60 && p.region === "eastern", [k, j])
  out[y] = { ...out[y], id: "004712", mrn: "004712", initials: "YA", name: { en: "Yousef A. Nasser", ar: "يوسف عبدالله ناصر" }, age: 67, mobile: "055 019 4432", visits: 3, lastVisit: "2025-01-11", registered: "2021-03-02" }
  const nr = pick((p) => p.gender === "female" && ageGroupOf(p.age) === "youth" && p.region === "madinah", [k, j, y])
  out[nr] = { ...out[nr], id: "003998", mrn: "003998", initials: "NM", name: { en: "Noura M. Alrashed", ar: "نورة محمد الراشد" }, age: 23, mobile: "053 118 6650", visits: 2, lastVisit: "2024-03-02", registered: "2023-11-20" }
  // Pair suspected duplicates with a neighbour record (same mobile in the data-quality report).
  out.forEach((p, i) => {
    if (p.tags.includes("duplicate")) p.duplicateOf = out[(i + 1) % out.length].mrn
  })
  return out
}

let cache: Patient[] | null = null
export function allPatients(): Patient[] {
  if (!cache) {
    cache = [...DESIGN, ...generate()]
    buildMissing(cache)
  }
  return cache
}

/* ---------------------------------------------------------------- incomplete files: what is missing */

export type MissingField = "nationalId" | "address" | "nationality" | "birthDate" | "phone" | "gender"
export const MISSING_FIELDS: MissingField[] = ["nationalId", "address", "nationality", "birthDate", "phone", "gender"]
/** Design figures (Incomplete records report): files missing each field. */
const MISSING_COUNTS: [MissingField, number][] = [["nationalId", 74], ["address", 61], ["nationality", 38], ["birthDate", 22], ["phone", 9]]
const MISSING_FIXED: Record<string, MissingField[]> = { "004891": ["nationalId", "address"], "004857": ["phone", "nationalId", "nationality"] }
const missingMap = new Map<string, MissingField[]>()

/** Spreads the design's missing-field counts over the incomplete files (deterministic); clears their phones. */
function buildMissing(list: Patient[]) {
  const rand = mulberry32(128)
  const inc = list.filter((p) => p.tags.includes("incomplete"))
  const used = Object.values(MISSING_FIXED).flat()
  const tokens = bag<MissingField>(MISSING_COUNTS.map(([f, n]) => [f, n - used.filter((x) => x === f).length]), rand)
  const files = inc.filter((p) => !MISSING_FIXED[p.id])
  for (const [id, f] of Object.entries(MISSING_FIXED)) missingMap.set(id, f)
  files.forEach((p) => missingMap.set(p.id, [tokens.pop()!]))
  for (const f of tokens) {
    for (let tries = 0; tries < 12; tries++) {
      const p = files[Math.floor(rand() * files.length)]
      const m = missingMap.get(p.id)!
      if (!m.includes(f)) {
        m.push(f)
        break
      }
    }
  }
  for (const p of inc) {
    const m = missingMap.get(p.id)!
    if (p.gender === "unset" && !m.includes("gender")) m.push("gender")
    m.sort((a, b) => MISSING_FIELDS.indexOf(a) - MISSING_FIELDS.indexOf(b))
    if (m.includes("phone") && !DESIGN.includes(p)) p.mobile = null
  }
}

/** Fields missing on a file (only incomplete files have any). */
export function missingOf(p: Patient): MissingField[] {
  allPatients()
  return p.tags.includes("incomplete") ? (missingMap.get(p.id) ?? ["nationalId"]) : []
}

export const patientById = (id: string) => allPatients().find((p) => p.id === id)

/* ---------------------------------------------------------------- stats (KPIs + charts) */

export function patientStats(list = allPatients()) {
  const count = (f: (p: Patient) => boolean) => list.filter(f).length
  return {
    total: list.length,
    /** Registrations this month: design figure (registration history isn't modelled in the mock). */
    newThisMonth: 86,
    vip: count((p) => p.tags.includes("vip")),
    incomplete: count((p) => p.tags.includes("incomplete")),
    banned: count((p) => p.tags.includes("banned")),
    duplicate: count((p) => p.tags.includes("duplicate")),
    gender: { male: count((p) => p.gender === "male"), female: count((p) => p.gender === "female"), unset: count((p) => p.gender === "unset") },
    ageGroups: AGE_GROUPS.map((g) => ({ ...g, count: count((p) => ageGroupOf(p.age) === g.key) })),
    regions: REGION_KEYS.map((r) => ({ key: r, count: count((p) => p.region === r) })),
  }
}

/** Trend deltas shown on the KPI cards (from the design; history isn't modelled in the mock). */
export const KPI_DELTAS = { total: "+12.5%", newThisMonth: "+9%", vip: "+3", incomplete: "−14" }

/* ---------------------------------------------------------------- query */

export type PatientQuery = {
  q?: string
  chip?: "all" | Tag
  gender?: Gender | "all"
  ageFrom?: number
  ageTo?: number
  region?: RegionKey | "all"
  branch?: BranchKey | "all"
  from?: string
  to?: string
  tags?: Tag[]
}

export function filterPatients(list: Patient[], q: PatientQuery, locale: string) {
  const text = q.q?.trim().toLowerCase()
  const digits = text?.replace(/\D/g, "")
  return list.filter((p) => {
    if (text) {
      const name = (locale === "ar" ? p.name.ar : p.name.en).toLowerCase()
      const hit =
        name.includes(text) ||
        p.name.en.toLowerCase().includes(text) ||
        p.name.ar.includes(q.q!.trim()) ||
        (!!digits && (p.mrn.includes(digits) || (p.mobile ?? "").replace(/\D/g, "").includes(digits)))
      if (!hit) return false
    }
    if (q.chip && q.chip !== "all" && !p.tags.includes(q.chip)) return false
    if (q.gender && q.gender !== "all" && p.gender !== q.gender) return false
    if (q.ageFrom !== undefined && p.age < q.ageFrom) return false
    if (q.ageTo !== undefined && p.age > q.ageTo) return false
    if (q.region && q.region !== "all" && p.region !== q.region) return false
    if (q.branch && q.branch !== "all" && p.branch !== q.branch) return false
    if (q.from && p.lastVisit < q.from) return false
    if (q.to && p.lastVisit > q.to) return false
    if (q.tags?.length && !q.tags.every((t) => p.tags.includes(t))) return false
    return true
  })
}

/* ---------------------------------------------------------------- sheet details */

export type VisitStatus = "completed" | "cancelled" | "inProgress" | "confirmed" | "pending"
export type PatientVisit = { date: string; service: Bi; status: VisitStatus; amount: number }

const FAHAD_VISITS: PatientVisit[] = [
  { date: "2026-10-28", service: { en: "Pediatrics · Dr. Ahmed Zaki", ar: "طب الأطفال · د. أحمد زكي" }, status: "completed", amount: 350 },
  { date: "2026-10-02", service: { en: "Dental · Dr. Sami Odeh", ar: "الأسنان · د. سامي عودة" }, status: "completed", amount: 520 },
  { date: "2026-09-15", service: { en: "Pediatrics · Dr. Ahmed Zaki", ar: "طب الأطفال · د. أحمد زكي" }, status: "cancelled", amount: 0 },
  { date: "2026-08-21", service: { en: "Lab · CBC, Vitamin D", ar: "التحاليل · CBC، فيتامين د" }, status: "completed", amount: 280 },
]
const SERVICES: Bi[] = [
  { en: "Cardiology · Dr. Khaled Mansour", ar: "القلب · د. خالد منصور" },
  { en: "Dental · Dr. Sami Odeh", ar: "الأسنان · د. سامي عودة" },
  { en: "Dermatology · Dr. Huda Fares", ar: "الجلدية · د. هدى فارس" },
  { en: "Family medicine · Dr. Reem Alotaibi", ar: "طب الأسرة · د. ريم العتيبي" },
  { en: "Lab · CBC", ar: "التحاليل · CBC" },
]

export type PatientDetails = {
  whatsapp: string | null
  nationalId: string | null
  birthDate: string
  nationality: Bi
  district: Bi | null
  insurance: Bi | null
  classification: Bi
  registeredBy: Bi
  bloodType: string | null
  visitsList: PatientVisit[]
  duplicate?: { mrn: string; name: Bi }
}

/** Facts for the side sheet / patient page. Fahad Al-Dosari = the design's sample file. */
export function patientDetails(p: Patient): PatientDetails {
  const rand = mulberry32(Number(p.mrn) + 7)
  const birthYear = 2026 - p.age
  const FIXED_BIRTH: Record<string, string> = { "004891": "2011-03-12", "004520": "2011-03-12", "004861": "1959-02-03", "004712": "1959-02-03", "004880": "2003-07-19" }
  const birthDate = FIXED_BIRTH[p.id] ? FIXED_BIRTH[p.id] : `${birthYear}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 27))}`
  const missing = missingOf(p)
  const visitsList =
    p.id === "004891"
      ? FAHAD_VISITS
      : Array.from({ length: Math.min(p.visits, 4) }, (_, i) => {
          const d = new Date(Date.parse(p.lastVisit) - i * (20 + Math.floor(rand() * 30)) * 86400000)
          const status: VisitStatus = rand() < 0.12 ? "cancelled" : "completed"
          return { date: iso(d), service: SERVICES[Math.floor(rand() * SERVICES.length)], status, amount: status === "cancelled" ? 0 : 150 + Math.floor(rand() * 8) * 50 }
        })
  const dup = p.duplicateOf
    ? p.duplicateOf === "004520"
      ? { mrn: "004520", name: { en: "Fahad Aldosari", ar: "فهد الدوسري" } }
      : (() => {
          const o = patientById(p.duplicateOf!)
          return o ? { mrn: o.mrn, name: o.name } : undefined
        })()
    : undefined
  return {
    whatsapp: p.mobile,
    nationalId: missing.includes("nationalId") ? null : p.id === "004650" ? "1087334902" : p.id === "004520" ? "1102334551" : p.id === "004861" || p.id === "004712" ? "1045776210" : p.id === "004880" ? "1120556781" : `1${Math.floor(rand() * 1e9).toString().padStart(9, "0")}`,
    birthDate,
    nationality: { en: "Saudi", ar: "سعودي" },
    district: p.id === "004891" || p.id === "004520" ? { en: "Al Malqa", ar: "الملقا" } : null,
    insurance: p.id === "004891" ? { en: "Bupa · Class B", ar: "بوبا · فئة B" } : rand() < 0.6 ? { en: "Tawuniya · Class A", ar: "التعاونية · فئة A" } : null,
    classification: p.tags.includes("vip") ? { en: "VIP", ar: "VIP" } : { en: "Regular", ar: "عادي" },
    registeredBy: { en: "Reem (reception)", ar: "ريم (الاستقبال)" },
    bloodType: p.id === "004891" ? "O+" : ["A+", "B+", "O+", "AB+", "O−", "A−"][Math.floor(rand() * 6)],
    visitsList,
    duplicate: dup,
  }
}

/* ---------------------------------------------------------------- duplicate lookup (Add patient) */

let idIndex: Map<string, string> | null = null
/** Existing patient with this national ID / iqama (digits only), if any. */
export function findByNationalId(id: string, list: Patient[]) {
  if (!idIndex) {
    idIndex = new Map()
    for (const p of allPatients()) {
      const n = patientDetails(p).nationalId
      if (n) idIndex.set(n, p.id)
    }
  }
  const hit = idIndex.get(id.replace(/\D/g, ""))
  return hit ? list.find((p) => p.id === hit) : undefined
}
