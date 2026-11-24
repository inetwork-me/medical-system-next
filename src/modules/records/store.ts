"use client"

import * as React from "react"

import {
  ACCESS,
  COMPLETION,
  DOCUMENTS,
  DUPLICATES,
  ENCOUNTERS,
  NOTES,
  PRESCRIPTIONS,
  REQUESTS,
  type AccessEvent,
  type CompletionItem,
  type DuplicatePair,
  type Encounter,
  type Prescription,
  type RecDocument,
  type RecordsRequest,
  type PatientKey,
  type Problem,
  type VisitNote,
} from "./data"
import { ARCHIVE_ACCESS, ARCHIVE_DOCUMENTS, ARCHIVE_ENCOUNTERS, ARCHIVE_NOTES, ARCHIVE_REQUESTS } from "./archive"
import type { RecViewRole } from "./roles"
import type { PatientIds } from "./visits-data"

/**
 * Medical records session store: the design's records with this session's changes (notes signed, prescriptions
 * sent, requests released, reminders, reviews, merges). Kept in sessionStorage like the other module stores; the
 * rules (rules.ts) and the service stubs decide every change, the store only keeps it.
 *
 * The access log is append-only: `logAccess` adds an event and a review is stored beside it (`reviews`); nothing
 * edits or removes an entry. Signed notes are never removed either: there is no delete for them.
 */
export type MergeRecord = { pair: string; keep: string; old: string; at: string; undone?: string }
type Review = NonNullable<AccessEvent["review"]>

type State = {
  notes: Record<string, VisitNote>
  addedNotes: VisitNote[]
  addedEncounters: Encounter[]
  prescriptions: Record<string, Prescription>
  addedPrescriptions: Prescription[]
  documents: Record<string, RecDocument>
  addedDocuments: RecDocument[]
  requests: Record<string, RecordsRequest>
  addedRequests: RecordsRequest[]
  completion: Record<string, CompletionItem>
  /** Append-only. */
  addedAccess: AccessEvent[]
  reviews: Record<string, Review>
  merges: MergeRecord[]
  /** Break the glass: access to a restricted file until a time, per patient (for the signed-in user). */
  grants: Record<PatientKey, string>
  /** Problems added from Add diagnosis ("Add to his problem list"), per patient. */
  problems: Record<PatientKey, Problem[]>
  role: RecViewRole
  /** Nationality / ID added to a patient's file (Add nationality): fills every visit of theirs. */
  patientIds: Record<PatientKey, PatientIdsSaved>
  /** Send list to reception: the patients and what's missing, for the reception team to complete. */
  receptionTasks: ReceptionTask[]
}

export type PatientIdsSaved = PatientIds & { at: string; by: string; yakeen?: boolean }
export type ReceptionTask = {
  id: string
  at: string
  by: string
  /** Who sent it, as the list says ("the records office"). */
  role?: string
  rule: string
  period: string
  branch: string
  /** Finish by (the day before the return is due). */
  due?: string
  /** The return the list is for (Back to the MOH return). */
  from?: string
  patients: PatientKey[]
  /** Calls that weren't answered, per patient ("No answer · 1"). */
  calls?: Record<PatientKey, number>
}

const KEY = "ms.records.session"
const EMPTY: State = {
  notes: {},
  addedNotes: [],
  addedEncounters: [],
  prescriptions: {},
  addedPrescriptions: [],
  documents: {},
  addedDocuments: [],
  requests: {},
  addedRequests: [],
  completion: {},
  addedAccess: [],
  reviews: {},
  merges: [],
  problems: {},
  grants: {},
  role: "lead",
  patientIds: {},
  receptionTasks: [],
}
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

/** Memoised merge of base records with the session's edits (stable references for useSyncExternalStore). */
function merged<T>(base: T[], key: (x: T) => string, pick: (s: State) => Record<string, T>, extra?: (s: State) => T[]) {
  let cache: { s: State; list: T[] } | null = null
  return (s: State) => {
    if (cache?.s === s) return cache.list
    const edits = pick(s)
    const list = [...(extra?.(s) ?? []), ...base].map((x) => edits[key(x)] ?? x)
    cache = { s, list }
    return list
  }
}
function memo<T>(fn: (s: State) => T) {
  let cache: { s: State; v: T } | null = null
  return (s: State) => {
    if (cache?.s === s) return cache.v
    cache = { s, v: fn(s) }
    return cache.v
  }
}

