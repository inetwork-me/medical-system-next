"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { DateRangePicker } from "@/components/ds/pickers"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ExportDialog } from "../calendar/export"
import { addDays, bookedBetween, DOCTORS, doctorById, iso, SCHEDULES, TODAY, toDate, weekStart, type Doctor, type DoctorId, type TimeOffReason } from "../data"
import { AppointmentsFrame } from "../frame"
import { useAppointmentActions, useTimeOff } from "../store"

const REASONS: TimeOffReason[] = ["annual", "sick", "training", "personal", "other"]

/**
 * Appointments · Doctor schedules (1440 / 768 / 390): one card, a row per doctor — who (avatar · name · clinic ·
 * slot length), the week Sun–Sat (hours / Off / —), today's load bar (amber from 85%) and "On leave" when booked.
 * Wide: one line per doctor; tablet / mobile: stacked. "Add time off" opens the dialog.
 */
export function DoctorSchedules() {
  const t = useTranslations("appointments.schedules")
  const dates = useDates()
  const [adding, setAdding] = React.useState<DoctorId | null>(null)
  const [exporting, setExporting] = React.useState(false)

  return (
    <AppointmentsFrame onExport={() => setExporting(true)}>
      <section className="@container/sched flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
        <header className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAdding("hf")}>
            <Icon name="calendar-add" size={24} />
            {t("addTimeOff")}
          </Button>
        </header>
        <ul className="flex flex-col">
          {DOCTORS.map((d) => (
            <DoctorRow key={d.id} doctor={d} />
          ))}
        </ul>
      </section>
      {adding && <TimeOffDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} initialDoctor={adding} />}
      {exporting && (
        <ExportDialog
          open={exporting}
          onOpenChange={setExporting}
          days={[0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart(TODAY), i))}
          doctors={DOCTORS.map((d) => d.id)}
          rangeLabel={dates.dayRange(weekStart(TODAY), addDays(weekStart(TODAY), 6))}
          fileStem={`schedules-week-${weekStart(TODAY)}`}
        />
      )}
    </AppointmentsFrame>
  )
}

