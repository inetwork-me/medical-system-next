/**
 * Document numbering (Settings › Numbering and formats, design v9.0): prefix + date token ({YY}, {YYMM}, {YYMMDD}) +
 * zero-padded counter + reset period. Codes always start with letters (RTL safety). A change applies to new numbers only,
 * from the next reset, so one period's numbers stay one series (ZATCA needs invoice numbers unique per branch).
 */
export type DatePart = "none" | "YY" | "YYMM" | "YYMMDD"
export type Reset = "never" | "daily" | "monthly" | "yearly"
export type NumberFormat = { prefix: string; date: DatePart; digits: number; reset: Reset }
export type DocKey = "mrn" | "visit" | "invoice" | "credit" | "rx" | "lab" | "request" | "contract"

export const DOC_KEYS: DocKey[] = ["mrn", "visit", "invoice", "credit", "rx", "lab", "request", "contract"]

/** Design seed. */
export const FORMATS_DEFAULT: Record<DocKey, NumberFormat> = {
  mrn: { prefix: "MRN", date: "none", digits: 5, reset: "never" },
  visit: { prefix: "V", date: "YYMM", digits: 5, reset: "monthly" },
  invoice: { prefix: "INV", date: "YYMM", digits: 4, reset: "monthly" },
  credit: { prefix: "CN", date: "YYMM", digits: 4, reset: "monthly" },
  rx: { prefix: "RX", date: "YYMM", digits: 4, reset: "monthly" },
  lab: { prefix: "LAB", date: "none", digits: 4, reset: "daily" },
  request: { prefix: "REQ", date: "YYMM", digits: 3, reset: "monthly" },
  contract: { prefix: "CTR", date: "YY", digits: 3, reset: "yearly" },
}

/** "INV-{YYMM}-{4}" */
export const pattern = (f: NumberFormat) => [f.prefix, f.date === "none" ? "" : `{${f.date}}`, `{${f.digits}}`].filter(Boolean).join("-")

const datePart = (d: NumberFormat["date"], at: string) =>
  d === "YY" ? at.slice(2, 4) : d === "YYMM" ? `${at.slice(2, 4)}${at.slice(5, 7)}` : d === "YYMMDD" ? `${at.slice(2, 4)}${at.slice(5, 7)}${at.slice(8, 10)}` : ""

/** The number for a counter at a date ("INV-2612-0001"). */
export function formatNumber(f: NumberFormat, at: string, n: number) {
  return [f.prefix, datePart(f.date, at), String(n).padStart(f.digits, "0")].filter(Boolean).join("-")
}

/** The day a period starts again after `at` (Never → null). */
export function nextReset(r: Reset, at: string): string | null {
  const d = new Date(`${at.slice(0, 10)}T12:00:00Z`)
  if (r === "never") return null
  if (r === "daily") d.setUTCDate(d.getUTCDate() + 1)
  if (r === "monthly") d.setUTCMonth(d.getUTCMonth() + 1, 1)
  if (r === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1, 0, 1)
  return d.toISOString().slice(0, 10)
}

/** A reset period the date part can't tell apart repeats numbers (monthly needs the month, …). */
export function resetCovered(f: NumberFormat) {
  const has = { none: 0, YY: 1, YYMM: 2, YYMMDD: 3 }[f.date]
  const needs = { never: 0, yearly: 1, monthly: 2, daily: 3 }[f.reset]
  return f.reset === "never" || has >= needs
}

/* ------------------------------------------------------------------ live formats */

/** A saved format and the day it starts (the next reset after it was saved). */
export type SavedFormat = { format: NumberFormat; from: string }
let live: Partial<Record<DocKey, SavedFormat>> | null = null
export function setFormatsGate(f: Partial<Record<DocKey, SavedFormat>> | null) {
  live = f
}

/** The format that numbers a document at a date: a saved change from its start day, the earlier format before. */
export function formatAt(key: DocKey, at: string): NumberFormat {
  const s = live?.[key]
  return s && at.slice(0, 10) >= s.from ? s.format : FORMATS_DEFAULT[key]
}

/** The next number after the existing ones of the same series (prefix + date part of `at`, same width). */
export function nextNumber(key: DocKey, existing: string[], at: string) {
  const f = formatAt(key, at)
  const stem = formatNumber(f, at, 0).slice(0, -f.digits)
  const top = existing.filter((n) => n.startsWith(stem) && n.length === stem.length + f.digits).reduce((m, n) => Math.max(m, Number(n.slice(-f.digits)) || 0), 0)
  return formatNumber(f, at, top + 1)
}