const NO_EDITS = {}
const notesOf = merged([...NOTES, ...ARCHIVE_NOTES], (x) => x.id, (s) => s.notes, (s) => s.addedNotes)
const encountersOf = merged([...ENCOUNTERS, ...ARCHIVE_ENCOUNTERS], (x) => x.id, () => NO_EDITS, (s) => s.addedEncounters)
const prescriptionsOf = merged(PRESCRIPTIONS, (x) => x.no, (s) => s.prescriptions, (s) => s.addedPrescriptions)
const documentsOf = merged([...DOCUMENTS, ...ARCHIVE_DOCUMENTS], (x) => x.no, (s) => s.documents, (s) => s.addedDocuments)
const requestsOf = merged([...REQUESTS, ...ARCHIVE_REQUESTS], (x) => x.no, (s) => s.requests, (s) => s.addedRequests)
const completionOf = merged(COMPLETION, (x) => x.id, (s) => s.completion)
const accessOf = memo((s) => [...s.addedAccess, ...ACCESS, ...ARCHIVE_ACCESS].map((x) => (s.reviews[x.id] ? { ...x, review: s.reviews[x.id] } : x)))
/** Duplicate pairs still to merge (a merged pair leaves the list until it's undone). */
const duplicatesOf = memo((s): DuplicatePair[] => DUPLICATES.filter((d) => !s.merges.some((m) => m.pair === d.id && !m.undone)))

function useSlice<T>(select: (s: State) => T): T {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return select(snap)
}

export const useNotes = () => useSlice(notesOf)
export const useEncounters = () => useSlice(encountersOf)
export const usePrescriptions = () => useSlice(prescriptionsOf)
export const useDocuments = () => useSlice(documentsOf)
export const useRequests = () => useSlice(requestsOf)
export const useCompletion = () => useSlice(completionOf)
export const useAccess = () => useSlice(accessOf)
export const useDuplicates = () => useSlice(duplicatesOf)
export const useMerges = () => useSlice((s) => s.merges)
const NO_PROBLEMS: Problem[] = []
export const useAddedProblems = (k: PatientKey) => useSlice((s) => s.problems?.[k] ?? NO_PROBLEMS)
export function addProblem(k: PatientKey, p: Problem) {
  load()
  const cur = state.problems?.[k] ?? []
  if (cur.some((x) => x.name.en === p.name.en)) return
  commit({ ...state, problems: { ...(state.problems ?? {}), [k]: [...cur, p] } })
}

export const useNote = (id: string) => useNotes().find((x) => x.id === id)
export const useEncounter = (id: string) => useEncounters().find((x) => x.id === id)
export const useDocument = (no: string) => useDocuments().find((x) => x.no === no)
export const getDocuments = () => documentsOf(read())
export const usePrescription = (no: string) => usePrescriptions().find((x) => x.no === no)
export const useRequest = (no: string) => useRequests().find((x) => x.no === no)

export const getNote = (id: string) => notesOf(read()).find((x) => x.id === id)
export const getNotes = () => notesOf(read())
export const getEncounter = (id: string) => encountersOf(read()).find((x) => x.id === id)
export const getRequests = () => requestsOf(read())
export const getRequest = (no: string) => requestsOf(read()).find((x) => x.no === no)

