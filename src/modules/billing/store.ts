"use client"

import * as React from "react"

import { CLAIMS, CONTRACTS, CREDIT_NOTES, INSURERS, INVOICES, type Claim, type Contract, type CreditNote, type Insurer, type Invoice } from "./data"
import { ARCHIVE_CONTRACTS, ARCHIVE_CREDIT_NOTES, ARCHIVE_INVOICES } from "./archive"
import type { BillRole } from "./roles"
import type { ManualInvoiceInput } from "./rules"

/**
 * Billing session store: the design's records with this session's changes (payments, claims sent / fixed,
 * contracts signed / drafted, papers uploaded). Kept in sessionStorage like the other module stores. The rules
 * (rules.ts) and the service stubs (ZATCA, NPHIES, Nafath) decide every change; the store only keeps it.
 */
type State = {
  invoices: Record<string, Invoice>
  claims: Record<string, Claim>
  insurers: Record<string, Insurer>
  contracts: Record<string, Contract>
  /** Contracts created in this session (New contract), newest first. */
  addedContracts: Contract[]
  /** Insurers that joined through a signed insurer agreement in this session. */
  addedInsurers: Insurer[]
  /** Credit notes issued in this session (newest first) and later changes to any credit note (ZATCA answer). */
  addedCreditNotes: CreditNote[]
  creditNotes: Record<string, CreditNote>
  /** New invoice (by hand): issued invoices and their claims (newest first), and the saved draft (not reported). */
  addedInvoices: Invoice[]
  addedClaims: Claim[]
  invoiceDraft: ManualInvoiceInput | null
  /** Export log (PDPL: every export is recorded — who, what, when, and whether patient names went out). */
  exports: ExportLog[]
  /** The other ready claims (aggregates) went out with a batch. */
  batchSent: boolean
  role: BillRole
}

const KEY = "ms.billing.session"
const EMPTY: State = { invoices: {}, claims: {}, insurers: {}, contracts: {}, addedContracts: [], addedInsurers: [], addedCreditNotes: [], creditNotes: {}, addedInvoices: [], addedClaims: [], invoiceDraft: null, exports: [], batchSent: false, role: "lead" }
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
const invoicesOf = merged(INVOICES, (x) => x.no, (s) => s.invoices, (s) => s.addedInvoices ?? [])
const claimsOf = merged(CLAIMS, (x) => x.no, (s) => s.claims, (s) => s.addedClaims ?? [])
const insurersOf = merged(INSURERS, (x) => x.id, (s) => s.insurers, (s) => s.addedInsurers ?? [])
const contractsOf = merged(CONTRACTS, (x) => x.no, (s) => s.contracts, (s) => s.addedContracts)
const creditNotesOf = merged([...CREDIT_NOTES, ...ARCHIVE_CREDIT_NOTES], (x) => x.no, (s) => s.creditNotes ?? {}, (s) => s.addedCreditNotes ?? [])
/** The lists (Show more) and record lookups also reach the rest of the month (archive.ts); the counts don't need it. */
const allInvoicesOf = merged([...INVOICES, ...ARCHIVE_INVOICES], (x) => x.no, (s) => s.invoices, (s) => s.addedInvoices ?? [])
const allContractsOf = merged([...CONTRACTS, ...ARCHIVE_CONTRACTS], (x) => x.no, (s) => s.contracts, (s) => s.addedContracts)

function useSlice<T>(select: (s: State) => T): T {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return select(snap)
}

export const useInvoices = () => useSlice(invoicesOf)
export const useClaims = () => useSlice(claimsOf)
export const useInsurers = () => useSlice(insurersOf)
export const useContracts = () => useSlice(contractsOf)
export const useBatchSent = () => useSlice((s) => s.batchSent)
export const useCreditNotes = () => useSlice(creditNotesOf)
export const useCreditNote = (no: string) => useCreditNotes().find((x) => x.no === no)
export const getCreditNotes = () => creditNotesOf(read())
export const getCreditNote = (no: string) => creditNotesOf(read()).find((x) => x.no === no)

export const useAllInvoices = () => useSlice(allInvoicesOf)
export const useAllContracts = () => useSlice(allContractsOf)
export const useInvoice = (no: string) => useAllInvoices().find((x) => x.no === no)
export const getInvoices = () => allInvoicesOf(read())
export const useInvoiceDraft = () => useSlice((s) => s.invoiceDraft ?? null)

