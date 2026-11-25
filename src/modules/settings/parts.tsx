"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { Scope } from "@/lib/permissions"
import { Icon, type IconName } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { SET_NOW, SET_TODAY } from "./data"
import { useSetText } from "./frame"
import { useBranches, useRoles } from "./store"
import type { SetUser } from "./users-data"

/* ------------------------------------------------------------------ atoms */

/** Section card (Widget sets): title 18 SemiBold, optional 12 muted line, optional end slot. */
export function SetCard({ title, sub, end, className, children }: { title?: React.ReactNode; sub?: React.ReactNode; end?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 md:p-5", className)}>
      {(title || end) && (
        <header className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          {end}
        </header>
      )}
      {children}
    </section>
  )
}

/** Tinted note (info / warning / destructive) with its icon. */
export function Note({ tone = "info", icon, children, className }: { tone?: "info" | "warning" | "destructive"; icon?: IconName; children: React.ReactNode; className?: string }) {
  const ic: IconName = icon ?? (tone === "warning" ? "warning-2" : tone === "destructive" ? "lock" : "info-circle")
  return (
    <p
      role={tone === "info" ? undefined : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-[10px] p-3 text-xs leading-relaxed",
        tone === "info" && "bg-info-soft text-info-soft-foreground",
        tone === "warning" && "bg-warning-soft text-warning-soft-foreground",
        tone === "destructive" && "bg-destructive-soft text-destructive-soft-foreground",
        className
      )}
    >
      <Icon name={ic} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

/** Label / value rows: 12 muted label, 14 value, border between rows; boxed = bordered card (dialog summaries). */
export function KvRows({ rows, boxed, className }: { rows: [React.ReactNode, React.ReactNode, "warning"?][]; boxed?: boolean; className?: string }) {
  return (
    <div className={cn(boxed && "rounded-[10px] border px-3", className)}>
      {rows.map(([k, v, tone], i) => (
        <div key={i} className={cn("flex items-center gap-3 border-b last:border-b-0", boxed ? "py-2.5" : "py-4")}>
          <span className="w-[120px] shrink-0 text-xs text-muted-foreground md:w-[140px]">{k}</span>
          <span className={cn("min-w-0 flex-1 text-sm", tone === "warning" ? "text-warning-soft-foreground" : "text-foreground")}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/** Action chip (what someone can do): blue = all branches, amber = own branch only. */
export function ActionChip({ scope, children }: { scope: Scope; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs", scope === "own" ? "bg-warning-soft text-warning-soft-foreground" : "bg-info-soft text-info-soft-foreground")}>
      {children}
    </span>
  )
}

export function Initials({ user, className }: { user: Pick<SetUser, "initials">; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-primary", className)}>{user.initials}</span>
  )
}

/* ------------------------------------------------------------------ user text */

const MIN = 60_000
const toMs = (iso: string) => Date.parse(`${iso}:00Z`)

/** User labels: role line, branches, last active ("Now", "5 min ago", "Yesterday"), 2-step badge, gender for ICU selects. */
export function useUserText() {
  const x = useSetText()
  const { t, b, dates, l } = x
  const roles = useRoles()
  const branches = useBranches()
  const roleName = (id: string) => {
    const r = roles.find((y) => y.id === id)
    return r ? b(r.name) : id
  }
  const branchNames = (u: Pick<SetUser, "branches">) =>
    u.branches === "all" ? t("users.allBranches") : u.branches.map((k) => { const br = branches.find((y) => y.key === k); return br ? b(br.name) : k }).join(x.locale === "ar" ? "، " : ", ")
  /** "Doctor · cardiology", "Medical director · admin". */
  const roleLine = (u: SetUser) => [u.roles.map(roleName).join(x.locale === "ar" ? " و" : " + "), u.title ? b(u.title) : ""].filter(Boolean).join(" · ")
  const ago = (iso?: string) => {
    if (!iso) return "—"
    const m = Math.round((toMs(SET_NOW) - toMs(iso)) / MIN)
    if (m < 2) return t("time.now")
    if (m < 60) return t("time.min", { n: m })
    if (iso.slice(0, 10) === SET_TODAY) return t("time.hours", { n: Math.round(m / 60) })
    const days = Math.round((Date.parse(`${SET_TODAY}T12:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T12:00:00Z`)) / 86_400_000)
    if (days === 1) return t("time.yesterday")
    if (days < 30) return t("time.days", { n: days })
    return l(dates.short(iso))
  }
  /** "10:15" today, "24 Nov" before. */
  const stamp = (iso: string) => (iso.slice(0, 10) === SET_TODAY ? l(iso.slice(11, 16)) : l(dates.dayMonth(iso)))
  const g = (u: Pick<SetUser, "female">) => (u.female ? "f" : "m")
  const first = (u: SetUser) => b(u.name).replace(/^(Dr\. |Nurse |د\. |الممرضة |الممرض )/, "").split(" ")[0]
  /** Mid-line form ("Chrome · now · 10.20.4.17"): lower-case first letter in English. */
  const agoInline = (iso?: string) => {
    const s = ago(iso)
    return x.locale === "en" ? s.charAt(0).toLowerCase() + s.slice(1) : s
  }
  return { ...x, roleName, branchNames, roleLine, ago, agoInline, stamp, g, first }
}

/** 2-step column / chip: On (green), Off (amber), Invited (blue), Deactivated (grey). */
export function TwoStepBadge({ user }: { user: SetUser }) {
  const { t } = useSetText()
  if (user.status === "invited") return <StatusBadge tone="info">{t("users.invited")}</StatusBadge>
  if (user.status === "deactivated") return <StatusBadge tone="neutral">{t("users.deactivatedOne")}</StatusBadge>
  return user.twoStep ? <StatusBadge tone="success">{t("users.on")}</StatusBadge> : <StatusBadge tone="warning">{t("users.off")}</StatusBadge>
}

const CHIP_TONE = {
  success: "bg-success-soft text-success-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  neutral: "bg-secondary text-muted-foreground",
} as const

/** Header chip with a leading icon (User page: Active, 2-step on, Nafath linked). */
export function IconChip({ tone, icon, children }: { tone: keyof typeof CHIP_TONE; icon?: IconName; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap", CHIP_TONE[tone])}>
      {icon && <Icon name={icon} size={14} className="shrink-0" />}
      <bdi>{children}</bdi>
    </span>
  )
}
