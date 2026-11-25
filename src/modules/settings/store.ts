"use client"

import * as React from "react"

import { SESSION_USER } from "@/lib/mock/shell"
import type { Bi } from "@/lib/mock/bi"
import { readSignedIn, writeSignedIn, type Access } from "@/lib/permissions"
import { accessFor } from "./access"
import { ACCOUNT_DEFAULT, ADDONS, BRANCH_MODULES, OFF_ALL, PLAN, PLANS, SET_BRANCHES, SET_NOW, SET_TODAY, SUB_INVOICES, TONIGHT, ZATCA_UNITS, type Account, type AddonId, type Branch, type BranchKey, type BranchModules, type PlanId, type SubInvoice, type ZatcaUnit } from "./data"
import { ORG_DEFAULT, type OrgIdentity } from "@/lib/org"
import { nextReset, type DocKey, type NumberFormat, type SavedFormat } from "@/lib/numbering"
import { DEFAULT_ACCESS, ROLES, type RoleDef, type RoleKey } from "./roles-data"
import type { SectionId } from "./sections"
import { ME_USER, USERS, type SetUser } from "./users-data"
import { AUDIT_SEED } from "./audit-data"
import { QUIET_DEFAULT, RULES, type QuietHours, type Rule } from "./notify-data"

/**
 * Settings session store (sessionStorage `ms.settings.session`, like the other modules): user changes (invites, deactivate,
 * 2-step resets, signed-out devices), role matrices as saved, new roles, and the audit rows written this session.
 */

/* ------------------------------------------------------------------ audit */

/** Audit filters (brief §2 · Audit log): settings changes, sign-ins, failed sign-ins, exports. */
export type AuditKind = "settings" | "signin" | "failed" | "export"

/**
 * One audit row: time, who, what, where (the section, or "signin" / a module for exports), IP. Kept 10 years, read-only,
 * exportable; exporting it writes a row too.
 */
export type AuditEntry = {
  id: string
  at: string
  who: Bi
  /** Avatar initials ("KM"; "SY" for the system, "?" for an unknown sign-in). */
  initials?: string
  kind: AuditKind
  what: Bi
  where: SectionId | "signin" | "reports" | "billing" | "records" | "messages" | "patients"
  ip: string
}

/** The demo admin PC (Olaya admin office, inside the Olaya trusted network 10.20.0.0/16). */
export const DEMO_IP = "10.20.1.5"

type State = {
  audit: AuditEntry[]
  users: Record<string, Partial<SetUser>>
  newUsers: SetUser[]
  /** Role matrices as saved this session (replace the defaults). */
  roleAccess: Record<RoleKey, Access>
  newRoles: RoleDef[]
  /** Modules per branch as changed this session (replace the seed for that branch). */
  branchModules: Partial<Record<BranchKey, BranchModules>>
  /** Turn-offs scheduled for tonight. */
  scheduled: Scheduled[]
  /** Branch changes (hours, status …) and branches added this session. */
  branches: Record<BranchKey, Partial<Branch>>
  newBranches: Branch[]
  /** General: the center's identity as saved (null = defaults). */
  org: OrgIdentity | null
  /** Numbering: saved formats and the day each starts. */
  formats: Partial<Record<DocKey, SavedFormat>>
  /** Dates, numbers and language. */
  prefs: Partial<Prefs>
  /** Security as saved (null = defaults); trusted networks save straight away. */
  security: Security | null
  /** ZATCA units with renewed certificates (unit id → valid until). */
  certs: Record<string, string>
  /** Last health check per integration. */
  checked: Record<string, string>
  /** Notification rules as saved (replace the seed rule with the same id) and quiet hours. */
  rules: Record<string, Rule>
  quiet: QuietHours | null
  /** Plan changes, add-ons bought, subscription invoices raised this session. */
  plan: { id?: PlanId; billing?: "yearly" | "monthly"; addons?: AddonId[]; smsExtra?: number; invoices?: SubInvoice[] }
  /** My account as saved. */
  account: Partial<Account>
}