/** Issue invoice (by hand): the invoice and, for insured patients, its claim, in one commit; the draft is cleared. */
export function saveManualInvoice(inv: Invoice, claim?: Claim) {
  load()
  commit({
    ...state,
    addedInvoices: [inv, ...(state.addedInvoices ?? []).filter((x) => x.no !== inv.no)],
    addedClaims: claim ? [claim, ...(state.addedClaims ?? []).filter((x) => x.no !== claim.no)] : (state.addedClaims ?? []),
    invoiceDraft: null,
  })
}
/** Save draft (New invoice): kept in this session only; nothing is reported. `null` clears it. */
export function saveInvoiceDraft(d: ManualInvoiceInput | null) {
  load()
  commit({ ...state, invoiceDraft: d })
}
export const useClaim = (no: string) => useClaims().find((x) => x.no === no)
export const useInsurer = (id: string) => useInsurers().find((x) => x.id === id)
export const useContract = (no: string) => useAllContracts().find((x) => x.no === no)

/** Read straight from the store (event handlers right after a change; stub callbacks). */
export const getInvoice = (no: string) => allInvoicesOf(read()).find((x) => x.no === no)
export const getClaim = (no: string) => claimsOf(read()).find((x) => x.no === no)
export const getClaims = () => claimsOf(read())
export const getInsurer = (id: string) => insurersOf(read()).find((x) => x.id === id)
export const getContract = (no: string) => allContractsOf(read()).find((x) => x.no === no)
export const getContracts = () => contractsOf(read())

export function saveInvoice(x: Invoice) {
  load()
  commit({ ...state, invoices: { ...state.invoices, [x.no]: x } })
}
export function saveClaims(xs: Claim[]) {
  load()
  commit({ ...state, claims: { ...state.claims, ...Object.fromEntries(xs.map((x) => [x.no, x])) } })
}
export function saveInsurer(x: Insurer) {
  load()
  const added = (state.addedInsurers ?? []).some((i) => i.id === x.id)
  if (added) commit({ ...state, addedInsurers: state.addedInsurers.map((i) => (i.id === x.id ? x : i)) })
  else if (INSURERS.some((i) => i.id === x.id)) commit({ ...state, insurers: { ...state.insurers, [x.id]: x } })
  else commit({ ...state, addedInsurers: [...(state.addedInsurers ?? []), x] })
}
export function saveContract(x: Contract) {
  load()
  const added = state.addedContracts.some((c) => c.no === x.no)
  commit(added ? { ...state, addedContracts: state.addedContracts.map((c) => (c.no === x.no ? x : c)) } : { ...state, contracts: { ...state.contracts, [x.no]: x } })
}
export function addContract(x: Contract) {
  load()
  commit({ ...state, addedContracts: [x, ...state.addedContracts.filter((c) => c.no !== x.no)] })
}
export function addCreditNote(x: CreditNote) {
  load()
  commit({ ...state, addedCreditNotes: [x, ...(state.addedCreditNotes ?? []).filter((c) => c.no !== x.no)] })
}
export function saveCreditNote(x: CreditNote) {
  load()
  const added = (state.addedCreditNotes ?? []).some((c) => c.no === x.no)
  commit(added ? { ...state, addedCreditNotes: state.addedCreditNotes.map((c) => (c.no === x.no ? x : c)) } : { ...state, creditNotes: { ...(state.creditNotes ?? {}), [x.no]: x } })
}
/** Issue in one commit: the credit note, the invoice's link to it and the adjusted claim. */
export function saveCreditIssue(cn: CreditNote, inv: Invoice, claim?: Claim) {
  load()
  commit({
    ...state,
    addedCreditNotes: [cn, ...(state.addedCreditNotes ?? []).filter((c) => c.no !== cn.no)],
    invoices: { ...state.invoices, [inv.no]: inv },
    claims: claim ? { ...state.claims, [claim.no]: claim } : state.claims,
  })
}
/** Approve / reject a refund: the credit note (decision + events) and, when approved, the invoice's refunded amount. */
export function saveRefundDecision(cn: CreditNote, inv?: Invoice) {
  saveCreditNote(cn)
  if (inv) saveInvoice(inv)
}
export type ExportLog = { at: string; by: string; what: string; period: string; format: string; rows: number; names: boolean; filter: string }
/** Record an export (newest first). */
export function logExport(x: ExportLog) {
  load()
  commit({ ...state, exports: [x, ...(state.exports ?? [])] })
}
export const useExportLog = () => useSlice((s) => s.exports ?? [])
export function setBatchSent() {
  load()
  commit({ ...state, batchSent: true })
}

/* ---------------------------------------------------------------- role */

/** The signed-in user's billing role (demo: "lead"; switchable in the dev stories). */
export const useBillRole = () => useSlice((s) => s.role)
export function setBillRole(role: BillRole) {
  load()
  commit({ ...state, role })
}
