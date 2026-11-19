"use client"

import * as React from "react"

import type { Bi } from "@/lib/mock/bi"

/**
 * Appointments waiting list (session): bookings a reassignment couldn't fit — Deactivate doctor, Request leave or
 * Pause clinic (DS "Move bookings" block: "Bookings the doctor/clinic can't fit go to the waiting list"). Patients on it
 * get the first slot that opens. There is no waiting-list screen in the design yet; entries are kept for when it lands.
 */
export type WaitlistEntry = {
  id: string
  /** How many bookings. */
  count: number
  source: "deactivate" | "leave" | "pause" | "hours"
  /** The doctor (Doctors key) or clinic (Clinics key) the bookings came from. */
  doctor?: string
  clinic?: string
  from: string
  to: string
  note?: Bi
}

const KEY = "ms.appointments.waitlist"
let entries: WaitlistEntry[] = []
let loaded = false
const listeners = new Set<() => void>()
const EMPTY: WaitlistEntry[] = []

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) entries = JSON.parse(raw) as WaitlistEntry[]
  } catch {}
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
  return entries
}

/** Put bookings on the waiting list (ignored when count is 0). */
export function addToWaitlist(entry: Omit<WaitlistEntry, "id">) {
  if (entry.count <= 0) return
  load()
  entries = [...entries, { ...entry, id: `wl-${entry.source}-${entry.doctor ?? entry.clinic}-${entry.from}-${entries.length}` }]
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries))
  } catch {}
  for (const l of listeners) l()
}

export function useWaitlist(): WaitlistEntry[] {
  return React.useSyncExternalStore(subscribe, read, () => EMPTY)
}
