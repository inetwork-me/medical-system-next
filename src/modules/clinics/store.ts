"use client"

import * as React from "react"

import { CLINICS, type Clinic } from "./data"

/**
 * Session edits to the clinics (settings saved, clinic paused, prices / services / doctors / rooms added, new clinics),
 * shared by every Clinics screen and by the patient file (Specialty tools). Kept in sessionStorage like the other
 * module stores.
 */
type State = { edits: Record<string, Partial<Clinic>>; added: Clinic[] }

const KEY = "ms.clinics.session"
let state: State = { edits: {}, added: [] }
let loaded = false
const listeners = new Set<() => void>()
let cache: { state: State; list: Clinic[] } | null = null

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<State>) }
  } catch {}
}
function commit(next: State) {
  state = next
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
  for (const l of listeners) l()
}
function subscribe(l: () => void) {
  load()
  listeners.add(l)
  return () => listeners.delete(l)
}

function list(): Clinic[] {
  load()
  if (cache?.state === state) return cache.list
  const all = [...CLINICS, ...state.added].map((c) => (state.edits[c.key] ? { ...c, ...state.edits[c.key] } : c)).filter((c) => !c.archived)
  cache = { state, list: all }
  return all
}
const serverList = () => CLINICS

/** Every clinic with this session's edits applied. */
export function useClinics(): Clinic[] {
  return React.useSyncExternalStore(subscribe, list, serverList)
}

/** One clinic by key (undefined when it doesn't exist). */
export function useClinic(key: string): Clinic | undefined {
  return useClinics().find((c) => c.key === key)
}

/** Merge fields into a clinic (archived ones too, so Archive can be undone). */
export function updateClinic(key: string, patch: Partial<Clinic> | ((c: Clinic) => Partial<Clinic>)) {
  const base = [...CLINICS, ...state.added].find((c) => c.key === key)
  const current = base && (state.edits[key] ? { ...base, ...state.edits[key] } : base)
  if (!current) return
  const fields = typeof patch === "function" ? patch(current) : patch
  if (state.added.some((c) => c.key === key)) {
    commit({ ...state, added: state.added.map((c) => (c.key === key ? { ...c, ...fields } : c)) })
  } else {
    commit({ ...state, edits: { ...state.edits, [key]: { ...state.edits[key], ...fields } } })
  }
}

/** Add a new clinic (New clinic → Create clinic). */
export function addClinic(clinic: Clinic) {
  commit({ ...state, added: [...state.added, clinic] })
}
