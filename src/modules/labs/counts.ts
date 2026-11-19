import { OTHER_TODAY, type LabOrder } from "./data"
import { statusOf } from "./machine"

/** Worklist filter: "collect" includes Recollect (rejected, waiting for a new sample). */
export type WorklistFilter = "all" | "collect" | "lab" | "validate" | "ready"

export const inFilter = (o: LabOrder, f: WorklistFilter) => {
  if (f === "all") return true
  const s = statusOf(o)
  return f === "collect" ? s === "collect" || s === "rejected" : s === f
}

/** Today's counts: the live sample orders plus the rest of the day (OTHER_TODAY), as in the design (64 · 12 · 18 · 9 · 25). */
export function dayCounts(orders: LabOrder[]) {
  const n = (f: WorklistFilter) => orders.filter((o) => inFilter(o, f)).length
  const collect = n("collect") + OTHER_TODAY.collect
  const lab = n("lab") + OTHER_TODAY.lab
  const validate = n("validate") + OTHER_TODAY.validate
  const ready = n("ready") + OTHER_TODAY.ready
  return {
    all: collect + lab + validate + ready,
    collect,
    collectStat: orders.filter((o) => inFilter(o, "collect") && o.priority === "stat").length + OTHER_TODAY.collectStat,
    lab,
    validate,
    ready,
  }
}
