"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import {
  addDays,
  breaksFor,
  DAY_END,
  DAY_START,
  doctorById,
  hhmm,
  NOW_LABEL,
  NOW_MIN,
  TODAY,
  type Appointment,
  type ApptStatus,
  type Doctor,
  type DoctorId,
} from "../data"
import { useApptOverlay } from "../overlays"
import { useAppointmentsOn } from "../store"

/** 88px per hour (design · Day Board / Week Board). */
const HOUR = 88
const px = (min: number) => ((min - DAY_START) * HOUR) / 60
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60)
const HEIGHT = px(DAY_END)

/** Block look per status (design · Status legend). */
const LOOK: Record<ApptStatus | "break", { box: string; bar: string; sub: string; strike?: boolean }> = {
  booked: { box: "border bg-card text-foreground", bar: "bg-border", sub: "text-muted-foreground" },
  confirmed: { box: "bg-accent text-accent-foreground", bar: "bg-primary", sub: "text-muted-foreground" },
  arrived: { box: "bg-warning-soft text-warning-soft-foreground", bar: "bg-warning", sub: "text-muted-foreground" },
  withDoctor: { box: "bg-primary text-primary-foreground", bar: "bg-primary", sub: "text-primary-foreground/80" },
  completed: { box: "bg-success-soft text-success-soft-foreground", bar: "bg-success", sub: "text-muted-foreground" },
  noShow: { box: "bg-destructive-soft text-destructive-soft-foreground", bar: "bg-destructive", sub: "text-muted-foreground" },
  cancelled: { box: "border bg-muted text-muted-foreground", bar: "bg-border", sub: "text-muted-foreground", strike: true },
  break: { box: "border bg-muted text-muted-foreground opacity-80", bar: "bg-border", sub: "text-muted-foreground" },
}

/** One appointment (or lunch break) on a board column: 3px status bar + time / name / reason. */
function Block({ start, duration, name, reason, status, telehealth, label, onOpen }: {
  start: number
  duration: number
  name: string
  reason?: string
  status: ApptStatus | "break"
  telehealth?: boolean
  label?: string
  onOpen?: () => void
}) {
  const t = useTranslations("appointments.calendar")
  const look = LOOK[status]
  const Tag = onOpen ? "button" : "div"
  const compact = duration < 30
  const top = px(start) + 2
  const height = (duration * HOUR) / 60 - 4
  return (
    <Tag
      type={onOpen ? "button" : undefined}
      onClick={onOpen}
      role={label ? "listitem" : undefined}
      aria-label={label}
      className={cn(
        "absolute inset-x-1 flex overflow-hidden rounded-lg text-start text-xs leading-4",
        onOpen && "cursor-pointer outline-none hover:brightness-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50",
        look.box
      )}
      style={{ top, height }}
    >
      <span aria-hidden className={cn("w-[3px] shrink-0", look.bar)} />
      {compact ? (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
          <span className="font-medium tabular-nums">{hhmm(start)}</span>
          <span className={cn("truncate", look.strike && "line-through")}>{name}</span>
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col gap-px px-2 pt-[5px]">
          <span className="flex items-center gap-1 tabular-nums">
            <bdi dir="ltr">
              {hhmm(start)}–{hhmm(start + duration)}
            </bdi>
            {telehealth && <Icon name="video" size={12} aria-label={t("telehealth")} />}
          </span>
          <span className={cn("truncate font-medium", look.strike && "line-through")}>{name}</span>
          {reason && duration >= 45 && <span className={cn("truncate", look.sub)}>{reason}</span>}
        </span>
      )}
    </Tag>
  )
}

function useApptText() {
  const locale = useLocale()
  const t = useTranslations("appointments")
  return {
    name: (a: Appointment) => (a.patient ? bi(a.patient, locale) : t("calendar.bookedSlot")),
    reason: (a: Appointment) => (a.reason ? bi(a.reason, locale) : undefined),
    label: (a: Appointment) =>
      t("calendar.apptLabel", {
        time: `${hhmm(a.start)}–${hhmm(a.start + a.duration)}`,
        patient: a.patient ? bi(a.patient, locale) : t("calendar.bookedSlot"),
        doctor: bi(doctorById(a.doctor).name, locale),
        status: t(`status.${a.status}`),
      }),
  }
}

/** Hour lines (full) + half-hour lines (50%), like the design grid. */
function Lines() {
  return (
    <>
      {HOURS.flatMap((h, i) => [
        <span key={`h${h}`} aria-hidden className="absolute inset-x-0 h-px bg-border" style={{ top: i * HOUR }} />,
        <span key={`m${h}`} aria-hidden className="absolute inset-x-0 h-px bg-border/50" style={{ top: i * HOUR + HOUR / 2 }} />,
      ])}
    </>
  )
}

