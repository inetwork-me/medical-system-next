import type { IconName } from "@/components/ds/icon"
import { MODULES } from "@/config/modules"
import { CERT_WARN_DAYS, INTEGRATION_COUNT, INTEGRATION_FACTS, PLAN, SET_TODAY, USAGE_WARN, ZATCA_UNITS, type Branch, type ZatcaUnit } from "./data"
import type { SectionId } from "./sections"
import { INVITE_DAYS, type SetUser } from "./users-data"

/**
 * Checks behind Overview's "Needs your attention" list and the amber dots (brief §2 · Overview, §4 · Integrations / Plan).
 * People checks count the live user list; the rest read the seed data until their sections land (steps 6 and 8).
 */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to.slice(0, 10)}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / 86_400_000)

/** When an invite stops working (7 days after it was sent). */
export function inviteExpires(u: Pick<SetUser, "invitedAt">) {
  if (!u.invitedAt) return undefined
  const d = new Date(`${u.invitedAt.slice(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + INVITE_DAYS)
  return d.toISOString().slice(0, 10)
}

export function userCounts(users: SetUser[]) {
  const active = users.filter((u) => u.status === "active")
  const invited = users.filter((u) => u.status === "invited")
  return {
    all: users.length,
    active: active.length,
    invited: invited.length,
    /** Invites that lapse by tomorrow. */
    invitesSoon: invited.filter((u) => daysBetween(SET_TODAY, inviteExpires(u) ?? SET_TODAY) <= 1).length,
    noTwoStep: active.filter((u) => !u.twoStep).length,
    deactivated: users.filter((u) => u.status === "deactivated").length,
  }
}

export type AttentionKind = "zatca" | "twoStep" | "invites" | "sms"
export type Attention = {
  kind: AttentionKind
  /** Section the row's button opens (rows for sections the user can't open are left out). */
  section: SectionId
  href: string
  icon: IconName
  tone: "destructive" | "warning" | "info"
  values: Record<string, string | number>
}

export function attentionItems(users: SetUser[], units: ZatcaUnit[] = ZATCA_UNITS, sms: { used: number; quota: number } = PLAN.sms): Attention[] {
  const out: Attention[] = []
  const c = userCounts(users)
  // ZATCA: the certificate closest to expiry, when it's within the warning window.
  const unit = [...units].sort((a, b) => a.certUntil.localeCompare(b.certUntil))[0]
  const days = unit ? daysBetween(SET_TODAY, unit.certUntil) : Infinity
  if (unit && days <= CERT_WARN_DAYS) {
    out.push({ kind: "zatca", section: "integrations", href: "/settings/integrations/zatca", icon: "danger", tone: "destructive", values: { days, branch: unit.branch } })
  }
  if (c.noTwoStep > 0) out.push({ kind: "twoStep", section: "users", href: "/settings/users?filter=no2fa", icon: "security-user", tone: "warning", values: { count: c.noTwoStep } })
  if (c.invited > 0) out.push({ kind: "invites", section: "users", href: "/settings/users?filter=invited", icon: "user-add", tone: "info", values: { count: c.invited, soon: c.invitesSoon } })
  // SMS usage over 80% of this month's quota (a bundle bought in Plan raises the quota).
  const share = sms.used / sms.quota
  if (share > USAGE_WARN) {
    out.push({ kind: "sms", section: "plan", href: "/settings/plan", icon: "sms", tone: "warning", values: { pct: Math.round(share * 100), used: sms.used, quota: sms.quota } })
  }
  return out
}

/** Units whose certificate is inside the warning window. */
export const expiringUnits = (units: ZatcaUnit[]) => units.filter((u) => daysBetween(SET_TODAY, u.certUntil) <= CERT_WARN_DAYS)

/** Cards that need a look: ZATCA with a certificate expiring, mada with a terminal offline. */
export function integrationWarnings(units: ZatcaUnit[] = ZATCA_UNITS) {
  return (expiringUnits(units).length ? 1 : 0) + (INTEGRATION_FACTS.mada.offline.length ? 1 : 0)
}

/** Sections with an amber dot: Users (people still without 2-step) and Integrations (a warning card). */
export function attentionDots(users: SetUser[], units: ZatcaUnit[] = ZATCA_UNITS): Partial<Record<SectionId, boolean>> {
  return { users: userCounts(users).noTwoStep > 0, integrations: integrationWarnings(units) > 0 }
}

/** Numbers for the section cards' one-line status. Eyes and dental count as one module (it's switched per branch too). */
export function sectionFacts(users: SetUser[], branches: Branch[], units: ZatcaUnit[] = ZATCA_UNITS) {
  const c = userCounts(users)
  return {
    // "3 branches · 1 opening soon": open branches, plus drafts.
    branches: branches.filter((b) => b.status !== "draft").length,
    drafts: branches.filter((b) => b.status === "draft").length,
    modules: MODULES.length + 1,
    integrations: INTEGRATION_COUNT,
    warnings: integrationWarnings(units),
    active: c.active,
    invited: c.invited,
  }
}
