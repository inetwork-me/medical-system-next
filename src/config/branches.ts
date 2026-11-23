import type { ModuleId } from "./modules"

/**
 * Per-branch feature flags. A branch lists the modules it hides and, optionally, module tabs it hides
 * ("<module>.<tab>"). The active branch comes from NEXT_PUBLIC_BRANCH (defaults to "main").
 * Later this will come from the signed-in user's facility; the shape stays the same.
 */
export type BranchConfig = {
  hiddenModules: ModuleId[]
  hiddenTabs: string[]
}

export const BRANCHES: Record<string, BranchConfig> = {
  main: { hiddenModules: [], hiddenTabs: [] },
  // Example: a small clinic without inpatient lab or billing, and without the eye / dental specialties.
  "olaya-clinic": { hiddenModules: ["lab", "billing"], hiddenTabs: ["patients.payments", "patients.eyes", "patients.dental"] },
  // Example: a cash-only branch — Billing without insurance claims or insurer partners, contracts handled at HQ.
  "cash-branch": { hiddenModules: [], hiddenTabs: ["billing.claims", "billing.insurers", "billing.contracts"] },
  // Example: a satellite clinic whose records office and privacy review sit at HQ (only the clinical tabs stay).
  "satellite-clinic": { hiddenModules: [], hiddenTabs: ["records.overview", "records.requests", "records.access"] },
}

export const ACTIVE_BRANCH = process.env.NEXT_PUBLIC_BRANCH ?? "main"

export const branchConfig = (): BranchConfig => BRANCHES[ACTIVE_BRANCH] ?? BRANCHES.main
