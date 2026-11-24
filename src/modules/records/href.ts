/**
 * Medical records routes. Records are query params (`/records/notes/note?id=VN-2611-2041`) so the app also runs as a
 * static export. Each inner page lives under its tab's path, so the nav keeps that tab active, and when that tab is
 * off for the branch the page and every link into it are off too.
 */
export const RECORDS_HREF = "/records"
export const VISITS_HREF = "/records/visits"
export const NOTES_HREF = "/records/notes"
export const DOCUMENTS_HREF = "/records/documents"
export const REQUESTS_HREF = "/records/requests"
export const COMPLETION_HREF = "/records/completion"
export const ACCESS_HREF = "/records/access"

const q = (base: string, params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
  return s ? `${base}?${s}` : base
}

/** Visit (inner page of Visits). */
export const visitHref = (id: string) => q("/records/visits/visit", { id })
/** Visits with missing data for an official return (inner page of Visits): the rule, the period, the branch and the return to go back to. */
export const missingHref = (rule: string, period: string, extra?: { branch?: string; from?: string }) =>
  q("/records/visits/missing", { rule, period, branch: extra?.branch, from: extra?.from })
/** Visits tab with a filter ("today", "here", "open", "month"). */
export const visitsHref = (filter?: string) => q(VISITS_HREF, { filter })
/** Visit note (inner page of Visit notes). */
export const noteHref = (id: string) => q("/records/notes/note", { id })
/** New prescription for a visit (inner page of Visit notes › Visit note); `no` reopens a draft. */
export const prescriptionHref = (visit: string, no?: string) => q("/records/notes/prescription", { visit, no })
/** Medical report and the other documents (inner page of Documents). */
export const reportHref = (no: string) => q("/records/documents/report", { no })
/** Request (inner page of Requests). */
export const requestHref = (no: string) => q("/records/requests/request", { no })
/** Tab links with a filter ("Visit notes · Overdue", "Access log · Flagged"). */
export const notesHref = (filter?: string) => q(NOTES_HREF, { filter })
export const requestsHref = (filter?: string) => q(REQUESTS_HREF, { filter })
export const accessHref = (filter?: string, review?: string) => q(ACCESS_HREF, { filter, review })
