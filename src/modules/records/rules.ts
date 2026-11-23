import type { Bi } from "@/lib/mock/bi"
import {
  ICD10,
  CHART_RED_HOURS,
  OVERDUE_HOURS,
  REC_NOW,
  REC_TODAY,
  REQUEST_SOON_DAYS,
  daysBetween,
  hoursBetween,
  type CompletionItem,
  type CopyPart,
  type Icd,
  type RxLine,
  type Encounter,
  type RecPatient,
  type RecordsRequest,
  type RequestStatus,
  type RequestStep,
  REQUEST_STEPS,
  type UserKey,
  type VisitNote,
  type Vitals,
} from "./data"

/*
 * Medical records rules (brief §4). Screens never decide a status themselves: they ask here, so the list, the
 * badge, the counts and the Overview all agree.
 */

/* ------------------------------------------------------------------ visit notes */

/** What the note list shows: Draft → Overdue after 24 h unsigned; Signed → Addendum once one is added. */
export type NoteStatus = "draft" | "overdue" | "signed" | "addendum"

export function noteStatus(n: VisitNote, now = REC_NOW): NoteStatus {
  if (n.signedAt) return n.addenda.length ? "addendum" : "signed"
  return hoursBetween(n.createdAt, now) >= OVERDUE_HOURS ? "overdue" : "draft"
}
export const isSigned = (n: VisitNote) => !!n.signedAt
export const toSign = (s: NoteStatus) => s === "draft" || s === "overdue"
/** Hours the note has waited for a signature ("Draft · 2 h"). */
export const noteAge = (n: VisitNote, now = REC_NOW) => hoursBetween(n.createdAt, now)
/** The main diagnosis (exactly one per note; it goes on the insurance claim). */
export const mainDiagnosis = (n: VisitNote) => n.diagnoses.find((d) => d.type === "main") ?? n.diagnoses[0]

/** Signed notes are locked: they can't be edited or deleted, only added to. */
export const canEditNote = (n: VisitNote, me: UserKey) => !n.signedAt && n.author === me
export const canAddendum = (n: VisitNote, me: UserKey) => !!n.signedAt && n.author === me

/** Add a diagnosis: one Main only (a new Main makes the old one Secondary); no duplicates. */
export function addDiagnosis(n: VisitNote, code: string, type: VisitNote["diagnoses"][number]["type"]): VisitNote {
  if (n.signedAt) return n
  const rest = n.diagnoses.filter((d) => d.code !== code).map((d) => (type === "main" && d.type === "main" ? { ...d, type: "secondary" as const } : d))
  return { ...n, diagnoses: type === "main" ? [{ code, type }, ...rest] : [...rest, { code, type }] }
}
/** Remove a diagnosis; removing the Main promotes the next one so the claim always has one. */
export function removeDiagnosis(n: VisitNote, code: string): VisitNote {
  if (n.signedAt) return n
  const left = n.diagnoses.filter((d) => d.code !== code)
  if (left.length && !left.some((d) => d.type === "main")) left[0] = { ...left[0], type: "main" }
  return { ...n, diagnoses: left }
}

/* ------------------------------------------------------------------ vitals */

export type VitalKey = "bp" | "pulse" | "temp" | "spo2" | "weight" | "bmi"
/** Abnormal vitals are tinted: red when out of range, amber when borderline (BMI 30+ is obesity, amber). */
export function vitalTone(k: VitalKey, v: Vitals): "destructive" | "warning" | undefined {
  switch (k) {
    case "bp":
      return v.bp[0] >= 140 || v.bp[1] >= 90 ? "destructive" : v.bp[0] >= 130 || v.bp[1] >= 85 ? "warning" : undefined
    case "pulse":
      return v.pulse > 120 || v.pulse < 45 ? "destructive" : v.pulse > 100 || v.pulse < 55 ? "warning" : undefined
    case "temp":
      return v.temp >= 38.5 ? "destructive" : v.temp >= 37.6 ? "warning" : undefined
    case "spo2":
      return v.spo2 < 92 ? "destructive" : v.spo2 < 95 ? "warning" : undefined
    case "bmi":
      return v.bmi >= 40 ? "destructive" : v.bmi >= 30 ? "warning" : undefined
    default:
      return undefined
  }
}

/* ------------------------------------------------------------------ chart completion */