export function saveNote(x: VisitNote) {
  load()
  const added = state.addedNotes.some((n) => n.id === x.id)
  commit(added ? { ...state, addedNotes: state.addedNotes.map((n) => (n.id === x.id ? x : n)) } : { ...state, notes: { ...state.notes, [x.id]: x } })
}
/** New visit note: its encounter and the draft note in one commit. */
export function addEncounter(e: Encounter, n: VisitNote) {
  load()
  commit({ ...state, addedEncounters: [e, ...state.addedEncounters], addedNotes: [n, ...state.addedNotes] })
}
export function savePrescription(x: Prescription) {
  load()
  const base = PRESCRIPTIONS.some((r) => r.no === x.no)
  commit(base ? { ...state, prescriptions: { ...state.prescriptions, [x.no]: x } } : { ...state, addedPrescriptions: [x, ...state.addedPrescriptions.filter((r) => r.no !== x.no)] })
}
export function saveDocument(x: RecDocument) {
  load()
  const base = DOCUMENTS.some((d) => d.no === x.no) || ARCHIVE_DOCUMENTS.some((d) => d.no === x.no)
  commit(base ? { ...state, documents: { ...state.documents, [x.no]: x } } : { ...state, addedDocuments: [x, ...state.addedDocuments.filter((d) => d.no !== x.no)] })
}
export function saveRequest(x: RecordsRequest) {
  load()
  const base = REQUESTS.some((r) => r.no === x.no) || ARCHIVE_REQUESTS.some((r) => r.no === x.no)
  commit(base ? { ...state, requests: { ...state.requests, [x.no]: x } } : { ...state, addedRequests: [x, ...state.addedRequests.filter((r) => r.no !== x.no)] })
}
export function saveCompletion(xs: CompletionItem[]) {
  load()
  commit({ ...state, completion: { ...state.completion, ...Object.fromEntries(xs.map((x) => [x.id, x])) } })
}
/** Every open, print, export and break-the-glass is logged (newest first). Entries are never edited or removed. */
export function logAccess(x: AccessEvent) {
  load()
  // Ids stay unique across reloads (the session keeps earlier entries).
  const id = state.addedAccess.some((e) => e.id === x.id) ? `${x.id}-${state.addedAccess.length}` : x.id
  commit({ ...state, addedAccess: [{ ...x, id }, ...state.addedAccess] })
}
/** Opening a record logs it once per visit to the page (the demo clock doesn't move, so once per session). */
export function logAccessOnce(x: AccessEvent) {
  load()
  if (state.addedAccess.some((e) => e.id === x.id)) return
  logAccess(x)
}
/** A review sits beside the entry; the entry itself doesn't change. */
export function saveReview(eventId: string, r: Review) {
  load()
  commit({ ...state, reviews: { ...state.reviews, [eventId]: r } })
}
/** Break the glass: access until `until` (BREAK_GLASS_HOURS from now). */
export function grantAccess(patient: PatientKey, until: string) {
  load()
  commit({ ...state, grants: { ...(state.grants ?? {}), [patient]: until } })
}
const NO_GRANTS: Record<PatientKey, string> = {}
export const useGrants = () => useSlice((s) => s.grants ?? NO_GRANTS)
export function saveMerge(m: MergeRecord) {
  load()
  commit({ ...state, merges: [m, ...state.merges.filter((x) => x.pair !== m.pair)] })
}

/* ---------------------------------------------------------------- role */

/** The signed-in user's records role (demo: "lead"; switchable in the dev stories). */
export const useRecRole = () => useSlice((s) => s.role)
export function setRecRole(role: RecViewRole) {
  load()
  commit({ ...state, role })
}

/* ---------------------------------------------------------------- visits */

const NO_IDS: Record<PatientKey, PatientIdsSaved> = {}
const NO_TASKS: ReceptionTask[] = []
/** Nationality / ID saved this session, per patient (patient fields: one save fills all their visits). */
export const useSavedIds = () => useSlice((s) => s.patientIds ?? NO_IDS)
export function savePatientIds(k: PatientKey, ids: PatientIdsSaved) {
  load()
  commit({ ...state, patientIds: { ...(state.patientIds ?? {}), [k]: { ...(state.patientIds?.[k] ?? {}), ...ids } } })
}
export const useReceptionTasks = () => useSlice((s) => s.receptionTasks ?? NO_TASKS)
export function addReceptionTask(t: ReceptionTask) {
  load()
  commit({ ...state, receptionTasks: [t, ...(state.receptionTasks ?? [])] })
}
/** A call from the reception list that wasn't answered: it goes back on the list for tomorrow. */
export function logReceptionCall(taskId: string, patient: PatientKey) {
  load()
  commit({
    ...state,
    receptionTasks: (state.receptionTasks ?? []).map((t) => (t.id === taskId ? { ...t, calls: { ...(t.calls ?? {}), [patient]: (t.calls?.[patient] ?? 0) + 1 } } : t)),
  })
}