export type Network = { id: string; name: Bi; range: string; admin: boolean }
export type Security = {
  nafath: boolean
  password: boolean
  minLength: number
  changeDays: number
  lockout: "3-15" | "5-15" | "5-30" | "10-60"
  /** Roles that must use 2-step. */
  twoStepRoles: string[]
  idleShared: number
  personalHours: number
  oneSession: boolean
  networks: Network[]
  adminOnlyTrusted: boolean
}
export const SECURITY_DEFAULT: Security = {
  nafath: true,
  password: true,
  minLength: 12,
  changeDays: 180,
  lockout: "5-15",
  twoStepRoles: ["admin", "director", "doctor", "billing", "claims"],
  idleShared: 15,
  personalHours: 8,
  oneSession: true,
  networks: [
    { id: "n-olaya", name: { en: "Olaya branch", ar: "فرع العليا" }, range: "10.20.0.0/16", admin: true },
    { id: "n-malaz", name: { en: "Malaz branch", ar: "فرع الملز" }, range: "10.30.0.0/16", admin: true },
    { id: "n-jeddah", name: { en: "Jeddah branch", ar: "فرع جدة" }, range: "10.40.0.0/16", admin: true },
  ],
  adminOnlyTrusted: true,
}

export type Prefs = {
  date: "dMonY" | "dmy" | "iso"
  hijri: "documents" | "everywhere" | "off"
  time: "24" | "12"
  week: "sun" | "sat" | "mon"
  digits: "latin" | "arabic"
  currency: "SAR"
  language: "ar" | "en"
  zone: "Asia/Riyadh"
}
export const PREFS_DEFAULT: Prefs = { date: "dMonY", hijri: "documents", time: "24", week: "sun", digits: "latin", currency: "SAR", language: "ar", zone: "Asia/Riyadh" }

/** A module turn-off scheduled for tonight (the switch shows "Off tonight 23:00" until then). */
export type Scheduled = { branch: BranchKey; module: string; at: string }

