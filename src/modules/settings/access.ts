import { sectionGrant, unionAccess, type Access, type SettingsGrant } from "@/lib/permissions"
import { DEFAULT_ACCESS, type RoleKey } from "./roles-data"
import type { SectionId } from "./sections"

/**
 * Settings access (brief intro + §4 · Roles): everything except My account is admin-only, and each section is its own
 * permission in the matrix's Settings row ("edit" or "view"). The checks read the signed-in snapshot (lib/permissions), so a
 * role change applies at the user's next sign-in.
 */
export type Grant = SettingsGrant

export const canOpenSection = (id: SectionId) => sectionGrant(id) !== null
export const canEditSection = (id: SectionId) => sectionGrant(id) === "edit"

/** Access for a set of roles from the given role matrices (the union; unknown roles add nothing). */
export function accessFor(roles: RoleKey[], matrices: Record<RoleKey, Access> = DEFAULT_ACCESS): Access {
  return unionAccess(roles.map((r) => matrices[r]).filter(Boolean))
}
