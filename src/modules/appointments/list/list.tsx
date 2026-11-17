"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { ActionMenu, type ActionItem } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { FilterChip, Pagination } from "@/components/ds/module-controls"
import { StatCard } from "@/components/ds/stat-card"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { STATUS_TONE } from "../calendar/agenda"
import { ExportDialog } from "../calendar/export"
import { DOCTORS, doctorById, hhmm, TODAY, type ApptStatus } from "../data"
import { AppointmentsFrame } from "../frame"
import { useAppointmentActions, useAppointmentsOn, type LiveAppointment } from "../store"

type Chip = "all" | "waiting" | "withDoctor" | "completed" | "noShow" | "cancelled"
const CHIPS: Chip[] = ["all", "waiting", "withDoctor", "completed", "noShow", "cancelled"]
const match = (c: Chip, s: ApptStatus) => c === "all" || (c === "waiting" ? s === "arrived" : s === c)
const PAGE = 10

/**
 * Appointments · List (1440 / 768 / 390): KPIs (md+) + "Today's appointments" card with status chips.
 * Wide card: table (Time · Patient · Doctor & clinic · Type · Reminder · Status · ⋯). Narrow (tablet, mobile):
 * compact rows; tapping a row opens its actions (bottom sheet on mobile).
 */
