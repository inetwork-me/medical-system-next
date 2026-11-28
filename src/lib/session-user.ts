import type { CurrentUser } from "@/lib/api/types"
import { SESSION_USER } from "@/lib/mock/shell"
import type { Bi } from "@/lib/mock/bi"
import { ROLES } from "@/modules/settings/roles-data"

/** What the app shell shows about the signed-in user (same shape as the design's sample user). */
export type SessionUser = typeof SESSION_USER

const same = (v: string): Bi => ({ en: v, ar: v })

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0]?.toUpperCase() ?? "")
    .join("")

/** First word of the name for greetings. */
const shortNameOf = (name: string) => name.split(/\s+/).filter(Boolean)[0] ?? name

/** The role's display name from the roles screen (en and ar); an unknown role shows its own name. */
function roleLabel(roles: string[]): Bi {
  const known = roles.map((r) => ROLES.find((d) => d.id === r)?.name ?? same(r))
  return { en: known.map((r) => r.en).join(", "), ar: known.map((r) => r.ar).join("، ") }
}

/** API answer → the shell's user. The tenant name is the facility; the branch comes in both languages. */
export function toSessionUser(cur: CurrentUser): SessionUser {
  const { user, tenant, branch } = cur
  return {
    initials: initialsOf(user.name),
    name: same(user.name),
    shortName: same(shortNameOf(user.name)),
    role: roleLabel(user.roles),
    facility: same(tenant.name),
    branch: branch ? { en: branch.name_en, ar: branch.name_ar } : same(""),
    email: user.email ?? "",
  }
}
