import type { IconName } from "@/components/ds/icon"

/**
 * Module registry — the single source for every navigation surface (sidebar, rail + flyout, tablet overlay,
 * mobile bottom nav, More sheet, header title). Each module is self-contained; hiding one per branch
 * (config/branches.ts) removes it everywhere without breaking navigation (brief §5.5).
 *
 * Labels are keys in messages/{en,ar}/shell.json → "nav.<labelKey>".
 */
export type ModuleId =
  | "dashboard"
  | "patients"
  | "appointments"
  | "doctors"
  | "clinics"
  | "records"
  | "lab"
  | "billing"
  | "reports"
  | "messages"

export type NavGroup = "main" | "clinical" | "admin"

export type ModuleTab = {
  /** Key in shell.json → "tabs.<module>.<key>" */
  key: string
  href: string
  icon?: IconName
  /** Header shows "module / tab" for this tab (design: reports, payments); other tabs show "Home / module". */
  ownTitle?: boolean
}

export type ModuleDef = {
  id: ModuleId
  icon: IconName
  href: string
  group: NavGroup
  labelKey: string
  /** Shorter label for the mobile More sheet / bottom nav when the design uses one. */
  shortLabelKey?: string
  /** Module tabs: shown as the sidebar tree, the rail flyout and the in-page module tabs. */
  tabs?: ModuleTab[]
  /** Where the module sits on mobile: one of the 4 bottom-nav slots or a tile in the More sheet. */
  mobile: "bottom" | "more"
  /** Module screens exist in this build (others show a placeholder page). */
  built: boolean
  /**
   * Tabs inside the module's record page (not in the nav), hideable per branch like module tabs ("patients.eyes").
   * Hiding one removes the tab, its workspaces and every button that opens them.
   */
  recordTabs?: string[]
}

