"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { addMonths, appointmentsOn, DOCTORS, isClosed, monthCells, STATUSES, TODAY, type ApptStatus, type DoctorId } from "../data"

/** Legend swatches (design · Side Panel · Status). */
const SWATCH: Record<ApptStatus, string> = {
  booked: "border-border bg-card",
  confirmed: "border-primary bg-accent",
  arrived: "border-warning bg-warning-soft",
  withDoctor: "border-primary bg-primary",
  completed: "border-success bg-success-soft",
  noShow: "border-destructive bg-destructive-soft",
  cancelled: "border-border bg-muted",
}

const card = "flex flex-col rounded-xl border bg-card p-4"

/** Calendar side panel (xl+): mini month, doctors to show (with today's count), status legend. */
export function SidePanel({
  date,
  onPick,
  doctors,
  onDoctors,
  className,
}: {
  date: string
  onPick: (d: string) => void
  doctors: DoctorId[]
  onDoctors: (ids: DoctorId[]) => void
  className?: string
}) {
  const t = useTranslations("appointments")
  const locale = useLocale()
  const list = appointmentsOn(date)
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      <MiniMonth date={date} onPick={onPick} />
      <section className={cn(card, "gap-2")}>
        <h2 className="text-sm font-medium">{t("calendar.doctors")}</h2>
        {DOCTORS.map((d) => {
          const on = doctors.includes(d.id)
          return (
            <label key={d.id} className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={on}
                onCheckedChange={(v) => onDoctors(v === true ? DOCTORS.filter((x) => x.id === d.id || doctors.includes(x.id)).map((x) => x.id) : doctors.filter((x) => x !== d.id))}
              />
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate">{bi(d.name, locale)}</span>
              <span className="text-muted-foreground tabular-nums">{list.filter((a) => a.doctor === d.id).length}</span>
            </label>
          )
        })}
      </section>
      <section className={cn(card, "gap-2")}>
        <h2 className="text-sm font-medium">{t("calendar.statusLegend")}</h2>
        <ul className="flex flex-col gap-2">
          {STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-2 text-xs">
              <span aria-hidden className={cn("size-3.5 rounded-sm border", SWATCH[s])} />
              {t(`status.${s}`)}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

function MiniMonth({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  const t = useTranslations("appointments.calendar")
  const dates = useDates()
  const [month, setMonth] = React.useState(date.slice(0, 7))
  // Follow the picked date when it moves to another month (toolbar, Today).
  const [seen, setSeen] = React.useState(date)
  if (seen !== date) {
    setSeen(date)
    setMonth(date.slice(0, 7))
  }
  const cells = monthCells(`${month}-01`)
  const weekdays = t("weekdays").split(",")
  return (
    <section className={cn(card, "gap-2.5")} aria-label={t("miniCalendar")}>
      <header className="flex items-center gap-1.5">
        <h2 className="flex-1 text-sm font-medium" aria-live="polite">
          {dates.monthLong(`${month}-01`)}
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label={t("prevMonth")} onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}>
          <Icon name="arrow-left-1" size={24} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("nextMonth")} onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}>
          <Icon name="arrow-right-1" size={24} />
        </Button>
      </header>
      <div role="grid" className="flex flex-col gap-1">
        <div role="row" className="grid grid-cols-7 gap-0.5">
          {weekdays.map((w, i) => (
            <span key={i} role="columnheader" className="text-center text-xs text-muted-foreground">
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, w) => (
          <div key={w} role="row" className="grid grid-cols-7 gap-0.5">
            {cells.slice(w * 7, w * 7 + 7).map((d) => {
              const on = d === date
              const out = !d.startsWith(month)
              const muted = out || isClosed(d)
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  aria-selected={on}
                  aria-current={d === TODAY ? "date" : undefined}
                  aria-label={dates.full(d)}
                  onClick={() => onPick(d)}
                  className={cn(
                    "flex h-8.5 items-center justify-center rounded-lg text-xs tabular-nums outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    on ? "bg-primary font-medium text-primary-foreground hover:bg-primary" : muted ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {Number(d.slice(8, 10))}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
