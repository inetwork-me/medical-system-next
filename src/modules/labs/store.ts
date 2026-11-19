"use client"

import * as React from "react"

import { BASE_TESTS, ORDERS, TESTS, registerTest, type LabOrder, type LabRole, type TestDef } from "./data"
import type { Step } from "./machine"

/**
 * Labs session store: today's orders with this session's changes (collected, rejected, results entered, calls
 * logged, released, new orders). Kept in sessionStorage like the other module stores; the status machine
 * (machine.ts) decides every change, the store only applies it.
 */
type State = { edits: Record<string, LabOrder>; added: LabOrder[]; role: LabRole; active: Record<string, boolean>; tests: TestDef[] }

const KEY = "ms.labs.session"
let state: State = { edits: {}, added: [], role: "lead", active: {}, tests: [] }
let loaded = false
const listeners = new Set<() => void>()
let cache: { state: State; list: LabOrder[] } | null = null

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<State>) }
  } catch {}
  // Tests added in this session join the catalog lookups (flags, critical limits, delta check use them).
  for (const t of state.tests) registerTest(t)
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
function list(): LabOrder[] {
  load()
  if (cache?.state === state) return cache.list
  const all = [...state.added, ...ORDERS].map((o) => state.edits[o.no] ?? o)
  cache = { state, list: all }
  return all
}
const serverList = () => ORDERS

/** Today's lab orders, newest first, with this session's changes. */
export function useLabOrders(): LabOrder[] {
  return React.useSyncExternalStore(subscribe, list, serverList)
}

export function useLabOrder(no: string): LabOrder | undefined {
  return useLabOrders().find((o) => o.no === no)
}

/**
 * Apply a status-machine step to an order: `run(order)` returns the next order or a refusal.
 * Returns the step so the caller can show the refusal (e.g. release blocked by an uncalled critical value).
 */
export function applyStep(no: string, run: (o: LabOrder) => Step): Step {
  const cur = list().find((o) => o.no === no)
  if (!cur) return { ok: false, reason: "empty" }
  const step = run(cur)
  if (step.ok) {
    const added = state.added.some((o) => o.no === no)
    commit(
      added
        ? { ...state, added: state.added.map((o) => (o.no === no ? step.order : o)) }
        : { ...state, edits: { ...state.edits, [no]: step.order } }
    )
  }
  return step
}

/** Next order number (LAB-0144 after the sample day's LAB-0143). */
export function nextOrderNo() {
  const max = Math.max(...list().map((o) => Number(o.no.replace(/\D/g, ""))))
  return `LAB-${String(max + 1).padStart(4, "0")}`
}

/** Next collection-queue ticket (C-11 after C-10). */
export function nextTicket() {
  const max = Math.max(0, ...list().map((o) => (o.ticket ? Number(o.ticket.replace(/\D/g, "")) : 0)))
  return `C-${String(max + 1).padStart(2, "0")}`
}

export function addOrder(o: LabOrder) {
  load()
  commit({ ...state, added: [o, ...state.added] })
}

/* ---------------------------------------------------------------- role */

const readRole = () => {
  load()
  return state.role
}

/** The signed-in user's lab role (demo: "lead" = every lab permission; switchable in the dev stories). */
export function useLabRole(): LabRole {
  return React.useSyncExternalStore(subscribe, readRole, () => "lead" as LabRole)
}

export function setLabRole(role: LabRole) {
  load()
  commit({ ...state, role })
}

/* ---------------------------------------------------------------- catalog */

let catalogCache: { state: State; list: TestDef[] } | null = null
function catalog(): TestDef[] {
  load()
  if (catalogCache?.state === state) return catalogCache.list
  const list = [...TESTS].map((t) => (t.key in state.active ? { ...t, active: state.active[t.key] } : t))
  catalogCache = { state, list }
  return list
}

/** The test catalog with this session's Active switches (inactive tests can't be ordered). */
export function useCatalog(): TestDef[] {
  return React.useSyncExternalStore(subscribe, catalog, () => BASE_TESTS as TestDef[])
}

export function setTestActive(key: string, active: boolean) {
  load()
  commit({ ...state, active: { ...state.active, [key]: active } })
}

/** Add test (catalog): the new test joins the catalog (and New lab order when active). */
export function addCatalogTest(t: TestDef) {
  load()
  registerTest(t)
  commit({ ...state, tests: [...state.tests.filter((x) => x.key !== t.key), t] })
}

/** The current order, read straight from the store (event handlers that run right after a step). */
export function getLabOrder(no: string): LabOrder | undefined {
  return list().find((o) => o.no === no)
}
