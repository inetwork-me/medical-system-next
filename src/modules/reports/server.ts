import { BRANCHES, DEFAULT_FILTERS, type ReportFilters } from "./data"

/*
 * The reports API, as a stub. Branch access is decided here — the server — not in the UI (brief §4): every query
 * takes the user, and the server narrows the filters to the branches that user may see, whatever the UI sent. The
 * UI only asks which branches to offer in the Filters dialog. Replace `ACCESS` with the users' facility grants and
 * `query` with the real endpoint; the screens don't change.
 */

/** Which branches each user may report on (demo: Dr. Khaled sees Riyadh main and Olaya, not Jeddah). */
const ACCESS: Record<string, string[]> = {
  "khaled.m@clinic.sa": ["riyadh-main", "olaya"],
}
const DEFAULT_ACCESS = ["riyadh-main"]

export function allowedBranches(userEmail: string): string[] {
  return ACCESS[userEmail.toLowerCase()] ?? DEFAULT_ACCESS
}

/**
 * Server-side narrowing: a branch the user can't see is replaced by their first allowed branch; "all" means all of
 * *their* branches. Returns the filters the query actually ran with and the branches it covered.
 */
export function enforceBranchAccess(userEmail: string, f: ReportFilters): { filters: ReportFilters; branches: string[] } {
  const allowed = allowedBranches(userEmail)
  if (f.branch === "all") return { filters: f, branches: allowed }
  const ok = allowed.includes(f.branch)
  const branch = ok ? f.branch : allowed[0]
  return { filters: { ...f, branch }, branches: [branch] }
}

export type QueryResult<T> = { data: T; ranWith: ReportFilters; branches: string[]; tookMs: number }

/** Run a report query on the server (stub): enforces branch access, then hands the narrowed filters to `compute`. */
export async function query<T>(userEmail: string, filters: ReportFilters, compute: (f: ReportFilters, branches: string[]) => T): Promise<QueryResult<T>> {
  const started = Date.now()
  await new Promise((r) => setTimeout(r, 200))
  const { filters: ranWith, branches } = enforceBranchAccess(userEmail, filters)
  return { data: compute(ranWith, branches), ranWith, branches, tookMs: Date.now() - started }
}

/** The branches to offer in the Filters dialog (the server's list; the UI never decides it). */
export function branchOptions(userEmail: string) {
  const allowed = allowedBranches(userEmail)
  return BRANCHES.filter((b) => allowed.includes(b.id))
}

export const defaultFiltersFor = (userEmail: string): ReportFilters => enforceBranchAccess(userEmail, DEFAULT_FILTERS).filters
