"use client"

import * as React from "react"

import { Link } from "@/i18n/navigation"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { org } from "@/lib/org"
import { canEditSection } from "./access"
import { CITIES, type Branch, type BranchModules, type FridayRule } from "./data"
import { SettingsFrame } from "./frame"
import { Note, SetCard, useUserText } from "./parts"
import { addBranch, updateBranch, useBranches, useBranchModules, useUsers, writeAudit } from "./store"

/** The 11 rows of Modules per branch (Eyes and dental counts as one). */
const MODULE_ROWS = ["dashboard", "patients", "appointments", "doctors", "clinics", "lab", "billing", "records", "reports", "messages"]
export function modulesOn(cfg?: BranchModules) {
  if (!cfg) return 0
  const eyes = !cfg.hiddenTabs.includes("patients.eyes") || !cfg.hiddenTabs.includes("patients.dental")
  return MODULE_ROWS.filter((m) => !cfg.hiddenModules.includes(m)).length + (eyes ? 1 : 0)
}

/** Times for Opens / Closes (every half hour, 06:00–24:00). */
const TIMES = Array.from({ length: 37 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`)

const PHONE = /^(01\d{8}|05\d{8}|9200\d{5})$/

/**
 * Settings · Branches: columns branch + address, hours today, modules on (n / 11), staff, status (Open, Draft), Modules
 * (→ Modules per branch for that branch), Edit. Below xl a list; a row opens Edit. Header: Add branch.
 */
export function BranchesPage() {
  const x = useUserText()
  const { t, b, l, dates } = x
  const branches = useBranches()
  const modules = useBranchModules()
  const users = useUsers()
  const edit = canEditSection("branches")
  const [adding, setAdding] = React.useState(false)
  const [editing, setEditing] = React.useState<Branch | null>(null)
  const main = org().mainBranch

  // Staff: active people by home branch (people across all branches count at the main branch).
  const staff = (key: string) => users.filter((u) => u.status === "active" && (u.branches === "all" ? main : u.branches[0]) === key).length
  // Today is a Wednesday: Saturday–Thursday hours.
  const hours = (br: Branch) => (br.opens && br.closes && br.status === "open" ? l(`${br.opens}–${br.closes}`) : "—")
  const where = (br: Branch) => (br.status === "draft" && br.opening ? t("branches.opening", { date: l(dates.monthYear(br.opening)) }) : `${b(br.address)} · ${b(br.city)}`)
  const badge = (br: Branch) =>
    br.status === "open" ? <StatusBadge tone="success">{t("branches.open")}</StatusBadge> : br.status === "draft" ? <StatusBadge tone="neutral">{t("branches.draft")}</StatusBadge> : <StatusBadge tone="neutral">{t("branches.closed")}</StatusBadge>

  return (
    <SettingsFrame
      section="branches"
      actions={
        edit ? (
          <Button onClick={() => setAdding(true)}>
            <Icon name="add" size={20} />
            {t("branches.add")}
          </Button>
        ) : undefined
      }
    >
      <SetCard title={t("branches.title")} sub={t("branches.sub")}>
        <div className="hidden overflow-hidden rounded-lg border xl:block">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="w-[32%] px-4 py-3 text-start font-normal">{t("branches.colBranch")}</th>
                <th className="w-[16%] px-3 py-3 text-start font-normal">{t("branches.colHours")}</th>
                <th className="w-[13%] px-3 py-3 text-start font-normal">{t("branches.colModules")}</th>
                <th className="w-[9%] px-3 py-3 text-start font-normal">{t("branches.colStaff")}</th>
                <th className="w-[12%] px-3 py-3 text-start font-normal">{t("branches.colStatus")}</th>
                <th className="px-4 py-3">
                  <span className="sr-only">{t("users.colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {branches.map((br) => (
                <tr key={br.key} className="border-t">
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-foreground">{b(br.name)}</span>
                      <span className="text-xs text-muted-foreground">{where(br)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-foreground tabular-nums">{hours(br)}</td>
                  <td className="px-3 py-2.5 text-foreground tabular-nums">{l(`${modulesOn(modules[br.key])} / 11`)}</td>
                  <td className="px-3 py-2.5 text-foreground tabular-nums">{staff(br.key)}</td>
                  <td className="px-3 py-2.5">{badge(br)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/settings/modules?branch=${br.key}`}>{t("sections.modules")}</Link>
                      </Button>
                      {edit && (
                        <Button variant="outline" size="sm" onClick={() => setEditing(br)}>
                          {t("branches.edit")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="flex flex-col divide-y xl:hidden">
          {branches.map((br) => (
            <li key={br.key}>
              <button
                type="button"
                disabled={!edit}
                onClick={() => setEditing(br)}
                className="flex w-full cursor-pointer items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                  <Icon name="location" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">{b(br.name)}</span>
                  <span className="text-xs text-muted-foreground">
                    {where(br)} · {t("branches.staff", { n: staff(br.key) })}
                  </span>
                  {badge(br)}
                </span>
                {edit && <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      </SetCard>
      {adding && <AddBranchDialog onOpenChange={setAdding} />}
      {editing && <EditBranchDialog branch={editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </SettingsFrame>
  )
}

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

function CitySelect({ value, onChange, ...c }: { value: string; onChange: (v: string) => void }) {
  const { b, t } = useUserText()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger {...c} className="w-full">
        <SelectValue placeholder={t("invite.pick")} />
      </SelectTrigger>
      <SelectContent>
        {CITIES.map((c) => (
          <SelectItem key={c.en} value={c.en}>
            {b(c)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Overlay · Add a branch: name, city, address, phone, copy hours from, "Copy modules and tabs from Olaya". It stays a draft
 * patients don't see until it's opened. → `branch-added`.
 */
function AddBranchDialog({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const x = useUserText()
  const { t, b } = x
  const branches = useBranches()
  const main = branches.find((y) => y.key === org().mainBranch) ?? branches[0]
  const [name, setName] = React.useState("")
  const [city, setCity] = React.useState("Riyadh")
  const [address, setAddress] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [hoursFrom, setHoursFrom] = React.useState(main.key)
  const [copy, setCopy] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const clean = name.trim()
  const key = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const errors = {
    name: !clean ? t("branches.errName") : branches.some((y) => y.name.en.toLowerCase() === clean.toLowerCase() || y.name.ar === clean || y.key === key) ? t("branches.errNameUsed") : undefined,
    phone: phone && !PHONE.test(phone.replace(/[\s-]/g, "")) ? t("branches.errPhone") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  const save = () => {
    setTried(true)
    if (invalid) return
    const src = branches.find((y) => y.key === hoursFrom)
    const c = CITIES.find((y) => y.en === city)!
    const br: Branch = {
      key: key || `branch-${branches.length + 1}`,
      name: { en: clean, ar: clean },
      city: c,
      address: { en: address.trim(), ar: address.trim() },
      phone: phone.replace(/[\s-]/g, ""),
      status: "draft",
      opens: src?.opens,
      closes: src?.closes,
      friday: src?.friday ?? "closed",
      booking: false,
    }
    addBranch(br, copy ? main.key : undefined)
    writeAudit({ what: { en: `Added the branch ${clean} (draft)${copy ? ` · modules copied from ${main.name.en}` : ""}`, ar: `أضاف فرع ${clean} (مسودة)` }, where: "branches" })
    toast.success(t("toasts.branchAdded"), { description: t("toasts.branchAddedText", { name: clean }) })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("branches.addTitle")}
      description={t("branches.addSub")}
      icon="location"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("branches.saveDraft")}</Button>}
    >
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label={t("branches.name")} required error={tried ? errors.name : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("branches.namePh")} autoComplete="off" />
        </Field>
        <Field label={t("branches.city")} required>
          {(c) => <CitySelect {...c} value={city} onChange={setCity} />}
        </Field>
      </div>
      <Field label={t("branches.address")}>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("branches.addressPh")} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label={t("branches.phone")} error={tried ? errors.phone : undefined}>
          {(c) => (
            <div className="relative" dir="ltr">
              <Icon name="call" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input {...c} dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="011XXXXXXX" className="ps-9 text-start" />
            </div>
          )}
        </Field>
        <Field label={t("branches.hoursFrom")}>
          {(c) => (
            <Select value={hoursFrom} onValueChange={setHoursFrom}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches
                  .filter((y) => y.opens)
                  .map((y) => (
                    <SelectItem key={y.key} value={y.key}>
                      {b(y.name)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <CheckRow checked={copy} onChange={setCopy}>
        {t("branches.copyModules", { branch: b(main.name) })}
      </CheckRow>
      <Note>{t("branches.draftNote")}</Note>
    </ResponsiveDialog>
  )
}

/**
 * Overlay · Edit branch: name, city, opens, closes, Fridays (Closed / Evening only / Open), show on patient booking; a draft
 * can be opened here. Amber note: new hours start tomorrow and bookings outside them are flagged for reception. → `branch-saved`.
 */
function EditBranchDialog({ branch, onOpenChange }: { branch: Branch; onOpenChange: (o: boolean) => void }) {
  const x = useUserText()
  const { t, b, locale } = x
  const branches = useBranches()
  const lang = locale === "ar" ? "ar" : "en"
  const [name, setName] = React.useState(branch.name[lang])
  const [city, setCity] = React.useState(branch.city.en)
  const [opens, setOpens] = React.useState(branch.opens ?? "")
  const [closes, setCloses] = React.useState(branch.closes ?? "")
  const [friday, setFriday] = React.useState<FridayRule>(branch.friday)
  const [booking, setBooking] = React.useState(branch.booking)
  const [status, setStatus] = React.useState(branch.status)
  const [tried, setTried] = React.useState(false)
  const clean = name.trim()
  const needHours = status === "open"
  const errors = {
    name: !clean ? t("branches.errName") : branches.some((y) => y.key !== branch.key && (y.name.en.toLowerCase() === clean.toLowerCase() || y.name.ar === clean)) ? t("branches.errNameUsed") : undefined,
    opens: needHours && !opens ? t("branches.errOpens") : undefined,
    closes: needHours && !closes ? t("branches.errCloses") : opens && closes && closes <= opens ? t("branches.errOrder") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const hoursChanged = opens !== (branch.opens ?? "") || closes !== (branch.closes ?? "") || friday !== branch.friday

  const save = () => {
    setTried(true)
    if (invalid) return
    updateBranch(branch.key, {
      name: { ...branch.name, [lang]: clean },
      city: CITIES.find((y) => y.en === city)!,
      opens: opens || undefined,
      closes: closes || undefined,
      friday,
      booking,
      status,
    })
    const parts = [
      hoursChanged && `hours ${opens || "—"}–${closes || "—"}, Fridays ${friday}`,
      booking !== branch.booking && (booking ? "shown on patient booking" : "hidden from patient booking"),
      status !== branch.status && `status ${status}`,
    ].filter(Boolean)
    writeAudit({ what: { en: `Changed the ${branch.name.en} branch${parts.length ? `: ${parts.join(", ")}` : ""}`, ar: `عدّل فرع ${branch.name.ar}` }, where: "branches" })
    toast.success(t("toasts.branchSaved"), {
      description: status === "open" && branch.status === "draft" ? t("toasts.branchOpened", { name: clean }) : hoursChanged ? t("toasts.branchSavedText", { name: clean }) : clean,
    })
    onOpenChange(false)
  }

  const timeSelect = (value: string, onChange: (v: string) => void, c: object) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger {...c} className="w-full">
        <SelectValue placeholder={t("invite.pick")} />
      </SelectTrigger>
      <SelectContent>
        {TIMES.map((tm) => (
          <SelectItem key={tm} value={tm}>
            {tm}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("branches.editTitle")}
      description={`${b(branch.name)} · ${b(branch.city)}`}
      icon="location"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("branches.save")}</Button>}
    >
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label={t("branches.name")} required error={tried ? errors.name : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("branches.city")} required>
          {(c) => <CitySelect {...c} value={city} onChange={setCity} />}
        </Field>
        <Field label={t("branches.opens")} required={needHours} error={tried ? errors.opens : undefined}>
          {(c) => timeSelect(opens, setOpens, c)}
        </Field>
        <Field label={t("branches.closes")} required={needHours} error={tried ? errors.closes : undefined}>
          {(c) => timeSelect(closes, setCloses, c)}
        </Field>
      </div>
      <Field label={t("branches.fridays")}>
        {(c) => (
          <Segmented<FridayRule>
            {...c}
            value={friday}
            onValueChange={setFriday}
            options={[
              { value: "closed", label: t("branches.friClosed") },
              { value: "evening", label: t("branches.friEvening") },
              { value: "open", label: t("branches.friOpen") },
            ]}
          />
        )}
      </Field>
      {branch.status === "draft" && (
        <Field label={t("branches.status")}>
          {(c) => (
            <Segmented
              {...c}
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "draft", label: t("branches.draft") },
                { value: "open", label: t("branches.open") },
              ]}
            />
          )}
        </Field>
      )}
      <CheckRow checked={booking} onChange={setBooking}>
        {t("branches.booking")}
      </CheckRow>
      <Note tone="warning">{t("branches.hoursNote")}</Note>
    </ResponsiveDialog>
  )
}
