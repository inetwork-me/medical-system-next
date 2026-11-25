"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { PERM_ACTIONS, type PermAction, type Scope } from "@/lib/permissions"
import { Link } from "@/i18n/navigation"
import type { ActionItem } from "@/components/ds/action-menu"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { canEditSection, accessFor } from "./access"
import { SET_BRANCHES, SET_TODAY } from "./data"
import { SettingsFrame } from "./frame"
import { ActionChip, IconChip, KvRows, SetCard, useUserText } from "./parts"
import { DeactivateDialog, ResetTwoStepDialog, isMe } from "./people-dialogs"
import { ROW_MODULES, SETTINGS_PERMS } from "./roles-data"
import { nowStamp, updateUser, useRoleAccess, useUser, writeAudit } from "./store"
import { inviteDaysLeft, resendInvite } from "./users"
import type { Device, SetUser } from "./users-data"

/** Devices for people the seed doesn't list them for: their work PC at their first branch (active accounts only). */
function devicesOf(u: SetUser): Device[] {
  if (u.devices) return u.devices
  if (u.status !== "active" || !u.lastActive) return []
  const br = (u.branches === "all" ? undefined : SET_BRANCHES.find((b) => b.key === (u.branches as string[])[0])) ?? SET_BRANCHES[0]
  return [{ id: "w1", kind: "pc", name: { en: `Work PC · ${br.name.en}`, ar: `جهاز العمل · ${br.name.ar}` }, browser: { en: "Chrome", ar: "كروم" }, ip: "10.20.6.31", at: u.lastActive }]
}

const DEVICE_ICON: Record<Device["kind"], IconName> = { pc: "monitor", phone: "mobile", tablet: "mobile" }

/**
 * Settings · User (Users ›): header card (avatar, name, role · branch · since, email; Active, 2-step, Nafath chips), Role and
 * branches (Change role → Roles), What she can do (allowed actions per module, amber = own branch), Signed in on (Sign out),
 * Recent activity. Header: Reset 2-step, Deactivate (Resend for an invite, Turn back on for a deactivated account).
 */
export function UserPage() {
  const id = useSearchParams().get("id") ?? ""
  const user = useUser(id)
  const x = useUserText()
  const { t } = x
  if (!user) {
    return (
      <SettingsFrame section="users" inner="user">
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="profile-2user"
            title={t("user.notFound")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href="/settings/users">{t("sections.users")}</Link>
              </Button>
            }
          />
        </div>
      </SettingsFrame>
    )
  }
  return <UserBody user={user} />
}

