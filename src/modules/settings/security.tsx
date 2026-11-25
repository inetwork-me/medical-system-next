"use client"

import * as React from "react"

import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { canEditSection } from "./access"
import { SettingsFrame } from "./frame"
import { Note, SetCard, useUserText } from "./parts"
import { DEMO_IP, VALID_RANGE, ipInRange, saveSecurity, useRoles, useSecurity, useUsers, writeAudit, type Network, type Security } from "./store"

/** Bordered switch row (sign-in methods, sessions, admin pages). */
function SwitchRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-3 rounded-[10px] border p-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

const LABELS: Partial<Record<keyof Security, string>> = {
  nafath: "Nafath sign-in", password: "password sign-in", minLength: "password length", changeDays: "password change interval", lockout: "lockout",
  twoStepRoles: "2-step roles", idleShared: "idle sign-out on shared PCs", personalHours: "personal device sessions", oneSession: "one session on reception PCs",
  adminOnlyTrusted: "admin pages from trusted networks only",
}

/**
 * Settings · Security: Sign-in (Nafath on/off, password on/off, password length, change interval, lockout), 2-step (required
 * roles as chips + Add role; amber note for people in them still without it), Sessions (idle sign-out on shared PCs, personal
 * devices, one session on reception PCs), Trusted networks (name + range, remove, Add; "Admin pages only from trusted
 * networks"). Header: Save changes. Networks add and remove straight away.
 */
