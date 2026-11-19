"use client"

import * as React from "react"

import { ReassignBookings, type ReassignCandidate, type ReassignChoice } from "@/components/ds/reassign-bookings"
import { useClinics } from "@/modules/clinics/store"
import type { Doctor } from "./data"
import { doctorCandidates, spreadPlan, type DoctorCover } from "./reassign"
import { useDoctors, useLeaves } from "./store"
import { useDoctorText } from "./text"

const open = (c: DoctorCover) => c.state === "all" || c.state === "some"

/** What the dialog applies on confirm. */
export type MoveOutcome =
  | { kind: "doctor"; cover: Doctor | undefined; covered: number; total: number; waiting: number }
  | { kind: "spread"; covered: number; total: number; waiting: number; doctors: number }
  | { kind: "cancel"; total: number }

/**
 * Move bookings block for Deactivate doctor and Request leave: the source doctor's bookings from `from` to `to` go to a
 * colleague in the same department (top coverage preselected), are spread across the department, or are cancelled.
 */
export function useDoctorMoveBookings(source: Doctor | undefined, from: string, to: string, opts: { leave?: boolean } = {}) {
  const { b, dates } = useDoctorText()
  const all = useDoctors()
  const leaves = useLeaves()
  const clinic = useClinics().find((c) => c.key === source?.clinic)
  const [choice, setChoice] = React.useState<ReassignChoice>("doctor")
  const [picked, setPicked] = React.useState<string>()
  const ready = !!source && !!from && !!to && to >= from
  const covers = ready ? doctorCandidates(source, all, leaves, from, to) : []
  const count = ready ? countOf(source, covers, from, to, leaves) : 0
  const pick = picked && covers.some((c) => c.doctor.key === picked && open(c)) ? picked : covers.find(open)?.doctor.key

  const rows: ReassignCandidate[] = covers.map((c) => ({
    key: c.doctor.key,
    name: b(c.doctor.name),
    sub: b(c.doctor.title),
    initials: c.doctor.initials,
    coverage: c.state === "leave" ? { state: "leave", until: dates.dayMonth(c.until) } : c.state === "unavailable" ? { state: "unavailable" } : { state: c.state, covered: c.covered, total: c.total },
  }))

  const element = ready ? (
    <ReassignBookings
      target="doctor"
      count={count}
      department={{ name: clinic ? b(clinic.name) : "", short: clinic ? b(clinic.short) : "" }}
      leave={opts.leave}
      value={choice}
      onValueChange={setChoice}
      picked={pick}
      onPick={setPicked}
      candidates={rows}
    />
  ) : null

  const outcome = (): MoveOutcome => {
    if (choice === "cancel" || !source) return { kind: "cancel", total: count }
    if (choice === "spread") {
      const s = spreadPlan(source, covers, leaves, from, to)
      return { kind: "spread", ...s }
    }
    const c = covers.find((x) => x.doctor.key === pick)
    const covered = c && (c.state === "all" || c.state === "some") ? c.covered : 0
    return { kind: "doctor", cover: c?.doctor, covered, total: count, waiting: count - covered }
  }
  return { element, outcome, choice, count }
}

/** Bookings that have to move (the same figure every row's "of n" uses). */
function countOf(source: Doctor, covers: DoctorCover[], from: string, to: string, leaves: Parameters<typeof spreadPlan>[2]) {
  const withTotal = covers.find((c) => "total" in c) as { total: number } | undefined
  return withTotal ? withTotal.total : spreadPlan(source, [], leaves, from, to).total
}
