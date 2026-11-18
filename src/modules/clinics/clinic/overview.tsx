"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { VBars } from "@/components/reports/parts"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { Widget } from "@/components/ds/widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checklist } from "../settings"
import { CLINICS_TODAY, checklistOf, isSettingUp, FLOW_HOURS, MONTH_FROM, NOW_HOUR, flowOf, queueOf, type Clinic, type RoomStatus } from "../data"
import { ClinicTile } from "../parts"
import { statusTone, useClinicText } from "../text"
import { ClinicPage, OverviewActions, useCurrentClinic } from "./frame"

/**
 * Clinic page · Overview. One DOM order, arranged by the content width:
 *  · wide (≥ 64rem): header; left = Patients by hour, This month; right (360) = Doctors on duty, Next in line, Rooms now
 *  · medium (tablet): header; Patients by hour; This month (2×2); Doctors on duty | Next in line; Rooms now
 *  · narrow (mobile): header; Next in line; Doctors on duty; Patients by hour (2-hourly); This month; Rooms now
 */
export function ClinicOverview() {
  const c = useCurrentClinic()
  return (
    <ClinicPage actions={<OverviewActions />}>
      {isSettingUp(c) && <Checklist done={checklistOf(c)} clinicKey={c.key} />}
      <ClinicHeader clinic={c} />
      <div className="@container/ov">
        <div className="grid grid-cols-1 gap-4 @xl/ov:grid-cols-2 @5xl/ov:grid-cols-[minmax(0,1fr)_22.5rem] @5xl/ov:items-start @5xl/ov:gap-6">
          <div className="contents @5xl/ov:flex @5xl/ov:flex-col @5xl/ov:gap-6">
            <Flow clinic={c} className="order-3 @xl/ov:order-1 @xl/ov:col-span-2" />
            <Month clinic={c} className="order-4 @xl/ov:order-2 @xl/ov:col-span-2" />
          </div>
          <div className="contents @5xl/ov:flex @5xl/ov:flex-col @5xl/ov:gap-6">
            <OnDuty clinic={c} className="order-2 @xl/ov:order-3 @xl/ov:self-start @5xl/ov:self-stretch" />
            <Queue clinic={c} className="order-1 @xl/ov:order-4 @xl/ov:self-start @5xl/ov:self-stretch" />
            <RoomsNow clinic={c} className="order-5 @xl/ov:col-span-2" />
          </div>
        </div>
      </div>
    </ClinicPage>
  )
}

/** Widget / Clinic Header: 52px tile · name + status · "Floor · Wing · Ext. · branch"; fact chips at the end (wrap under it when narrow). */
export function ClinicHeader({ clinic: c }: { clinic: Clinic }) {
  const t = useTranslations("clinics.header")
  const { b, status } = useClinicText()
  const facts = [
    t("doctors", { n: c.doctors.length }),
    t("rooms", { n: c.rooms.length }),
    !c.ages ? t("allAges") : c.ages[1] >= 120 ? t("agesFrom", { from: c.ages[0] }) : t("ages", { from: c.ages[0], to: c.ages[1] }),
    c.rules.online ? t("online") : t("onlineOff"),
  ]
  return (
    <section className="@container/hd rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-4 @4xl/hd:flex-row @4xl/hd:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <ClinicTile icon={c.icon} tone={c.tone} size={52} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{b(c.name)}</h2>
              <StatusBadge tone={statusTone(c)}>{status(c)}</StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.floor ? t("subtitle", { floor: c.floor, wing: c.wing, ext: c.ext || "—", branch: b(c.branch) }) : b(c.branch)}
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <li key={f} className="inline-flex h-6 items-center rounded-full border bg-card px-2.5 text-xs font-medium text-foreground">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}


/** Widget / Clinic Flow: hourly bars 8a–9p (wide) or 2-hourly 8a–8p (compact, mobile); the current hour highlighted. */
function Flow({ clinic, className }: { clinic: Clinic; className?: string }) {
  const t = useTranslations("clinics.flow")
  const hourLabel = (h: number) => (h < 12 ? t("am", { h }) : t("pm", { h: h === 12 ? 12 : h - 12 }))
  const vals = flowOf(clinic)
  const pairs = FLOW_HOURS.filter((_, i) => i % 2 === 0)
  const sums = pairs.map((_, i) => vals[i * 2] + (vals[i * 2 + 1] ?? 0))
  const peak = Math.max(...vals, 1)
  const vmax = Math.max(8, Math.ceil(peak / 2) * 2)
  const vmax2 = Math.max(16, Math.ceil(Math.max(...sums) / 4) * 4)
  return (
    <Widget title={t("title")} description={t("text")} className={cn("gap-4 p-5", className)}>
      <div className="hidden @lg/widget:block">
        <VBars
          values={vals}
          labels={FLOW_HOURS.map((h) => hourLabel(h))}
          vmax={vmax}
          highlight={FLOW_HOURS.indexOf(NOW_HOUR)}
          height={150}
          ariaLabel={t("title")}
        />
      </div>
      <div className="@lg/widget:hidden">
        <VBars values={sums} labels={pairs.map((h) => hourLabel(h))} vmax={vmax2} highlight={pairs.indexOf(NOW_HOUR)} height={120} ariaLabel={t("title")} />
      </div>
    </Widget>
  )
}