function DoctorRow({ doctor }: { doctor: Doctor }) {
  const t = useTranslations("appointments.schedules")
  const locale = useLocale()
  const dates = useDates()
  const timeOff = useTimeOff()
  const s = SCHEDULES[doctor.id]
  const [used, total] = s.load
  const pct = Math.round((used / total) * 100)
  const sunday = weekStart(TODAY)
  const leave = timeOff.filter((o) => o.doctor === doctor.id && o.to >= TODAY)
  const tc = useTranslations("appointments.calendar")
  // Arabic design uses single-letter weekdays (ح ن ث …); English uses Sun, Mon …
  const letters = tc("weekdays").split(",")
  const dayName = (day: string, i: number) => (locale === "ar" ? letters[i] : dates.weekdayShort(day))
  // "22–24 Nov" (design: no year); different months → "30 Nov–2 Dec"
  const leaveRange = (from: string, to: string) =>
    from.slice(0, 7) === to.slice(0, 7) ? `${Number(from.slice(8, 10))}–${dates.dayMonth(to)}` : `${dates.dayMonth(from)}–${dates.dayMonth(to)}`

  return (
    <li className="flex flex-col gap-3 border-b py-5 first:pt-1 last:border-b-0 last:pb-1 @min-[60rem]/sched:flex-row @min-[60rem]/sched:items-center @min-[60rem]/sched:gap-4 @min-[60rem]/sched:py-3.5">
      <div className="flex items-center gap-2.5 @min-[60rem]/sched:w-60 @min-[60rem]/sched:shrink-0">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">{doctor.initials}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{bi(doctor.name, locale)}</span>
          <span className="text-xs text-muted-foreground">{t("clinicSlots", { clinic: bi(doctor.clinic, locale), n: s.slot })}</span>
        </span>
      </div>
      <ol className="grid min-w-0 grid-cols-7 gap-1 @min-[60rem]/sched:flex-1">
        {s.week.map((h, i) => {
          const day = addDays(sunday, i)
          const working = h && h !== "off"
          return (
            <li
              key={i}
              aria-label={`${dates.full(day)}: ${h === null ? t("notWorking") : h === "off" ? t("off") : h}`}
              className={cn("flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-xs whitespace-nowrap", working ? "bg-accent" : "bg-muted")}
            >
              <span className="text-muted-foreground">{dayName(day, i)}</span>
              <span className={cn("font-medium tabular-nums", working ? "text-accent-foreground" : "text-muted-foreground")}>
                {h === null ? "—" : h === "off" ? t("off") : <bdi dir="ltr">{h}</bdi>}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-col gap-2 @min-[60rem]/sched:w-42.5 @min-[60rem]/sched:shrink-0">
        <div className="flex flex-col gap-1" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={used} aria-label={t("load", { used, total })}>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="flex-1 text-muted-foreground">{t("today")}</span>
            <span className="font-medium tabular-nums">
              {used}/{total}
            </span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-full rounded-full", pct >= 85 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
          </span>
        </div>
        {leave.map((o) => (
          <StatusBadge key={o.id} tone="warning">
            {t("onLeave", { range: leaveRange(o.from, o.to) })}
          </StatusBadge>
        ))}
      </div>
    </li>
  )
}

/** Overlay · Add time off: doctor · dates · reason, the booked-patients note, Save time off (DS toast with Undo). */
function TimeOffDialog({ open, onOpenChange, initialDoctor }: { open: boolean; onOpenChange: (o: boolean) => void; initialDoctor: DoctorId }) {
  const t = useTranslations("appointments.schedules.timeOff")
  const tc = useTranslations("common")
  const locale = useLocale()
  const dates = useDates()
  const timeOff = useTimeOff()
  const { addTimeOff, removeTimeOff } = useAppointmentActions()
  const [doctor, setDoctor] = React.useState<DoctorId>(initialDoctor)
  const [range, setRange] = React.useState<DateRange | undefined>(() => ({ from: toDate(addDays(TODAY, 13)), to: toDate(addDays(TODAY, 15)) }))
  const [reason, setReason] = React.useState<TimeOffReason>("annual")
  const [tried, setTried] = React.useState(false)

  const from = range?.from ? iso(range.from) : undefined
  const to = range?.to ? iso(range.to) : from
  const booked = from && to ? bookedBetween(doctor, from, to) : 0
  const overlap = !!from && !!to && timeOff.some((o) => o.doctor === doctor && o.from <= to && o.to >= from)
  const name = bi(doctorById(doctor).name, locale)

  const save = () => {
    setTried(true)
    if (!from || !to) return
    const id = `to-${doctor}-${Date.now()}`
    addTimeOff({ id, doctor, from, to, reason })
    onOpenChange(false)
    toast.success(t("saved"), {
      description: t("savedText", { doctor: name, range: dates.dayRange(from, to), count: booked }),
      action: { label: t("undo"), onClick: () => removeTimeOff(id) },
    })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="calendar-add"
      title={t("title")}
      description={t("description")}
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={save}>
          <Icon name="tick-circle" size={20} />
          {t("save")}
        </Button>
      }
    >
      <Field label={t("doctor")} required>
        {(p) => (
          <Select value={doctor} onValueChange={(v) => setDoctor(v as DoctorId)}>
            <SelectTrigger {...p} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCTORS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {bi(d.name, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("dates")} required error={tried && !from ? t("required") : undefined}>
        {(p) => <DateRangePicker {...p} value={range} onChange={setRange} placeholder={t("datesPlaceholder")} daysLabel={(n) => t("days", { n })} className="w-full" />}
      </Field>
      <Field label={t("reason")}>
        {(p) => (
          <Select value={reason} onValueChange={(v) => setReason(v as TimeOffReason)}>
            <SelectTrigger {...p} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`reasons.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      {from && (
        <p className={cn("flex items-start gap-2.5 rounded-lg p-3 text-xs", overlap ? "bg-warning-soft text-warning-soft-foreground" : "bg-info-soft text-info-soft-foreground")}>
          <Icon name={overlap ? "warning-2" : "info-circle"} size={18} className="shrink-0" />
          {overlap ? t("overlap", { doctor: name }) : t("booked", { count: booked })}
        </p>
      )}
    </ResponsiveDialog>
  )
}
