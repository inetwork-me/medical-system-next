"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { AppointmentsFrame } from "../frame"
import { addDays, addMonths, DOCTORS, doctorById, monthCells, TODAY, weekStart, type DoctorId } from "../data"
import { Agenda } from "./agenda"
import { DayBoard, WeekBoard, weekDays } from "./boards"
import { ExportDialog } from "./export"
import { MonthGrid } from "./month"
import { SidePanel } from "./side-panel"

import type { CalendarView } from "./params"

/**
 * Appointments · Calendar (Day / Week / Month · 1440 / 768 / 390).
 *  · xl   side panel (mini month, doctors, status legend) + board
 *  · md–lg board only (day board scrolls sideways, ~2 doctors at a time)
 *  · <md  date title, Today ‹ › Day/Month; Day = week strip + agenda list, Month = dot grid
 * View and date live in the URL (?view=week&date=2026-11-18) so a refresh or a shared link keeps them.
 */
export function CalendarScreen({ initialView, initialDate }: { initialView: CalendarView; initialDate: string }) {
  const t = useTranslations("appointments.calendar")
  const locale = useLocale()
  const dates = useDates()
  const [view, setView] = React.useState<CalendarView>(initialView)
  const [date, setDate] = React.useState(initialDate)
  const [doctors, setDoctors] = React.useState<DoctorId[]>(DOCTORS.map((d) => d.id))
  const [exporting, setExporting] = React.useState(false)

  const shown = view

  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (view === "day") q.delete("view")
    else q.set("view", view)
    if (date === TODAY) q.delete("date")
    else q.set("date", date)
    const s = q.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`)
  }, [view, date])

  const sunday = weekStart(date)
  const weekDoctor = doctors[0] ?? "km"
  const step = (k: number) => setDate(shown === "day" ? addDays(date, k) : shown === "week" ? addDays(date, 7 * k) : addMonths(date, k))
  const title =
    shown === "day"
      ? dates.full(date)
      : shown === "week"
        ? t("weekTitle", { range: dates.dayRange(sunday, addDays(sunday, 4)), doctor: bi(doctorById(weekDoctor).name, locale) })
        : dates.monthLong(date)

  // Export covers what's on screen.
  const exportDays = shown === "day" ? [date] : shown === "week" ? weekDays(sunday) : monthCells(date).filter((d) => d.startsWith(date.slice(0, 7)))
  const exportDoctors = shown === "week" ? [weekDoctor] : doctors
  const rangeLabel = shown === "day" ? dates.full(date) : shown === "week" ? dates.dayRange(sunday, addDays(sunday, 4)) : dates.monthLong(date)
  const stem = shown === "month" ? date.slice(0, 7) : shown === "week" ? `week-${sunday}` : date

  const prevLabel = { day: t("prevDay"), week: t("prevWeek"), month: t("prevMonth") }[shown]
  const nextLabel = { day: t("nextDay"), week: t("nextWeek"), month: t("nextMonth") }[shown]

  return (
    <AppointmentsFrame onExport={() => setExporting(true)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
        <h2 className="order-1 text-lg font-semibold md:order-2 md:flex-1" aria-live="polite">
          {title}
        </h2>
        <div className="order-2 flex items-center gap-2 md:order-1">
          <Button variant="outline" size="sm" className="h-10 px-3 md:h-8" onClick={() => setDate(TODAY)}>
            {t("today")}
          </Button>
          <Button variant="outline" size="icon-sm" className="size-10 md:size-8" aria-label={prevLabel} onClick={() => step(-1)}>
            <Icon name="arrow-left-1" size={24} />
          </Button>
          <Button variant="outline" size="icon-sm" className="size-10 md:size-8" aria-label={nextLabel} onClick={() => step(1)}>
            <Icon name="arrow-right-1" size={24} />
          </Button>
          {/* Mobile: Day · Month only (design) */}
          <ViewSwitch className="md:hidden" views={["day", "month"]} value={shown === "week" ? "day" : shown} onChange={setView} />
        </div>
        <ViewSwitch className="order-3 hidden md:flex" views={["day", "week", "month"]} value={shown} onChange={setView} />
      </div>

      <div className="flex items-start gap-6 [--day-col:18rem] xl:[--day-col:11rem]">
        <SidePanel className="hidden w-65 shrink-0 xl:flex" date={date} onPick={setDate} doctors={doctors} onDoctors={setDoctors} />
        <div className="min-w-0 flex-1">
          {doctors.length === 0 && shown !== "month" ? (
            <div className="rounded-xl border bg-card">
              <EmptyState icon="people" title={t("noDoctors")} description={t("noDoctorsText")} className="py-16" />
            </div>
          ) : shown === "month" ? (
            <MonthGrid
              date={date}
              onOpenDay={(d) => {
                setDate(d)
                setView("day")
              }}
            />
          ) : (
            <>
              {/* Mobile: week strip + agenda (also for ?view=week, which mobile doesn't offer) */}
              <div className="md:hidden">
                <Agenda key={date} date={date} doctors={doctors} onPick={setDate} />
              </div>
              <div className="hidden md:block">{shown === "week" ? <WeekBoard sunday={sunday} doctor={weekDoctor} /> : <DayBoard date={date} doctors={doctors} />}</div>
            </>
          )}
        </div>
      </div>

      {exporting && (
        <ExportDialog
          open={exporting}
          onOpenChange={setExporting}
          days={exportDays}
          doctors={exportDoctors}
          rangeLabel={rangeLabel}
          fileStem={stem}
        />
      )}
    </AppointmentsFrame>
  )
}

/** Day · Week · Month switch (design · View switch: muted track, active = card pill, 12 Medium). */
function ViewSwitch({ views, value, onChange, className }: { views: CalendarView[]; value: CalendarView; onChange: (v: CalendarView) => void; className?: string }) {
  const t = useTranslations("appointments.calendar")
  return (
    <div role="radiogroup" aria-label={t("view")} className={cn("flex gap-0.5 rounded-lg bg-muted p-[3px]", className)}>
      {views.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={cn(
            "h-8.5 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-6 md:text-xs",
            v === value && "bg-card text-foreground shadow-xs"
          )}
        >
          {t(v)}
        </button>
      ))}
    </div>
  )
}
