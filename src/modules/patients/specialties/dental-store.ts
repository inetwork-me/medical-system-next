"use client"

import * as React from "react"

import { dentalRecord, newDentalRecord, procedureBy, TOOTH_NOTES, type Condition, type DentalRecord, type PlanItem, type Surface, type ToothMark, type ToothRecord } from "./data"
import type { Bi } from "@/lib/mock/bi"

/**
 * Session edits to the dental file (Tooth Panel "Update plan", tooth selection, uploaded x-rays), shared by the Dental
 * tab and every dental workspace (chart, 3D view, plan, gums) so a change shows everywhere. Kept in sessionStorage like
 * the other module stores; uploaded x-ray images stay in memory only (object URLs).
 */

type PatientEdits = {
  /** A first dental chart was opened for a patient without dental records. */
  started?: boolean
  teeth?: Record<number, ToothRecord>
  plan?: PlanItem[]
  notes?: Record<number, string>
  selected?: number | null
  savedAt?: string
  preApproval?: { sentAt: string; notifyGuardian: boolean }
  consent?: "sent" | "signed"
}
type State = Record<string, PatientEdits>

const KEY = "ms.dental.session"
let state: State = {}
let loaded = false
const listeners = new Set<() => void>()
const uploads: Record<string, { src: string; label: Bi }[]> = {}

function emit() {
  for (const l of listeners) l()
}
function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
}
function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      state = JSON.parse(raw)
      emit()
    }
  } catch {}
}
function update(id: string, fn: (e: PatientEdits) => PatientEdits) {
  state = { ...state, [id]: fn(state[id] ?? {}) }
  persist()
  emit()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const EMPTY: State = {}

function useEdits(id: string): PatientEdits | undefined {
  React.useEffect(load, [])
  const all = React.useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  )
  return all[id]
}

/** Dental file with this session's edits applied (null = no dental records). */
export function useDentalRecord(id: string): DentalRecord | null {
  const edits = useEdits(id)
  return React.useMemo(() => {
    const base = dentalRecord(id) ?? (edits?.started ? newDentalRecord(id) : null)
    if (!base) return null
    if (!edits) return base
    return {
      ...base,
      chart: {
        teeth: { ...base.chart.teeth, ...edits.teeth },
        selected: edits.selected === undefined ? base.chart.selected : (edits.selected ?? base.chart.selected),
      },
      plan: edits.plan ?? base.plan,
      consent: edits.consent ? { ...base.consent, status: edits.consent } : base.consent,
      preApproval:
        base.preApproval && edits.preApproval
          ? {
              ...base.preApproval,
              notifyGuardian: edits.preApproval.notifyGuardian,
              current: "decision" as const,
              steps: base.preApproval.steps.map((st) => (st.key === "sent" ? { ...st, at: edits.preApproval!.sentAt } : st)),
            }
          : base.preApproval,
    }
  }, [id, edits])
}

/** Selected tooth (null = panel closed). Starts at the design's tooth 36, or `?tooth=` when the workspace opens. */
export function useSelectedTooth(id: string, initial?: number | null): [number | null, (fdi: number | null) => void] {
  const edits = useEdits(id)
  const base = dentalRecord(id)?.chart.selected ?? null
  const selected = edits?.selected !== undefined ? edits.selected : (initial ?? base)
  const set = React.useCallback((fdi: number | null) => update(id, (e) => ({ ...e, selected: fdi })), [id])
  return [selected, set]
}

export function useToothNote(id: string, fdi: number): string | null {
  const edits = useEdits(id)
  return edits?.notes?.[fdi] ?? null
}

export function useToothUploads(id: string, fdi: number) {
  const [, force] = React.useReducer((x: number) => x + 1, 0)
  const key = `${id}:${fdi}`
  return {
    list: uploads[key] ?? [],
    add: (files: FileList | File[]) => {
      uploads[key] = [...(uploads[key] ?? []), ...Array.from(files).map((f) => ({ src: URL.createObjectURL(f), label: { en: f.name, ar: f.name } }))]
      force()
    },
  }
}

/* ---------------------------------------------------------------- tooth panel → chart + plan */

export type ToothDraft = {
  surfaces: Surface[]
  condition: Condition | null
  treatment: string | null
  status: "existing" | "planned" | "done"
  notes: string
}

