"use client"

import * as React from "react"

import { allPatients, type Patient, type Tag } from "./data"
import type { EditForm } from "./edit/form"

/**
 * Client-side changes made during this session (mock persistence): VIP toggles, bans, archives.
 * Lives in the Patients layout so the list, side sheet and patient page agree. Swap for API mutations later.
 */
/** A payment taken at the desk (Collect payment overlay). */
export type Collection = { invoice: string; amount: number; method: "mada" | "cash" | "card"; receipt: string; at: string }

type Override = { tags?: Tag[]; archived?: boolean; fields?: Partial<Patient>; form?: EditForm }

type Store = {
  patients: Patient[]
  setTags: (id: string, tags: Tag[]) => void
  archive: (id: string) => void
  /** Save from the Edit page: list fields (name, mobile, tags…) + the full form for the patient page. */
  save: (id: string, fields: Partial<Patient>, form: EditForm) => void
  /** Merge page: `drop` is closed into `keep` (fields + form for the kept file). Returns an undo function. */
  merge: (keep: string, drop: string, fields: Partial<Patient>, form: EditForm) => () => void
  /** Payments collected this session, per patient. */
  collections: (id: string) => Collection[]
  collect: (id: string, c: Omit<Collection, "receipt" | "at">) => Collection
  /** Add-patient wizard: create a file (shown first in the list); returns its MRN. */
  add: (patient: Omit<Patient, "id" | "mrn">, form: EditForm) => string
  /** Last saved edit form for a patient (this session). */
  savedForm: (id: string) => EditForm | undefined
  get: (id: string) => Patient | undefined
}

const Ctx = React.createContext<Store | null>(null)
const NONE: Collection[] = []

export function PatientsStoreProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = React.useState<Record<string, Override>>({})
  const [added, setAdded] = React.useState<Patient[]>([])
  const [paid, setPaid] = React.useState<Record<string, Collection[]>>({})
  const base = React.useMemo(() => allPatients(), [])

  const patients = React.useMemo(
    () =>
      [...added, ...base]
        .filter((p) => !overrides[p.id]?.archived)
        .map((p) => {
          const o = overrides[p.id]
          if (!o) return p
          return { ...p, ...o.fields, ...(o.tags ? { tags: o.tags } : {}) }
        }),
    [base, added, overrides]
  )

  const store = React.useMemo<Store>(
    () => ({
      patients,
      setTags: (id, tags) => setOverrides((o) => ({ ...o, [id]: { ...o[id], tags } })),
      archive: (id) => setOverrides((o) => ({ ...o, [id]: { ...o[id], archived: true } })),
      save: (id, fields, form) =>
        setOverrides((o) => ({ ...o, [id]: { ...o[id], fields: { ...o[id]?.fields, ...fields }, form, ...(fields.tags ? { tags: fields.tags } : {}) } })),
      savedForm: (id) => overrides[id]?.form,
      merge: (keep, drop, fields, form) => {
        const snapshot = overrides
        setOverrides((o) => ({
          ...o,
          [keep]: { ...o[keep], fields: { ...o[keep]?.fields, ...fields }, form, ...(fields.tags ? { tags: fields.tags } : {}) },
          [drop]: { ...o[drop], archived: true },
        }))
        return () => setOverrides(snapshot)
      },
      collections: (id) => paid[id] ?? NONE,
      collect: (id, c) => {
        const done: Collection = { ...c, receipt: c.invoice.replace("INV", "RCP"), at: new Date().toISOString() }
        setPaid((p) => ({ ...p, [id]: [...(p[id] ?? []), done] }))
        return done
      },
      add: (patient, form) => {
        // Next file number after the design's latest sample (MRN 004912 for the first new patient).
        const mrn = String(4912 + added.length).padStart(6, "0")
        setAdded((a) => [{ ...patient, id: mrn, mrn }, ...a])
        setOverrides((o) => ({ ...o, [mrn]: { form } }))
        return mrn
      },
      get: (id) => patients.find((p) => p.id === id),
    }),
    [patients, overrides, added.length, paid]
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function usePatientsStore() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error("usePatientsStore outside PatientsStoreProvider")
  return ctx
}

/** Tag add/remove helper (keeps tag order stable). */
export const toggleTag = (tags: Tag[], tag: Tag, on: boolean): Tag[] =>
  on ? (tags.includes(tag) ? tags : [tag, ...tags]) : tags.filter((t) => t !== tag)
