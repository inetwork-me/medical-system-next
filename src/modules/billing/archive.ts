/*
 * The rest of November behind the drawn rows: the lists say "Showing 8 of 214 invoices" and "8 of 64 contracts", and
 * Show more pages through these. Generated deterministically (same rows every load) to match the module's aggregates
 * exactly — OTHER_INVOICES (7 unpaid · 3 partly paid · 194 paid · 1 refunded) and OTHER_CONTRACTS (35 staff · 14
 * partners · 7 insurers; 2 waiting for the other side, 1 ending) — so filters, counters and pages agree. The counts
 * keep using the aggregates; these records exist so the rows can be listed, opened and acted on.
 */
import type { Bi } from "@/lib/mock/bi"
import {
  CONTRACTS,
  OTHER_CONTRACTS,
  OTHER_INVOICES,
  PATIENTS,
  PRICE_LIST,
  insurerOf,
  vatRuleOf,
  type Contract,
  type ContractKind,
  type CreditNote,
  type Invoice,
  type InvoiceLine,
  type PatientKey,
  type PayMethod,
} from "./data"
import { round2 } from "./money"
import { copayRuleFor, invoiceStatus, totals } from "./rules"

const bi = (en: string, ar: string): Bi => ({ en, ar })
const pad = (n: number, w: number) => String(n).padStart(w, "0")

/* ------------------------------------------------------------------ invoices */

const KEYS = Object.keys(PATIENTS) as PatientKey[]
const CLINIC: Record<string, Bi> = {
  "CONS-DER": bi("Dermatology", "الجلدية"),
  "CONS-GP": bi("General practice", "الطب العام"),
  "CONS-IM": bi("Internal medicine", "الباطنة"),
  "CONS-PED": bi("Pediatrics", "الأطفال"),
  "CONS-DEN": bi("Dentistry", "الأسنان"),
}
const DOCTOR: Record<string, string> = { "CONS-DER": "qahtani", "CONS-GP": "odeh", "CONS-IM": "mansour", "CONS-PED": "saud", "CONS-DEN": "odeh" }
const CONSULTS = PRICE_LIST.filter((p) => p.kind === "consult")
const EXTRAS = PRICE_LIST.filter((p) => p.kind !== "consult" && p.price <= 450)
const METHODS: PayMethod[] = ["mada", "cash", "card", "mada", "applepay"]

function line(code: string, vatRule: string): InvoiceLine {
  const s = PRICE_LIST.find((p) => p.code === code)!
  return { serviceCode: s.code, item: s.item, qty: 1, price: s.price, vatRate: vatRuleOf(vatRule).rate, vatRule, source: { kind: s.kind } }
}

/** One older invoice (paid in full by default): a consultation, sometimes a test or procedure, the patient's payer. */
function olderInvoice(seq: number, i: number): Invoice {
  const no = `INV-2611-${pad(seq, 4)}`
  const key = KEYS[i % KEYS.length]
  const file = PATIENTS[key].file
  const vat = file?.vat ?? "standard"
  const consult = CONSULTS[i % CONSULTS.length]
  const lines = [line(consult.code, vat), ...(i % 3 === 0 ? [line(EXTRAS[i % EXTRAS.length].code, vat)] : [])]
  // Spread over 1–17 November, newest number on the latest day, two to three a working hour.
  const day = 1 + Math.floor(((seq - 24) / 205) * 17)
  const at = `2026-11-${pad(Math.min(17, Math.max(1, day)), 2)}T${pad(8 + (seq % 10), 2)}:${pad((seq * 7) % 60, 2)}`
  const ins = file?.payer === "insurance" && file.insurer ? insurerOf(file.insurer) : undefined
  const rule = ins ? copayRuleFor(ins, file?.class) : undefined
  const inv: Invoice = {
    no,
    issuedAt: at,
    patient: key,
    visitId: `V-2611-${pad(seq + 200, 4)}`,
    visitAt: at,
    clinic: CLINIC[consult.code],
    doctor: DOCTOR[consult.code],
    payer: ins ? ins.id : "cash",
    class: ins ? file?.class : undefined,
    lines,
    copay: rule ? { pct: rule.pct, ...(rule.cap != null ? { cap: rule.cap } : {}) } : { pct: 100 },
    payments: [],
    zatca: {
      uuid: `0a${pad(seq, 6)}-5c1e-4d2b-9f3a-7e8b6c${pad(seq, 6)}`,
      hash: `sha256:0a${pad(seq, 6)}5c1e4d2b`,
      qr: "",
      reportedAt: at,
      status: ins ? "cleared" : "reported",
      type: ins ? "standard" : "simplified",
    },
    events: [],
    company: file?.payer === "company" ? file.company : undefined,
  }
  const share = totals(inv).patientShare
  const paidAt = `${at.slice(0, 11)}${pad(Math.min(19, 9 + (seq % 10)), 2)}:${pad((seq * 7 + 3) % 60, 2)}`
  return share > 0
    ? { ...inv, payments: [{ invoiceNo: no, amount: share, method: METHODS[i % METHODS.length], at: paidAt, by: "nora", byName: bi("Nora Al-Fahad", "نورة الفهد") }] }
    : inv
}

