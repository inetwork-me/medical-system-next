"use client"

import * as React from "react"

import { allPatients, type Patient, type Tag } from "./data"

/**
 * Client-side changes made during this session (mock persistence): VIP toggles, bans, archives.
 * Lives in the Patients layout so the list, side sheet and patient page agree. Swap for API mutations later.
 */
type Override = { tags?: Tag[]; archived?: boolean }

type Store = {
  patients: Patient[]
  setTags: (id: string, tags: Tag[]) => void
  archive: (id: string) => void
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
        .map((p) => (overrides[p.id]?.tags ? { ...p, tags: overrides[p.id].tags! } : p)),
    [base, overrides]
  )

  const store = React.useMemo<Store>(
    () => ({
      patients,
      setTags: (id, tags) => setOverrides((o) => ({ ...o, [id]: { ...o[id], tags } })),
      archive: (id) => setOverrides((o) => ({ ...o, [id]: { ...o[id], archived: true } })),
      get: (id) => patients.find((p) => p.id === id),
    }),
    [patients]
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