/** An item is open until it's done: the note it waits for is signed, or (no code) the note gets its main diagnosis. */
export function completionOpen(c: CompletionItem, notes: VisitNote[]) {
  if (c.doneAt) return false
  const n = c.note ? notes.find((x) => x.id === c.note) : undefined
  if (c.missing === "noCode") return !n || n.diagnoses.length === 0
  if (c.note) return !n?.signedAt
  return true
}
/** Remind goes to the doctor of the visit: app notification + SMS (stub); not for your own items. */
export const canRemind = (c: CompletionItem, doctor: UserKey, me: UserKey) => doctor !== me
export const waitingHours = (c: CompletionItem, now = REC_NOW) => hoursBetween(c.since, now)
/** Amber while waiting; red over 48 h. */
export const waitingTone = (c: CompletionItem, now = REC_NOW): "warning" | "destructive" => (waitingHours(c, now) > CHART_RED_HOURS ? "destructive" : "warning")

/* ------------------------------------------------------------------ requests */

/** The status follows from the steps: rejected · released · reviewed = ready · consent given = preparing · identity checked = waiting for consent · new. */
export function requestStatus(r: RecordsRequest): RequestStatus {
  if (r.rejected) return "rejected"
  if (r.steps.released) return "released"
  if (r.steps.review) return "ready"
  if (r.steps.consent) return "preparing"
  if (r.steps.identity) return "consent"
  return "new"
}
export const OPEN_REQUEST: RequestStatus[] = ["new", "consent", "preparing", "ready"]
export const isOpenRequest = (r: RecordsRequest) => OPEN_REQUEST.includes(requestStatus(r))
/** The step being worked on (the first not done), or undefined once released / rejected. */
export function currentStep(r: RecordsRequest): RequestStep | undefined {
  if (r.rejected) return undefined
  return REQUEST_STEPS.find((s) => !r.steps[s])
}
/** Pages in the copy (the ticked parts). */
export const copyPages = (r: RecordsRequest) => r.parts.reduce((n, p) => n + (r.pages?.[p] ?? 0), 0)
/** Release needs the doctor's review and at least one page in the copy. */
export const canRelease = (r: RecordsRequest) => requestStatus(r) === "ready" && r.parts.length > 0
/** Next request number this month (REQ-2611-019 after REQ-2611-018). */
export function nextRequestNo(existing: string[], month = "2611") {
  const head = `REQ-${month}-`
  const n = existing.filter((x) => x.startsWith(head)).map((x) => Number(x.slice(head.length)))
  return `${head}${String(Math.max(0, ...n) + 1).padStart(3, "0")}`
}
/** Days left until the due date (negative = late). */
export const dueIn = (r: RecordsRequest, today = REC_TODAY) => daysBetween(today, r.due)
/** Amber when due within 3 days (the design tints "In 3 days" and "Tomorrow"). */
export const dueSoon = (r: RecordsRequest) => isOpenRequest(r) && dueIn(r) <= 3
export const dueThisWeek = (r: RecordsRequest) => isOpenRequest(r) && dueIn(r) <= REQUEST_SOON_DAYS

/**
 * What goes in the copy: nothing outside the consent can be ticked, and mental health notes never go without a
 * court order (even inside the consent).
 */
export function canInclude(r: RecordsRequest, part: CopyPart) {
  if (part === "mental") return !!r.courtOrder && r.consentCovers.includes("mental")
  return r.consentCovers.includes(part)
}
/** A minor's records are released on the guardian's consent. */
export const consentBy = (p: RecPatient): "patient" | "guardian" => (p.age < 18 ? "guardian" : "patient")

/* ------------------------------------------------------------------ restricted files */

/** Opening a restricted file (VIP, staff, sensitive) outside the care team needs break the glass. */
export const needsBreakGlass = (p: RecPatient, me: UserKey, grantUntil?: string, now = REC_NOW) =>
  !!p.restricted && !p.careTeam.includes(me) && !(grantUntil && grantUntil > now)

/* ------------------------------------------------------------------ helpers */

export const encounterOf = (encounters: Encounter[], id: string) => encounters.find((e) => e.id === id)

/* ------------------------------------------------------------------ signing + addenda */

/** Sign and lock: timestamped with the clock; the note can't be edited or deleted after this. */
export function signNote(n: VisitNote, at: string = REC_NOW): VisitNote {
  return n.signedAt ? n : { ...n, signedAt: at }
}
/** An addendum goes under the signed note with who, when and why; the signed text never changes. */
export function addAddendum(n: VisitNote, a: VisitNote["addenda"][number]): VisitNote {
  return n.signedAt ? { ...n, addenda: [...n.addenda, a] } : n
}