function UserBody({ user }: { user: SetUser }) {
  const x = useUserText()
  const { t, b, l, dates } = x
  const g = x.g(user)
  const edit = canEditSection("users") && !isMe(user)
  const [dialog, setDialog] = React.useState<null | "reset" | "deactivate">(null)
  const roleHref = `/settings/roles?role=${user.roles[0]}`

  const resend = () => {
    resendInvite(user)
    toast.success(t("toasts.inviteSent"), { description: t("toasts.inviteSentText") })
  }
  const turnOn = () => {
    updateUser(user.id, { status: "active", deactivatedAt: undefined })
    writeAudit({ what: { en: `Turned ${user.name.en}'s account back on`, ar: `رجّع تفعيل حساب ${user.name.ar}` }, where: "users" })
    toast.success(t("toasts.reactivated", { name: x.first(user), g }), { description: t("toasts.reactivatedText", { g }) })
  }

  const actions =
    !edit ? undefined : user.status === "active" ? (
      <>
        <Button variant="outline" onClick={() => setDialog("reset")}>
          <Icon name="shield-tick" size={20} />
          {t("user.reset")}
        </Button>
        <Button variant="outline" onClick={() => setDialog("deactivate")}>
          <Icon name="trash" size={20} />
          {t("user.deactivate")}
        </Button>
      </>
    ) : user.status === "invited" ? (
      <>
        <Button variant="outline" onClick={resend}>
          <Icon name="send-2" size={20} />
          {t("user.resend")}
        </Button>
        <Button variant="outline" onClick={() => setDialog("deactivate")}>
          <Icon name="trash" size={20} />
          {t("user.cancelInvite")}
        </Button>
      </>
    ) : (
      <Button variant="outline" onClick={turnOn}>
        <Icon name="refresh" size={20} />
        {t("user.turnOn")}
      </Button>
    )

  // Mobile ⋯ (Overlay · User actions): Reset 2-step, Change role, Deactivate.
  const menu: ActionItem[] = [
    edit && user.status === "active" && { key: "reset", icon: "shield-tick", label: t("user.reset"), onSelect: () => setDialog("reset") },
    { key: "role", icon: "security-user", label: t("user.changeRole"), href: roleHref },
    edit && user.status !== "deactivated" && { key: "off", icon: "trash", label: t("user.deactivate"), onSelect: () => setDialog("deactivate"), destructive: true },
  ].filter(Boolean) as ActionItem[]

  const sinceLine = [x.roleLine(user), user.branches === "all" ? t("users.allBranches") : t("user.branchLine", { name: x.branchNames(user) }), t("user.since", { date: l(dates.monthYear(user.since)) })].join(" · ")

  return (
    <SettingsFrame section="users" inner="user" title={b(user.name)} actions={actions} menu={menu}>
      {/* Header card */}
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:p-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-primary">{user.initials}</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-xl font-semibold text-foreground">{b(user.name)}</h2>
            <p className="text-xs text-muted-foreground">{sinceLine}</p>
            <p className="truncate text-xs text-muted-foreground">{l(user.email)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 md:justify-end">
          {user.status === "active" && (
            <IconChip tone="success" icon="tick-circle">
              {t("user.active")}
            </IconChip>
          )}
          {user.status === "invited" && <IconChip tone="info" icon="sms">{t("user.invitedLeft", { n: inviteDaysLeft(user) })}</IconChip>}
          {user.status === "deactivated" && <IconChip tone="neutral" icon="lock">{t("user.deactivatedOn", { date: l(dates.dayMonth(user.deactivatedAt ?? "")) })}</IconChip>}
          {user.status === "active" &&
            (user.twoStep ? (
              <IconChip tone="info" icon="shield-tick">
                {t("user.twoStepOn")}
              </IconChip>
            ) : (
              <IconChip tone="warning" icon="warning-2">
                {t("user.twoStepOff")}
              </IconChip>
            ))}
          {user.nafath && (
            <IconChip tone="neutral" icon="finger-scan">
              {t("user.nafath")}
            </IconChip>
          )}
        </div>
      </section>

      <SetCard
        title={t("user.roleTitle")}
        end={
          <Button variant="ghost" size="sm" asChild>
            <Link href={roleHref}>{t("user.changeRole")}</Link>
          </Button>
        }
      >
        <KvRows
          rows={[
            [t("user.role"), user.roles.map(x.roleName).join(" + ")],
            ...(user.extra?.length ? [[t("user.extra"), user.extra.map(b).join(", ")] as [string, string]] : []),
            [t("user.branches"), x.branchNames(user)],
            [t("user.clinics"), user.clinics ? b(user.clinics) : t("user.noClinic")],
          ]}
        />
      </SetCard>

      <CanDo user={user} />
      {user.status !== "invited" && <Devices user={user} />}
      <Activity user={user} />

      {dialog === "reset" && <ResetTwoStepDialog user={user} onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "deactivate" && <DeactivateDialog user={user} onOpenChange={(o) => !o && setDialog(null)} />}
    </SettingsFrame>
  )
}

/** What she can do: per module, the allowed actions as chips (amber = own branch only), from her roles as saved. */
function CanDo({ user }: { user: SetUser }) {
  const x = useUserText()
  const { t } = x
  const matrices = useRoleAccess()
  const a = accessFor(user.roles, matrices)
  const rows = ROW_MODULES.map((m) => ({ m, acts: PERM_ACTIONS.filter((act) => a.modules[m]?.[act]).map((act) => [act, a.modules[m]![act]!] as [PermAction, Scope]) })).filter((r) => r.acts.length)
  const settings = SETTINGS_PERMS.filter((s) => a.settings[s])
  const roleNames = user.roles.map(x.roleName).join(" + ")
  return (
    <SetCard title={t("user.canDo", { g: x.g(user) })} sub={t("user.canDoSub", { role: roleNames, n: user.roles.length })}>
      <div className="flex flex-col divide-y">
        {rows.map(({ m, acts }) => (
          <div key={m} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
            <span className="text-sm text-foreground md:w-40 md:shrink-0">{t(`modules.${m}`)}</span>
            <span className="flex flex-wrap gap-1.5">
              {acts.map(([act, scope]) => (
                <ActionChip key={act} scope={scope}>
                  {t(`actionsMatrix.${act}`)}
                </ActionChip>
              ))}
            </span>
          </div>
        ))}
        {settings.length > 0 && (
          <div className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
            <span className="text-sm text-foreground md:w-40 md:shrink-0">{t("modules.settings")}</span>
            <span className="flex flex-wrap gap-1.5">
              {settings.map((s) => (
                <ActionChip key={s} scope="all">
                  {t(`sections.${s}`)}
                  {a.settings[s] === "view" ? ` · ${t("roles.viewOnly")}` : ""}
                </ActionChip>
              ))}
            </span>
          </div>
        )}
        {rows.length === 0 && settings.length === 0 && <p className="py-3 text-sm text-muted-foreground">{t("user.nothing")}</p>}
      </div>
    </SetCard>
  )
}

/** Signed in on: devices with Sign out (→ `session-ended`, logged). */
function Devices({ user }: { user: SetUser }) {
  const x = useUserText()
  const { t, b, l } = x
  const list = devicesOf(user)
  const edit = canEditSection("users")
  const signOut = (d: Device) => {
    updateUser(user.id, { devices: list.filter((y) => y.id !== d.id) })
    writeAudit({ what: { en: `Signed ${user.name.en} out of ${d.name.en}`, ar: `طلّع ${user.name.ar} من ${d.name.ar}` }, where: "users" })
    toast.info(t("toasts.sessionEnded"), { description: t("toasts.sessionEndedText") })
  }
  return (
    <SetCard title={t("user.signedIn")}>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("user.noDevices")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {list.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <Icon name={DEVICE_ICON[d.kind]} size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">{b(d.name)}</span>
                <span className="text-xs text-muted-foreground">{[d.browser ? b(d.browser) : "", x.agoInline(d.at), d.ip ? l(d.ip) : d.place ? b(d.place) : ""].filter(Boolean).join(" · ")}</span>
              </span>
              {edit && (
                <Button variant="outline" size="sm" onClick={() => signOut(d)}>
                  {t("user.signOut")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SetCard>
  )
}

/** Recent activity: time (today) or date, and what happened. */
function Activity({ user }: { user: SetUser }) {
  const x = useUserText()
  const { t, b } = x
  const list =
    user.activity ??
    (user.status === "invited"
      ? [{ at: user.invitedAt ?? nowStamp(), what: { en: "Invite sent by SMS and email", ar: "انرسلت الدعوة برسالة وإيميل" } }]
      : user.lastActive
        ? [{ at: user.lastActive, what: user.nafath ? { en: "Signed in with Nafath", ar: "دخل بنفاذ" } : { en: "Signed in with password and 2-step", ar: "دخل بكلمة المرور والتحقق" } }]
        : [])
  return (
    <SetCard title={t("user.activity")}>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("user.noActivity")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...list.filter((a) => a.at.slice(0, 10) === SET_TODAY).sort((a, z) => a.at.localeCompare(z.at)), ...list.filter((a) => a.at.slice(0, 10) !== SET_TODAY).sort((a, z) => z.at.localeCompare(a.at))]
            .map((a, i) => (
              <li key={i} className="flex gap-4 text-xs">
                <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{x.stamp(a.at)}</span>
                <span className="text-foreground">{b(a.what)}</span>
              </li>
            ))}
        </ul>
      )}
    </SetCard>
  )
}
