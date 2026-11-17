"use client"

import * as React from "react"

import { appointmentsOn, type Appointment, type ApptStatus } from "./data"

/**
 * Session changes on top of the mock data (no backend yet): status moves (check in, call in, no-show, cancel…) and
 * reminders sent. Kept in sessionStorage so a refresh keeps them; every Appointments screen reads through here.
 */
type Change = { status?: ApptStatus; reminded?: boolean }
type Store = {
  changes: Record<string, Change>
  setStatus: (id: string, status: ApptStatus) => void
  remind: (id: string) => void
}

const KEY = "ms.appointments.changes"
const Ctx = React.createContext<Store | null>(null)

export function AppointmentsStoreProvider({ children }: { children: React.ReactNode }) {
  const [changes, setChanges] = React.useState<Record<string, Change>>({})
  const loaded = React.useRef(false)

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage after hydration
      if (raw) setChanges(JSON.parse(raw))
    } catch {}
    loaded.current = true
  }, [])
  React.useEffect(() => {
    if (!loaded.current) return
    try {
      sessionStorage.setItem(KEY, JSON.stringify(changes))
    } catch {}
  }, [changes])

  const store = React.useMemo<Store>(
    () => ({
      changes,
      setStatus: (id, status) => setChanges((c) => ({ ...c, [id]: { ...c[id], status } })),
      remind: (id) => setChanges((c) => ({ ...c, [id]: { ...c[id], reminded: true } })),
    }),
    [changes]
  )
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export type LiveAppointment = Appointment & { reminded: boolean }

/** Reminders go out the evening before, so everything today has one; a manual send marks it again. */
const withChange = (a: Appointment, c?: Change): LiveAppointment => ({ ...a, status: c?.status ?? a.status, reminded: c?.reminded ?? true })

/** `on(date)` → that day's appointments with this session's changes applied. */
export function useAppointmentsOn() {
  const store = React.useContext(Ctx)
  const changes = store?.changes
  return React.useCallback((date: string) => appointmentsOn(date).map((a) => withChange(a, changes?.[a.id])), [changes])
}

export function useAppointmentActions() {
  const store = React.useContext(Ctx)
  if (!store) throw new Error("useAppointmentActions needs AppointmentsStoreProvider")
  return { setStatus: store.setStatus, remind: store.remind }
}
