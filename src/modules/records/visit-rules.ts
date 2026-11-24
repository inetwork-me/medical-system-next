import { REC_TODAY, type PatientKey, type VisitNote } from "./data"
import { baseIdsOf, mainDx, visitStatus, type ClinicId, type IdType, type PatientIds, type Visit } from "./visits-data"

/*
 * Data quality for official returns (brief §4). Patient fields: nationality, ID type + number. Visit fields: main
 * diagnosis code, visit type, payer. A visit is "missing data" when a field a return needs is empty. Nationality and
 * ID live on the patient's file, so adding them once fills every visit of that patient.
 */

export type MissingRule = "nationality" | "id" | "diagnosis"
export const RULES: MissingRule[] = ["nationality", "id", "diagnosis"]
export const isRule = (x: string | null | undefined): x is MissingRule => !!x && (RULES as string[]).includes(x)
/** The rule as the URL spells it (?rule=nationality|id|dx). */
export const ruleParam = (r: MissingRule) => (r === "diagnosis" ? "dx" : r)
export const ruleFromParam = (x: string | null | undefined): MissingRule | null => (x === "dx" ? "diagnosis" : isRule(x) ? x : null)

/** What the rules look at: the patients' IDs (with this session's saves) and each visit's note. */
export type VisitCtx = { ids: (k: PatientKey) => PatientIds; note: (visitId: string) => VisitNote | undefined }

export function makeCtx(saved: Record<PatientKey, PatientIds>, notes: VisitNote[]): VisitCtx {
  const byVisit = new Map<string, VisitNote>()
  for (const n of notes) byVisit.set(n.encounter, n)
  const cache = new Map<PatientKey, PatientIds>()
  return {
    ids: (k) => {
      let v = cache.get(k)
      if (!v) {
        v = { ...baseIdsOf(k), ...stripEmpty(saved[k]) }
        cache.set(k, v)
      }
      return v
    },
    note: (id) => byVisit.get(id),
  }
}
const stripEmpty = (x?: PatientIds): PatientIds => (x ? Object.fromEntries(Object.entries(x).filter(([, v]) => v)) : {})

/** A visit's diagnosis is only due once the doctor is done with it. */
const finished = (v: Visit) => {
  const s = visitStatus(v)
  return s === "checkedOut" || s === "notCheckedOut"
}

export function missingOf(v: Visit, ctx: VisitCtx): MissingRule[] {
  const ids = ctx.ids(v.patient)
  const out: MissingRule[] = []
  if (!ids.nationality) out.push("nationality")
  // A missing ID counts on its own once the nationality is known (Add nationality fills both).
  else if (!ids.idType || !ids.idNumber) out.push("id")
  if (finished(v) && !mainDx(v, ctx.note(v.id))) out.push("diagnosis")
  return out
}

/** Period "2026-11" + branch: the visits a monthly return covers. */
export const inPeriod = (v: Visit, period: string, branch?: string) => v.checked_in_at.startsWith(period) && (!branch || v.branch === branch)

export type MissingRow = { patient: PatientKey; visits: Visit[]; last: Visit; clinic: ClinicId }

/** Rows of the missing-data view: one per patient, most recent visit first. */
export function missingRows(visits: Visit[], rule: MissingRule, ctx: VisitCtx): MissingRow[] {
  const by = new Map<PatientKey, Visit[]>()
  for (const v of visits) {
    if (!missingOf(v, ctx).includes(rule)) continue
    const list = by.get(v.patient)
    if (list) list.push(v)
    else by.set(v.patient, [v])
  }
  return [...by.entries()]
    .map(([patient, vs]) => {
      const sorted = [...vs].sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))
      return { patient, visits: sorted, last: sorted[0], clinic: sorted[0].clinic }
    })
    .sort((a, b) => b.last.checked_in_at.localeCompare(a.last.checked_in_at))
}

/** Visits and patients missing each rule in a set of visits. */
export function missingCounts(visits: Visit[], ctx: VisitCtx) {
  const out = { nationality: { visits: 0, patients: 0 }, id: { visits: 0, patients: 0 }, diagnosis: { visits: 0, patients: 0 } }
  const seen = { nationality: new Set<string>(), id: new Set<string>(), diagnosis: new Set<string>() }
  for (const v of visits) {
    for (const r of missingOf(v, ctx)) {
      out[r].visits++
      seen[r].add(v.patient)
    }
  }
  for (const r of RULES) out[r].patients = seen[r].size
  return out
}

/** ID numbers: National ID 10 digits from 1, Iqama 10 digits from 2, GCC ID 8–15 digits, passport 6–9 letters / digits. */
export function idNumberProblem(type: IdType, no: string): "format" | null {
  const v = no.trim()
  if (type === "border") return /^[34]\d{9}$/.test(v) ? null : "format"
  if (type === "national") return /^1\d{9}$/.test(v) ? null : "format"
  if (type === "iqama") return /^2\d{9}$/.test(v) ? null : "format"
  if (type === "gcc") return /^\d{8,15}$/.test(v) ? null : "format"
  return /^[A-Za-z0-9]{6,9}$/.test(v) ? null : "format"
}
/** A National ID is for Saudis; an Iqama for residents who aren't. */
export function idTypeConflict(nationality: string, type: IdType): "nationalNotSaudi" | "iqamaSaudi" | null {
  if (type === "national" && nationality && nationality !== "SA") return "nationalNotSaudi"
  if (type === "iqama" && nationality === "SA") return "iqamaSaudi"
  return null
}

export const lastDigits = (no?: string) => (no ? no.slice(-3) : "")
export const isToday = (v: Visit) => v.checked_in_at.slice(0, 10) === REC_TODAY