/** Widget / Clinic Month: Visits · No-show rate · Rating · Revenue boxes (4 in a row when wide, else 2×2). */
function Month({ clinic: c, className }: { clinic: Clinic; className?: string }) {
  const t = useTranslations("clinics.month")
  const { dates } = useClinicText()
  const m = c.month
  const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")
  const items = [
    { k: "visits", label: t("visits"), value: m.visits.toLocaleString("en"), cap: t("visitsDelta", { d: `${sign(m.visitsDelta)}%`, month: dates.month("2026-10-15") }), good: true },
    { k: "noShow", label: t("noShow"), value: `${m.noShow}%`, cap: t("noShowDelta", { d: sign(m.noShowDelta) }), good: true },
    { k: "rating", label: t("rating"), value: `${m.rating} / 5`, cap: t("reviews", { n: m.reviews }) },
    { k: "revenue", label: t("revenue"), value: t("revenueValue", { n: m.revenue }), cap: t("insured", { n: m.insuredPct }) },
  ]
  return (
    <Widget title={t("title")} description={dates.dayRange(MONTH_FROM, CLINICS_TODAY).replace(" – ", "–")} className={cn("gap-4 p-5", className)}>
      <div className="grid grid-cols-2 gap-3 @2xl/widget:grid-cols-4">
        {items.map((it) => (
          <div key={it.k} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted p-3">
            <span className="text-xs text-muted-foreground">{it.label}</span>
            <span className="text-lg font-semibold text-foreground tabular-nums">
              <bdi dir={/[؀-ۿ]/.test(it.value) ? "rtl" : "ltr"}>{it.value}</bdi>
            </span>
            <span className={cn("text-xs tabular-nums", it.good ? "text-success" : "text-muted-foreground")}>
              <bdi>{it.cap}</bdi>
            </span>
          </div>
        ))}
      </div>
    </Widget>
  )
}

/** Widget / Clinic On Duty: avatar · name over today's status, divided rows. */
function OnDuty({ clinic: c, className }: { clinic: Clinic; className?: string }) {
  const t = useTranslations("clinics.duty")
  const { b } = useClinicText()
  const on = c.status === "paused" ? 0 : c.doctors.length
  return (
    <Widget title={t("title")} description={t("text", { on, all: c.doctors.length })} className={cn("gap-2 p-5", className)}>
      {c.doctors.length === 0 ? (
        <EmptyState icon="people" title={t("empty")} className="py-6" />
      ) : (
        <ul className="flex flex-col divide-y">
          {c.doctors.map((d) => (
            <li key={d.initials + d.name.en} className="flex items-center gap-2.5 py-2.5">
              <Avatar size="sm">
                <AvatarFallback>{d.initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="truncate text-sm font-medium">{b(d.name)}</span>
                <StatusBadge tone={d.today.tone}>{b(d.today.label)}</StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}

/** Widget / Clinic Queue: time · patient over reason · status; "Waiting room" → Appointments (only when it's on). */
function Queue({ clinic: c, className }: { clinic: Clinic; className?: string }) {
  const t = useTranslations("clinics.queue")
  const { b } = useClinicText()
  const list = queueOf(c)
  const waiting = list.filter((q) => q.state === "waiting")
  const longest = Math.max(0, ...waiting.map((q) => q.waited ?? 0))
  return (
    <Widget
      title={t("title")}
      description={waiting.length ? t("text", { n: c.today.waiting, m: longest }) : t("textNone")}
      className={cn("gap-2 p-5", className)}
      action={
        <IfModule id="appointments">
          <Button variant="ghost" size="sm" className="-me-2 shrink-0" asChild>
            <Link href="/appointments/waiting-room">
              {t("waitingRoom")}
              <Icon name="arrow-right-1" size={16} />
            </Link>
          </Button>
        </IfModule>
      }
    >
      {list.length === 0 ? (
        <EmptyState icon="profile-2user" title={t("empty")} className="py-6" />
      ) : (
        <ul className="flex flex-col divide-y">
          {list.map((q) => (
            <li key={q.time + q.patient.en} className="flex items-center gap-3 py-2.5">
              <span className="w-11 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{q.time}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{b(q.patient)}</span>
                <span className="truncate text-xs text-muted-foreground">{b(q.reason)}</span>
              </div>
              <StatusBadge tone={q.state === "waiting" ? "warning" : q.state === "checkedIn" ? "info" : "neutral"}>
                {q.state === "waiting" ? t("waiting", { n: q.waited ?? 0 }) : t(q.state)}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}

export const ROOM_BOX: Record<RoomStatus, string> = {
  inUse: "bg-accent text-primary",
  free: "bg-success-soft text-success-soft-foreground",
  cleaning: "bg-warning-soft text-warning-soft-foreground",
  closed: "bg-muted text-muted-foreground",
}

/** Widget / Clinic Rooms Now: room number + state boxes, 2 per row. */
function RoomsNow({ clinic: c, className }: { clinic: Clinic; className?: string }) {
  const t = useTranslations("clinics.roomsNow")
  const count = (s: RoomStatus) => c.rooms.filter((r) => r.status === s).length
  return (
    <Widget
      title={t("title")}
      description={t("summary", { inUse: count("inUse"), free: count("free"), cleaning: count("cleaning") })}
      className={cn("gap-4 p-5", className)}
    >
      <ul className="grid grid-cols-2 gap-2 @xl/widget:grid-cols-4">
        {c.rooms.map((r) => (
          <li key={r.number} className={cn("flex flex-col gap-0.5 rounded-lg p-2.5", ROOM_BOX[r.status])}>
            <span className="text-sm font-medium text-foreground tabular-nums">{r.number}</span>
            <span className="text-xs">{t(r.status)}</span>
          </li>
        ))}
      </ul>
    </Widget>
  )
}
