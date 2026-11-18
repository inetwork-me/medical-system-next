"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { notify } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { SwitchCard } from "@/modules/clinics/parts"
import { useClinics } from "@/modules/clinics/store"
import { WEEKDAYS, type Doctor, type DoctorBooking, type Shift, type Weekday } from "../data"
import { updateDoctor } from "../store"
import { ltr, useDoctorText } from "../text"
import { DoctorPage, useCurrentDoctor } from "./frame"
import { LeaveCard, shiftHours } from "./overview"

/**
 * Doctor page · Schedule: Weekly hours (per day: switch · shift chips · clinic/room · booked; Fri/Sat off), Booking
 * settings and Leave. Wide: hours beside a 360 column (booking settings, leave); tablet: hours, then settings | leave;
 * mobile: stacked. Everything feeds the Appointments slots (../booking.ts).
 */
export function DoctorSchedule() {
  const d = useCurrentDoctor()
  return (
    <DoctorPage>
      <div className="@container/sc">
        <div className="grid grid-cols-1 gap-4 @xl/sc:grid-cols-2 @5xl/sc:grid-cols-[minmax(0,1fr)_22.5rem] @5xl/sc:items-start @5xl/sc:gap-6">
          <WeekHours doctor={d} className="@xl/sc:col-span-2 @5xl/sc:col-span-1" />
          <div className="contents @5xl/sc:flex @5xl/sc:flex-col @5xl/sc:gap-6">
            <BookingSettings doctor={d} className="@xl/sc:self-start @5xl/sc:self-stretch" />
            <LeaveCard doctor={d} className="@xl/sc:self-start @5xl/sc:self-stretch" />
          </div>
        </div>
      </div>
    </DoctorPage>
  )
}

/* ================================================================== weekly hours */

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
const TIMES = Array.from({ length: 36 }, (_, i) => 6 * 60 + i * 30) // 06:00 → 23:30
const DEFAULT_DAY: Shift[] = [{ from: "08:00", to: "16:00" }]
const sortShifts = (s: Shift[]) => [...s].sort((a, b) => mins(a.from) - mins(b.from))
const totalHours = (week: Record<Weekday, Shift[]>) => WEEKDAYS.reduce((n, w) => n + week[w].reduce((m, s) => m + shiftHours(s), 0), 0)

/**
 * Widget / Doctor Week Hours. Day switches apply at once. Edit hours (no overlay in the design — the user chose the
 * Clinics hours editor pattern) turns the card into an editor: remove a shift, + Add shift (from / to, telehealth),
 * Copy to all days; Save hours or Cancel.
 */
function WeekHours({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.hours")
  const { clinicName } = useDoctorText()
  const [draft, setDraft] = React.useState<Record<Weekday, Shift[]> | null>(null)
  const last = React.useRef<Partial<Record<Weekday, Shift[]>>>({})
  const week = draft ?? d.week
  const editing = !!draft

  const setDay = (day: Weekday, shifts: Shift[]) => {
    const next = { ...week, [day]: sortShifts(shifts) }
    if (editing) setDraft(next)
    else updateDoctor(d.key, { week: next })
  }
  const toggle = (day: Weekday, on: boolean) => {
    if (!on) last.current[day] = week[day]
    setDay(day, on ? (last.current[day]?.length ? last.current[day]! : DEFAULT_DAY) : [])
    if (!editing) {
      const name = t(`days.${day}`)
      notify.success(on ? t("dayOn", { day: name }) : t("dayOff", { day: name }), { description: on ? t("dayOnText", { day: name }) : t("dayOffText", { day: name }) })
    }
  }
  const copyAll = () => {
    if (!draft) return
    const source = WEEKDAYS.find((w) => draft[w].length)
    if (!source) return
    const next = { ...draft }
    for (const w of WEEKDAYS) if (next[w].length) next[w] = [...draft[source]]
    setDraft(next)
    notify.success(t("copied"), { description: t("copiedText", { day: t(`days.${source}`) }) })
  }
  const save = () => {
    if (!draft) return
    updateDoctor(d.key, { week: draft })
    setDraft(null)
    notify.success(t("saved"), { description: t("savedText") })
  }

  return (
    <Widget
      title={t("title")}
      description={t("text", { h: totalHours(week) })}
      className={cn("gap-2 p-4 md:p-5", className)}
      action={
        editing ? (
          <div className="-me-2 flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={copyAll}>
              <Icon name="copy" size={16} />
              <span className="hidden @lg/widget:inline">{t("copy")}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={save}>
              {t("save")}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setDraft({ ...d.week })}>
            <Icon name="edit-2" size={16} />
            {t("edit")}
          </Button>
        )
      }
    >
      <ul className="flex flex-col divide-y">
        {WEEKDAYS.map((day) => {
          const shifts = week[day]
          const open = shifts.length > 0
          const label = t(`days.${day}`)
          const tele = shifts.some((s) => s.telehealth)
          const booked = open && d.booked[day] > 0 && <span className="text-xs text-muted-foreground tabular-nums">{t("booked", { n: d.booked[day] })}</span>
          return (
            <li key={day} className="flex flex-col gap-2 py-3 @lg/widget:flex-row @lg/widget:items-center @lg/widget:gap-3">
              <div className="flex items-center gap-2.5 @lg/widget:w-37.5 @lg/widget:shrink-0">
                <Switch checked={open} onCheckedChange={(v) => toggle(day, v)} aria-label={t("dayToggle", { day: label })} />
                <span className={cn("flex-1 text-sm font-medium", !open && "text-muted-foreground")}>{label}</span>
                <span className="@lg/widget:hidden">{booked}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {open ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {shifts.map((s) => {
                        const range = `${s.from}–${s.to}`
                        return (
                          <span
                            key={range}
                            className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg border bg-card ps-2.5 text-xs font-medium tabular-nums", editing ? "pe-1" : "pe-2.5")}
                          >
                            <Icon name="clock" size={14} className="text-muted-foreground" />
                            <bdi dir="ltr">{range}</bdi>
                            {editing && (
                              <button
                                type="button"
                                onClick={() => setDay(day, shifts.filter((x) => x !== s))}
                                aria-label={t("removeShift", { shift: range })}
                                className="flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              >
                                <Icon name="close-circle" size={14} />
                              </button>
                            )}
                          </span>
                        )
                      })}
                      {editing && <AddShift shifts={shifts} onAdd={(s) => setDay(day, [...shifts, s])} />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {ltr(t("where", { clinic: clinicName(d.clinic), room: d.room }))}
                      {tele && t("plusTele")}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">{t("off")}</span>
                )}
              </div>
              <div className="hidden w-27.5 shrink-0 text-end @lg/widget:block">{booked}</div>
            </li>
          )
        })}
      </ul>
    </Widget>
  )
}