/** Time gutter (56px) with the red "now" pill when the board shows today. */
function Times({ today }: { today: boolean }) {
  const t = useTranslations("appointments.calendar")
  return (
    <div className="relative" style={{ height: HEIGHT }}>
      {HOURS.map((h, i) => (
        <span key={h} className="absolute start-0 w-14 ps-3 text-xs text-muted-foreground tabular-nums" style={{ top: i * HOUR + 4 }}>
          {hhmm(h)}
        </span>
      ))}
      {today && (
        <span
          className="absolute start-1 z-10 rounded-full bg-destructive px-1.5 py-px text-xs font-medium text-primary-foreground tabular-nums"
          style={{ top: px(NOW_MIN) - 9 }}
          aria-label={t("nowLine", { time: NOW_LABEL })}
        >
          {NOW_LABEL}
        </span>
      )}
    </div>
  )
}

const NowLine = () => <span aria-hidden className="absolute inset-x-0 z-10 h-0.5 bg-destructive" style={{ top: px(NOW_MIN) }} />

/** Board shell: card, horizontal scroll when columns don't fit (tablet shows ~2 doctors at a time). */
function BoardShell({ cols, colMin, head, body }: { cols: number; colMin: string; head: React.ReactNode; body: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <div className="grid min-w-full" style={{ gridTemplateColumns: `56px repeat(${cols}, minmax(${colMin}, 1fr))` }}>
          {head}
          {body}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== day */

/** Calendar · Day: one column per ticked doctor (avatar · name · clinic · count · colour swatch). */
export function DayBoard({ date, doctors }: { date: string; doctors: DoctorId[] }) {
  const t = useTranslations("appointments.calendar")
  const locale = useLocale()
  const text = useApptText()
  const list = useAppointmentsOn()(date)
  const overlay = useApptOverlay()
  const today = date === TODAY
  const cols = doctors.map(doctorById)
  return (
    <BoardShell
      cols={cols.length}
      colMin="var(--day-col)"
      head={
        <>
          <div className="border-b" />
          {cols.map((d) => (
            <DoctorHead key={d.id} doctor={d} count={list.filter((a) => a.doctor === d.id).length} />
          ))}
        </>
      }
      body={
        <>
          <Times today={today} />
          {cols.map((d) => (
            <div key={d.id} role="list" aria-label={bi(d.name, locale)} className="relative border-s" style={{ height: HEIGHT }}>
              <Lines />
              {breaksFor(d.id).map((b) => (
                <Block key={`b${b.start}`} start={b.start} duration={b.duration} name={t("lunch")} status="break" />
              ))}
              {list
                .filter((a) => a.doctor === d.id)
                .map((a) => (
                  <Block
                    key={a.id}
                    start={a.start}
                    duration={a.duration}
                    name={text.name(a)}
                    reason={text.reason(a)}
                    status={a.status}
                    telehealth={a.telehealth}
                    label={text.label(a)}
                    onOpen={() => overlay.open("details", a)}
                  />
                ))}
              {today && <NowLine />}
            </div>
          ))}
        </>
      }
    />
  )
}

function DoctorHead({ doctor, count }: { doctor: Doctor; count: number }) {
  const t = useTranslations("appointments.calendar")
  const locale = useLocale()
  return (
    <div className="flex items-center gap-2 border-b p-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
        {doctor.initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-xs leading-4">
        <span className="truncate font-medium">{bi(doctor.name, locale)}</span>
        <span className="text-muted-foreground">{t("clinicAppts", { clinic: bi(doctor.clinic, locale), count })}</span>
      </span>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: doctor.color }} />
    </div>
  )
}

/* ================================================================== week */

/** Sunday → Thursday of the week of `date` (design · Week view). */
export const weekDays = (sunday: string) => [0, 1, 2, 3, 4].map((i) => addDays(sunday, i))

/** Calendar · Week: one doctor, Sunday–Thursday; today's column tinted, "now" line across it. */
export function WeekBoard({ sunday, doctor }: { sunday: string; doctor: DoctorId }) {
  const dates = useDates()
  const text = useApptText()
  const on = useAppointmentsOn()
  const overlay = useApptOverlay()
  const days = weekDays(sunday)
  return (
    <BoardShell
      cols={days.length}
      colMin="7.5rem"
      head={
        <>
          <div className="border-b" />
          {days.map((d) => {
            const today = d === TODAY
            return (
              <div key={d} className="flex flex-col items-center border-b p-2" aria-current={today ? "date" : undefined}>
                <span className={cn("text-xs", today ? "text-primary" : "text-muted-foreground")}>{dates.weekdayShort(d)}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                    today && "bg-primary text-primary-foreground"
                  )}
                >
                  {Number(d.slice(8, 10))}
                </span>
              </div>
            )
          })}
        </>
      }
      body={
        <>
          <Times today={days.includes(TODAY)} />
          {days.map((d) => (
            <div key={d} role="list" aria-label={dates.full(d)} className={cn("relative border-s", d === TODAY && "bg-accent")} style={{ height: HEIGHT }}>
              <Lines />
              {on(d)
                .filter((a) => a.doctor === doctor)
                .map((a) => (
                  <Block
                    key={a.id}
                    start={a.start}
                    duration={a.duration}
                    name={text.name(a)}
                    status={a.status}
                    telehealth={a.telehealth}
                    label={text.label(a)}
                    onOpen={() => overlay.open("details", a)}
                  />
                ))}
              {d === TODAY && <NowLine />}
            </div>
          ))}
        </>
      }
    />
  )
}
