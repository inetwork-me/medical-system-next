/**
 * Reports permissions (brief §4):
 * - managers see their area dashboards (Operations, Clinical, Doctors);
 * - finance sees Finance;
 * - the medical director signs off official returns (and sees every area);
 * - report owners edit their reports; anyone with Reports can build their own private reports.
 * "lead" is the demo role: every permission (switchable in the dev stories).
 */
export type RepRole = "manager" | "finance" | "director" | "lead"

export const REP_ROLES: RepRole[] = ["lead", "manager", "finance", "director"]

export type RepAction = "build" | "schedule" | "export" | "share" | "returns" | "signOff"

const MATRIX: Record<Exclude<RepRole, "lead">, RepAction[]> = {
  manager: ["build", "schedule", "export", "share"],
  finance: ["build", "schedule", "export", "share", "returns"],
  director: ["build", "schedule", "export", "share", "returns", "signOff"],
}

export function repCan(role: RepRole, action: RepAction): boolean {
  if (role === "lead") return true
  return MATRIX[role].includes(action)
}

/** Which module tabs a role sees (branch-hidden tabs stay hidden on top of this). */
export function repTabs(role: RepRole): string[] {
  switch (role) {
    case "manager":
      return ["overview", "operations", "clinical", "doctors", "library", "schedules"]
    case "finance":
      return ["overview", "finance", "library", "schedules", "returns"]
    default:
      return ["overview", "operations", "finance", "clinical", "doctors", "library", "schedules", "returns"]
  }
}
