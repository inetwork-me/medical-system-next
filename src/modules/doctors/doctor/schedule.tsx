"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { SwitchCard } from "@/modules/clinics/parts"
import { useClinics } from "@/modules/clinics/store"
import { WEEKDAYS, assignmentsOn, type Doctor, type DoctorBooking, type Shift, type Weekday } from "../data"
import { EditHoursDialog } from "../edit-hours"
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

const DEFAULT_DAY: Shift[] = [{ from: "08:00", to: "16:00" }]
const totalHours = (week: Record<Weekday, Shift[]>) => WEEKDAYS.reduce((n, w) => n + week[w].reduce((m, s) => m + shiftHours(s), 0), 0)

/**
 * Widget / Doctor Week Hours. Day switches apply at once. Edit hours opens Overlay · Edit hours (design v4.8): shifts
 * per day with Start / End / Location, Applies from, copy Sunday, conflicts, and a new hours version on save.
 */
function WeekHours({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.hours")
  const { clinicName } = useDoctorText()
  const [editing, setEditing] = React.useState(false)
  const last = React.useRef<Partial<Record<Weekday, Shift[]>>>({})
  const week = d.week

  const toggle = (day: Weekday, on: boolean) => {
    if (!on) last.current[day] = week[day]
    updateDoctor(d.key, { week: { ...week, [day]: on ? (last.current[day]?.length ? last.current[day]! : DEFAULT_DAY) : [] } })
    const name = t(`days.${day}`)
    toast.success(on ? t("dayOn", { day: name }) : t("dayOff", { day: name }), { description: on ? t("dayOnText", { day: name }) : t("dayOffText", { day: name }) })
  }
  // Shifts in other clinics (Assign clinic): read-only chips with the clinic's name; edited from Works in, not here.
  const extraChips = (day: Weekday) =>
    assignmentsOn(d, day).map((a) => (
      <span key={`${a.clinic}-${a.from}`} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-dashed bg-card px-2.5 text-xs font-medium tabular-nums">
        <Icon name="hospital" size={14} className="text-muted-foreground" />
        <bdi dir="ltr">{`${a.from}–${a.to}`}</bdi>
        <span className="text-muted-foreground">· {clinicName(a.clinic)}</span>
      </span>
    ))

  return (
    <Widget
      title={t("title")}
      description={t("text", { h: totalHours(week) })}
      className={cn("gap-2 p-4 md:p-5", className)}
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setEditing(true)}>
          <Icon name="edit-2" size={16} />
          {t("edit")}
        </Button>
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
                          <span key={range} className="inline-flex h-7 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-medium tabular-nums">
                            <Icon name="clock" size={14} className="text-muted-foreground" />
                            <bdi dir="ltr">{range}</bdi>
                          </span>
                        )
                      })}
                      {extraChips(day)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {ltr(t("where", { clinic: clinicName(d.clinic), room: shifts.find((s) => !s.telehealth)?.room ?? d.room }))}
                      {tele && t("plusTele")}
                    </span>
                  </>
                ) : assignmentsOn(d, day).length ? (
                  <div className="flex flex-wrap items-center gap-1.5">{extraChips(day)}</div>
                ) : (
                  <span className="text-sm text-muted-foreground">{t("off")}</span>
                )}
              </div>
              <div className="hidden w-27.5 shrink-0 text-end @lg/widget:block">{booked}</div>
            </li>
          )
        })}
      </ul>
      {editing && <EditHoursDialog doctor={d} onOpenChange={(o) => !o && setEditing(false)} />}
    </Widget>
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