export function SecurityPage() {
  const x = useUserText()
  const { t, b, l } = x
  const saved = useSecurity()
  const roles = useRoles()
  const users = useUsers()
  const edit = canEditSection("security")
  const [f, setF] = React.useState<Security>(saved)
  const [tried, setTried] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const set = <K extends keyof Security>(k: K, v: Security[K]) => setF((o) => ({ ...o, [k]: v }))

  const missing = users.filter((u) => u.status === "active" && !u.twoStep && u.roles.some((r) => f.twoStepRoles.includes(r))).length
  const onTrusted = saved.networks.some((n) => n.admin && ipInRange(DEMO_IP, n.range))
  const errors = {
    method: !f.nafath && !f.password ? t("security.errMethod") : undefined,
    trusted: f.adminOnlyTrusted && !onTrusted ? t("security.errTrusted", { ip: l(DEMO_IP) }) : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  const save = () => {
    setTried(true)
    if (invalid) return
    const next = { ...f, networks: saved.networks }
    const changed = (Object.keys(LABELS) as (keyof Security)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(saved[k]))
    saveSecurity(next)
    if (changed.length) writeAudit({ what: { en: `Changed ${changed.map((k) => LABELS[k]).join(", ")}`, ar: `غيّر إعدادات الأمان (${changed.length})` }, where: "security" })
    toast.success(t("toasts.saved"), { description: t("toasts.savedText") })
  }

  const removeNetwork = (n: Network) => {
    // Never lock yourself out: the network you're on stays while admin pages are limited to trusted networks.
    if (saved.adminOnlyTrusted && n.admin && ipInRange(DEMO_IP, n.range) && saved.networks.filter((y) => y.admin && ipInRange(DEMO_IP, y.range)).length === 1) {
      toast.warning(t("security.keepYours"), { description: t("security.keepYoursText", { ip: l(DEMO_IP) }) })
      return
    }
    saveSecurity({ ...saved, networks: saved.networks.filter((y) => y.id !== n.id) })
    writeAudit({ what: { en: `Removed the trusted network ${n.name.en} (${n.range})`, ar: `شال الشبكة الموثوقة ${n.name.ar} (${n.range})` }, where: "security" })
    toast.info(t("toasts.removed"), { description: t("toasts.removedText") })
  }

  const sel = (k: "minLength" | "changeDays" | "idleShared" | "personalHours", opts: [number, string][], c: object) => (
    <Select value={String(f[k])} onValueChange={(v) => set(k, Number(v))} disabled={!edit || ((k === "minLength" || k === "changeDays") && !f.password)}>
      <SelectTrigger {...c} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map(([v, label]) => (
          <SelectItem key={v} value={String(v)}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  const others = roles.filter((r) => !f.twoStepRoles.includes(r.id))

  return (
    <SettingsFrame section="security" actions={edit ? <Button onClick={save}>{t("general.save")}</Button> : undefined}>
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <SetCard title={t("security.signIn")}>
        <div className="flex flex-col gap-4">
          <SwitchRow label={t("security.nafath")} hint={t("security.nafathHint")} checked={f.nafath} onChange={(v) => set("nafath", v)} disabled={!edit} />
          <SwitchRow label={t("security.password")} checked={f.password} onChange={(v) => set("password", v)} disabled={!edit} />
          {tried && errors.method && <p className="-mt-2 text-xs text-destructive">{errors.method}</p>}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            <Field label={t("security.length")}>{(c) => sel("minLength", [8, 10, 12, 14, 16].map((n) => [n, t("security.lengthN", { n })]), c)}</Field>
            <Field label={t("security.change")}>{(c) => sel("changeDays", [[90, t("security.days", { n: 90 })], [180, t("security.days", { n: 180 })], [365, t("security.days", { n: 365 })], [0, t("security.never")]], c)}</Field>
            <Field label={t("security.lockout")} className="md:col-span-2">
              {(c) => (
                <Select value={f.lockout} onValueChange={(v) => set("lockout", v as Security["lockout"])} disabled={!edit}>
                  <SelectTrigger {...c} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["3-15", "5-15", "5-30", "10-60"] as const).map((v) => {
                      const [n, m] = v.split("-").map(Number)
                      return (
                        <SelectItem key={v} value={v}>
                          {t("security.lockoutN", { n, m })}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </div>
      </SetCard>

      <SetCard title={t("security.twoStep")} sub={t("security.twoStepSub")}>
        <div className="flex flex-wrap gap-1.5">
          {f.twoStepRoles.map((id) => {
            const r = roles.find((y) => y.id === id)
            if (!r) return null
            return (
              <span key={id} className="inline-flex h-6 items-center gap-1 rounded-full bg-info-soft ps-2 pe-1 text-xs text-info-soft-foreground">
                <Icon name="shield-tick" size={14} />
                {b(r.name)}
                {edit && (
                  <button
                    type="button"
                    onClick={() => set("twoStepRoles", f.twoStepRoles.filter((y) => y !== id))}
                    aria-label={t("security.removeRole", { role: b(r.name) })}
                    className="flex size-4 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-info/15 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Icon name="close-circle" size={12} />
                  </button>
                )}
              </span>
            )
          })}
          {edit && others.length > 0 && (
            <ActionMenu
              title={t("security.addRole")}
              align="start"
              trigger={
                <button type="button" className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full bg-muted px-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
                  <Icon name="add" size={14} />
                  {t("security.addRole")}
                </button>
              }
              groups={[others.map((r) => ({ key: r.id, icon: "security-user" as const, label: b(r.name), onSelect: () => set("twoStepRoles", [...f.twoStepRoles, r.id]) }))]}
            />
          )}
        </div>
        {missing > 0 && <Note tone="warning">{t("security.missing", { n: missing })}</Note>}
      </SetCard>

      <SetCard title={t("security.sessions")}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Field label={t("security.idle")}>{(c) => sel("idleShared", [5, 10, 15, 30].map((n) => [n, t("security.idleN", { n })]), c)}</Field>
          <Field label={t("security.personal")}>{(c) => sel("personalHours", [[4, t("security.hours", { n: 4 })], [8, t("security.hours", { n: 8 })], [12, t("security.hours", { n: 12 })], [168, t("security.days", { n: 7 })]], c)}</Field>
        </div>
        <SwitchRow label={t("security.oneSession")} checked={f.oneSession} onChange={(v) => set("oneSession", v)} disabled={!edit} />
      </SetCard>

      <SetCard
        title={t("security.networks")}
        sub={t("security.networksSub")}
        end={
          edit ? (
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Icon name="add" size={16} />
              {t("security.add")}
            </Button>
          ) : undefined
        }
      >
        <ul className="flex flex-col divide-y">
          {saved.networks.map((n) => (
            <li key={n.id} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <Icon name="global" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">{b(n.name)}</span>
                <span className="text-xs text-muted-foreground">
                  {l(n.range)}
                  {!n.admin && ` · ${t("security.noAdmin")}`}
                  {ipInRange(DEMO_IP, n.range) && ` · ${t("security.youAreHere")}`}
                </span>
              </span>
              {edit && (
                <Button variant="ghost" size="icon" aria-label={t("security.remove", { name: b(n.name) })} onClick={() => removeNetwork(n)}>
                  <Icon name="trash" size={20} />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <SwitchRow label={t("security.adminOnly")} checked={f.adminOnlyTrusted} onChange={(v) => set("adminOnlyTrusted", v)} disabled={!edit} />
        {tried && errors.trusted && <p className="-mt-2 text-xs text-destructive">{errors.trusted}</p>}
      </SetCard>
      {adding && <AddNetworkDialog onOpenChange={setAdding} />}
    </SettingsFrame>
  )
}

/** Overlay · Add a trusted network: name, IPv4 range, allow admin pages from here. → `network-added`. */
function AddNetworkDialog({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const { t, l } = useUserText()
  const saved = useSecurity()
  const [name, setName] = React.useState("")
  const [range, setRange] = React.useState("")
  const [admin, setAdmin] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const id = React.useId()
  const r = range.trim()
  const errors = {
    name: !name.trim() ? t("security.errName") : undefined,
    range: !VALID_RANGE(r) ? t("security.errRange") : saved.networks.some((n) => n.range === r) ? t("security.errRangeUsed") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  const add = () => {
    setTried(true)
    if (invalid) return
    const n: Network = { id: `n-${saved.networks.length + 1}-${r}`, name: { en: name.trim(), ar: name.trim() }, range: r, admin }
    saveSecurity({ ...saved, networks: [...saved.networks, n] })
    writeAudit({ what: { en: `Added the trusted network ${n.name.en} (${r})${admin ? " · admin pages allowed" : ""}`, ar: `أضاف الشبكة الموثوقة ${n.name.ar} (${r})` }, where: "security" })
    toast.success(t("toasts.networkAdded"), { description: `${name.trim()} · ${l(r)}` })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("security.addTitle")}
      description={t("security.networksSub")}
      icon="global"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={add}>{t("security.add")}</Button>}
    >
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <Field label={t("security.name")} required error={tried ? errors.name : undefined}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("security.namePh")} autoComplete="off" />
      </Field>
      <Field label={t("security.range")} required helper={t("security.rangeHint")} error={tried ? errors.range : undefined}>
        <Input dir="ltr" className="text-start" value={range} onChange={(e) => setRange(e.target.value)} placeholder="10.50.0.0/16" />
      </Field>
      <div className="flex items-center gap-2.5">
        <Checkbox id={id} checked={admin} onCheckedChange={(v) => setAdmin(v === true)} />
        <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
          {t("security.allowAdmin")}
        </label>
      </div>
    </ResponsiveDialog>
  )
}
