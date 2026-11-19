import type { Bi } from "@/lib/mock/bi"
import {
  LAB_NOW,
  ORDER_OF_DRAW,
  addMins,
  analyteOf,
  minsBetween,
  minsOf,
  testOf,
  type Analyte,
  type CriticalCall,
  type Flag,
  type LabEvent,
  type LabOrder,
  type LabPatient,
  type OrderStatus,
  type Panel,
  type RefBand,
  type RejectReason,
  type Result,
  type Tube,
} from "./data"

/*
 * Labs status machine (brief §4). Pure functions: each transition takes an order and returns the next one, or a
 * refusal ({ ok: false, reason }) when its guard fails. The store applies them; screens read the derived state.
 *
 *   collect ──(every tube collected)──▶ lab ──(a panel submitted)──▶ validate ──(released)──▶ ready
 *      ▲                                                         partial: panels release one by one
 *      └──── rejected (a tube rejected with "request a new sample" → recollect ticket) ◀── any stage before release
 *
 * A critical result blocks release of the whole order until its call is logged (who, how, when, read-back).
 */

/* ------------------------------------------------------------------ flags */

/** The reference band for a patient (age in months, sex); falls back to the first band. */
export function bandFor(a: Analyte, p?: Pick<LabPatient, "ageMonths" | "sex">): RefBand | undefined {
  if (!p) return a.ref[0]
  return (
    a.ref.find((b) => (!b.sex || b.sex === p.sex) && (b.minMonths === undefined || p.ageMonths >= b.minMonths) && (b.maxMonths === undefined || p.ageMonths <= b.maxMonths)) ??
    a.ref[0]
  )
}

/** Auto flag: critical limits first (they're separate from the range), then the age/sex reference range. */
export function flagFor(analyte: string, value: number | null, p?: Pick<LabPatient, "ageMonths" | "sex">): Flag | null {
  const a = analyteOf(analyte)
  if (!a || value === null || Number.isNaN(value)) return null
  if ((a.critLow !== undefined && value < a.critLow) || (a.critHigh !== undefined && value > a.critHigh)) return "C"
  const b = bandFor(a, p)
  if (b?.low !== undefined && value < b.low) return "L"
  if (b?.high !== undefined && value > b.high) return "H"
  return null
}

/** "4.0–5.6", "< 170", "> 45" (Latin, LTR). */
export function refText(r: Pick<Result, "refLow" | "refHigh" | "analyte">) {
  const dp = analyteOf(r.analyte)?.dp ?? 0
  const f = (v: number) => v.toFixed(dp)
  if (r.refLow !== undefined && r.refHigh !== undefined) return `${f(r.refLow)}–${f(r.refHigh)}`
  if (r.refHigh !== undefined) return `< ${f(r.refHigh)}`
  if (r.refLow !== undefined) return `> ${f(r.refLow)}`
  return "—"
}

/** A result value formatted with the analyte's decimals. */
export function valueText(analyte: string, v: number | null) {
  if (v === null) return "—"
  const dp = analyteOf(analyte)?.dp ?? 0
  return v.toFixed(dp)
}

/**
 * Delta check: the % change from the previous result when it's over the analyte's threshold (LDL 30%), else null.
 * Rounded down so a 32.0–32.9% change reads "32%".
 */
export function deltaFor(r: Pick<Result, "analyte" | "value" | "previous">): number | null {
  const a = analyteOf(r.analyte)
  if (!a?.deltaPct || r.value === null || !r.previous || !r.previous.value) return null
  const pct = ((r.value - r.previous.value) / r.previous.value) * 100
  return Math.abs(pct) > a.deltaPct ? Math.trunc(pct) : null
}

/** Trend against the previous result, shown with an icon only when the value is flagged (as in the design). */
export const trendOf = (r: Pick<Result, "value" | "previous">): "up" | "down" | null =>
  r.value === null || !r.previous || r.value === r.previous.value ? null : r.value > r.previous.value ? "up" : "down"

/** Flag counts across the order (mock counts for sample orders without individual results). */
export function flagCounts(o: LabOrder): Record<Flag, number> {
  const c: Record<Flag, number> = { C: 0, H: 0, L: 0 }
  for (const p of o.panels) {
    if (p.state !== "validate" && p.state !== "released") continue
    for (const r of p.results) if (r.flag) c[r.flag]++
    if (p.mockFlags) for (const k of ["C", "H", "L"] as Flag[]) c[k] += p.mockFlags[k] ?? 0
  }
  return c
}

/* ------------------------------------------------------------------ status */

/** Tubes waiting to be (re)collected. */
export const tubesToCollect = (o: LabOrder) =>
  o.tubes.filter((t) => t.state === "pending").sort((a, z) => (a.recollectOf ?? a.no) - (z.recollectOf ?? z.no))
