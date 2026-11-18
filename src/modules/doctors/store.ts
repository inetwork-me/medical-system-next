"use client"

import * as React from "react"

import { DOCTORS, type Doctor } from "./data"

/**
 * Session edits to the doctor roster (settings saved, leave, credentials renewed, new doctors), shared by every
 * Doctors screen and by Clinics / Appointments. Kept in sessionStorage like the other module stores.
 */
type State = { edits: Record<string, Partial<Doctor>>; added: Doctor[] }

const KEY = "ms.doctors.session"
let state: State = { edits: {}, added: [] }
let loaded = false
const listeners = new Set<() => void>()
let cache: { state: State; list: Doctor[] } | null = null

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
function list(): Doctor[] {
  load()
  if (cache?.state === state) return cache.list
  const all = [...DOCTORS, ...state.added].map((d) => (state.edits[d.key] ? { ...d, ...state.edits[d.key] } : d))
  cache = { state, list: all }
  return all
}
const serverList = () => DOCTORS

/** Every doctor (deactivated ones too — screens filter on `active`) with this session's edits applied. */
export function useDoctors(): Doctor[] {
  return React.useSyncExternalStore(subscribe, list, serverList)
}

/** One doctor by key (undefined when it doesn't exist). */
export function useDoctor(key: string): Doctor | undefined {
  return useDoctors().find((d) => d.key === key)
}

/** Merge fields into a doctor. */
export function updateDoctor(key: string, patch: Partial<Doctor>) {
  load()
  commit({ ...state, edits: { ...state.edits, [key]: { ...state.edits[key], ...patch } } })
}

/** Add a doctor created with New doctor. */
export function addDoctor(d: Doctor) {
  load()
  commit({ ...state, added: [...state.added, d] })
}
