"use client"

import { useTranslations } from "next-intl"

import { BRANCHES, ME, MSG_NOW, STAFF } from "./data"
import { useMsgText } from "./parts"
import { minutesSince } from "./rules"
import type { AccessLevel, Membership, RoleRule, StaffRole } from "./types"

const PERSONAL_ROLE_ORDER: StaffRole[] = ["doctor", "admin", "nurse", "reception"]

/** Words for access, people and roles on the Mail accounts screens. */
export function useAccessText() {
  const { b, dates, l, locale } = useMsgText()
  const t = useTranslations("messages")
  /** "Doctors and management" (lower: "doctors and management"). */
  const roleList = (roles: StaffRole[], lower = false) => {
    const names = PERSONAL_ROLE_ORDER.filter((r) => roles.includes(r)).map((r) => t(`roleNames.${r as "doctor" | "admin" | "nurse" | "reception"}${lower ? "L" : ""}` as "roleNames.doctor"))
    if (names.length <= 1) return names[0] ?? ""
    return t("roleNames.and", { a: names.slice(0, -1).join(locale === "ar" ? "، " : ", "), b: names.at(-1)! })
  }
  /** "02 Nov" style day + short month (access log, until). */
  const dayMonth = (iso: string) => `${iso.slice(8, 10)} ${dates.month(iso)}`
  const until = (iso: string) => `${Number(iso.slice(8, 10))} ${dates.month(iso)}`
  return {
    t,
    b,
    l,
    roleList,
    dayMonth,
    until,
    /** Lower-case level for sentences ("read only"). */
    level: (lv: AccessLevel) => t(`level.${lv}`),
    staffName: (k: string) => (STAFF[k] ? b(STAFF[k].name) : k),
    firstName: (k: string) => {
      const n = STAFF[k]?.name
      if (!n) return k
      const words = b(n).replace(/^(Dr\.|Nurse|د\.|الممرضة)\s+/, "").split(" ")
      return words[0]
    },
    /** How a person got access: "Role · cardiology doctors", "Added by IT", "Added by you". */
    how: (m: Membership, rules: RoleRule[]) => {
      if (m.via.kind === "role") {
        const rule = rules.find((r) => r.id === (m.via as { rule: string }).rule)
        const who = rule ? b(rule.who) : ""
        return t("mailbox.byRole", { who: who.charAt(0).toLowerCase() + who.slice(1) })
      }
      if (m.via.kind === "branch") return t("mailbox.byBranch", { branch: b(BRANCHES.find((x) => x.key === STAFF[m.staff]?.branch)?.name ?? BRANCHES[0].name) })
      if (m.via.by === "it") return t("mailbox.byIt")
      if (m.via.by === ME) return t(STAFF[m.staff]?.female ? "mailbox.byYouF" : "mailbox.byYou")
      return t("mailbox.byOther", { name: STAFF[m.via.by] ? b(STAFF[m.via.by].name) : m.via.by })
    },
    /** "1 min ago" / "just now" against the demo clock. */
    ago: (iso?: string) => {
      if (!iso) return "–"
      const n = minutesSince(iso, MSG_NOW)
      return n === 0 ? t("accounts.justNow") : t("accounts.minAgo", { n })
    },
  }
}