/** A tube was rejected and a new sample is requested, not collected yet → "Recollect". */
export const isRecollect = (o: LabOrder) => o.tubes.some((t) => t.state === "pending" && t.recollectOf !== undefined)
/** Tubes still in play (rejected ones are kept for the record only). */
export const liveTubes = (o: LabOrder) => o.tubes.filter((t) => t.state !== "rejected")

/**
 * Order status, derived from the tubes and panels:
 * - rejected: a rejected tube waits for its recollection;
 * - collect: a tube isn't collected yet;
 * - ready: every panel is released;
 * - validate: a panel is submitted and waits for the pathologist;
 * - lab: everything else (collected, received, on the analyzer, results being entered).
 *
 * The design keeps an in-transit order (collected, not yet received) under "In lab" (LAB-0137), so "lab" starts at
 * collection; reception is tracked per tube.
 */
export function statusOf(o: LabOrder): OrderStatus {
  if (isRecollect(o)) return "rejected"
  if (tubesToCollect(o).length) return "collect"
  if (o.panels.length && o.panels.every((p) => p.state === "released")) return "ready"
  if (o.panels.some((p) => p.state === "validate")) return "validate"
  return "lab"
}

/** Released panels / all panels (partial release). */
export const releasedCount = (o: LabOrder) => o.panels.filter((p) => p.state === "released").length

/* ------------------------------------------------------------------ critical values */

export type CriticalItem = { panel: string; result: Result; resultedAt: string; deadline: string; called?: CriticalCall }

/** Every critical result on the order, with its call-by deadline (resulted + 30 min) and the call that covers it. */
export function criticals(o: LabOrder): CriticalItem[] {
  const out: CriticalItem[] = []
  for (const p of o.panels) {
    if (p.state !== "validate" && p.state !== "released") continue
    for (const r of p.results) {
      if (r.flag !== "C") continue
      const at = r.resultedAt ?? p.resultedAt ?? o.createdAt
      out.push({ panel: p.test, result: r, resultedAt: at, deadline: addMins(at, 30), called: o.calls.find((c) => c.analyte === r.analyte && c.readBack) })
    }
  }
  return out
}

/** Critical results nobody has called in yet (KPI, alert strip and banner stay up while this isn't empty). */
export const uncalledCriticals = (o: LabOrder) => criticals(o).filter((c) => !c.called)

/** Minutes left to call (negative = overdue). */
export const minsToDeadline = (c: CriticalItem, now = LAB_NOW) => -minsBetween(c.deadline, now)

/* ------------------------------------------------------------------ guards */

export type Refusal = { ok: false; reason: "notPending" | "notCollected" | "missingValues" | "criticalNotCalled" | "notSubmitted" | "noReadBack" | "notReleased" | "empty" }
export type Step = { ok: true; order: LabOrder } | Refusal

const no = (reason: Refusal["reason"]): Refusal => ({ ok: false, reason })
const ok = (order: LabOrder): Step => ({ ok: true, order })
const log = (o: LabOrder, e: LabEvent): LabEvent[] => [...o.events, e]

/** Release is allowed for submitted panels once every critical result has a logged call with read-back. */
export function canRelease(o: LabOrder): { ok: true } | Refusal {
  if (!o.panels.some((p) => p.state === "validate")) return no("notSubmitted")
  if (uncalledCriticals(o).length) return no("criticalNotCalled")
  return { ok: true }
}

/* ------------------------------------------------------------------ transitions */

/**
 * Collect sample: ticked tubes become collected (ID checked by the phlebotomist). Unticked tubes stay "to collect".
 * When the last tube is collected the order leaves the collection queue (ticket cleared) → "In lab".
 */
export function collect(o: LabOrder, tubeNos: number[], by: string, at: string, opts: { fastingConfirmed?: boolean } = {}): Step {
  const picks = o.tubes.filter((t) => tubeNos.includes(t.no) && t.state === "pending")
  if (!picks.length) return no("notPending")
  const tubes = o.tubes.map((t) => (picks.includes(t) ? { ...t, state: "collected" as const, collectedAt: at, collectedBy: by } : t))
  const done = tubes.every((t) => t.state !== "pending")
  // A test's results are due collection time + its turnaround (same-day TATs; longer ones show no due time).
  const ready = (test: string) => tubes.filter((t) => t.tests.includes(test)).every((t) => t.state !== "pending")
  const panels = o.panels.map((p) => {
    const tat = testOf(p.test)?.tatH ?? 0
    return p.state === "waiting" && !p.dueAt && ready(p.test) && tat && minsOf(at) + tat * 60 < 24 * 60 ? { ...p, dueAt: addMins(at, tat * 60) } : p
  })
  return ok({
    ...o,
    tubes,
    panels,
    fasting: opts.fastingConfirmed ?? o.fasting,
    ticket: done ? undefined : o.ticket,
    queuedAt: done ? undefined : o.queuedAt,
    events: log(o, { at, kind: "collected", by }),
  })
}