export function AppointmentsList() {
  const t = useTranslations("appointments.list")
  const dates = useDates()
  const list = useAppointmentsOn()(TODAY)
  const [chip, setChip] = React.useState<Chip>("all")
  const [page, setPage] = React.useState(1)
  const [all, setAll] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const rows = list.filter((a) => match(chip, a.status))
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pageCount)
  const paged = rows.slice((current - 1) * PAGE, current * PAGE)
  const compact = all ? rows : rows.slice(0, PAGE)
  const pick = (c: Chip) => {
    setChip(c)
    setPage(1)
    setAll(false)
  }

  return (
    <AppointmentsFrame onExport={() => setExporting(true)}>
      <Kpis list={list} />
      <section className="@container/list flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
        <header className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted-foreground">{t("subtitle", { date: `${dates.weekdayShort(TODAY)} ${dates.short(TODAY)}`, count: list.length })}</p>
          </div>
          <ActionMenu
            title={t("title")}
            align="end"
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("more")}>
                <Icon name="more" size={16} />
              </Button>
            }
            groups={[
              [
                { key: "export", icon: "export", label: t("exportToday"), onSelect: () => setExporting(true) },
                { key: "print", icon: "printer", label: t("print"), onSelect: () => window.print() },
              ],
            ]}
          />
        </header>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("col.status")}>
          {CHIPS.map((c) => (
            <FilterChip key={c} selected={chip === c} count={list.filter((a) => match(c, a.status)).length} onClick={() => pick(c)}>
              {t(`chips.${c}`)}
            </FilterChip>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="calendar-2" title={t("empty")} description={t("emptyText")} className="py-12" />
        ) : (
          <>
            {/* Wide: table */}
            <div className="hidden overflow-hidden rounded-lg border @min-[60rem]/list:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr className="h-10 border-b text-start">
                    <th scope="col" className="w-[8.875rem] ps-4 text-start font-medium">{t("col.time")}</th>
                    <th scope="col" className="px-2 text-start font-medium">{t("col.patient")}</th>
                    <th scope="col" className="w-56.5 px-2 text-start font-medium">{t("col.doctor")}</th>
                    <th scope="col" className="w-39 px-2 text-start font-medium">{t("col.type")}</th>
                    <th scope="col" className="w-31.5 px-2 text-start font-medium">{t("col.reminder")}</th>
                    <th scope="col" className="w-34 px-2 text-start font-medium">{t("col.status")}</th>
                    <th scope="col" className="w-14 pe-4">
                      <span className="sr-only">{t("col.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((a) => (
                    <TableRow key={a.id} a={a} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              className="hidden @min-[60rem]/list:flex"
              page={current}
              pageCount={pageCount}
              onPage={setPage}
              info={t("showing", { from: (current - 1) * PAGE + 1, to: Math.min(current * PAGE, rows.length), total: rows.length })}
            />

            {/* Narrow: compact rows */}
            <ul className="flex flex-col @min-[60rem]/list:hidden">
              {compact.map((a) => (
                <CompactRow key={a.id} a={a} />
              ))}
            </ul>
            {compact.length < rows.length && (
              <Button variant="outline" className="h-10 @min-[60rem]/list:hidden" onClick={() => setAll(true)}>
                {t("showAll")}
              </Button>
            )}
          </>
        )}
      </section>

      {exporting && <ExportDialog open={exporting} onOpenChange={setExporting} days={[TODAY]} doctors={DOCTORS.map((d) => d.id)} rangeLabel={dates.full(TODAY)} fileStem={`list-${TODAY}`} />}
    </AppointmentsFrame>
  )
}

/** KPI row (design · Stat Card ×4): today · waiting now (12 min average wait) · completed (% of today) · no-show. */
function Kpis({ list }: { list: LiveAppointment[] }) {
  const t = useTranslations("appointments.list.kpi")
  const completed = list.filter((a) => a.status === "completed").length
  return (
    <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
      <StatCard icon="calendar-tick" label={t("today")} value={list.length} delta="+4" caption={t("vsLastMonday")} />
      <StatCard
        icon="clock"
        tile="warning"
        label={t("waiting")}
        value={list.filter((a) => a.status === "arrived").length}
        delta={t("minutes", { n: 12 })}
        deltaTone="warning"
        caption={t("avgWait")}
      />
      <StatCard
        icon="tick-circle"
        tile="success"
        label={t("completed")}
        value={completed}
        delta={`${Math.round((completed / Math.max(list.length, 1)) * 100)}%`}
        caption={t("ofToday")}
      />
      <StatCard
        icon="close-circle"
        tile="destructive"
        label={t("noShow")}
        value={list.filter((a) => a.status === "noShow").length}
        delta="3%"
        deltaTone="destructive"
        caption={t("thisWeek")}
      />
    </div>
  )
}

function useRowText(a: LiveAppointment) {
  const t = useTranslations("appointments")
  const locale = useLocale()
  const doc = doctorById(a.doctor)
  return {
    name: a.patient ? bi(a.patient, locale) : t("calendar.bookedSlot"),
    doctor: bi(doc.name, locale),
    clinic: bi(doc.clinic, locale),
    reason: a.reason ? bi(a.reason, locale) : "—",
    time: `${hhmm(a.start)}–${hhmm(a.start + a.duration)}`,
    status: t(`status.${a.status}`),
  }
}

function TableRow({ a }: { a: LiveAppointment }) {
  const t = useTranslations("appointments.list")
  const x = useRowText(a)
  return (
    <tr className="h-14 border-b last:border-b-0">
      <td className="ps-4">
        <span className="flex flex-col">
          <bdi dir="ltr" className="w-fit font-medium tabular-nums">
            {x.time}
          </bdi>
          <span className="text-xs text-muted-foreground">{t("duration", { n: a.duration })}</span>
        </span>
      </td>
      <td className="truncate px-2 font-medium">
        <span className={cn(a.status === "cancelled" && "text-muted-foreground line-through")}>{x.name}</span>
      </td>
      <td className="px-2">
        <span className="flex flex-col">
          <span className="truncate">{x.doctor}</span>
          <span className="truncate text-xs text-muted-foreground">{x.clinic}</span>
        </span>
      </td>
      <td className="px-2">
        <span className="flex items-center gap-1.5">
          <Icon name={a.telehealth ? "video" : "hospital"} size={14} className="shrink-0 text-muted-foreground" aria-label={a.telehealth ? t("video") : t("inClinic")} />
          <span className="truncate">{x.reason}</span>
        </span>
      </td>
      <td className="px-2">
        <span className="flex items-center gap-1.5 text-xs">
          <Icon name="tick-circle" size={14} className="shrink-0 text-success" />
          {t("sent")}
        </span>
      </td>
      <td className="px-2">
        <StatusBadge tone={STATUS_TONE[a.status]}>{x.status}</StatusBadge>
      </td>
      <td className="pe-4 text-end">
        <RowMenu
          a={a}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={t("menu.label", { name: x.name })}>
              <Icon name="more" size={16} />
            </Button>
          }
        />
      </td>
    </tr>
  )
}