/** The archived credit note behind the one older refunded invoice (a consultation billed twice, refunded in cash). */
let refundCn: CreditNote | undefined

function buildInvoices(): Invoice[] {
  const want = OTHER_INVOICES.unpaid + OTHER_INVOICES.part + OTHER_INVOICES.paid + OTHER_INVOICES.refunded
  const top = 228 // INV-2611-0229 and later are the drawn rows
  const list = Array.from({ length: want }, (_, i) => olderInvoice(top - i, i))
  // Unpaid / partly paid / refunded: spread through the month, on invoices where the patient owes something.
  const owing = list.map((x, i) => [x, i] as const).filter(([x]) => totals(x).patientShare > 0)
  const pick = (n: number, offset: number) => Array.from({ length: n }, (_, k) => owing[(offset + k * Math.floor(owing.length / (n + 1))) % owing.length][1])
  const unpaid = new Set(pick(OTHER_INVOICES.unpaid, 1))
  const part = new Set(pick(OTHER_INVOICES.part, 5).filter((i) => !unpaid.has(i)))
  // The refunded one: a cash invoice early in the list that's neither unpaid nor partly paid.
  const refunded = owing.map(([, i]) => i).find((i) => i >= 9 && !unpaid.has(i) && !part.has(i) && list[i].payer === "cash" && !list[i].company)
  return list.map((x, i) => {
    if (unpaid.has(i)) return { ...x, payments: [] }
    if (part.has(i)) return { ...x, payments: x.payments.map((p) => ({ ...p, amount: round2(Math.floor(p.amount / 2)) })) }
    if (i === refunded) {
      // A consultation billed twice: credited in full and refunded in cash (CN-2611-0004).
      const one = { ...x, lines: x.lines.slice(0, 1) }
      const t = totals(one)
      const at = one.payments[0]?.at ?? one.issuedAt
      const nora = bi("Nora Al-Fahad", "نورة الفهد")
      const paid = { ...one, payments: one.payments.map((p) => ({ ...p, amount: t.total })) }
      refundCn = {
        no: "CN-2611-0004",
        invoiceNo: one.no,
        issuedAt: at,
        lines: [0],
        reason: "billedTwice",
        by: "u-nora",
        byName: nora,
        amounts: { subtotal: t.subtotal, vat: t.vat, total: t.total, insurer: 0, patient: t.total, before: { total: t.total, insurer: 0, patient: t.total }, after: { total: 0, insurer: 0, patient: 0 }, paid: t.total, refund: t.total },
        refund: { amount: t.total, method: "cash", receipt: true, at, byName: nora },
        zatca: { ...one.zatca, uuid: `${one.zatca.uuid.slice(0, -4)}0004` },
        events: [
          { at, kind: "issued", byName: nora },
          { at, kind: "refunded", byName: nora, refund: { amount: t.total, method: "cash", receipt: true } },
        ],
      }
      return { ...paid, credits: [{ cn: "CN-2611-0004", lines: [0], total: t.total, refund: t.total }] }
    }
    return x
  })
}

export const ARCHIVE_INVOICES: Invoice[] = buildInvoices()
export const ARCHIVE_CREDIT_NOTES: CreditNote[] = refundCn ? [refundCn] : []

// Dev check: the generated statuses must match the aggregates (filters and counters rely on it).
if (process.env.NODE_ENV !== "production") {
  const by = { unpaid: 0, part: 0, paid: 0, refunded: 0 }
  for (const x of ARCHIVE_INVOICES) by[invoiceStatus(x)]++
  if (JSON.stringify(by) !== JSON.stringify({ unpaid: OTHER_INVOICES.unpaid, part: OTHER_INVOICES.part, paid: OTHER_INVOICES.paid, refunded: OTHER_INVOICES.refunded }))
    console.warn("[billing] archive invoices don't match OTHER_INVOICES", by)
}

/* ------------------------------------------------------------------ contracts */

