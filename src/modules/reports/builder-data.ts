import type { Bi } from "@/lib/mock/bi"
import { BRANCHES, CLINICS, DEFAULT_FILTERS, DOCTORS, PAYERS, type ReportFilters } from "./data"
import { LIBRARY, type ReportRow, type SavedReport } from "./library"
import { MEASURES, type MeasureId, type SourceId } from "./measures"
import type { AreaId } from "./overview-data"
import { enforceBranchAccess } from "./server"

/*
 * Report builder data (brief §2 "Report builder", §4): 1 Data (the source), 2 Measure (show, group by, then by),
 * 3 Filters (rows over the shared filters + the source's status rule), 4 Chart (bars / line / table only). The preview
 * runs the same query a saved report runs: branch access is narrowed on the server (server.ts) and rows never carry
 * patient names or IDs — only groups (clinic, doctor, insurer, hour, test, user) and their numbers.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

export type GroupBy = SavedReport["groupBy"]
export type ChartType = SavedReport["chart"]

export const BUILDER_SOURCES: SourceId[] = ["appointments", "visits", "invoices", "claims", "lab", "prescriptions"]

/** What each source can show (the measure list is filtered by source; the first is picked when the source changes). */
export const SOURCE_MEASURES: Record<SourceId, MeasureId[]> = {
  appointments: ["noShowRate", "missedVisits", "revenueMissed", "roomsInUse"],
  visits: ["visits", "newPatients", "avgWait", "avgVisit", "notesOnTime", "returns30", "visitsPerDoctor", "rating"],
  invoices: ["revenue"],
  claims: ["claimRejections"],
  lab: ["labTurnaround"],
  prescriptions: ["antibiotics"],
}

/** How each source can be grouped (Group by, then Then by from the rest). */
export const SOURCE_GROUPS: Record<SourceId, GroupBy[]> = {
  appointments: ["clinic", "doctor", "hour"],
  visits: ["clinic", "doctor", "hour", "insurer"],
  invoices: ["clinic", "insurer", "user", "doctor"],
  claims: ["insurer", "clinic", "doctor"],
  lab: ["test", "clinic", "doctor"],
  prescriptions: ["doctor", "clinic"],
}

/** The library folder a source's reports go to by default. */
export const SOURCE_FOLDER: Record<SourceId, AreaId> = {
  appointments: "operations",
  visits: "operations",
  invoices: "finance",
  claims: "finance",
  lab: "clinical",
  prescriptions: "clinical",
}

/** Sources that have a status rule ("Status · booked or done" for appointments). */
export const HAS_STATUS: SourceId[] = ["appointments"]

/** A builder's settings — what a saved report stores besides its name, owner, folder and visibility. */
export type BuilderCfg = {
  source: SourceId
  measure: MeasureId
  groupBy: GroupBy
  thenBy: GroupBy | "none"
  filters: ReportFilters
  /** The date row is on (off = every date the data has). */
  dated: boolean
  /** The status row is on (appointments: booked or done only). */
  status: boolean
  chart: ChartType
}

export const NEW_REPORT: BuilderCfg = {
  source: "appointments",
  measure: "noShowRate",
  groupBy: "clinic",
  thenBy: "none",
  filters: { ...DEFAULT_FILTERS, compare: true },
  dated: true,
  status: true,
  chart: "bars",
}

export function cfgOfReport(r: SavedReport): BuilderCfg {
  return {
    source: r.source,
    measure: r.measure,
    groupBy: r.groupBy,
    thenBy: r.builder?.thenBy ?? "none",
    filters: r.builder?.filters ?? NEW_REPORT.filters,
    dated: r.builder?.dated ?? true,
    status: r.builder?.status ?? HAS_STATUS.includes(r.source),
    chart: r.chart,
  }
}

/** Switching the source keeps what still fits and picks the first measure / grouping that does. */
export function withSource(c: BuilderCfg, source: SourceId): BuilderCfg {
  const measures = SOURCE_MEASURES[source]
  const groups = SOURCE_GROUPS[source]
  const groupBy = groups.includes(c.groupBy) ? c.groupBy : groups[0]
  const thenBy = c.thenBy !== "none" && groups.includes(c.thenBy) && c.thenBy !== groupBy ? c.thenBy : "none"
  return { ...c, source, measure: measures.includes(c.measure) ? c.measure : measures[0], groupBy, thenBy, status: HAS_STATUS.includes(source) ? c.status : false }
}

/* ------------------------------------------------------------------ groups */

const HOURS = ["08", "09", "10", "11", "12", "13", "14", "15", "16"]
const TESTS: { id: string; name: Bi }[] = [
  { id: "cbc", name: bi("CBC", "CBC") },
  { id: "hba1c", name: bi("HbA1c", "HbA1c") },
  { id: "lipid", name: bi("Lipid panel", "دهون الدم") },
  { id: "tsh", name: bi("TSH", "TSH") },
  { id: "vitd", name: bi("Vitamin D", "فيتامين د") },
  { id: "urine", name: bi("Urine culture", "مزرعة البول") },
]
const USERS: { id: string; name: Bi }[] = [
  { id: "reem", name: bi("Reem Al-Qahtani", "ريم القحطاني") },
  { id: "nora", name: bi("Nora Al-Fahad", "نورة الفهد") },
  { id: "abdullah", name: bi("Abdullah Al-Harbi", "عبدالله الحربي") },
  { id: "huda", name: bi("Huda Al-Shehri", "هدى الشهري") },
]