/** Add shift: popover with From / To (30-min steps) and a telehealth switch; overlapping shifts are refused. */
function AddShift({ shifts, onAdd }: { shifts: Shift[]; onAdd: (s: Shift) => void }) {
  const t = useTranslations("doctors.hours")
  const [open, setOpen] = React.useState(false)
  const defaults = () => {
    const end = shifts.length ? Math.max(...shifts.map((s) => mins(s.to))) : 7 * 60
    return [Math.min(end + 4 * 60, 21 * 60), Math.min(end + 6 * 60, 23 * 60 + 30)] as const
  }
  const [from, setFrom] = React.useState(() => defaults()[0])
  const [to, setTo] = React.useState(() => defaults()[1])
  const [tele, setTele] = React.useState(false)
  const overlap = shifts.some((s) => from < mins(s.to) && to > mins(s.from))
  const add = () => {
    if (to <= from || overlap) return
    onAdd({ from: fmt(from), to: fmt(to), ...(tele ? { telehealth: true } : {}) })
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
          setTele(false)
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
      <PopoverContent align="start" className="w-68 gap-3 shadow-md">
        <div className="grid grid-cols-2 gap-2">
          {select(from, setFrom, t("from"))}
          {select(to, setTo, t("to"), from)}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={tele} onCheckedChange={(v) => setTele(v === true)} />
          {t("telehealth")}
        </label>
        {overlap && <p className="text-xs text-destructive">{t("overlap")}</p>}
        <Button size="sm" onClick={add} disabled={to <= from || overlap}>
          {t("add")}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/* ================================================================== booking settings */

const VISIT = [10, 15, 20, 25, 30, 40, 45, 60]
const MAX = [12, 16, 20, 24, 28, 32, 40]

/** Widget / Doctor Booking Settings: visit length · max per day; online booking, new patients, telehealth visits. Applies at once. */
function BookingSettings({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.bookingSettings")
  const { dates, locale } = useDoctorText()
  const clinic = useClinics().find((c) => c.key === d.clinic)
  const set = (patch: Partial<DoctorBooking>) => updateDoctor(d.key, (x) => ({ booking: { ...x.booking, ...patch } }))
  const bk = d.booking
  const rule = clinic?.rules.slotMin ?? 15
  const teleDays = WEEKDAYS.filter((w) => d.week[w].some((s) => s.telehealth))
  const sun = (w: Weekday) => `2026-11-${String(15 + WEEKDAYS.indexOf(w)).padStart(2, "0")}`
  const teleLabel = teleDays.map((w) => dates.weekdayShort(sun(w))).join(locale === "ar" ? " و" : " and ")
  const select = (label: string, value: string, set: (v: string) => void, items: { value: string; label: string }[]) => (
    <Field label={label}>
      {(p) => (
        <Select value={value} onValueChange={set}>
          <SelectTrigger {...p} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((it) => (
              <SelectItem key={it.value} value={it.value}>
                {it.label}
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
        {select(t("visit"), bk.visitMin === null ? "clinic" : String(bk.visitMin), (v) => set({ visitMin: v === "clinic" ? null : Number(v) }), [
          { value: "clinic", label: t("clinicRule", { n: rule }) },
          ...VISIT.map((n) => ({ value: String(n), label: t("minutes", { n }) })),
        ])}
        {select(t("max"), String(bk.maxPerDay), (v) => set({ maxPerDay: Number(v) }), (MAX.includes(bk.maxPerDay) ? MAX : [...MAX, bk.maxPerDay].sort((a, z) => a - z)).map((n) => ({ value: String(n), label: t("patients", { n }) })))}
      </div>
      <SwitchCard label={t("online")} hint={t("onlineText")} checked={bk.online} onCheckedChange={(v) => set({ online: v })} />
      <SwitchCard label={t(d.female ? "acceptsNewF" : "acceptsNew")} checked={bk.acceptsNew} onCheckedChange={(v) => set({ acceptsNew: v })} />
      <SwitchCard
        label={t("telehealth")}
        hint={teleDays.length ? t("teleText", { days: teleLabel }) : t("teleNone")}
        checked={bk.telehealth}
        onCheckedChange={(v) => set({ telehealth: v })}
      />
    </Widget>
  )
}
