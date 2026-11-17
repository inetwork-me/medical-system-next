"use client"

import * as React from "react"

import { eyeRecord, type Eye, type EyeExam, type EyeRecord, type Gaze, type MuscleKey } from "./data"

/**
 * Session state of the eye workspaces, shared by Exam / Anatomy / Compare and the Eyes tab:
 *  · today's draft exam (grades + findings edited in the workspace) and its signing ("Finish & sign")
 *  · the viewer state (gaze direction, angle, eye select, toggles, selected muscle) so switching modes keeps the view
 */

export type EyeView = {
  gaze: Gaze
  angle: number
  eye: "both" | Eye
  together: boolean
  showMuscles: boolean
  showLines: boolean
  muscle: MuscleKey | null
  muscleEye: Eye
}
export const DEFAULT_VIEW: EyeView = { gaze: "right", angle: 30, eye: "both", together: true, showMuscles: true, showLines: false, muscle: "LR", muscleEye: "OD" }

type PatientEyes = { draft?: Partial<EyeExam>; signedAt?: string; view?: Partial<EyeView> }
type State = Record<string, PatientEyes>

const KEY = "ms.eyes.session"
let state: State = {}
let loaded = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
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
function update(id: string, fn: (e: PatientEyes) => PatientEyes) {
  state = { ...state, [id]: fn(state[id] ?? {}) }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
  emit()
}
const EMPTY: State = {}

function useEyes(id: string): PatientEyes | undefined {
  React.useEffect(load, [])
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  )[id]
}

/** Eye exams with today's draft edits (and signing) applied. */
export function useEyeRecord(id: string): EyeRecord | null {
  const e = useEyes(id)
  return React.useMemo(() => {
    const base = eyeRecord(id)
    if (!base || !e) return base
    return {
      exams: base.exams.map((x) =>
        x.status === "draft" || x.kind === "today" ? { ...x, ...e.draft, ...(e.signedAt ? { status: "signed" as const } : {}) } : x,
      ),
    }
  }, [id, e])
}

/** Today's exam (the draft being recorded), or the latest exam when none is open. */
export function useTodayExam(id: string) {
  const rec = useEyeRecord(id)
  const e = useEyes(id)
  const exam = rec?.exams.find((x) => x.kind === "today") ?? rec?.exams[0] ?? null
  const patch = React.useCallback((p: Partial<EyeExam>) => update(id, (s) => ({ ...s, draft: { ...s.draft, ...p } })), [id])
  return { exam, patch, signedAt: e?.signedAt ?? null }
}

export function useEyeView(id: string): [EyeView, (p: Partial<EyeView>) => void] {
  const e = useEyes(id)
  const view = React.useMemo(() => ({ ...DEFAULT_VIEW, ...e?.view }), [e?.view])
  const set = React.useCallback((p: Partial<EyeView>) => update(id, (s) => ({ ...s, view: { ...s.view, ...p } })), [id])
  return [view, set]
}

export function signExam(id: string) {
  update(id, (s) => ({ ...s, signedAt: new Date().toISOString() }))
}
