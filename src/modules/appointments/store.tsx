"use client"

import * as React from "react"

import { appointmentsOn, NOW_MIN, TIME_OFF, type Appointment, type ApptStatus, type TimeOff } from "./data"

/**
 * Session changes on top of the mock data (no backend yet): status moves (check in, call in, no-show, cancel…) and
 * reminders sent. Kept in sessionStorage so a refresh keeps them; every Appointments screen reads through here.
 */
type Change = { status?: ApptStatus; reminded?: boolean; since?: number; paid?: boolean }
type Store = {
  changes: Record<string, Change>
  setStatus: (id: string, status: ApptStatus, since?: number) => void
  remind: (id: string) => void
  collect: (id: string, paid?: boolean) => void
  added: Appointment[]
  book: (a: Appointment) => void
  timeOff: TimeOff[]
  addTimeOff: (t: TimeOff) => void
  removeTimeOff: (id: string) => void
}

const KEY = "ms.appointments.session"
const Ctx = React.createContext<Store | null>(null)

export function AppointmentsStoreProvider({ children }: { children: React.ReactNode }) {
  const [changes, setChanges] = React.useState<Record<string, Change>>({})
  const [added, setAdded] = React.useState<TimeOff[]>([])
  const [booked, setBooked] = React.useState<Appointment[]>([])
  const loaded = React.useRef(false)

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY)
      if (raw) {
        // One-time restore from sessionStorage after hydration (not available during SSR).
        const saved = JSON.parse(raw)
        /* eslint-disable react-hooks/set-state-in-effect */
        setChanges(saved.changes ?? {})
        setAdded(saved.timeOff ?? [])
        setBooked(saved.booked ?? [])
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {}
    loaded.current = true
  }, [])
  React.useEffect(() => {
    if (!loaded.current) return
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ changes, timeOff: added, booked }))
    } catch {}
  }, [changes, added, booked])

  const store = React.useMemo<Store>(
    () => ({
      changes,
      // Check in / call in start the waiting-room timer now; undo restores the previous status and timer.
      setStatus: (id, status, since?: number) =>
        setChanges((c) => ({ ...c, [id]: { ...c[id], status, since: since ?? (status === "arrived" || status === "withDoctor" ? NOW_MIN : c[id]?.since) } })),
      collect: (id, paid = true) => setChanges((c) => ({ ...c, [id]: { ...c[id], paid } })),
      remind: (id) => setChanges((c) => ({ ...c, [id]: { ...c[id], reminded: true } })),
      added: booked,
      book: (a) => setBooked((l) => [...l, a]),
      timeOff: [...TIME_OFF, ...added],
      addTimeOff: (t) => setAdded((l) => [...l, t]),
      removeTimeOff: (id) => setAdded((l) => l.filter((x) => x.id !== id)),
    }),
    [changes, added, booked]
  )
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export type LiveAppointment = Appointment & { reminded: boolean; paid: boolean }

/** Reminders go out the evening before, so everything today has one; a manual send marks it again. */
const withChange = (a: Appointment, c?: Change): LiveAppointment => ({
  ...a,
  status: c?.status ?? a.status,
  since: c?.since ?? a.since,
  reminded: c?.reminded ?? true,
  paid: c?.paid ?? false,
})

/** `on(date)` → that day's appointments with this session's changes applied. */
export function useAppointmentsOn() {
  const store = React.useContext(Ctx)
  const changes = store?.changes
  const booked = store?.added
  return React.useCallback(
    (date: string) =>
      [...appointmentsOn(date), ...(booked ?? []).filter((a) => a.date === date)]
        .sort((a, b) => a.start - b.start)
        .map((a) => withChange(a, changes?.[a.id])),
    [changes, booked]
  )
}

export function useAppointmentActions() {
  const store = React.useContext(Ctx)
  if (!store) throw new Error("useAppointmentActions needs AppointmentsStoreProvider")
  return {
    setStatus: store.setStatus,
    remind: store.remind,
    collect: store.collect,
    addTimeOff: store.addTimeOff,
    removeTimeOff: store.removeTimeOff,
    book: store.book,
  }
}

export function useTimeOff() {
  return React.useContext(Ctx)?.timeOff ?? TIME_OFF
}