export const MODULES: ModuleDef[] = [
  { id: "dashboard", icon: "category", href: "/dashboard", group: "main", labelKey: "dashboard", shortLabelKey: "home", mobile: "bottom", built: true },
  {
    id: "patients",
    icon: "profile-2user",
    href: "/patients",
    group: "main",
    labelKey: "patients",
    mobile: "bottom",
    built: true,
    tabs: [
      { key: "list", href: "/patients", icon: "profile-2user" },
      { key: "reports", href: "/patients/reports", icon: "chart-2", ownTitle: true },
      { key: "payments", href: "/patients/payments", icon: "wallet-money", ownTitle: true },
    ],
    // Patient page specialty tabs (Eyes & Dental): optional per branch.
    recordTabs: ["eyes", "dental"],
  },
  {
    id: "appointments",
    icon: "calendar-2",
    href: "/appointments",
    group: "main",
    labelKey: "appointments",
    mobile: "bottom",
    built: true,
    tabs: [
      { key: "calendar", href: "/appointments" },
      { key: "list", href: "/appointments/list" },
      { key: "waiting", href: "/appointments/waiting-room" },
      { key: "schedules", href: "/appointments/schedules" },
      { key: "reports", href: "/appointments/reports", ownTitle: true },
    ],
  },
  {
    id: "doctors",
    icon: "people",
    href: "/doctors",
    group: "main",
    labelKey: "doctors",
    mobile: "more",
    built: true,
    tabs: [
      { key: "list", href: "/doctors" },
      { key: "credentials", href: "/doctors/credentials", ownTitle: true },
      { key: "leave", href: "/doctors/leave", ownTitle: true },
      { key: "reports", href: "/doctors/reports", ownTitle: true },
    ],
  },
  {
    id: "clinics",
    icon: "hospital",
    href: "/clinics",
    group: "main",
    labelKey: "clinics",
    mobile: "more",
    built: true,
    tabs: [
      { key: "list", href: "/clinics" },
      { key: "prices", href: "/clinics/prices", ownTitle: true },
      { key: "rooms", href: "/clinics/rooms", ownTitle: true },
      { key: "reports", href: "/clinics/reports", ownTitle: true },
    ],
  },
  // Medical records (design v6.0): opens Overview. Each tab can be hidden per branch ("records.access", …); hiding one
  // removes its tab, its count and every link into it.
  {
    id: "records",
    icon: "clipboard-text",
    href: "/records",
    group: "clinical",
    labelKey: "records",
    shortLabelKey: "recordsShort",
    mobile: "more",
    built: true,
    tabs: [
      { key: "overview", href: "/records" },
      { key: "visits", href: "/records/visits", ownTitle: true },
      { key: "notes", href: "/records/notes", ownTitle: true },
      { key: "documents", href: "/records/documents", ownTitle: true },
      { key: "requests", href: "/records/requests", ownTitle: true },
      { key: "completion", href: "/records/completion", ownTitle: true },
      { key: "access", href: "/records/access", ownTitle: true },
    ],
  },
  // Lab (design v4.9): renamed from "Lab results"; opens the Worklist.
  {
    id: "lab",
    icon: "glass",
    href: "/lab",
    group: "clinical",
    labelKey: "lab",
    shortLabelKey: "labShort",
    mobile: "more",
    built: true,
    tabs: [
      { key: "worklist", href: "/lab" },
      { key: "samples", href: "/lab/samples", ownTitle: true },
      { key: "results", href: "/lab/results", ownTitle: true },
      { key: "catalog", href: "/lab/catalog", ownTitle: true },
      { key: "reports", href: "/lab/reports", ownTitle: true },
    ],
  },
  // Billing & contracts (design v5.0): opens Overview. Each tab can be hidden per branch ("billing.claims" at a
  // cash-only branch, "billing.contracts", …); hiding one removes its tab, counts and every link into it.
  {
    id: "billing",
    icon: "receipt-2",
    href: "/billing",
    group: "admin",
    labelKey: "billing",
    mobile: "more",
    built: true,
    tabs: [
      { key: "overview", href: "/billing" },
      { key: "invoices", href: "/billing/invoices", ownTitle: true },
      { key: "claims", href: "/billing/claims", ownTitle: true },
      { key: "insurers", href: "/billing/insurers", ownTitle: true },
      { key: "contracts", href: "/billing/contracts", ownTitle: true },
    ],
  },
  // Reports (design v7.0): opens Overview. Each tab can be hidden per branch ("reports.returns", …); hiding one removes
  // its tab, its count and every link into it.
  {
    id: "reports",
    icon: "chart-2",
    href: "/reports",
    group: "admin",
    labelKey: "reports",
    mobile: "more",
    built: true,
    tabs: [
      { key: "overview", href: "/reports" },
      { key: "operations", href: "/reports/operations", ownTitle: true },
      { key: "finance", href: "/reports/finance", ownTitle: true },
      { key: "clinical", href: "/reports/clinical", ownTitle: true },
      { key: "doctors", href: "/reports/doctors", ownTitle: true },
      { key: "library", href: "/reports/library", ownTitle: true },
      { key: "schedules", href: "/reports/schedules", ownTitle: true },
      { key: "returns", href: "/reports/returns", ownTitle: true },
    ],
  },
  // Messages (design v8.0): opens Inbox. Each tab can be hidden per branch ("messages.patients", …); Mail accounts is
  // admin-only on top of that (roles.ts). Inner pages live under their tab path so the nav keeps the tab active.
  {
    id: "messages",
    icon: "message",
    href: "/messages",
    group: "admin",
    labelKey: "messages",
    mobile: "bottom",
    built: true,
    tabs: [
      { key: "inbox", href: "/messages" },
      { key: "chat", href: "/messages/chat", ownTitle: true },
      { key: "patients", href: "/messages/patients", ownTitle: true },
      { key: "partners", href: "/messages/partners", ownTitle: true },
      { key: "templates", href: "/messages/templates", ownTitle: true },
      { key: "accounts", href: "/messages/accounts", ownTitle: true },
    ],
  },
]

export const NAV_GROUPS: NavGroup[] = ["main", "clinical", "admin"]

/**
 * The modular rule (Settings › Modules per branch, brief §4): every module declares what replaces it at a branch where it's
 * off. Links into an off module go to `href` (when that module is on) or disappear; a deep link or bookmark lands on a page
 * that says what replaces it (text: shell.json → "fallback.<id>"). Dashboard and Patients are always on.
 */
export type ModuleFallback = { alwaysOn?: true; href?: string; via?: ModuleId }
export const MODULE_FALLBACKS: Record<ModuleId, ModuleFallback> = {
  dashboard: { alwaysOn: true },
  patients: { alwaysOn: true },
  // Bookings by phone only: booking controls disappear; the patient file keeps past visits.
  appointments: {},
  // Doctor lists come from Clinics (each clinic's Doctors tab), and the other way round.
  doctors: { href: "/clinics", via: "clinics" },
  clinics: { href: "/doctors", via: "doctors" },
  // Lab orders go to the send-out partner; results land in the patient file.
  lab: { href: "/patients", via: "patients" },
  // Invoices are issued by the main branch.
  billing: {},
  // Notes stay on the patient file.
  records: { href: "/patients", via: "patients" },
  // Reports come from the main branch.
  reports: {},
  // Phone and SMS only.
  messages: {},
}

/** Record tabs switched as one row in Settings (Eyes and dental). */
export const EYES_DENTAL = ["eyes", "dental"] as const

export const moduleById = (id: ModuleId) => MODULES.find((m) => m.id === id)!

/** Placeholder routes for modules that aren't built yet: /appointments, /doctors, … */
export const placeholderSlugs = () => MODULES.filter((m) => !m.built).map((m) => m.href.slice(1))