const FIRST = ["Ahmed", "Faisal", "Mohammed", "Abdullah", "Saud", "Turki", "Nawaf", "Bandar", "Majed", "Hassan", "Ali", "Khalid"]
const FIRST_AR = ["أحمد", "فيصل", "محمد", "عبدالله", "سعود", "تركي", "نواف", "بندر", "ماجد", "حسن", "علي", "خالد"]
const FIRST_F = ["Noura", "Sara", "Reem", "Hessa", "Lama", "Dalal", "Abeer", "Hind"]
const FIRST_F_AR = ["نورة", "سارة", "ريم", "حصة", "لمى", "دلال", "عبير", "هند"]
const LAST = ["Al-Qahtani", "Al-Otaibi", "Al-Shammari", "Al-Ghamdi", "Al-Zahrani", "Al-Dossary", "Al-Mutairi", "Al-Harthi", "Al-Anazi", "Al-Subaie", "Al-Shehri", "Al-Juhani"]
const LAST_AR = ["القحطاني", "العتيبي", "الشمري", "الغامدي", "الزهراني", "الدوسري", "المطيري", "الحارثي", "العنزي", "السبيعي", "الشهري", "الجهني"]
const JOBS: Bi[] = [
  bi("Staff nurse", "ممرضة"),
  bi("Specialist dentist", "أخصائي أسنان"),
  bi("Lab technician", "فني مختبر"),
  bi("General practitioner", "طبيب عام"),
  bi("Receptionist", "موظف استقبال"),
  bi("Pharmacist", "صيدلي"),
  bi("Radiology technician", "فني أشعة"),
]
const PARTNERS: [string, string, Bi][] = [
  ["Nahdi Medical", "النهدي الطبية", bi("Pharmacy supplies", "مستلزمات صيدلية")],
  ["Al Mokhtabar Labs", "المختبر للتحاليل", bi("Reference lab", "مختبر مرجعي")],
  ["Gulf Medical Waste", "الخليج للنفايات الطبية", bi("Medical waste", "النفايات الطبية")],
  ["Riyadh Linen Services", "الرياض لخدمات المفروشات", bi("Linen and laundry", "المفروشات والغسيل")],
  ["Elite Biomedical", "النخبة للأجهزة الطبية", bi("Equipment maintenance", "صيانة الأجهزة")],
  ["Smart IT Solutions", "الحلول الذكية للتقنية", bi("IT support", "الدعم التقني")],
  ["Safe Guard Security", "الحارس الآمن للحراسات", bi("Security", "الحراسات الأمنية")],
  ["Al Jazira Catering", "الجزيرة للإعاشة", bi("Catering", "الإعاشة")],
  ["Prime Cleaning", "برايم للنظافة", bi("Cleaning", "النظافة")],
  ["Vision Optics", "فيجن للبصريات", bi("Optical lab", "مختبر بصريات")],
  ["Dental Art Lab", "فن الأسنان", bi("Dental lab", "مختبر أسنان")],
  ["Najd Oxygen", "نجد للأكسجين", bi("Medical gases", "الغازات الطبية")],
  ["Care Ambulance", "كير للإسعاف", bi("Ambulance transport", "النقل الإسعافي")],
  ["Sahara Couriers", "صحارى للتوصيل", bi("Sample courier", "توصيل العينات")],
]
const INSURERS_X: [string, string][] = [
  ["Allianz Saudi Fransi", "أليانز السعودي الفرنسي"],
  ["Arabian Shield", "الدرع العربي"],
  ["Gulf Union Alahlia", "اتحاد الخليج الأهلية"],
  ["Saudi Enaya", "عناية السعودية"],
  ["Buruj", "بروج"],
  ["Amana Insurance", "أمانة للتأمين"],
  ["United Cooperative", "المتحدة للتأمين التعاوني"],
]

const initialsOf = (en: string) => {
  const w = en.replace(/^Dr\.\s*/, "").split(/\s+/)
  const last = (w.at(-1) ?? "").replace(/^Al-/, "")
  return `${w[0][0]}${w.length > 1 ? last[0] : ""}`.toUpperCase()
}

const SOURCE: Record<ContractKind, Contract> = {
  staff: CONTRACTS.find((c) => c.kind === "staff")!,
  partner: CONTRACTS.find((c) => c.kind === "partner")!,
  insurer: CONTRACTS.find((c) => c.kind === "insurer")!,
}

