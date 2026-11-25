"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { csvBlob, saveBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { canEditSection } from "./access"
import { inviteExpires, userCounts } from "./checks"
import { ORG, SET_TODAY } from "./data"
import { SettingsFrame } from "./frame"
import { Initials, SetCard, TwoStepBadge, useUserText } from "./parts"
import { InviteDialog } from "./people-dialogs"
import { nowStamp, updateUser, useUsers, writeAudit } from "./store"
import type { SetUser } from "./users-data"

export type UserFilter = "all" | "active" | "invited" | "no2fa"
const FIRST = 7
const MORE = 20

export const userHref = (id: string) => `/settings/users/user?id=${encodeURIComponent(id)}`

/** Resend an invite: a fresh 7 days from now (toast `invite-sent`, logged). */
export function resendInvite(u: SetUser) {
  updateUser(u.id, { invitedAt: nowStamp() })
  writeAudit({ what: { en: `Resent the invite to ${u.name.en}`, ar: `أعاد إرسال الدعوة لـ ${u.name.ar}` }, where: "users" })
}

/**
 * Settings · Users (Widget / Set Users): tiles (active, invited, no 2-step, deactivated), search and filter (All / Active /
 * Invited / No 2-step), the table on desktop and a list below xl, Show more (+20). Header: Export, Invite user.
 */