/* ------------------------------------------------------------------ ICD-10 search */

/** By code ("I47") or name / search words in either language: code matches, then name matches, then the rest. */
export function searchIcd(q: string, list: Icd[] = ICD10, limit = 6): Icd[] {
  const raw = q.trim()
  const s = raw.toLowerCase()
  if (!s) return []
  const score = (x: Icd) =>
    x.code.toLowerCase().startsWith(s) ? 0 : x.name.en.toLowerCase().includes(s) || x.name.ar.includes(raw) ? 1 : (x.terms ?? []).some((w) => w.toLowerCase().includes(s)) ? 2 : 9
  return list
    .map((x) => [x, score(x)] as const)
    .filter(([, n]) => n < 9)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([x]) => x)
}

/* ------------------------------------------------------------------ prescriptions */

const DOSE_N: Record<RxLine["dose"], number> = { half: 0.5, one: 1, two: 2 }
const PER_DAY: Record<RxLine["freq"], number> = { morning: 1, night: 1, afterFood: 1, twice: 2, thrice: 3, asNeeded: 0 }

/** Quantity for the course (dose × times a day × days, rounded up); "when needed" keeps what the doctor typed. */
export function qtyFor(l: Pick<RxLine, "dose" | "freq" | "days">, current = 0) {
  const per = PER_DAY[l.freq]
  return per ? Math.ceil(DOSE_N[l.dose] * per * l.days) : current
}

/** The short line the visit note shows ("1 tablet daily · 30 days"). */
export function sigOf(l: RxLine, form: Bi): Bi {
  const capsule = form.en === "capsule"
  const dose: Record<RxLine["dose"], Bi> = {
    half: { en: `½ ${capsule ? "capsule" : "tablet"}`, ar: capsule ? "نص كبسولة" : "نص حبة" },
    one: { en: `1 ${capsule ? "capsule" : "tablet"}`, ar: capsule ? "كبسولة" : "حبة" },
    two: { en: `2 ${capsule ? "capsules" : "tablets"}`, ar: capsule ? "كبسولتين" : "حبتين" },
  }
  const how: Record<RxLine["freq"], Bi> = {
    morning: { en: "daily", ar: "يومياً" },
    night: { en: "at night", ar: "بالليل" },
    afterFood: { en: "daily", ar: "يومياً" },
    twice: { en: "twice a day", ar: "مرتين يومياً" },
    thrice: { en: "3 times a day", ar: "3 مرات يومياً" },
    asNeeded: { en: "when needed", ar: "عند الحاجة" },
  }
  const days: Bi = { en: `${l.days} days`, ar: l.days <= 10 ? `${l.days} أيام` : `${l.days} يوم` }
  return { en: `${dose[l.dose].en} ${how[l.freq].en} · ${days.en}`, ar: `${dose[l.dose].ar} ${how[l.freq].ar} · ${days.ar}` }
}

/** Next prescription number this month (RX-2611-0389 after RX-2611-0388). */
export function nextRxNo(existing: string[], month = "2611") {
  const n = existing.filter((x) => x.startsWith(`RX-${month}-`)).map((x) => Number(x.slice(8)))
  return `RX-${month}-${String(Math.max(388, ...n) + 1).padStart(4, "0")}`
}

/** Sending needs at least one medicine with a quantity, no allergy clash, and every interaction warning acknowledged. */
export function rxProblems(lines: RxLine[], check: { allergy: unknown[]; interactions: { id: string }[] }, acknowledged: string[]) {
  return {
    empty: lines.length === 0,
    qty: lines.some((l) => !(l.qty > 0)),
    allergy: check.allergy.length > 0,
    unacked: check.interactions.filter((i) => !acknowledged.includes(i.id)).map((i) => i.id),
  }
}

/* ------------------------------------------------------------------ documents */

/** Next document number this month for a prefix ("SL-2611-0092" after "SL-2611-0091"). */
export function nextDocNo(prefix: "SL" | "RF" | "MR", existing: string[], month = "2611") {
  const head = `${prefix}-${month}-`
  const n = existing.filter((x) => x.startsWith(head)).map((x) => Number(x.slice(head.length)))
  return `${head}${String(Math.max(0, ...n) + 1).padStart(4, "0")}`
}
/** Draft prescriptions open in New prescription; everything else on the document page. */
export const opensInPrescription = (d: { kind: string; status: string }) => d.kind === "prescription" && d.status === "draft"