function CompactRow({ a }: { a: LiveAppointment }) {
  const t = useTranslations("appointments")
  const x = useRowText(a)
  return (
    <li className="border-b last:border-b-0">
      <RowMenu
        a={a}
        trigger={
          <button
            type="button"
            aria-label={t("list.menu.label", { name: x.name })}
            className="flex w-full cursor-pointer items-start gap-3 py-3 text-start outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="flex w-12 shrink-0 flex-col">
              <span className="text-sm font-medium tabular-nums">{hhmm(a.start)}</span>
              <span className="text-xs text-muted-foreground">{t("calendar.minutes", { n: a.duration })}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn("text-sm font-medium", a.status === "cancelled" && "text-muted-foreground line-through")}>{x.name}</span>
              <span className="text-xs text-muted-foreground">
                {x.doctor} · {x.reason}
              </span>
            </span>
            <StatusBadge tone={STATUS_TONE[a.status]}>{x.status}</StatusBadge>
          </button>
        }
      />
    </li>
  )
}

/**
 * Row actions by status: check in (booked / confirmed) → call in (arrived) → finish (with doctor); send reminder,
 * mark no-show and cancel while the visit hasn't started. Each change shows a DS toast with Undo.
 */
function RowMenu({ a, trigger }: { a: LiveAppointment; trigger: React.ReactElement }) {
  const t = useTranslations("appointments.list")
  const ts = useTranslations("appointments.status")
  const router = useRouter()
  const { setStatus, remind } = useAppointmentActions()
  const x = useRowText(a)
  const doc = doctorById(a.doctor)
  const vars = { name: x.name, doctor: x.doctor, time: hhmm(a.start), room: doc.room }

  const move = (to: ApptStatus, title: string, description: string, tone: "success" | "info" = "success") => {
    const from = a.status
    setStatus(a.id, to)
    notify[tone](title, {
      description,
      action: {
        label: t("toast.undo"),
        onClick: () => {
          setStatus(a.id, from)
          notify.info(t("toast.undone"), { description: t("toast.undoneText", { name: x.name, status: ts(from) }) })
        },
      },
    })
  }

  const open = a.status === "booked" || a.status === "confirmed"
  const items: (ActionItem | false)[][] = [
    [
      open && { key: "checkIn", icon: "tick-circle", label: t("menu.checkIn"), onSelect: () => move("arrived", t("toast.checkedIn"), t("toast.checkedInText", vars)) },
      a.status === "arrived" && { key: "callIn", icon: "people", label: t("menu.callIn"), onSelect: () => move("withDoctor", t("toast.calledIn"), t("toast.calledInText", vars)) },
      a.status === "withDoctor" && { key: "finish", icon: "tick-square", label: t("menu.finish"), onSelect: () => move("completed", t("toast.finished"), t("toast.finishedText", vars)) },
      { key: "day", icon: "calendar-2", label: t("menu.openDay"), onSelect: () => router.push("/appointments") },
    ],
    [
      open && {
        key: "remind",
        icon: "sms",
        label: t("menu.remind"),
        onSelect: () => {
          remind(a.id)
          notify.success(t("toast.reminded"), { description: t("toast.remindedText", vars) })
        },
      },
    ],
    [
      (open || a.status === "arrived") && {
        key: "noShow",
        icon: "close-circle",
        label: t("menu.noShow"),
        destructive: true,
        onSelect: () => move("noShow", t("toast.noShow"), t("toast.noShowText", vars), "info"),
      },
      (open || a.status === "arrived") && {
        key: "cancel",
        icon: "trash",
        label: t("menu.cancel"),
        destructive: true,
        onSelect: () => move("cancelled", t("toast.cancelled"), t("toast.cancelledText", vars), "info"),
      },
    ],
  ]
  return <ActionMenu title={x.name} description={`${x.time} · ${x.doctor}`} align="end" width="w-56" trigger={trigger} groups={items.filter((g) => g.some(Boolean))} />
}
