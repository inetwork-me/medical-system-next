"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { Field } from "@/components/ds/field"
import { DatePicker } from "@/components/ds/pickers"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { shiftRange } from "../booking"
import { CLINICS_TODAY, WEEKDAYS, type BookingRules, type Clinic, type Closure, type Weekday } from "../data"
import { SwitchCard } from "../parts"
import { updateClinic } from "../store"
import { useClinicText } from "../text"
import { ClinicPage, useCurrentClinic } from "./frame"

/**
 * Clinic page · Schedule: Opening hours (per day: switch · shift chips · Add shift; Copy to all days), Booking rules
 * and Closures & holidays. Wide: hours beside a 360 column (rules, closures); tablet: hours, then rules | closures;
 * mobile: stacked. Every change applies at once and feeds the Appointments slots (see ../booking.ts).
 */
export function ClinicSchedule() {
  const c = useCurrentClinic()
  return (
    <ClinicPage>
      <div className="@container/sc">
        <div className="grid grid-cols-1 gap-4 @xl/sc:grid-cols-2 @5xl/sc:grid-cols-[minmax(0,1fr)_22.5rem] @5xl/sc:items-start @5xl/sc:gap-6">
          <Hours clinic={c} className="@xl/sc:col-span-2 @5xl/sc:col-span-1" />
          <div className="contents @5xl/sc:flex @5xl/sc:flex-col @5xl/sc:gap-6">
            <Rules clinic={c} className="@xl/sc:self-start @5xl/sc:self-stretch" />
            <Closures clinic={c} className="@xl/sc:self-start @5xl/sc:self-stretch" />
          </div>
        </div>
      </div>
    </ClinicPage>
  )
}

/* ================================================================== opening hours */

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
const TIMES = Array.from({ length: 36 }, (_, i) => 6 * 60 + i * 30) // 06:00 → 23:30
const DEFAULT_SHIFTS = ["08:00–14:00", "16:00–22:00"]
const sortShifts = (s: string[]) => [...s].sort((a, b) => shiftRange(a)[0] - shiftRange(b)[0])

