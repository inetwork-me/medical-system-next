"use client"

import * as React from "react"

import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { BranchKey } from "./data"
import { KvRows, Note, useUserText } from "./parts"
import { addUser, nowStamp, updateUser, useBranches, useRoles, useUsers, writeAudit } from "./store"
import { CLINIC_LIST, ME_USER, type SetUser } from "./users-data"

const MOBILE = /^05\d{8}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
        {children}
      </label>
    </div>
  )
}

/**
 * Overlay · Invite a user (Invite user): name, mobile, work email, role, branches, clinic, start date, "Sign in with Nafath
 * the first time". The invite goes by SMS and email and expires in 7 days. → `invite-sent`; the person shows as Invited.
 */
export function InviteDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t, b } = useUserText()
  const roles = useRoles()
  const users = useUsers()
  const branches = useBranches()
  const [name, setName] = React.useState("")
  const [mobile, setMobile] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("")
  const [branch, setBranch] = React.useState<BranchKey | "all" | "">("")
  const [clinic, setClinic] = React.useState("none")
  const [start, setStart] = React.useState<Date | undefined>(new Date(2026, 11, 1))
  const [nafath, setNafath] = React.useState(true)
  const [tried, setTried] = React.useState(false)

  const mob = mobile.replace(/[\s-]/g, "")
  const mail = email.trim().toLowerCase()
  const errors = {
    name: name.trim().split(/\s+/).length < 2 ? t("invite.errName") : undefined,
    mobile: !MOBILE.test(mob) ? t("invite.errMobile") : undefined,
    email: !EMAIL.test(mail) ? t("invite.errEmail") : users.some((u) => u.email === mail) ? t("invite.errEmailUsed") : undefined,
    role: !role ? t("invite.errRole") : undefined,
    branch: !branch ? t("invite.errBranch") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  const send = () => {
    setTried(true)
    if (invalid) return
    const parts = name.trim().split(/\s+/)
    const c = CLINIC_LIST.find((x) => x.en === clinic)
    const u: SetUser = {
      id: `inv-${users.length + 1}`,
      initials: (parts[0][0] + (parts[parts.length - 1].replace(/^Al-/i, "")[0] ?? "")).toUpperCase(),
      name: { en: name.trim(), ar: name.trim() },
      email: mail,
      mobile: mob,
      roles: [role],
      branches: branch === "all" ? "all" : [branch as BranchKey],
      clinics: c,
      title: c ? { en: c.en.toLowerCase(), ar: c.ar } : undefined,
      status: "invited",
      twoStep: false,
      since: start ? iso(start) : "2026-12-01",
      nafath,
      invitedAt: nowStamp(),
    }
    addUser(u)
    const r = roles.find((x) => x.id === role)!
    writeAudit({ what: { en: `Invited ${u.name.en} as ${r.name.en}`, ar: `دعا ${u.name.ar} بدور ${r.name.ar}` }, where: "users" })
    toast.success(t("toasts.inviteSent"), { description: t("toasts.inviteSentText") })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("invite.title")}
      description={t("invite.sub")}
      icon="user-add"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={send}>{t("invite.send")}</Button>}
    >
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label={t("invite.name")} required error={tried ? errors.name : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("invite.namePh")} autoComplete="off" />
        </Field>
        <Field label={t("invite.mobile")} required error={tried ? errors.mobile : undefined}>
          {(c) => (
            <div className="relative" dir="ltr">
              <Icon name="call" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input {...c} dir="ltr" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05XXXXXXXX" className="ps-9 text-start" />
            </div>
          )}
        </Field>
      </div>
      <Field label={t("invite.email")} required error={tried ? errors.email : undefined}>
        {(c) => (
          <div className="relative" dir="ltr">
            <Icon name="sms" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input {...c} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@alnoor.sa" className="ps-9 text-start" />
          </div>
        )}
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label={t("invite.role")} required error={tried ? errors.role : undefined}>
          {(c) => (
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue placeholder={t("invite.pick")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {b(r.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("invite.branches")} required error={tried ? errors.branch : undefined}>
          {(c) => (
            <Select value={branch} onValueChange={(v) => setBranch(v as BranchKey | "all")}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue placeholder={t("invite.pick")} />
              </SelectTrigger>
              <SelectContent>
                {branches.map((x) => (
                  <SelectItem key={x.key} value={x.key}>
                    {b(x.name)}
                    {x.status === "draft" ? ` · ${t("invite.draft")}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="all">{t("users.allBranches")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("invite.clinic")}>
          {(c) => (
            <Select value={clinic} onValueChange={setClinic}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("invite.noClinic")}</SelectItem>
                {CLINIC_LIST.map((x) => (
                  <SelectItem key={x.en} value={x.en}>
                    {b(x)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("invite.starts")}>
          {(c) => <DatePicker {...c} value={start} onChange={setStart} placeholder={t("invite.pick")} />}
        </Field>
      </div>
      <CheckRow checked={nafath} onChange={setNafath}>
        {t("invite.nafath")}
      </CheckRow>
      <Note>{t("invite.note")}</Note>
    </ResponsiveDialog>
  )
}

/**
 * Overlay · Deactivate (Deactivate): red note (can't sign in, sessions end now), open items + access, "Move her open items
 * to" (required when there are any), remove from shared mailboxes and chats; records and signatures stay and the account
 * can be turned back on. → `user-deactivated`.
 */
export function DeactivateDialog({ user, onOpenChange }: { user: SetUser; onOpenChange: (open: boolean) => void }) {
  const x = useUserText()
  const { t, b } = x
  const users = useUsers()
  const g = x.g(user)
  const first = x.first(user)
  const [to, setTo] = React.useState("")
  const [remove, setRemove] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const items = user.openItems
  // Someone in the same role who's active (the design moves Nora's patient messages to Huda at reception).
  const takers = users.filter((u) => u.status === "active" && u.id !== user.id && u.roles.some((r) => user.roles.includes(r)))
  const lastAdmin = user.roles.includes("admin") && users.filter((u) => u.status === "active" && u.roles.includes("admin")).length <= 1
  const error = items && !to ? t("deactivate.errMove", { g }) : undefined

  const go = () => {
    setTried(true)
    if (error || lastAdmin) return
    const taker = users.find((u) => u.id === to)
    updateUser(user.id, { status: "deactivated", deactivatedAt: nowStamp(), devices: [], sharedAccess: remove ? undefined : user.sharedAccess, openItems: undefined })
    writeAudit({
      what: {
        en: `Deactivated ${user.name.en}${taker ? ` · open items moved to ${taker.name.en}` : ""}${remove ? " · removed from shared mailboxes and chats" : ""}`,
        ar: `أوقف حساب ${user.name.ar}${taker ? ` · الأشغال انتقلت لـ ${taker.name.ar}` : ""}${remove ? " · انشال من الصناديق المشتركة والمحادثات" : ""}`,
      },
      where: "users",
    })
    toast.success(t("toasts.deactivated", { name: first }), {
      description: taker ? t("toasts.deactivatedMoved", { g, to: x.first(taker) }) : t("toasts.deactivatedNoItems"),
    })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("deactivate.title", { name: first })}
      description={`${b(user.name)} · ${x.roleLine(user).toLowerCase()}`}
      icon="trash"
      tone="destructive"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={go} disabled={lastAdmin}>
          {t("deactivate.confirm")}
        </Button>
      }
    >
      {tried && error && <Note tone="destructive" icon="danger">{t("deactivate.strip")}</Note>}
      <Note tone="destructive">{t("deactivate.warn", { name: first, g })}</Note>
      {lastAdmin && <Note tone="warning">{t("deactivate.lastAdmin")}</Note>}
      <KvRows
        boxed
        rows={[
          [t("deactivate.openItems"), items ? b(items.what) : t("deactivate.noItems"), items ? "warning" : undefined],
          [t("deactivate.access"), user.sharedAccess ? b(user.sharedAccess) : t("deactivate.noShared")],
        ]}
      />
      {items && (
        <Field label={t("deactivate.moveTo", { g })} required error={tried ? error : undefined}>
          {(c) => (
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue placeholder={t("invite.pick")} />
              </SelectTrigger>
              <SelectContent>
                {takers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {b(u.name)} · {x.roleLine(u).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      <CheckRow checked={remove} onChange={setRemove}>
        {t("deactivate.remove", { g })}
      </CheckRow>
      <Note>{t("deactivate.stays", { g })}</Note>
    </ResponsiveDialog>
  )
}

type CheckMethod = "person" | "video" | "nafath"

/**
 * Overlay · Reset 2-step (Reset 2-step): person + current method, "How you checked it's her" (In person / Video call /
 * Nafath, required), warning note. → `twofa-reset`; she sets it up again at her next sign-in. The check is logged.
 */
export function ResetTwoStepDialog({ user, onOpenChange }: { user: SetUser; onOpenChange: (open: boolean) => void }) {
  const x = useUserText()
  const { t, b, dates, l } = x
  const g = x.g(user)
  const [how, setHow] = React.useState<CheckMethod | "">("")
  const [tried, setTried] = React.useState(false)
  const error = !how ? t("reset.errHow", { g }) : undefined
  const method = user.twoStep
    ? t("reset.method", { m: user.twoStepMethod === "sms" ? "sms" : "app", since: l(dates.monthYear(user.since)) })
    : t("reset.methodNone")

  const go = () => {
    setTried(true)
    if (error) return
    updateUser(user.id, { twoStep: false })
    const checked = { person: ["in person", "حضورياً"], video: ["by video call", "بمكالمة فيديو"], nafath: ["with Nafath", "بنفاذ"] }[how as CheckMethod]
    writeAudit({ what: { en: `Reset 2-step for ${user.name.en} · identity checked ${checked[0]}`, ar: `أعاد ضبط التحقق لـ ${user.name.ar} · تأكد من هويته ${checked[1]}` }, where: "users" })
    toast.success(t("toasts.twofaReset"), { description: t("toasts.twofaResetText", { name: x.first(user), g }) })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("reset.title")}
      description={b(user.name)}
      icon="shield-tick"
      tone="warning"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={go}>{t("reset.confirm")}</Button>}
    >
      {tried && error && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <KvRows
        boxed
        rows={[
          [t("reset.person"), `${b(user.name)} · ${x.roleLine(user).toLowerCase()}`],
          [t("reset.current"), method],
        ]}
      />
      <Field label={t("reset.how", { g })} required error={tried ? error : undefined}>
        {(c) => (
          <Segmented<CheckMethod | "">
            {...c}
            value={how}
            onValueChange={setHow}
            options={[
              { value: "person", label: t("reset.inPerson") },
              { value: "video", label: t("reset.video") },
              { value: "nafath", label: t("reset.nafath") },
            ]}
          />
        )}
      </Field>
      <Note tone="warning">{t("reset.warn", { g })}</Note>
    </ResponsiveDialog>
  )
}

/** You can't deactivate or reset yourself here (My account covers your own sign-in). */
export const isMe = (u: SetUser) => u.id === ME_USER
