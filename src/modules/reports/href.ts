/**
 * Reports routes. Records are query params so the app also runs as a static export. Inner pages live under their
 * tab's path (Report and Report builder under Library, Return under Official returns), so the nav keeps that tab
 * active and a tab switched off for the branch takes its inner pages with it.
 */
export const REPORTS_HREF = "/reports"
export const OPERATIONS_HREF = "/reports/operations"
export const FINANCE_HREF = "/reports/finance"
export const CLINICAL_HREF = "/reports/clinical"
export const DOCTORS_HREF = "/reports/doctors"
export const LIBRARY_HREF = "/reports/library"
export const SCHEDULES_HREF = "/reports/schedules"
export const RETURNS_HREF = "/reports/returns"

const q = (base: string, params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
  return s ? `${base}?${s}` : base
}

/** Report (inner page of Library). */
export const reportHref = (id: string) => q("/reports/library/report", { id })
/** Report builder (inner page of Library); `id` edits a saved report. */
export const builderHref = (id?: string) => q("/reports/library/builder", { id })
/** Return (inner page of Official returns). */
export const returnHref = (id: string) => q("/reports/returns/return", { id })
