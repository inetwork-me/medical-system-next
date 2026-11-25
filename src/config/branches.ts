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
  "satellite-clinic": { hiddenModules: [], hiddenTabs: ["records.overview", "records.requests", "records.access", "reports.returns"] },
}

export const ACTIVE_BRANCH = process.env.NEXT_PUBLIC_BRANCH ?? "main"

/**
 * Runtime branch config (Settings › Modules per branch, design v9.0): the signed-in user's working branch with the switches
 * as saved this session. Set on the client by <PermissionsGate>; the server render (and a build pinned to a preset with
 * NEXT_PUBLIC_BRANCH) keeps the static config above.
 */
let runtime: BranchConfig | null = null
export function setBranchGate(cfg: BranchConfig | null) {
  runtime = ACTIVE_BRANCH === "main" ? cfg : null
}

export const branchConfig = (): BranchConfig => runtime ?? BRANCHES[ACTIVE_BRANCH] ?? BRANCHES.main
