"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { useApptOverlay } from "../overlays"
import { useAppointmentsOn } from "../store"
import { addDays, doctorById, hhmm, isClosed, NOW_LABEL, NOW_MIN, TODAY, weekStart, type Appointment, type ApptStatus, type DoctorId } from "../data"

export const STATUS_TONE: Record<ApptStatus, StatusTone> = {
  booked: "neutral",
  confirmed: "info",
  arrived: "warning",
  withDoctor: "info",
  completed: "success",
  noShow: "destructive",
  cancelled: "neutral",
}

const FIRST = 11

/**
 * Mobile · Calendar · Day (design · Widget / Appt · Agenda): week strip (Sun–Sat, Friday dimmed) + one card per
 * appointment (time · minutes | doctor colour bar | patient · doctor · reason · status). Today starts at the visits
 * still going on, with the red "Now" divider; the rest of the day sits behind "Show the rest of the day · n".
 */
export function Agenda({ date, doctors, onPick }: { date: string; doctors: DoctorId[]; onPick: (d: string) => void }) {
  const t = useTranslations("appointments.calendar")
  const dates = useDates()
  const [more, setMore] = React.useState(false)
  const [earlier, setEarlier] = React.useState(false)

  const all = useAppointmentsOn()(date).filter((a) => doctors.includes(a.doctor))
  const today = date === TODAY
  // Today: visits already over (completed / no-show) are folded away above the list.
  const done = today ? all.filter((a) => a.status === "completed" || a.status === "noShow") : []
  const rest = all.filter((a) => !done.includes(a))
  const shown = more ? rest : rest.slice(0, FIRST)
  const hidden = rest.length - shown.length
  const nowAt = today ? shown.findIndex((a) => a.start > NOW_MIN) : -1
  const sunday = weekStart(date)

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={t("miniCalendar")} className="flex gap-1.5">
        {Array.from({ length: 7 }, (_, i) => addDays(sunday, i)).map((d) => {
          const on = d === date
          const closed = isClosed(d)
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={dates.full(d)}
              disabled={closed}
              onClick={() => onPick(d)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl border py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-card",
                closed && "opacity-50"
              )}
            >
              <span className={cn("text-xs", on ? "text-primary-foreground" : "text-muted-foreground")}>{dates.weekdayShort(d)}</span>
              <span className={cn("text-sm font-medium tabular-nums", closed && !on && "text-muted-foreground")}>{Number(d.slice(8, 10))}</span>
            </button>
          )
        })}
      </div>

      {all.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="calendar-2" title={t("noAppointments")} description={isClosed(date) ? t("closedText") : t("noAppointmentsText")} className="py-12" />
        </div>
      ) : (
        <>
          {done.length > 0 && !earlier && (
            <Button variant="ghost" size="sm" className="w-fit self-center text-muted-foreground" onClick={() => setEarlier(true)}>
              {t("earlier", { count: done.length })}
            </Button>
          )}
          <ul className="flex flex-col gap-2">
            {earlier && done.map((a) => <Item key={a.id} a={a} />)}
            {shown.map((a, i) => (
              <React.Fragment key={a.id}>
                {i === nowAt && <NowDivider />}
                <Item a={a} />
              </React.Fragment>
            ))}
            {today && nowAt === -1 && !hidden && <NowDivider />}
          </ul>
          {hidden > 0 && (
            <Button variant="outline" className="h-10 w-full" onClick={() => setMore(true)}>
              {t("restOfDay", { count: hidden })}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function NowDivider() {
  const t = useTranslations("appointments.calendar")
  return (
    <li aria-label={t("nowLine", { time: NOW_LABEL })} className="flex items-center gap-2 py-0.5 text-xs text-destructive">
      <span className="tabular-nums">{t("now", { time: NOW_LABEL })}</span>
      <span aria-hidden className="h-px flex-1 bg-destructive" />
    </li>
  )
}

function Item({ a }: { a: Appointment }) {
  const t = useTranslations("appointments")
  const overlay = useApptOverlay()
  const locale = useLocale()
  const doc = doctorById(a.doctor)
  return (
    <li>
      <button
        type="button"
        onClick={() => overlay.open("details", a)}
        className="flex w-full cursor-pointer gap-2.5 rounded-xl border bg-card p-3 text-start outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
      <span className="flex w-11.5 shrink-0 flex-col">
        <span className="text-sm font-medium tabular-nums">{hhmm(a.start)}</span>
        <span className="text-xs text-muted-foreground">{t("calendar.minutes", { n: a.duration })}</span>
      </span>
      <span aria-hidden className="w-[3px] shrink-0 rounded-full" style={{ background: doc.color }} />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className={cn("max-w-full truncate text-sm font-medium", a.status === "cancelled" && "text-muted-foreground line-through")}>
          {a.patient ? bi(a.patient, locale) : t("calendar.bookedSlot")}
        </span>
        <span className="max-w-full truncate text-xs text-muted-foreground">
          {bi(doc.name, locale)}
          {a.reason && ` · ${bi(a.reason, locale)}`}
        </span>
        <StatusBadge tone={STATUS_TONE[a.status]} className="mt-1">
          {t(`status.${a.status}`)}
        </StatusBadge>
      </span>
      </button>
    </li>
  )
}