function Hours({ clinic: c, className }: { clinic: Clinic; className?: string }) {
  const t = useTranslations("clinics.hours")
  const setDay = (day: Weekday, shifts: string[]) => updateClinic(c.key, (x) => ({ hours: { ...x.hours, [day]: sortShifts(shifts) } }))
  const copyAll = () => {
    const source = WEEKDAYS.find((d) => c.hours[d].length)
    if (!source) return
    const next = { ...c.hours }
    for (const d of WEEKDAYS) if (next[d].length) next[d] = [...c.hours[source]]
    updateClinic(c.key, { hours: next })
    toast.success(t("copied"), { description: t("copiedText", { day: t(`days.${source}`) }) })
  }
  return (
    <Widget
      title={t("title")}
      description={t("text")}
      className={cn("gap-2 p-4 md:p-5", className)}
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={copyAll}>
          <Icon name="copy" size={16} />
          {t("copy")}
        </Button>
      }
    >
      <ul className="flex flex-col divide-y">
        {WEEKDAYS.map((day) => {
          const shifts = c.hours[day]
          const open = shifts.length > 0
          const label = t(`days.${day}`)
          return (
            <li key={day} className="flex flex-col gap-3 py-3 @lg/widget:flex-row @lg/widget:items-center">
              <div className="flex items-center gap-2.5 @lg/widget:w-42.5 @lg/widget:shrink-0">
                <Switch checked={open} onCheckedChange={(v) => setDay(day, v ? DEFAULT_SHIFTS : [])} aria-label={t("dayToggle", { day: label })} />
                <span className={cn("text-sm font-medium", !open && "text-muted-foreground")}>{label}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {open ? (
                  <>
                    {shifts.map((s) => (
                      <span key={s} className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-card ps-2.5 pe-1 text-xs font-medium tabular-nums">
                        <Icon name="clock" size={14} className="text-muted-foreground" />
                        <bdi dir="ltr">{s}</bdi>
                        <button
                          type="button"
                          onClick={() => setDay(day, shifts.filter((x) => x !== s))}
                          aria-label={t("removeShift", { shift: s })}
                          className="flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          <Icon name="close-circle" size={14} />
                        </button>
                      </span>
                    ))}
                    <AddShift shifts={shifts} onAdd={(s) => setDay(day, [...shifts, s])} />
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">{t("closed")}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Widget>
  )
}

/** Add shift: small popover with From / To (30-min steps); overlapping shifts are refused. */
function AddShift({ shifts, onAdd }: { shifts: string[]; onAdd: (s: string) => void }) {
  const t = useTranslations("clinics.hours")
  const [open, setOpen] = React.useState(false)
  const defaults = () => {
    const last = shifts.length ? Math.max(...shifts.map((s) => shiftRange(s)[1])) : 7 * 60
    return [Math.min(last + 60, 21 * 60), Math.min(last + 4 * 60, 23 * 60 + 30)] as const
  }
  const [from, setFrom] = React.useState(() => defaults()[0])
  const [to, setTo] = React.useState(() => defaults()[1])
  const overlap = shifts.some((s) => {
    const [a, b] = shiftRange(s)
    return from < b && to > a
  })
  const add = () => {
    if (to <= from || overlap) return
    onAdd(`${fmt(from)}–${fmt(to)}`)
    setOpen(false)
  }
  const select = (value: number, set: (n: number) => void, label: string, min = 0) => (
    <Field label={label}>
      {(p) => (
        <Select value={String(value)} onValueChange={(v) => set(Number(v))}>
          <SelectTrigger {...p} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMES.filter((m) => m > min || min === 0).map((m) => (
              <SelectItem key={m} value={String(m)}>
                <bdi dir="ltr">{fmt(m)}</bdi>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) {
          const [a, z] = defaults()
          setFrom(a)
          setTo(z)
        }
        setOpen(o)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Icon name="add" size={16} />
          {t("addShift")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-3 shadow-md">
        <div className="grid grid-cols-2 gap-2">
          {select(from, setFrom, t("from"))}
          {select(to, setTo, t("to"), from)}
        </div>
        {overlap && <p className="text-xs text-destructive">{t("overlap")}</p>}
        <Button size="sm" onClick={add} disabled={to <= from || overlap}>
          {t("add")}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/* ================================================================== booking rules */

const VISIT = [10, 15, 20, 25, 30, 40, 45, 60]
const GAP = [0, 5, 10, 15]
const AHEAD = [7, 14, 30, 60, 90]

function Rules({ clinic: c, className }: { clinic: Clinic; className?: string }) {
  const t = useTranslations("clinics.rules")
  const set = (patch: Partial<BookingRules>) => updateClinic(c.key, (x) => ({ rules: { ...x.rules, ...patch } }))
  const r = c.rules
  const pick = (label: string, value: number, options: number[], text: (n: number) => string, key: keyof BookingRules) => (
    <Field label={label}>
      {(p) => (
        <Select value={String(value)} onValueChange={(v) => set({ [key]: Number(v) })}>
          <SelectTrigger {...p} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(options.includes(value) ? options : [...options, value].sort((a, b) => a - b)).map((n) => (
              <SelectItem key={n} value={String(n)}>
                {text(n)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
  return (
    <Widget title={t("title")} description={t("text")} className={cn("gap-4 p-4 md:p-5", className)}>
      <div className="grid grid-cols-2 gap-3">
        {pick(t("visit"), r.slotMin, VISIT, (n) => t("minutes", { n }), "slotMin")}
        {pick(t("gap"), r.gapMin, GAP, (n) => t("minutes", { n }), "gapMin")}
      </div>
      {pick(t("ahead"), r.maxDaysAhead, AHEAD, (n) => t("aheadValue", { n }), "maxDaysAhead")}
      <SwitchCard label={t("online")} hint={t("onlineText")} checked={r.online} onCheckedChange={(v) => set({ online: v })} />
      <SwitchCard
        label={t("walkIns")}
        hint={r.walkIns ? t("walkInsText", { n: r.walkInsPerHour }) : t("walkInsOff")}
        checked={r.walkIns}
        onCheckedChange={(v) => set({ walkIns: v })}
      />
    </Widget>
  )
}

/* ================================================================== closures */

function Closures({ clinic: c, className }: { clinic: Clinic; className?: string }) {
  const t = useTranslations("clinics.closures")
  const { b, dates } = useClinicText()
  const [adding, setAdding] = React.useState(false)
  const list = c.closures.filter((x) => x.date >= CLINICS_TODAY).sort((a, z) => a.date.localeCompare(z.date))
  return (
    <Widget
      title={t("title")}
      description={t("text")}
      className={cn("gap-2 p-4 md:p-5", className)}
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setAdding(true)}>
          <Icon name="add" size={16} />
          {t("add")}
        </Button>
      }
    >
      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {list.map((x) => (
            <li key={x.date} className="flex items-center gap-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium tabular-nums">{dates.short(x.date)}</span>
                <span className="text-xs text-muted-foreground">{b(x.reason)}</span>
              </div>
              <StatusBadge tone={x.kind === "halfDay" ? "info" : "neutral"}>{x.kind === "halfDay" ? t("halfDay") : t("holiday")}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddClosureDialog clinic={c} onOpenChange={setAdding} />}
    </Widget>
  )
}

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Add closure (not in the design; built on the DS dialog): date · reason · whole / half day. */
function AddClosureDialog({ clinic: c, onOpenChange }: { clinic: Clinic; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("clinics.closures")
  const { dates } = useClinicText()
  const [date, setDate] = React.useState<Date | undefined>()
  const [reason, setReason] = React.useState("")
  const [kind, setKind] = React.useState<Closure["kind"]>("holiday")
  const [tried, setTried] = React.useState(false)
  const iso = date ? isoOf(date) : ""
  const exists = !!iso && c.closures.some((x) => x.date === iso)
  const error = tried && !date ? t("required") : exists ? t("exists") : undefined
  const confirm = () => {
    setTried(true)
    if (!date || exists) return
    const text = reason.trim() || (kind === "halfDay" ? t("halfDay") : t("holiday"))
    updateClinic(c.key, (x) => ({ closures: [...x.closures, { date: iso, reason: { en: text, ar: text }, kind }] }))
    onOpenChange(false)
    toast.success(t("toast"), { description: t("toastText", { date: dates.short(iso) }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("dialogTitle")}
      description={t("dialogText")}
      icon="calendar-2"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={confirm}>{t("confirm")}</Button>}
    >
      <Field label={t("date")} required error={error}>
        {(p) => <DatePicker {...p} value={date} onChange={setDate} placeholder="dd/mm/yyyy" />}
      </Field>
      <Field label={t("reason")}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPh")} />
      </Field>
      <Field label={t("type")}>
        {() => (
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as Closure["kind"])} className="gap-2" aria-label={t("type")}>
            <RadioOption value="holiday" title={t("full")} />
            <RadioOption value="halfDay" title={t("half")} />
          </RadioGroup>
        )}
      </Field>
    </ResponsiveDialog>
  )
}