/** Draft the Tooth Panel opens with, read from the chart, the plan and the saved note. */
export function draftFor(rec: DentalRecord, fdi: number, note: string | null, locale: "en" | "ar"): ToothDraft {
  const r = rec.chart.teeth[fdi] ?? {}
  const s = r.surfaces ?? {}
  const decay = (Object.keys(s) as Surface[]).filter((k) => s[k] === "decay")
  const items = rec.plan.filter((i) => i.teeth.includes(fdi))
  const item = items.find((i) => i.status === "planned") ?? items[0]
  const fromPlan = item ? procedureBy(item.cdt)?.condition : undefined
  const condition: Condition | null = decay.length
    ? "decay"
    : r.state === "missing"
      ? "missing"
      : (fromPlan ?? (r.marks?.includes("sealant") ? "sealant" : Object.keys(s).length ? "filling" : null))
  return {
    surfaces: decay.length ? decay : (Object.keys(s) as Surface[]),
    condition,
    treatment: item?.cdt ?? null,
    status: item ? item.status : "existing",
    notes: note ?? TOOTH_NOTES[fdi]?.[locale] ?? "",
  }
}

/**
 * "Update plan": writes the draft to the tooth (surfaces, planned marks, missing) and to the treatment plan
 * (adds the procedure or updates its status). Returns the patient's share of the new / changed item, if any.
 */
export function applyDraft(id: string, rec: DentalRecord, fdi: number, d: ToothDraft) {
  const before = rec.chart.teeth[fdi] ?? {}
  const proc = d.treatment ? procedureBy(d.treatment) : undefined
  // Surfaces: done today → green, existing work → blue, decay still to treat → red. Planned non-decay work
  // (crown, sealant…) leaves the surfaces as they are and shows as marks + the plan dot.
  const surfaces = { ...before.surfaces }
  const paint = d.status === "done" ? "done" : d.status === "existing" ? (d.condition === "decay" ? "decay" : "existing") : d.condition === "decay" ? "decay" : null
  if (d.condition === "decay") for (const k of Object.keys(surfaces) as Surface[]) if (surfaces[k] === "decay" && !d.surfaces.includes(k)) delete surfaces[k]
  if (paint) for (const k of d.surfaces) surfaces[k] = paint
  const marks = new Set<ToothMark>(before.marks ?? [])
  if (proc?.mark && d.status === "planned") marks.add(proc.mark)
  if (proc?.mark && d.status !== "planned") marks.delete(proc.mark)
  let plan = rec.plan
  if (proc && d.status !== "existing") {
    const at = plan.findIndex((i) => i.cdt === proc.cdt && i.teeth.includes(fdi))
    if (at >= 0) plan = plan.map((i, k) => (k === at ? { ...i, status: d.status === "done" ? "done" : "planned" } : i))
    else
      plan = [
        ...plan,
        {
          id: `t${fdi}-${proc.cdt}-${plan.length}`,
          phase: d.status === "done" ? "today" : "restore",
          teeth: [fdi],
          procedure: proc.name,
          cdt: proc.cdt,
          fee: proc.fee,
          coveragePct: rec.insurance.insured ? proc.coveragePct : 0,
          insuranceStatus: !rec.insurance.insured ? "selfPay" : d.status === "done" ? "claimSent" : proc.preApproval ? "pending" : "covered",
          status: d.status === "done" ? "done" : "planned",
        },
      ]
  }
  const stillPlanned = plan.some((i) => i.status === "planned" && i.teeth.includes(fdi))
  const missing = d.condition === "missing" || (d.condition === "extraction" && d.status === "done")
  const next: ToothRecord = {
    ...(missing ? { state: "missing" as const } : before.state === "unerupted" ? { state: "unerupted" as const } : {}),
    surfaces,
    ...(stillPlanned ? { planned: true as const } : {}),
    ...(marks.size ? { marks: [...marks] } : {}),
  }
  update(id, (e) => ({ ...e, teeth: { ...e.teeth, [fdi]: next }, plan, notes: { ...e.notes, [fdi]: d.notes } }))
}

/** Open a blank chart for a patient's first dental visit (no-op when they already have one). */
export function startDentalChart(id: string) {
  if (!dentalRecord(id) && !state[id]?.started) update(id, (e) => ({ ...e, started: true }))
}

export function markChartSaved(id: string) {
  update(id, (e) => ({ ...e, savedAt: new Date().toISOString() }))
}

/** "2026-11-17T13:14" in clinic time (Asia/Riyadh), like the design's step times. */
function clinicNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

export function sendPreApproval(id: string, notifyGuardian: boolean) {
  update(id, (e) => ({ ...e, preApproval: { sentAt: clinicNow(), notifyGuardian } }))
}

export function setConsent(id: string, status: "sent" | "signed") {
  update(id, (e) => ({ ...e, consent: status }))
}
