"use client"

import * as React from "react"

import { HoursEditorBody, useHoursEditor } from "@/modules/doctors/edit-hours"
import { useDoctor } from "@/modules/doctors/store"
import type { Doctor } from "@/modules/doctors/data"

type Seed = Parameters<typeof useHoursEditor>[1]

/** Design state: Thursday cut to 08:00–12:00 → "2 booked visits on Thu 26 Nov fall after 12:00", 40 h. */
const THURSDAY_12: Seed = (w) => ({ ...w, thu: w.thu.map((s) => ({ ...s, to: "12:00" })) })
/** More than 5 bookings affected → the shared ReassignBookings block. */
const MANY: Seed = (w) => ({ ...w, mon: w.mon.map((s, i) => (i === 0 ? { ...s, to: "12:00" } : s)), tue: [], thu: w.thu.map((s) => ({ ...s, to: "12:00" })) })
/** Validation: end before start on Sunday, overlapping shifts on Monday. */
const ERRORS: Seed = (w) => ({
  ...w,
  sun: w.sun.map((s) => ({ ...s, from: "16:00", to: "08:00" })),
  mon: w.mon.map((s, i) => (i === 1 ? { ...s, from: "15:00", to: "18:00", loc: s.loc === "tele" ? "101" : s.loc } : s)),
})

function Story({ name, doctor, seed, width }: { name: string; doctor: Doctor; seed?: Seed; width: number }) {
  const e = useHoursEditor(doctor, seed)
  const [plan, setPlan] = React.useState<"keep" | "move">("keep")
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
        {name} · {width}
      </span>
      <div className="rounded-2xl border bg-card p-6 shadow-lg" style={{ width }}>
        <HoursEditorBody editor={e} plan={plan} setPlan={setPlan} />
      </div>
    </div>
  )
}

export function HoursStories() {
  const d = useDoctor("zaki")
  if (!d) return null
  const states: [string, Seed | undefined][] = [
    ["default (current hours)", undefined],
    ["conflict · Thursday 08:00–12:00 (design)", THURSDAY_12],
    ["conflict · more than 5 → keep / move (dialog shows ReassignBookings)", MANY],
    ["validation errors", ERRORS],
  ]
  return (
    <div className="flex flex-col gap-10">
      {states.map(([name, seed]) => (
        <section key={name} className="flex flex-wrap items-start gap-6">
          <Story name={name} doctor={d} seed={seed} width={680} />
          <Story name={name} doctor={d} seed={seed} width={390} />
        </section>
      ))}
    </div>
  )
}
