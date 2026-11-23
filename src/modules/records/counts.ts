import {
  CHART_RED_HOURS,
  COMPLETION_STATS,
  REC_TODAY,
  type AccessEvent,
  type CompletionItem,
  type DocKind,
  type Encounter,
  type RecDocument,
  type RecordsRequest,
  type UserKey,
  type VisitNote,
} from "./data"
import { completionOpen, dueSoon, dueThisWeek, isOpenRequest, noteStatus, requestStatus, toSign, waitingHours } from "./rules"

/*
 * Module counts: the design's rows (with this session's changes) plus the aggregates for the rest of the month, so
 * tabs, filters, tiles and KPIs agree with each other and move when a row changes.
 */

/**
 * Visit notes: "Mine" is today's notes and anything not signed yet (the list's first page); Show more reaches the
 * doctor's older signed notes (`mineAll`, "Showing 6 of 37"). "All clinics" counts every doctor's notes.
 */
export function noteCounts(notes: VisitNote[], me: UserKey) {
  const mine = notes.filter((n) => n.author === me)
  const st = mine.map((n) => noteStatus(n))
  const drafts = st.filter((s) => s === "draft").length
  const overdue = st.filter((s) => s === "overdue").length
  const signed = st.filter((s) => s === "signed" || s === "addendum").length
  return { mine: mine.filter(inMine).length, mineAll: mine.length, drafts, overdue, toSign: st.filter(toSign).length, signed, all: notes.length }
}
/** The Mine filter's first page: today's notes and every unsigned one. */
export const inMine = (n: VisitNote) => !n.signedAt || n.createdAt.slice(0, 10) === REC_TODAY

export function documentCounts(docs: RecDocument[]) {
  const kind = (k: DocKind) => docs.filter((d) => d.kind === k).length
  // Discharge summaries are filed with the reports (the design's filters have no separate tab for them).
  const c = { prescription: kind("prescription"), sickLeave: kind("sickLeave"), report: kind("report") + kind("discharge"), referral: kind("referral") }
  return { all: docs.length, ...c }
}

export function requestCounts(reqs: RecordsRequest[]) {
  const open = reqs.filter(isOpenRequest).length
  const released = reqs.filter((r) => requestStatus(r) === "released").length
  const rejected = reqs.filter((r) => requestStatus(r) === "rejected").length
  return { open, week: reqs.filter(dueThisWeek).length, soon: reqs.filter(dueSoon).length, released, rejected, all: open + released + rejected }
}

export function completionCounts(items: CompletionItem[], notes: VisitNote[], encounters: Encounter[]) {
  const open = items.filter((c) => completionOpen(c, notes))
  const red = open.filter((c) => waitingHours(c) > CHART_RED_HOURS)
  const doctorsOf = (xs: CompletionItem[]) => new Set(xs.map((c) => encounters.find((e) => e.id === c.encounter)?.doctor)).size
  // Done this week: the rest of the week plus the drawn items closed since (signed, coded, reviewed).
  const done = COMPLETION_STATS.doneThisWeek + items.filter((c) => !completionOpen(c, notes)).length
  return { open: open.length, over48: red.length, doctors: doctorsOf(open), redDoctors: doctorsOf(red), done, onTimePct: COMPLETION_STATS.onTimePct, goalPct: COMPLETION_STATS.goalPct }
}

/** Flagged = break the glass or unusual, not yet reviewed. */
export function accessCounts(events: AccessEvent[]) {
  const flagged = events.filter((e) => e.flag !== "normal" && !e.review)
  return { flagged: flagged.length, breakGlass: flagged.filter((e) => e.flag === "breakGlass").length, today: events.filter((e) => e.at.slice(0, 10) === REC_TODAY).length }
}