/** The groups of a dimension, as the filters narrow them. */
export function groupsOf(g: GroupBy, f: ReportFilters, source: SourceId): { key: string; label: Bi }[] {
  switch (g) {
    case "clinic":
      return CLINICS.filter((c) => f.clinic === "all" || c.id === f.clinic).map((c) => ({ key: c.id, label: c.name }))
    case "doctor":
      return DOCTORS.filter((d) => (f.doctor === "all" || d.id === f.doctor) && (f.clinic === "all" || d.clinic === f.clinic)).map((d) => ({ key: d.id, label: d.name }))
    case "insurer":
      return PAYERS.filter((p) => (source !== "claims" || p.id !== "cash") && (f.payer === "all" || p.id === f.payer)).map((p) => ({ key: p.id, label: p.name }))
    case "hour":
      return HOURS.map((h) => ({ key: h, label: bi(`${h}:00`, `${h}:00`) }))
    case "test":
      return TESTS.map((x) => ({ key: x.id, label: x.name }))
    case "user":
      return USERS.map((x) => ({ key: x.id, label: x.name }))
  }
}

/* ------------------------------------------------------------------ values */

/** A typical value and spread per measure (the demo data; the real query replaces this). */
const TYPICAL: Record<MeasureId, [number, number]> = {
  visits: [1500, 700],
  newPatients: [200, 100],
  avgWait: [16, 6],
  noShowRate: [9, 4],
  missedVisits: [150, 80],
  revenue: [420_000, 200_000],
  revenueMissed: [30_000, 15_000],
  claimRejections: [4, 2],
  labTurnaround: [4, 1.5],
  notesOnTime: [90, 7],
  rating: [4.5, 0.3],
  roomsInUse: [75, 15],
  avgVisit: [18, 5],
  returns30: [6, 3],
  visitsPerDoctor: [18, 6],
  antibiotics: [14, 6],
}

/** Stable pseudo-random 0–1 from a string (the same settings always preview the same numbers). */
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

const isCount = (m: MeasureId) => MEASURES[m].unit === "count" || MEASURES[m].unit === "sar"
const round = (m: MeasureId, v: number) => {
  const u = MEASURES[m].unit
  if (u === "count") return Math.round(v)
  if (u === "sar") return Math.round(v / 100) * 100
  if (u === "minutes") return Math.round(v)
  if (u === "stars") return Math.round(v * 10) / 10
  return Math.round(v * 10) / 10
}

/** Counts scale with the period and the branches the query ran over; rates don't. */
function scale(c: BuilderCfg, branches: string[]) {
  const period = !c.dated ? 1 : c.filters.period === "today" ? 0.05 : c.filters.period === "week" ? 0.3 : 1
  return period * (0.6 + 0.4 * branches.length)
}

export type PreviewRow = ReportRow & { sub?: Bi }

/**
 * The preview / saved rows for some settings. Runs through the server's branch narrowing first. A drawn library
 * report with the same source, measure and grouping (and the drawn filters) gives its own rows, so the builder and
 * the report it was saved as agree ("No-show rate by clinic": Dental 13.6% · 1,712 booked · 233 no-shows).
 * `rows` are per group (the bars, and what a saved report keeps); `table` splits them by Then by when it's set.
 */
export function previewRows(c: BuilderCfg, email: string): { rows: PreviewRow[]; table: PreviewRow[]; branches: string[] } {
  const { filters, branches } = enforceBranchAccess(email, c.filters)
  const drawn = LIBRARY.slice(0, 7).find((r) => r.source === c.source && r.measure === c.measure && r.groupBy === c.groupBy)
  const asDrawn = drawn && c.dated && c.filters.period === "month" && branches.length === 1 && branches[0] === "riyadh-main"
  const groups = groupsOf(c.groupBy, filters, c.source)
  let rows: PreviewRow[]
  if (asDrawn) {
    const keys = new Set(groups.map((g) => g.key))
    rows = drawn.rows.filter((r) => c.groupBy !== "clinic" || keys.has(r.key))
  } else {
    const [mid, spread] = TYPICAL[c.measure]
    const k = isCount(c.measure) ? scale(c, branches) / Math.max(1, groups.length / 4) : 1
    rows = groups.map((g) => {
      const seed = `${c.measure}|${c.groupBy}|${g.key}|${branches.join(",")}`
      const now = round(c.measure, (mid + (hash(seed) - 0.5) * 2 * spread) * k)
      const before = round(c.measure, now * (0.9 + hash(`${seed}|b`) * 0.2))
      if (c.measure !== "noShowRate") return { key: g.key, label: g.label, now, before }
      const base = Math.round((1000 + hash(`${seed}|n`) * 1100) * scale(c, branches))
      return { key: g.key, label: g.label, now, before, base, count: Math.round((base * now) / 100) }
    })
  }
  // Highest first (the drawn order: Dental 13.6% down to Pediatrics 7.2%).
  rows = [...rows].sort((a, z) => z.now - a.now)
  if (c.thenBy === "none") return { rows, table: rows, branches }
  // Then by: each group split by the second dimension; counts share the group's total, rates vary around it.
  const subs = groupsOf(c.thenBy, filters, c.source).slice(0, 3)
  const table: PreviewRow[] = []
  for (const r of rows) {
    subs.forEach((s, i) => {
      const w = hash(`${r.key}|${s.key}`)
      const part = (v: number) => (isCount(c.measure) ? round(c.measure, (v * (i === 0 ? 0.45 : i === 1 ? 0.35 : 0.2))) : round(c.measure, v * (0.85 + w * 0.3)))
      table.push({ key: `${r.key}:${s.key}`, label: r.label, sub: s.label, now: part(r.now), before: part(r.before) })
    })
  }
  return { rows, table, branches }
}

export const branchName = (id: string) => BRANCHES.find((b) => b.id === id)
