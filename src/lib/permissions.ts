import type { ModuleId } from "@/config/modules"

/**
 * Permission matrix (Settings › Roles and access, design v9.0 · brief §4 · Roles): permission = module × action (View /
 * Create / Edit / Approve / Export) with scope all branches or own branch. The Settings row is one permission per section
 * (view / edit). Users get the union of their roles; changes apply at the next sign-in, so the app enforces the snapshot
 * taken when the user signed in (sessionStorage `ms.session.access`), never the live role editor.
 *
 * Every surface checks the same gate: navigation (sidebar, rail, bottom nav, More sheet), the module guards, and each
 * module's own action checks (billCan, labCan, recCan, repCan, msgCan) plus the create / export buttons of the others.
 */
export type PermModule = Exclude<ModuleId, "dashboard"> | "settings"
/** Matrix rows, in the design's order (Dashboard is always on and has no row). */
export const PERM_MODULES: PermModule[] = ["patients", "appointments", "doctors", "clinics", "billing", "records", "lab", "messages", "reports", "settings"]

export type PermAction = "view" | "create" | "edit" | "approve" | "export"
export const PERM_ACTIONS: PermAction[] = ["view", "create", "edit", "approve", "export"]

export type Scope = "all" | "own"
export type ModuleGrants = Partial<Record<PermAction, Scope>>
export type SettingsGrant = "edit" | "view"

export type Access = {
  modules: Partial<Record<Exclude<PermModule, "settings">, ModuleGrants>>
  /** Settings row: one grant per section (general, users, roles …). */
  settings: Partial<Record<string, SettingsGrant>>
}

export const NO_ACCESS: Access = { modules: {}, settings: {} }

/** Union of several roles' access: the wider scope wins (all > own), edit beats view. */
export function unionAccess(list: Access[]): Access {
  const out: Access = { modules: {}, settings: {} }
  for (const a of list) {
    for (const [m, g] of Object.entries(a.modules) as [Exclude<PermModule, "settings">, ModuleGrants][]) {
      const cur = (out.modules[m] ??= {})
      for (const [act, scope] of Object.entries(g) as [PermAction, Scope][]) {
        if (cur[act] !== "all") cur[act] = scope
      }
    }
    for (const [s, g] of Object.entries(a.settings)) {
      if (out.settings[s] !== "edit" && g) out.settings[s] = g
    }
  }
  return out
}

/* ------------------------------------------------------------------ the gate */

/** null = not signed in yet / server render: nothing is hidden (the static export renders the full app). */
let gate: Access | null = null

/** Set by <PermissionsGate> (components/shell/permissions.tsx) from the signed-in snapshot. */
export function setGate(a: Access | null) {
  gate = a
}

/** May the signed-in user do this? Dashboard is always on; Settings' module-level View/Edit mean "any section". */
export function can(module: PermModule | "dashboard", action: PermAction = "view"): boolean {
  if (module === "dashboard") return action === "view"
  if (!gate) return true
  if (module === "settings") {
    const grants = Object.values(gate.settings)
    if (action === "view") return grants.length > 0
    if (action === "edit") return grants.includes("edit")
    return false
  }
  return !!gate.modules[module]?.[action]
}

/** Scope of a grant: "all" branches, "own" branch, or null when it isn't granted. */
export function scopeOf(module: Exclude<PermModule, "settings">, action: PermAction = "view"): Scope | null {
  if (!gate) return "all"
  return gate.modules[module]?.[action] ?? null
}

/** Settings section grant from the gate (Overview and My account are everyone's). */
export function sectionGrant(section: string): SettingsGrant | null {
  if (section === "overview" || section === "account") return section === "account" ? "edit" : "view"
  if (!gate) return "edit"
  return gate.settings[section] ?? null
}

/* ------------------------------------------------------------------ signed-in snapshot */

/** The snapshot also carries the branch the user is working at (the modules and tabs that branch runs). */
export type SignedIn = { user: string; roles: string[]; access: Access; at: string; branch?: string }

const KEY = "ms.session.access"
let cache: SignedIn | null | undefined
const listeners = new Set<() => void>()

export function readSignedIn(): SignedIn | null {
  if (typeof window === "undefined") return null
  if (cache === undefined) {
    try {
      const raw = sessionStorage.getItem(KEY)
      cache = raw ? (JSON.parse(raw) as SignedIn) : null
    } catch {
      cache = null
    }
  }
  return cache
}

/** "Sign in": take the snapshot the app enforces until the next sign-in. */
export function writeSignedIn(s: SignedIn) {
  cache = s
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s))
  } catch {}
  for (const l of listeners) l()
}

/** Sign out: forget the snapshot (the session ended or the user logged out). */
export function clearSignedIn() {
  cache = null
  try {
    sessionStorage.removeItem(KEY)
  } catch {}
  for (const l of listeners) l()
}

export function subscribeSignedIn(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