/** Lab reception scans tubes in: received time + who, and a custody event (with a typed remark when there is one). */
export function receive(o: LabOrder, tubeNos: number[], by: string, at: string, opts: { note?: Bi; remark?: string } = {}): Step {
  const picks = o.tubes.filter((t) => tubeNos.includes(t.no) && t.state === "collected")
  if (!picks.length) return no("notCollected")
  return ok({
    ...o,
    tubes: o.tubes.map((t) => (picks.includes(t) ? { ...t, state: "received" as const, receivedAt: at, receivedBy: by } : t)),
    events: log(o, { at, kind: "received", by, note: opts.note, remark: opts.remark }),
  })
}

export type ReceiveProblem =
  | { reason: "stability"; analyte: string; hours: number; ageMin: number }
  | { reason: "info" }

/**
 * Receiving rules (CODE_CHAT_LABS.md §4): the collection must be recorded (time + who), and the sample must still be
 * within the stability limit of every test it carries (e.g. potassium 4 h before spinning). Returns the problem, or
 * null when the tube can be received.
 */
export function receiveProblem(o: LabOrder, tubeNo: number, now: string = LAB_NOW): ReceiveProblem | null {
  const t = o.tubes.find((x) => x.no === tubeNo)
  if (!t || !t.collectedAt || !t.collectedBy) return { reason: "info" }
  const age = minsBetween(t.collectedAt, now)
  const limits = t.tests.map((k) => testOf(k)?.stability).filter((x): x is NonNullable<typeof x> => !!x)
  const broken = limits.filter((l) => age > l.hours * 60).sort((a, z) => a.hours - z.hours)[0]
  return broken ? { reason: "stability", analyte: broken.analyte, hours: broken.hours, ageMin: age } : null
}

/**
 * Reject sample: the tube goes back to "to collect" with the reason. With "request a new sample" the order shows
 * as Recollect and gets a collection-queue ticket; its panels that depend on the tube go back to waiting.
 */
export function reject(
  o: LabOrder,
  tubeNo: number,
  reason: RejectReason,
  opts: { recollect: boolean; toldDoctor: boolean; ticket?: string },
  by: string,
  at: string
): Step {
  const tube = o.tubes.find((t) => t.no === tubeNo)
  if (!tube || tube.state === "pending" || tube.state === "rejected") return no("notCollected")
  const rejection = { reason, at, by, recollect: opts.recollect, toldDoctor: opts.toldDoctor }
  const tubes: Tube[] = o.tubes.map((t) => (t.no === tubeNo ? { ...t, state: "rejected" as const, rejection } : t))
  // A new sample gets its own tube (and label) number; it carries the same tests.
  if (opts.recollect)
    tubes.push({ no: Math.max(...o.tubes.map((t) => t.no)) + 1, type: tube.type, tests: tube.tests, volumeMl: tube.volumeMl, state: "pending", recollectOf: tube.no })
  return ok({
    ...o,
    tubes,
    panels: o.panels.map((p) => (tube.tests.includes(p.test) && p.state !== "released" ? { ...p, state: "waiting" as const, dueAt: undefined, results: p.results.map((r) => ({ ...r, value: null, flag: null })) } : p)),
    ticket: opts.recollect ? (o.ticket ?? opts.ticket) : o.ticket,
    queuedAt: opts.recollect ? (o.queuedAt ?? at) : o.queuedAt,
    events: log(o, { at, kind: "rejected", by }),
  })
}

/** Values typed or imported for a panel: flags are recomputed from the ranges and critical limits. */
export function withValues(o: LabOrder, test: string, values: Record<string, number | null>): Panel[] {
  return o.panels.map((p) =>
    p.test !== test
      ? p
      : {
          ...p,
          results: p.results.map((r) => {
            if (!(r.analyte in values)) return r
            const value = values[r.analyte]
            return { ...r, value, flag: flagFor(r.analyte, value, o.patient), manual: r.value !== value ? true : r.manual }
          }),
        }
  )
}

/** Save draft: values and comment kept, nothing visible to the doctor yet. */
export function saveDraft(o: LabOrder, test: string, values: Record<string, number | null>, comment: string | undefined): Step {
  const p = o.panels.find((x) => x.test === test)
  if (!p || p.state === "validate" || p.state === "released") return no("notPending")
  const panels = withValues(o, test, values).map((x) => (x.test === test ? { ...x, state: "draft" as const, comment } : x))
  return ok({ ...o, panels })
}

