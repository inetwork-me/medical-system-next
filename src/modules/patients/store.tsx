"use client"

import * as React from "react"

import { allPatients, type Patient, type Tag } from "./data"
import type { EditForm } from "./edit/form"

/**
 * Client-side changes made during this session (mock persistence): VIP toggles, bans, archives.
 * Lives in the Patients layout so the list, side sheet and patient page agree. Swap for API mutations later.
 */
type Override = { tags?: Tag[]; archived?: boolean; fields?: Partial<Patient>; form?: EditForm }

type Store = {
  patients: Patient[]
  setTags: (id: string, tags: Tag[]) => void
  archive: (id: string) => void
  /** Save from the Edit page: list fields (name, mobile, tags…) + the full form for the patient page. */
  save: (id: string, fields: Partial<Patient>, form: EditForm) => void
  /** Last saved edit form for a patient (this session). */
  savedForm: (id: string) => EditForm | undefined
  get: (id: string) => Patient | undefined
}

const Ctx = React.createContext<Store | null>(null)

export function PatientsStoreProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = React.useState<Record<string, Override>>({})
  const base = React.useMemo(() => allPatients(), [])

  const patients = React.useMemo(
    () =>
      base
        .filter((p) => !overrides[p.id]?.archived)
        .map((p) => {
          const o = overrides[p.id]
          if (!o) return p
          return { ...p, ...o.fields, ...(o.tags ? { tags: o.tags } : {}) }
        }),
    [base, overrides]
  )

  const store = React.useMemo<Store>(
    () => ({
      patients,
      setTags: (id, tags) => setOverrides((o) => ({ ...o, [id]: { ...o[id], tags } })),
      archive: (id) => setOverrides((o) => ({ ...o, [id]: { ...o[id], archived: true } })),
      save: (id, fields, form) =>
        setOverrides((o) => ({ ...o, [id]: { ...o[id], fields: { ...o[id]?.fields, ...fields }, form, ...(fields.tags ? { tags: fields.tags } : {}) } })),
      savedForm: (id) => overrides[id]?.form,
      get: (id) => patients.find((p) => p.id === id),
    }),
    [patients, overrides]
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