const KEY = "ms.settings.session"
const EMPTY: State = { audit: [], users: {}, newUsers: [], roleAccess: {}, newRoles: [], branchModules: {}, scheduled: [], branches: {}, newBranches: [], org: null, formats: {}, prefs: {}, security: null, certs: {}, checked: {}, rules: {}, quiet: null, plan: {}, account: {} }
let state: State = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<State>) }
  } catch {}
}
function commit(fn: (s: State) => State) {
  load()
  state = fn(state)
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
  for (const l of listeners) l()
}
function subscribe(l: () => void) {
  load()
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
const read = () => {
  load()
  return state
}
const serverState = () => EMPTY

function useSnap() {
  return React.useSyncExternalStore(subscribe, read, serverState)
}

/** Audit events written this session, newest first (build step 5 merges them with the stored log). */
export const useAuditEvents = () => useSnap().audit
/** The whole log: this session's rows on top of the stored week (audit-data.ts). */
export function useAuditLog(): AuditEntry[] {
  const audit = useSnap().audit
  return React.useMemo(() => [...audit, ...AUDIT_SEED], [audit])
}

const pad = (n: number) => String(n).padStart(2, "0")
/** Local wall time as "YYYY-MM-DDTHH:MM" (the format every module's data uses). */
function stamp(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** Now, as the demo clock reads it (the real time on the demo day, else the demo time). */
export function nowStamp() {
  const s = stamp(new Date())
  return s.slice(0, 10) === SET_NOW.slice(0, 10) ? s : SET_NOW
}

/**
 * The audit-log writer every section uses: one row per settings change, sign-in (including failed) and export, with who
 * (the signed-in user unless given), what, where and IP. Call it from the action that makes the change, after it succeeds.
 */
export function writeAudit(e: { kind?: AuditKind; what: Bi; where: AuditEntry["where"]; who?: Bi; ip?: string }) {
  const at = nowStamp()
  commit((s) => ({
    ...s,
    audit: [
      {
        id: `a-${s.audit.length + 1}-${at}`,
        at,
        who: e.who ?? SESSION_USER.name,
        initials: e.who ? undefined : SESSION_USER.initials,
        kind: e.kind ?? "settings",
        what: e.what,
        where: e.where,
        ip: e.ip ?? DEMO_IP,
      },
      ...s.audit,
    ],
  }))
}

/* ------------------------------------------------------------------ users */

export function useUsers(): SetUser[] {
  const snap = useSnap()
  return React.useMemo(
    () => [...USERS.map((u) => (snap.users[u.id] ? { ...u, ...snap.users[u.id] } : u)), ...snap.newUsers.map((u) => (snap.users[u.id] ? { ...u, ...snap.users[u.id] } : u))],
    [snap.users, snap.newUsers]
  )
}
export function useUser(id: string): SetUser | undefined {
  return useUsers().find((u) => u.id === id)
}
export const updateUser = (id: string, patch: Partial<SetUser>) =>
  commit((s) => ({ ...s, users: { ...s.users, [id]: { ...s.users[id], ...patch } } }))
export const addUser = (u: SetUser) => commit((s) => ({ ...s, newUsers: [...s.newUsers, u] }))

/* ------------------------------------------------------------------ roles */

export function useRoles(): RoleDef[] {
  const snap = useSnap()
  return React.useMemo(() => [...ROLES, ...snap.newRoles], [snap.newRoles])
}
/** Saved access per role (defaults, then this session's saves). */
export function useRoleAccess(): Record<RoleKey, Access> {
  const snap = useSnap()
  return React.useMemo(() => ({ ...DEFAULT_ACCESS, ...snap.roleAccess }), [snap.roleAccess])
}
export const saveRoleAccess = (id: RoleKey, a: Access) => commit((s) => ({ ...s, roleAccess: { ...s.roleAccess, [id]: a } }))
export const addRole = (r: RoleDef, a: Access) => commit((s) => ({ ...s, newRoles: [...s.newRoles, r], roleAccess: { ...s.roleAccess, [r.id]: a } }))

/* ------------------------------------------------------------------ sign-in */

/**
 * Sign in (the demo's "sign in again" on the dev page): takes the snapshot of the user's access from the roles as saved now.
 * Role changes made after this apply at the next sign-in. `roles` overrides the user's roles (dev page role switch).
 */
export function signIn(userId: string = ME_USER, roles?: RoleKey[], branch?: BranchKey) {
  load()
  const u = [...USERS, ...state.newUsers].find((x) => x.id === userId)
  const r = roles ?? (state.users[userId]?.roles as RoleKey[] | undefined) ?? u?.roles ?? []
  const access = accessFor(r, { ...DEFAULT_ACCESS, ...state.roleAccess })
  writeSignedIn({ user: userId, roles: r, access, at: nowStamp(), branch: branch ?? (readSignedIn()?.branch as BranchKey | undefined) ?? WORK_BRANCH })
}

/* ------------------------------------------------------------------ modules per branch */

/** Where the demo user works unless the dev page signs in elsewhere (Olaya, the main branch). */
export const WORK_BRANCH: BranchKey = "olaya"

const branchOf = (s: State, b: BranchKey): BranchModules => s.branchModules[b] ?? BRANCH_MODULES[b] ?? { hiddenModules: OFF_ALL, hiddenTabs: [] }

export function useBranchModules(): Record<BranchKey, BranchModules> {
  const bm = useSnap().branchModules
  return React.useMemo(() => ({ ...BRANCH_MODULES, ...bm }) as Record<BranchKey, BranchModules>, [bm])
}
export const useScheduled = () => useSnap().scheduled

/** Branch config the app runs with (sync read, for the gate). */
export function readBranchModules(b: BranchKey): BranchModules {
  load()
  return branchOf(state, b)
}
export { subscribe as subscribeSettings }

const without = (list: string[], x: string) => list.filter((y) => y !== x)

/** Module (or the Eyes and dental pair) on / off at a branch, now. */
export function setModuleNow(b: BranchKey, module: string, on: boolean) {
  commit((s) => {
    const cur = branchOf(s, b)
    const next: BranchModules =
      module === "eyesDental"
        ? { ...cur, hiddenTabs: on ? cur.hiddenTabs.filter((t) => t !== "patients.eyes" && t !== "patients.dental") : [...without(without(cur.hiddenTabs, "patients.eyes"), "patients.dental"), "patients.eyes", "patients.dental"] }
        : { ...cur, hiddenModules: on ? without(cur.hiddenModules, module) : [...without(cur.hiddenModules, module), module] }
    return { ...s, branchModules: { ...s.branchModules, [b]: next }, scheduled: s.scheduled.filter((x) => !(x.branch === b && x.module === module)) }
  })
}
export function scheduleOff(b: BranchKey, module: string) {
  commit((s) => ({ ...s, scheduled: [...s.scheduled.filter((x) => !(x.branch === b && x.module === module)), { branch: b, module, at: `${SET_TODAY}T${TONIGHT}` }] }))
}
export function cancelScheduled(b: BranchKey, module: string) {
  commit((s) => ({ ...s, scheduled: s.scheduled.filter((x) => !(x.branch === b && x.module === module)) }))
}
export function setTab(b: BranchKey, key: string, on: boolean) {
  commit((s) => {
    const cur = branchOf(s, b)
    return { ...s, branchModules: { ...s.branchModules, [b]: { ...cur, hiddenTabs: on ? without(cur.hiddenTabs, key) : [...without(cur.hiddenTabs, key), key] } } }
  })
}

/* ------------------------------------------------------------------ branches */

export function useBranches(): Branch[] {
  const snap = useSnap()
  return React.useMemo(
    () => [...SET_BRANCHES, ...snap.newBranches].map((b) => (snap.branches[b.key] ? { ...b, ...snap.branches[b.key] } : b)),
    [snap.branches, snap.newBranches]
  )
}
export const updateBranch = (key: BranchKey, patch: Partial<Branch>) =>
  commit((s) => ({ ...s, branches: { ...s.branches, [key]: { ...s.branches[key], ...patch } } }))
/** Add a draft branch; its modules and tabs copy another branch's, or start with Dashboard and Patients only. */
export function addBranch(b: Branch, copyModulesFrom?: BranchKey) {
  commit((s) => {
    const src = copyModulesFrom ? branchOf(s, copyModulesFrom) : { hiddenModules: OFF_ALL, hiddenTabs: ["patients.eyes", "patients.dental"] }
    return { ...s, newBranches: [...s.newBranches, b], branchModules: { ...s.branchModules, [b.key]: { hiddenModules: [...src.hiddenModules], hiddenTabs: [...src.hiddenTabs] } } }
  })
}

/* ------------------------------------------------------------------ general, numbering, formats */

export const useOrg = (): OrgIdentity => useSnap().org ?? ORG_DEFAULT
export const saveOrg = (o: OrgIdentity) => commit((s) => ({ ...s, org: o }))
/** Sync read for the app gate (lib/org). */
export function readOrg() {
  load()
  return state.org
}

export const useFormats = () => useSnap().formats
/** Save a format: it starts at the next reset (now for numbers that never reset). Returns the start day. */
export function saveFormat(key: DocKey, format: NumberFormat) {
  const from = nextReset(format.reset, SET_TODAY) ?? SET_TODAY
  commit((s) => ({ ...s, formats: { ...s.formats, [key]: { format, from } } }))
  return from
}
export function readFormats() {
  load()
  return state.formats
}

export const usePrefs = (): Prefs => ({ ...PREFS_DEFAULT, ...useSnap().prefs })
export const savePrefs = (p: Prefs) => commit((s) => ({ ...s, prefs: p }))

/* ------------------------------------------------------------------ security */

export const useSecurity = (): Security => useSnap().security ?? SECURITY_DEFAULT
export const saveSecurity = (x: Security) => commit((s) => ({ ...s, security: x }))
export function readSecurity(): Security {
  load()
  return state.security ?? SECURITY_DEFAULT
}

/** Is an IPv4 address inside a CIDR range ("10.20.1.5" in "10.20.0.0/16")? */
export function ipInRange(ip: string, range: string) {
  const [base, bitsS] = range.split("/")
  const toN = (v: string) => v.split(".").reduce((n, p) => n * 256 + Number(p), 0)
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false
  const bits = Number(bitsS ?? 32)
  const mask = bits === 0 ? 0 : 2 ** 32 - 2 ** (32 - bits)
  return (toN(ip) & mask) >>> 0 === (toN(base) & mask) >>> 0
}
/** A well-formed IPv4 range with a prefix of /8–/32. */
export const VALID_RANGE = (r: string) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.test(r) && r.split("/")[0].split(".").every((p) => Number(p) <= 255) && Number(r.split("/")[1]) >= 8 && Number(r.split("/")[1]) <= 32

/* ------------------------------------------------------------------ integrations */

/** ZATCA units with this session's renewals. */
export function useZatcaUnits(): ZatcaUnit[] {
  const certs = useSnap().certs
  return React.useMemo(() => ZATCA_UNITS.map((u) => (certs[u.unit] ? { ...u, certUntil: certs[u.unit] } : u)), [certs])
}
export const renewCert = (unit: string, until: string) => commit((s) => ({ ...s, certs: { ...s.certs, [unit]: until } }))
export const useChecked = () => useSnap().checked
export const markChecked = (ids: string[]) => {
  const at = nowStamp()
  commit((s) => ({ ...s, checked: { ...s.checked, ...Object.fromEntries(ids.map((id) => [id, at])) } }))
}

/* ------------------------------------------------------------------ notification rules */

export function useRules(): Rule[] {
  const rules = useSnap().rules
  return React.useMemo(() => RULES.map((r) => rules[r.id] ?? r), [rules])
}
export const saveRule = (r: Rule) => commit((s) => ({ ...s, rules: { ...s.rules, [r.id]: r } }))
export const useQuiet = (): QuietHours => useSnap().quiet ?? QUIET_DEFAULT
export const saveQuiet = (q: QuietHours) => commit((s) => ({ ...s, quiet: q }))

/* ------------------------------------------------------------------ plan */

export function usePlan() {
  const p = useSnap().plan
  return React.useMemo(() => {
    const id = p.id ?? PLAN.id
    return {
      id,
      billing: p.billing ?? PLAN.billing,
      def: PLANS[id],
      renews: PLAN.renews,
      sms: { used: PLAN.sms.used, quota: PLAN.sms.quota + (p.smsExtra ?? 0) },
      whatsapp: PLAN.whatsapp,
      storageGb: PLAN.storageGb,
      addons: p.addons ?? ADDONS.filter((a) => a.on).map((a) => a.id),
      invoices: [...(p.invoices ?? []), ...SUB_INVOICES],
    }
  }, [p])
}
export const savePlan = (patch: Partial<State["plan"]>) => commit((s) => ({ ...s, plan: { ...s.plan, ...patch } }))

/* ------------------------------------------------------------------ my account */

export const useAccount = (): Account => ({ ...ACCOUNT_DEFAULT, ...useSnap().account })
export const saveAccount = (a: Partial<Account>) => commit((s) => ({ ...s, account: { ...s.account, ...a } }))