export function UsersPage() {
  const x = useUserText()
  const { t, b, n, l } = x
  const router = useRouter()
  const params = useSearchParams()
  const users = useUsers()
  const c = userCounts(users)
  const edit = canEditSection("users")
  const [filter, setFilter] = React.useState<UserFilter>(() => (["active", "invited", "no2fa"].includes(params.get("filter") ?? "") ? (params.get("filter") as UserFilter) : "all"))
  const [q, setQ] = React.useState("")
  const [shown, setShown] = React.useState(FIRST)
  const [invite, setInvite] = React.useState(false)

  const words = q.trim().toLowerCase().replace(/\s+/g, "")
  const rows = users.filter((u) => {
    if (filter === "active" && u.status !== "active") return false
    if (filter === "invited" && u.status !== "invited") return false
    if (filter === "no2fa" && !(u.status === "active" && !u.twoStep)) return false
    if (!words) return true
    return [u.name.en, u.name.ar, u.email, u.mobile].join(" ").toLowerCase().replace(/\s+/g, "").includes(words)
  })
  const visible = rows.slice(0, shown)

  const pick = (f: UserFilter) => {
    setFilter(f)
    setShown(FIRST)
    router.replace(f === "all" ? "/settings/users" : `/settings/users?filter=${f}`, { scroll: false })
  }
  const exportRows = () => {
    const head = ["Name", "Email", "Mobile", "Role", "Branches", "2-step", "Status", "Last active"]
    const body = rows.map((u) => [u.name.en, u.email, u.mobile, u.roles.join(" + ") + (u.title ? ` · ${u.title.en}` : ""), u.branches === "all" ? "All branches" : u.branches.join(", "), u.twoStep ? "On" : "Off", u.status, u.lastActive ?? ""])
    saveBlob(csvBlob(head, body), `users-${SET_TODAY}.csv`)
    writeAudit({ kind: "export", what: { en: `Exported ${rows.length} users`, ar: `صدّر ${rows.length} مستخدم` }, where: "users" })
    toast.info(t("toasts.exported"), { description: t("toasts.exportedText") })
  }
  const more = () => {
    const add = Math.min(MORE, rows.length - shown)
    setShown((s) => s + MORE)
    toast.info(t("toasts.moreLoaded", { n: add }), { description: t("toasts.moreLoadedText") })
  }
  const resend = (u: SetUser) => {
    resendInvite(u)
    toast.success(t("toasts.inviteSent"), { description: t("toasts.inviteSentText") })
  }

  const filters: { value: UserFilter; label: string }[] = [
    { value: "all", label: t("users.filterAll", { n: n(c.all) }) },
    { value: "active", label: t("users.filterActive", { n: n(c.active) }) },
    { value: "invited", label: t("users.filterInvited", { n: n(c.invited) }) },
    { value: "no2fa", label: t("users.filterNo2fa", { n: n(c.noTwoStep) }) },
  ]

  return (
    <SettingsFrame
      section="users"
      actions={
        <>
          <Button variant="outline" onClick={exportRows}>
            <Icon name="export" size={20} />
            {t("users.export")}
          </Button>
          {edit && (
            <Button onClick={() => setInvite(true)}>
              <Icon name="user-add" size={20} />
              {t("users.invite")}
            </Button>
          )}
        </>
      }
    >
      <SetCard title={t("users.title")} sub={t("users.sub", { org: b(ORG.short) })}>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Tile label={t("users.active")} value={n(c.active)} />
          <Tile label={t("users.invitedTile")} value={n(c.invited)} hint={c.invitesSoon ? t("users.invitesSoon", { n: c.invitesSoon }) : undefined} />
          <Tile label={t("users.no2fa")} value={n(c.noTwoStep)} hint={c.noTwoStep ? t("users.no2faHint") : undefined} warn />
          <Tile label={t("users.deactivated")} value={n(c.deactivated)} />
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative xl:w-60">
            <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setShown(FIRST)
              }}
              placeholder={t("users.search")}
              aria-label={t("users.search")}
              className="ps-9"
            />
          </div>
          {/* Desktop: all four; below xl the design keeps three (No 2-step shows when it's the active filter). */}
          <Segmented size="sm" value={filter} onValueChange={pick} options={filters} aria-label={t("users.filterLabel")} className="hidden xl:inline-flex" />
          <Segmented
            value={filter}
            onValueChange={pick}
            options={filters.filter((f) => f.value !== "no2fa" || filter === "no2fa")}
            aria-label={t("users.filterLabel")}
            className="w-full xl:hidden"
          />
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("users.none")}</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border xl:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-[34%] px-4 py-3 text-start font-normal">{t("users.colUser")}</th>
                    <th className="w-[22%] px-3 py-3 text-start font-normal">{t("users.colRole")}</th>
                    <th className="w-[15%] px-3 py-3 text-start font-normal">{t("users.colBranches")}</th>
                    <th className="w-[10%] px-3 py-3 text-start font-normal">{t("users.col2fa")}</th>
                    <th className="w-[13%] px-3 py-3 text-start font-normal">{t("users.colLast")}</th>
                    <th className="w-[112px] px-4 py-3">
                      <span className="sr-only">{t("users.colActions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => (
                    <tr key={u.id} className={cn("border-t", u.status === "deactivated" && "text-muted-foreground")}>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Initials user={u} />
                          <div className="flex min-w-0 flex-col">
                            <Link href={userHref(u.id)} className="truncate font-medium text-foreground hover:underline">
                              {b(u.name)}
                            </Link>
                            <span className="truncate text-xs text-muted-foreground">{l(u.email)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">{x.roleLine(u)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{x.branchNames(u)}</td>
                      <td className="px-3 py-3">
                        <TwoStepBadge user={u} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                        {u.status === "invited" ? t("users.invitedAgo", { when: x.ago(u.invitedAt) }) : x.ago(u.lastActive)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {u.status === "invited" && edit ? (
                          <Button variant="outline" size="sm" onClick={() => resend(u)}>
                            {t("users.resend")}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={userHref(u.id)}>{t("users.open")}</Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tablet / mobile list */}
            <ul className="flex flex-col divide-y xl:hidden">
              {visible.map((u) => (
                <li key={u.id}>
                  <Link href={userHref(u.id)} className="flex items-center gap-3 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <Initials user={u} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-foreground">{b(u.name)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {x.roleLine(u)} · {x.branchNames(u)}
                      </span>
                      {u.status === "invited" ? (
                        <StatusBadge tone="info" className="mt-1 w-fit">
                          {t("users.invited")}
                        </StatusBadge>
                      ) : u.status === "deactivated" ? (
                        <StatusBadge tone="neutral" className="mt-1 w-fit">
                          {t("users.deactivatedOne")}
                        </StatusBadge>
                      ) : (
                        !u.twoStep && (
                          <StatusBadge tone="warning" className="mt-1 w-fit">
                            {t("users.no2faBadge")}
                          </StatusBadge>
                        )
                      )}
                    </span>
                    <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 max-xl:flex-col xl:justify-between">
              <p className="hidden text-xs text-muted-foreground xl:block">{t("users.showing", { shown: n(visible.length), total: n(rows.length) })}</p>
              {shown < rows.length && (
                <Button variant="outline" onClick={more} className="max-xl:w-full">
                  {t("users.showMore")}
                </Button>
              )}
            </div>
          </>
        )}
      </SetCard>
      {invite && <InviteDialog onOpenChange={setInvite} />}
    </SettingsFrame>
  )
}

function Tile({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/70 px-3 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
      {hint && <span className={cn("text-xs", warn ? "text-warning" : "text-muted-foreground")}>{hint}</span>}
    </div>
  )
}

/** Days left on an invite (for the User page). */
export function inviteDaysLeft(u: SetUser) {
  const e = inviteExpires(u)
  if (!e) return 0
  return Math.max(0, Math.round((Date.parse(`${e}T12:00:00Z`) - Date.parse(`${SET_TODAY}T12:00:00Z`)) / 86_400_000))
}
