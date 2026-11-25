import type { IconName } from "@/components/ds/icon"

/**
 * Settings sections (brief §1 · Layout): Overview, then the groups Organisation (General, Branches, Plan), People (Users,
 * Roles and access), System (Modules, Integrations, Security, Audit log, Notifications, Numbering and formats) and You
 * (My account). The same list drives the desktop menu card, the tablet tab row and the mobile Settings home.
 */
export type SectionId =
  | "overview"
  | "general"
  | "branches"
  | "plan"
  | "users"
  | "roles"
  | "modules"
  | "integrations"
  | "security"
  | "audit"
  | "notifications"
  | "numbering"
  | "account"

export type SectionGroup = "organisation" | "people" | "system" | "you"

export type SectionDef = {
  id: SectionId
  icon: IconName
  href: string
  group?: SectionGroup
  /** Form sections (General, Security, Notifications, Numbering, My account, Roles): mobile shows a fixed action bar. */
  form?: boolean
  /** Build step (brief §5) that lands the section's screen. */
  step: number
}

export const SECTIONS: SectionDef[] = [
  { id: "overview", icon: "setting-2", href: "/settings", step: 1 },
  { id: "general", icon: "buildings", href: "/settings/general", group: "organisation", form: true, step: 4 },
  { id: "branches", icon: "location", href: "/settings/branches", group: "organisation", step: 4 },
  { id: "plan", icon: "card", href: "/settings/plan", group: "organisation", step: 8 },
  { id: "users", icon: "profile-2user", href: "/settings/users", group: "people", step: 2 },
  { id: "roles", icon: "security-user", href: "/settings/roles", group: "people", form: true, step: 2 },
  { id: "modules", icon: "category", href: "/settings/modules", group: "system", step: 3 },
  { id: "integrations", icon: "link-2", href: "/settings/integrations", group: "system", step: 6 },
  { id: "security", icon: "shield-tick", href: "/settings/security", group: "system", form: true, step: 5 },
  { id: "audit", icon: "document-text", href: "/settings/audit-log", group: "system", step: 5 },
  { id: "notifications", icon: "notification", href: "/settings/notifications", group: "system", form: true, step: 7 },
  { id: "numbering", icon: "hashtag", href: "/settings/numbering", group: "system", form: true, step: 4 },
  { id: "account", icon: "profile-circle", href: "/settings/account", group: "you", form: true, step: 8 },
]

export const SECTION_GROUPS: SectionGroup[] = ["organisation", "people", "system", "you"]

export const sectionById = (id: SectionId) => SECTIONS.find((s) => s.id === id)!

/** Inner pages: they keep their list section active and go back to it (User → Users, ZATCA → Integrations). */
export type InnerPage = "user" | "zatca"
export const INNER_PARENT: Record<InnerPage, SectionId> = { user: "users", zatca: "integrations" }
