import type { Bi } from "@/lib/mock/bi"
import type { Access, ModuleGrants, PermModule, SettingsGrant } from "@/lib/permissions"

/**
 * Roles (Roles and access, design v9.0): 9 roles. Member counts are counted from the users (active accounts). Each role's
 * default access below follows the design (Reception) and how a Saudi outpatient center splits the work:
 * - Admin (IT and operations): everything, all branches. Locked so the center can never lose its last full admin.
 * - Medical director: everything, all branches; signs off (approve) across modules.
 * - Doctor: clinical work at their own branches; reads money only for their own contracts (Billing › Contracts).
 * - Nurse, Reception, Lab, Pharmacy: their desk at their own branch.
 * - Billing / Claims: money and claims across branches.
 */
export type RoleKey = string
export type RoleDef = { id: RoleKey; name: Bi; about?: Bi; locked?: boolean; copiedFrom?: RoleKey }

const bi = (en: string, ar: string): Bi => ({ en, ar })

export const ROLES: RoleDef[] = [
  { id: "admin", name: bi("Admin", "مشرف النظام"), about: bi("IT and operations: full access, all branches", "التقنية والتشغيل: صلاحيات كاملة لكل الفروع"), locked: true },
  { id: "director", name: bi("Medical director", "المدير الطبي") },
  { id: "doctor", name: bi("Doctor", "طبيب") },
  { id: "nurse", name: bi("Nurse", "تمريض") },
  { id: "reception", name: bi("Reception", "الاستقبال") },
  { id: "billing", name: bi("Billing", "الفواتير") },
  { id: "claims", name: bi("Claims", "المطالبات") },
  { id: "lab", name: bi("Lab", "المختبر") },
  { id: "pharmacy", name: bi("Pharmacy", "الصيدلية") },
]

/** Settings sections that are permissions (Overview and My account are everyone's). */
export const SETTINGS_PERMS = ["general", "branches", "plan", "users", "roles", "modules", "integrations", "security", "audit", "notifications", "numbering"] as const
export type SettingsPerm = (typeof SETTINGS_PERMS)[number]

const ALL: ModuleGrants = { view: "all", create: "all", edit: "all", approve: "all", export: "all" }
const g = (spec: string, scope: "all" | "own" = "all"): ModuleGrants => {
  // "VCEAX" → view, create, edit, approve, export. Lower case = own branch only.
  const out: ModuleGrants = {}
  const map: Record<string, keyof ModuleGrants> = { v: "view", c: "create", e: "edit", a: "approve", x: "export" }
  for (const ch of spec) {
    const k = map[ch.toLowerCase()]
    if (k) out[k] = ch === ch.toUpperCase() ? scope : "own"
  }
  return out
}
const allSettings = (): Partial<Record<SettingsPerm, SettingsGrant>> =>
  Object.fromEntries(SETTINGS_PERMS.map((s) => [s, s === "audit" ? "view" : "edit"])) as Partial<Record<SettingsPerm, SettingsGrant>>

type Modules = Access["modules"]
const full = (): Modules => Object.fromEntries(["patients", "appointments", "doctors", "clinics", "billing", "records", "lab", "messages", "reports"].map((m) => [m, { ...ALL }])) as Modules

export const DEFAULT_ACCESS: Record<RoleKey, Access> = {
  admin: { modules: full(), settings: allSettings() },
  director: { modules: full(), settings: allSettings() },
  doctor: {
    modules: {
      patients: g("VCE"),
      appointments: g("vce"),
      doctors: g("V"),
      clinics: g("V"),
      billing: g("v"),
      records: g("VCEAX"),
      lab: g("VCa"),
      messages: g("VCE"),
      reports: g("vx"),
    },
    settings: {},
  },
  nurse: {
    modules: { patients: g("VE"), appointments: g("vce"), doctors: g("V"), clinics: g("V"), records: g("vce"), lab: g("vce"), messages: g("VCE") },
    settings: {},
  },
  // Design (Reception, 14 people): Patients V C E · Appointments V C E A · Billing V + own-branch Create · Records own-branch
  // View · Lab V · Messages V C E · Reports and Settings none.
  reception: {
    modules: { patients: g("VCE"), appointments: g("VCEA"), doctors: g("V"), clinics: g("V"), billing: g("Vc"), records: g("v"), lab: g("V"), messages: g("VCE") },
    settings: {},
  },
  billing: {
    modules: { patients: g("V"), appointments: g("V"), doctors: g("V"), clinics: g("V"), billing: g("VCEaX"), reports: g("VX"), messages: g("VCE") },
    settings: { numbering: "view", plan: "view" },
  },
  claims: {
    modules: { patients: g("V"), billing: g("VCEX"), records: g("V"), reports: g("VX"), messages: g("VCE") },
    settings: {},
  },
  lab: {
    modules: { patients: g("v"), appointments: g("v"), lab: g("vceax"), records: g("v"), messages: g("VCE") },
    settings: {},
  },
  pharmacy: {
    modules: { patients: g("v"), records: g("v"), lab: g("v"), billing: g("v"), messages: g("VCE") },
    settings: {},
  },
}

export const ROW_MODULES: Exclude<PermModule, "settings">[] = ["patients", "appointments", "doctors", "clinics", "billing", "records", "lab", "messages", "reports"]