/** An older contract, signed by both sides (or waiting for the other side / ending soon), copied from a drawn one. */
function olderContract(kind: ContractKind, i: number, no: string, state: "signed" | "awaitingThem" | "ending"): Contract {
  const src = SOURCE[kind]
  const female = kind === "staff" && i % 3 === 1
  const f = female ? FIRST_F[i % FIRST_F.length] : FIRST[i % FIRST.length]
  const fAr = female ? FIRST_F_AR[i % FIRST_F_AR.length] : FIRST_AR[i % FIRST_AR.length]
  const l = LAST[(i * 5) % LAST.length]
  const lAr = LAST_AR[(i * 5) % LAST_AR.length]
  const job = JOBS[i % JOBS.length]
  const party: Contract["party"] =
    kind === "staff"
      ? { kind: "employee", initials: initialsOf(`${f} ${l}`), name: bi(`${f} ${l}`, `${fAr} ${lAr}`), role: job, female, nationalId: `10${pad(48213000 + i * 7919, 8)}`, licence: { no: `2${i % 6}R${pad(1000 + i * 37, 4)}`, validTo: "2028-06-30" } }
      : kind === "partner"
        ? { kind: "company", initials: initialsOf(PARTNERS[i % PARTNERS.length][0]), name: bi(PARTNERS[i % PARTNERS.length][0], PARTNERS[i % PARTNERS.length][1]), role: PARTNERS[i % PARTNERS.length][2], cr: `1010${pad(300000 + i * 4111, 6)}`, city: bi("Riyadh", "الرياض") }
        : { kind: "company", initials: initialsOf(INSURERS_X[i % INSURERS_X.length][0]), name: bi(INSURERS_X[i % INSURERS_X.length][0], INSURERS_X[i % INSURERS_X.length][1]), role: bi("Insurer", "شركة تأمين"), cr: `1010${pad(200000 + i * 3001, 6)}`, city: bi("Riyadh", "الرياض") }
  const years = kind === "partner" ? 1 : 2
  // Signed in the last two years; "ending" runs out within the 60-day window.
  const startY = state === "ending" ? 2025 : 2025 + (i % 2)
  const start = state === "ending" ? "2025-01-01" : `${startY}-${pad(1 + (i % 12), 2)}-01`
  const end = state === "ending" ? "2026-12-31" : `${startY + years}-${pad(1 + (i % 12), 2)}-01`
  const signedAt = `${start.slice(0, 8)}0${1 + (i % 8)}T10:${pad((i * 13) % 60, 2)}`
  const signers = src.signers.map((s) => {
    const isParty = s.side === "party"
    const base = isParty ? { ...s, initials: party.initials, name: party.name, female: party.female, role: party.role } : s
    const waiting = state === "awaitingThem" && isParty
    return waiting ? { ...base, status: "waiting" as const, signedAt: undefined, nafathTxn: undefined, pdfHash: undefined } : { ...base, status: "signed" as const, signedAt }
  })
  // Waiting for them: the party signs first, so put them first in the order.
  const ordered = state === "awaitingThem" ? [...signers].sort((a, b) => (a.side === "party" ? -1 : b.side === "party" ? 1 : 0)).map((s, k) => ({ ...s, order: k + 1 })) : signers
  return {
    ...src,
    no,
    party,
    department: kind === "staff" ? bi("General practice · Riyadh", "الطب العام · الرياض") : undefined,
    start,
    end,
    signers: ordered,
    sent: true,
    sentAt: start,
    remindedAt: undefined,
    locked: state !== "awaitingThem",
    draftedAt: start,
    version: 1,
    events: [],
    verifyCode: `${no.slice(-3)}X${i}`,
  }
}

function buildContracts(): Contract[] {
  const taken = new Set(CONTRACTS.map((c) => c.no))
  const nos: string[] = []
  for (let n = 120; nos.length < OTHER_CONTRACTS.staff + OTHER_CONTRACTS.partner + OTHER_CONTRACTS.insurer && n > 0; n--) {
    const no = `CTR-25-${pad(n, 3)}`
    if (!taken.has(no)) nos.push(no)
  }
  const kinds: ContractKind[] = [
    ...Array<ContractKind>(OTHER_CONTRACTS.staff).fill("staff"),
    ...Array<ContractKind>(OTHER_CONTRACTS.partner).fill("partner"),
    ...Array<ContractKind>(OTHER_CONTRACTS.insurer).fill("insurer"),
  ]
  // Interleave the types so pages mix them; the first two partners wait for the other side, one staff contract ends soon.
  const order = kinds.map((k, i) => [k, i] as const).sort((a, b) => ((a[1] * 7) % kinds.length) - ((b[1] * 7) % kinds.length))
  let waiting = OTHER_CONTRACTS.awaitingThem
  let ending = OTHER_CONTRACTS.ending
  return order.map(([kind, i], k) => {
    const state = kind === "partner" && waiting > 0 ? (waiting--, "awaitingThem" as const) : kind === "staff" && ending > 0 ? (ending--, "ending" as const) : ("signed" as const)
    return olderContract(kind, i, nos[k], state)
  })
}

export const ARCHIVE_CONTRACTS: Contract[] = buildContracts()
