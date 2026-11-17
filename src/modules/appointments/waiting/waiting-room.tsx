"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { ExportDialog } from "../calendar/export"
import { DOCTORS, doctorById, hhmm, NOW_MIN, TODAY, type ApptStatus } from "../data"
import { AppointmentsFrame } from "../frame"
import { Kpis } from "../list/list"
import { useAppointmentActions, useAppointmentsOn, type LiveAppointment } from "../store"

type Col = "expected" | "waiting" | "withDoctor" | "done"
const COLS: Col[] = ["expected", "waiting", "withDoctor", "done"]
const TONE: Record<Col, StatusTone> = { expected: "neutral", waiting: "warning", withDoctor: "info", done: "success" }
/** Waits over this get the red timer (design: 18 min). */
const LONG_WAIT = 15
const DONE_FIRST = 3

/**
 * Appointments · Waiting room (1440 / 768 / 390). xl: KPIs + four columns — Expected · next hour (Check in),
 * Waiting (timer, Call in), With doctor (timer, Finish), Done · to pay (Collect). Below xl: the four columns become
 * a segmented switch (Waiting first) with today's average / longest wait under the cards.
 */
export function WaitingRoom() {
  const t = useTranslations("appointments.waiting")
  const dates = useDates()
  const list = useAppointmentsOn()(TODAY)
  const [tab, setTab] = React.useState<Col>("waiting")
  const [exporting, setExporting] = React.useState(false)

  const cols: Record<Col, LiveAppointment[]> = {
    expected: list.filter((a) => (a.status === "booked" || a.status === "confirmed") && a.start > NOW_MIN && a.start < NOW_MIN + 60),
    waiting: list.filter((a) => a.status === "arrived").sort((a, b) => (a.since ?? 0) - (b.since ?? 0)),
    withDoctor: list.filter((a) => a.status === "withDoctor"),
    done: list.filter((a) => a.status === "completed" && !a.paid).sort((a, b) => b.start + b.duration - (a.start + a.duration)),
  }
  const waits = cols.waiting.map((a) => NOW_MIN - (a.since ?? NOW_MIN))
  const longest = Math.max(0, ...waits)

  return (
    <AppointmentsFrame onExport={() => setExporting(true)}>
      {/* Tablet / mobile design: no KPIs here, the switch comes first */}
      <Kpis list={list} className="md:hidden xl:grid" />
      <div className="hidden items-start gap-4 xl:grid xl:grid-cols-4">
        {COLS.map((c) => (
          <section key={c} aria-label={t(`columns.${c}`)} className="flex flex-col gap-2.5 rounded-xl bg-muted p-3">
            <header className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 text-sm font-medium">{t(`columns.${c}`)}</h2>
              <StatusBadge tone={TONE[c]}>{cols[c].length}</StatusBadge>
            </header>
            <Cards col={c} items={cols[c]} />
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-4 xl:hidden">
        <div role="tablist" aria-label={t("label")} className="flex gap-0.5 rounded-lg bg-muted p-[3px]">
          {COLS.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={tab === c}
              onClick={() => setTab(c)}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                tab === c && "bg-card text-foreground shadow-xs"
              )}
            >
              <span className="truncate">{t(`tabs.${c}`)}</span>
              <span className="text-muted-foreground tabular-nums">{cols[c].length}</span>
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={t(`columns.${tab}`)} className="flex flex-col gap-4">
          <Cards key={tab} col={tab} items={cols[tab]} />
        </div>
        <p className="text-xs text-muted-foreground">{t("summary", { avg: 12, max: longest })}</p>
      </div>

      {exporting && <ExportDialog open={exporting} onOpenChange={setExporting} days={[TODAY]} doctors={DOCTORS.map((d) => d.id)} rangeLabel={dates.full(TODAY)} fileStem={`waiting-${TODAY}`} />}
    </AppointmentsFrame>
  )
}

function Cards({ col, items }: { col: Col; items: LiveAppointment[] }) {
  const t = useTranslations("appointments.waiting")
  const [all, setAll] = React.useState(false)
  if (!items.length) return <EmptyState icon="people" title={t("empty")} className="rounded-xl border border-dashed bg-card py-8" />
  const shown = col === "done" && !all ? items.slice(0, DONE_FIRST) : items
  return (
    <>
      <ul className="flex flex-col gap-2.5 max-xl:gap-4">
        {shown.map((a) => (
          <Card key={a.id} col={col} a={a} />
        ))}
      </ul>
      {col === "done" && items.length > DONE_FIRST && (
        <Button variant="ghost" size="sm" className="self-center" onClick={() => setAll((v) => !v)}>
          {all ? t("showLess") : t("showAll", { count: items.length })}
        </Button>
      )}
    </>
  )
}

function Card({ col, a }: { col: Col; a: LiveAppointment }) {
  const t = useTranslations("appointments")
  const tw = useTranslations("appointments.waiting")
  const locale = useLocale()
  const { setStatus, collect } = useAppointmentActions()
  const doc = doctorById(a.doctor)
  const name = a.patient ? bi(a.patient, locale) : t("calendar.bookedSlot")
  const doctor = bi(doc.name, locale)
  const mins = a.since !== undefined ? Math.max(0, NOW_MIN - a.since) : undefined
  const long = col === "waiting" && mins !== undefined && mins > LONG_WAIT

  const move = (to: ApptStatus, title: string, description: string) => {
    const from = a.status
    const since = a.since
    setStatus(a.id, to)
    notify.success(title, {
      description,
      action: { label: t("list.toast.undo"), onClick: () => setStatus(a.id, from, since) },
    })
  }
  const vars = { name, doctor, room: doc.room, time: hhmm(a.start) }

  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{hhmm(a.start)}</span>
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {doctor} · {bi(doc.clinic, locale)}
      </span>
      <div className="flex items-center gap-2">
        {mins !== undefined && (col === "waiting" || col === "withDoctor") && (
          <span
            aria-label={col === "waiting" ? tw("waitedLabel", { n: mins }) : tw("withLabel", { n: mins })}
            className={cn(
              "inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium tabular-nums",
              long ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon name="clock" size={12} />
            {tw("minutes", { n: mins })}
          </span>
        )}
        <span className="flex-1" />
        {col === "expected" && (
          <Button size="sm" onClick={() => move("arrived", t("list.toast.checkedIn"), t("list.toast.checkedInText", vars))}>
            {tw("checkIn")}
          </Button>
        )}
        {col === "waiting" && (
          <Button size="sm" onClick={() => move("withDoctor", t("list.toast.calledIn"), t("list.toast.calledInText", vars))}>
            {tw("callIn")}
          </Button>
        )}
        {col === "withDoctor" && (
          <Button size="sm" variant="outline" onClick={() => move("completed", t("list.toast.finished"), tw("finishedText", vars))}>
            {tw("finish")}
          </Button>
        )}
        {col === "done" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              collect(a.id)
              notify.success(tw("collected"), {
                description: tw("collectedText", vars),
                action: { label: t("list.toast.undo"), onClick: () => collect(a.id, false) },
              })
            }}
          >
            {tw("collect")}
          </Button>
        )}
      </div>
    </li>
  )
}
