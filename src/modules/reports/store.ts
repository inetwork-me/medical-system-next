"use client"

import * as React from "react"

import { SESSION_USER } from "@/lib/mock/shell"
import type { ReportFilters, Schedule } from "./data"
import type { RepRole } from "./roles"
import { LIBRARY, type SavedReport, type ShareEntry } from "./library"
import { defaultFiltersFor } from "./server"
import { SCHEDULES } from "./schedules-data"

/**
 * Reports session store (sessionStorage, like the other modules): the filters each page uses (dashboards and
 * reports keep their own), the export / share / send log and the demo role. Later steps add saved reports,
 * favourites, schedules and returns here.
 */
export type LogEntry = { at: string; kind: "export" | "share" | "send" | "submit"; what: string; detail: string }

type State = {
  filters: Record<string, ReportFilters>
  log: LogEntry[]
  /** Starred reports, in the order starred (null = the design's four). */
  favourites: string[] | null
  /** Schedules made or changed in this session (Schedules, step 6, adds the design's six). */
  schedules: Schedule[]
  /** Who each report is shared with, once changed in this session. */
  shares: Record<string, ShareEntry[]>
  role: RepRole
  /** Reports saved from the builder in this session (new ones, and the user's own edited ones). */
  saved: SavedReport[]
  /** Official returns submitted this session (the portal's reference) and the notes added on their checks. */
  submitted: Record<string, { at: string; ref: string; by: string }>
  notes: Record<string, Record<string, string>>
}

const KEY = "ms.reports.session"
const EMPTY: State = { filters: {}, log: [], favourites: null, schedules: [], shares: {}, role: "lead", saved: [], submitted: {}, notes: {} }
let state: State = EMPTY
let loaded = false
const listeners = new Set<() => void>()

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
  return () => {
    listeners.delete(l)
  }
}
const read = () => {
  load()
  return state
}
const serverState = () => EMPTY

function useSlice<T>(select: (s: State) => T): T {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return select(snap)
}

/** The signed-in user, as the reports server knows them (branch access is keyed by this). */
export const sessionEmail = () => SESSION_USER.email
const DEFAULTS = defaultFiltersFor(SESSION_USER.email)

/** Filters for a page ("operations", "report:no-shows-by-clinic", …); the defaults until changed. */
export const useFilters = (scope: string) => useSlice((s) => s.filters[scope] ?? DEFAULTS)
export function saveFilters(scope: string, f: ReportFilters) {
  load()
  commit({ ...state, filters: { ...state.filters, [scope]: f } })
}

/** Every export, share and scheduled send is logged (brief §4). */
export function logReport(e: LogEntry) {
  load()
  commit({ ...state, log: [e, ...state.log] })
}
export const useReportLog = () => useSlice((s) => s.log)

const DEFAULT_FAVOURITES = ["no-shows-by-clinic", "claim-rejections-by-insurer", "waiting-time-by-hour", "notes-on-time"]
export const useFavourites = () => useSlice((s) => s.favourites ?? DEFAULT_FAVOURITES)
export function toggleFavourite(id: string): boolean {
  load()
  const cur = state.favourites ?? DEFAULT_FAVOURITES
  const on = !cur.includes(id)
  commit({ ...state, favourites: on ? [...cur, id] : cur.filter((x) => x !== id) })
  return on
}

const NO_SCHEDULES: Schedule[] = []
export const useSavedSchedules = () => useSlice((s) => s.schedules ?? NO_SCHEDULES)
export function saveSchedule(x: Schedule) {
  load()
  const cur = state.schedules ?? []
  commit({ ...state, schedules: [x, ...cur.filter((s) => s.id !== x.id)] })
}

export const useShares = (id: string, fallback: ShareEntry[]) => useSlice((s) => s.shares?.[id] ?? fallback)
export function saveShares(id: string, list: ShareEntry[]) {
  load()
  commit({ ...state, shares: { ...(state.shares ?? {}), [id]: list } })
}

export const useRepRole = () => useSlice((s) => s.role)
export function setRepRole(role: RepRole) {
  load()
  commit({ ...state, role })
}

/* ------------------------------------------------------------------ saved reports */

const NO_SAVED: SavedReport[] = []
export const useSavedReports = () => useSlice((s) => s.saved ?? NO_SAVED)
/** Save from the builder: a new report goes first in the library; the owner's own report is replaced in place. */
export function saveReport(r: SavedReport) {
  const saved = state.saved ?? NO_SAVED
  commit({ ...state, saved: [r, ...saved.filter((x) => x.id !== r.id)] })
}

function mergeLibrary(saved: SavedReport[]): SavedReport[] {
  const edited = new Map(saved.map((r) => [r.id, r]))
  return [...saved.filter((r) => !LIBRARY.some((x) => x.id === r.id)), ...LIBRARY.map((r) => edited.get(r.id) ?? r)]
}
/** The library as this user sees it: reports saved this session first, then the stored ones (edited ones replaced). */
export function useLibrary(): SavedReport[] {
  const saved = useSavedReports()
  return React.useMemo(() => mergeLibrary(saved), [saved])
}
export const useReport = (id: string) => useLibrary().find((r) => r.id === id)

/* ------------------------------------------------------------------ schedules */

function mergeSchedules(session: Schedule[]): Schedule[] {
  const changed = new Map(session.map((x) => [x.id, x]))
  return [...session.filter((x) => !SCHEDULES.some((y) => y.id === x.id)), ...SCHEDULES.map((x) => changed.get(x.id) ?? x)]
}
/** Every scheduled report: the design's six with this session's changes, new ones first. */
export function useSchedules(): Schedule[] {
  const session = useSavedSchedules()
  return React.useMemo(() => mergeSchedules(session), [session])
}
/** The schedule that sends a report (by its target), if any. */
export const useScheduleOf = (target: string) => useSchedules().find((x) => x.target === target)
/** Every scheduled send is logged (brief §4). */
export function logSend(s: Schedule, at: string) {
  logReport({ at, kind: "send", what: s.target, detail: s.recipients.map((r) => r.email).join(", ") })
}

/* ------------------------------------------------------------------ official returns */

const NO_SUBMITTED: State["submitted"] = {}
const NO_NOTES: Record<string, string> = {}
export const useSubmitted = () => useSlice((s) => s.submitted ?? NO_SUBMITTED)
export const useReturnNotes = (id: string) => useSlice((s) => s.notes?.[id] ?? NO_NOTES)
export function addReturnNote(id: string, check: string, text: string) {
  load()
  const notes = state.notes ?? {}
  commit({ ...state, notes: { ...notes, [id]: { ...(notes[id] ?? {}), [check]: text } } })
}
/** Archive a submission (the reference and who signed it); the download keeps the file in the history. */
export function markSubmitted(id: string, x: { at: string; ref: string; by: string }) {
  load()
  commit({ ...state, submitted: { ...(state.submitted ?? {}), [id]: x } })
}