/** Submit for validation: every value present; stamps resulted time (the critical deadline starts here). */
export function submit(o: LabOrder, test: string, values: Record<string, number | null>, comment: string | undefined, by: string, at: string): Step {
  const p = o.panels.find((x) => x.test === test)
  if (!p || p.state === "validate" || p.state === "released") return no("notPending")
  const panels = withValues(o, test, values)
  const np = panels.find((x) => x.test === test)!
  if (!np.results.length || np.results.some((r) => r.value === null)) return no("missingValues")
  return ok({
    ...o,
    panels: panels.map((x) =>
      x.test === test ? { ...x, state: "validate" as const, comment, submittedBy: by, resultedAt: at, results: x.results.map((r) => ({ ...r, resultedAt: at })) } : x
    ),
    events: log(o, { at, kind: "submitted", by }),
  })
}

/** Log critical call: needs who, how, when and read-back ticked. */
export function logCall(o: LabOrder, call: CriticalCall): Step {
  if (!call.readBack) return no("noReadBack")
  if (!criticals(o).some((c) => c.result.analyte === call.analyte)) return no("empty")
  return ok({ ...o, calls: [...o.calls.filter((c) => c.analyte !== call.analyte), call], events: log(o, { at: call.at, kind: "critical", by: call.by }) })
}

/**
 * Validate & release the chosen submitted panels (partial release: the rest stay for later).
 * Refused while a critical value hasn't been called in.
 */
export function release(o: LabOrder, tests: string[], by: string, at: string, opts: { inPatientApp: boolean; comment?: string }): Step {
  const g = canRelease(o)
  if (!g.ok) return g
  const picks = o.panels.filter((p) => tests.includes(p.test) && p.state === "validate")
  if (!picks.length) return no("empty")
  return ok({
    ...o,
    panels: o.panels.map((p) =>
      picks.includes(p) ? { ...p, state: "released" as const, validatedBy: by, validatedAt: at, releasedAt: at, inPatientApp: opts.inPatientApp, comment: opts.comment ?? p.comment } : p
    ),
    events: [...o.events, { at, kind: "validated", by }, { at, kind: "released", by }],
  })
}

/** Send results (report): only released panels can go out. */
export function send(o: LabOrder, by: string, at: string): Step {
  if (!releasedCount(o)) return no("notReleased")
  return ok({ ...o, sentAt: at, events: log(o, { at, kind: "sent", by }) })
}

/* ------------------------------------------------------------------ stepper */

export type StepKey = "ordered" | "collected" | "received" | "resulted" | "validated" | "released"
export const STEPS: StepKey[] = ["ordered", "collected", "received", "resulted", "validated", "released"]

/** The 6-step stepper: each step's time (first event of that kind) and the current step (first one not done). */
export function stepper(o: LabOrder): { key: StepKey; at?: string; state: "done" | "now" | "todo" }[] {
  const first = (k: LabEvent["kind"]) => o.events.find((e) => e.kind === k)?.at
  const times: Record<StepKey, string | undefined> = {
    ordered: o.createdAt,
    collected: tubesToCollect(o).length ? undefined : first("collected"),
    received: liveTubes(o).every((t) => t.receivedAt) ? first("received") : undefined,
    resulted: o.panels.some((p) => p.resultedAt) ? (o.panels.map((p) => p.resultedAt).filter(Boolean).sort().at(-1) as string) : undefined,
    validated: o.panels.some((p) => p.validatedAt) ? first("validated") : undefined,
    released: statusOf(o) === "ready" ? first("released") : undefined,
  }
  const now = STEPS.findIndex((k) => !times[k])
  return STEPS.map((key, i) => ({ key, at: times[key], state: now === -1 || i < now ? "done" : i === now ? "now" : "todo" }))
}

/* ------------------------------------------------------------------ helpers for screens */

/** Barcode/tube helpers for a new order: one tube per tube type, carrying every test that uses it. */
export function tubesFor(tests: string[]) {
  const by = new Map<string, string[]>()
  for (const k of tests) {
    const t = testOf(k)
    if (!t) continue
    by.set(t.tube, [...(by.get(t.tube) ?? []), k])
  }
  // Tubes are numbered (and labelled) in the order of draw; urine cups and culture bottles come last.
  const rank = (type: string) => {
    const i = ORDER_OF_DRAW.findIndex((x) => x.tube === type)
    return i === -1 ? ORDER_OF_DRAW.length : i
  }
  return [...by.entries()].sort((a, z) => rank(a[0]) - rank(z[0])).map(([type, ts], i) => ({ no: i + 1, type: type as LabOrder["tubes"][number]["type"], tests: ts, volumeMl: Math.max(0, ...ts.map((k) => testOf(k)?.volumeMl ?? 0)) || undefined, state: "pending" as const }))
}
