"use client"

import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { csvBlob, saveBlob, stamp } from "@/lib/export/files"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Donut, HBars, Kpis, ReportCard, ReportFilters, ReportTable, VBars, type Column, type Kpi } from "@/components/reports/parts"
import { Icon } from "@/components/ds/icon"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExportDialog } from "../calendar/export"
import { DOCTORS, TODAY } from "../data"
import { AppointmentsFrame } from "../frame"
import { useAppointmentsOn } from "../store"
import {
  BY_TYPE,
  CANCEL_REASONS,
  CHANNELS,
  CLINICS,
  DEFAULT_FILTERS,
  doctorsFor,
  FUNNEL,
  HEAT,
  HOURS_BY_DOCTOR,
  LEAD_BUCKETS,
  LONGEST_WAITS,
  NOSHOW_BY_WEEKDAY,
  perDay,
  PERIODS,
  RDOCTORS,
  REMINDER_CHANNELS,
  REPEAT_NOSHOWS,
  REPORTS,
  shareFor,
  VOLUME_BY_DOCTOR,
  WAIT_BY_DOCTOR,
  WAIT_BY_HOUR,
  type ClinicKey,
  type Filters,
  type ReportDoctor,
  type ReportKey,
} from "./data"

/* ================================================================== index */

/** Appointments · Reports tab: the module's six reports (icon · area badge · title · description · Open report). */
export function AppointmentsReportsIndex() {
  const t = useTranslations("appointments.reports")
  const dates = useDates()
  const [exporting, setExporting] = React.useState(false)
  return (
    <AppointmentsFrame onExport={() => setExporting(true)}>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <article key={r.key} className="flex flex-col gap-3.5 rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                <Icon name={r.icon} size={22} />
              </span>
              <span className="flex-1" />
              <Badge variant="secondary">{t(`badge.${r.key}`)}</Badge>
            </div>
            <h2 className="text-lg font-semibold">{t(`cards.${r.key}.title`)}</h2>
            <p className="flex-1 text-sm text-muted-foreground">{t(`cards.${r.key}.desc`)}</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs text-muted-foreground">{t("meta")}</span>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/appointments/reports/${r.key}`}>
                  {t("open")}
                  <Icon name="arrow-right-1" size={16} />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
      {exporting && <ExportDialog open={exporting} onOpenChange={setExporting} days={[TODAY]} doctors={DOCTORS.map((d) => d.id)} rangeLabel={dates.full(TODAY)} fileStem={`reports-${TODAY}`} />}
    </AppointmentsFrame>
  )
}

/* ================================================================== shell */

type Csv = { name: string; head: string[]; rows: (string | number)[][] }
type Ctx = { f: Filters; share: number; doctors: ReportDoctor[]; scale: (v: number) => number; n: (v: number) => string; range: string }
const FilterCtx = React.createContext<Ctx | null>(null)
const useR = () => React.useContext(FilterCtx)!

/**
 * Report page (Appointments · Report · <name> · 1440 / 768 / 390): header back to Reports, module tabs with Print ·
 * Export (CSV of the report's table), period / clinic / doctor filters (only the period on mobile), then the body.
 */
function ReportShell({ report, csv, children }: { report: ReportKey; csv: (c: Ctx) => Csv; children: React.ReactNode }) {
  const t = useTranslations("appointments.reports")
  const tn = useTranslations("shell.nav")
  const locale = useLocale()
  const dates = useDates()
  const format = useFormatter()
  const today = useAppointmentsOn()(TODAY)
  const [f, setF] = React.useState<Filters>(DEFAULT_FILTERS)
  const p = PERIODS.find((x) => x.key === f.period)!
  const share = shareFor(f)
  const ctx: Ctx = {
    f,
    share,
    doctors: doctorsFor(f),
    scale: (v) => Math.round(v * share),
    n: (v) => format.number(Math.round(v), "integer"),
    range: dates.dayRange(p.from, p.to),
  }
  const clinicDoctors = RDOCTORS.filter((d) => f.clinic === "all" || d.clinic === f.clinic)

  const exportCsv = () => {
    const { name, head, rows } = csv(ctx)
    saveBlob(csvBlob(head, rows.map((r) => r.map(String))), `${name}-${stamp()}.csv`)
    toast.success(t("exported"), { description: t("exportedText", { count: rows.length }) })
  }

  return (
    <PageContainer>
      <PageTitle
        title={t(`cards.${report}.title`)}
        back="/appointments/reports"
        crumbs={[
          { label: tn("appointments"), href: "/appointments" },
          { label: t("back"), href: "/appointments/reports" },
        ]}
      />
      <Button variant="ghost" size="sm" className="-ms-2 -mb-2 w-fit md:hidden" asChild>
        <Link href="/appointments/reports">
          <Icon name="arrow-left" size={20} />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        tabs={<ModuleTabsNav module="appointments" counts={{ calendar: today.length, list: today.length, waiting: today.filter((a) => a.status === "arrived").length }} />}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Icon name="printer" size={20} />
              {t("print")}
            </Button>
            <Button onClick={exportCsv}>
              <Icon name="export" size={20} />
              {t("export")}
            </Button>
          </>
        }
      />
      <ReportFilters
        selects={[
          {
            label: t("filter.period"),
            value: f.period,
            onChange: (v) => setF((s) => ({ ...s, period: v as Filters["period"] })),
            options: PERIODS.map((x) => ({ value: x.key, label: dates.dayRange(x.from, x.to) })),
            width: "md:w-40.5",
          },
          {
            label: t("filter.clinic"),
            value: f.clinic,
            onChange: (v) => setF((s) => ({ ...s, clinic: v as Filters["clinic"], doctor: "all" })),
            options: [{ value: "all", label: t("filter.allClinics") }, ...CLINICS.map((c) => ({ value: c.key, label: bi(c.name, locale) }))],
          },
          {
            label: t("filter.doctor"),
            value: f.doctor,
            onChange: (v) => setF((s) => ({ ...s, doctor: v })),
            options: [{ value: "all", label: t("filter.allDoctors") }, ...clinicDoctors.map((d) => ({ value: d.key, label: bi(d.name, locale) }))],
          },
        ]}
      />
      <FilterCtx.Provider value={ctx}>{children}</FilterCtx.Provider>
    </PageContainer>
  )
}

export function AppointmentsReport({ report }: { report: ReportKey }) {
  switch (report) {
    case "volume":
      return <VolumeReport />
    case "no-shows":
      return <NoShowsReport />
    case "utilisation":
      return <UtilisationReport />
    case "waiting-time":
      return <WaitingReport />
    case "channels":
      return <ChannelsReport />
    case "reminders":
      return <RemindersReport />
  }
}

/* ================================================================== helpers */

const CLINIC_COLOR: Record<ClinicKey, string> = { cardiology: "bg-chart-1", pediatrics: "bg-chart-2", orthopedics: "bg-chart-4", dental: "bg-chart-3" }
const pct = (v: number, digits = 0) => `${v.toFixed(digits)}%`

function DoctorCell({ d }: { d: ReportDoctor }) {
  const locale = useLocale()
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{bi(d.name, locale)}</span>
      <span className="truncate text-xs text-muted-foreground">{bi(CLINICS.find((c) => c.key === d.clinic)!.name, locale)}</span>
    </span>
  )
}

/** Compact row (tablet / mobile): title · sub line · end value. */
function Item({ title, sub, end }: { title: React.ReactNode; sub: React.ReactNode; end: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{sub}</span>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums">{end}</span>
    </div>
  )
}

/** Weekday label: Sun, Mon … (Arabic design: single letters ح ن ث …). */
function useWeekday() {
  const t = useTranslations("appointments")
  const locale = useLocale()
  const letters = t("calendar.weekdays").split(",")
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
  return (i: number) => (locale === "ar" ? letters[i] : t(`reports.weekday.${keys[i]}`))
}

const Grid2 = ({ children }: { children: React.ReactNode }) => <div className="grid gap-4 md:gap-6 xl:grid-cols-2">{children}</div>

/* ================================================================== 1 · volume */

function VolumeReport() {
  return (
    <ReportShell
      report="volume"
      csv={({ doctors, scale }) => ({
        name: "appointment-volume",
        head: ["Doctor", "Booked", "Completed", "Cancelled", "No-show"],
        rows: doctors.map((d) => {
          const v = VOLUME_BY_DOCTOR[d.key]
          return [d.name.en, scale(v.booked), scale(v.completed), scale(v.cancelled), scale(v.noShow)]
        }),
      })}
    >
      <VolumeBody />
    </ReportShell>
  )
}

function VolumeBody() {
  const t = useTranslations("appointments.reports")
  const locale = useLocale()
  const { f, doctors, share, n, range } = useR()
  const days = perDay(f)
  const total = days.reduce((s, d) => s + d.value, 0)
  const open = days.filter((d) => d.value > 0).length
  const max = Math.max(...days.map((d) => d.value))
  const factor = PERIODS.find((p) => p.key === f.period)!.factor
  const clinics = CLINICS.map((c) => ({ c, v: doctors.filter((d) => d.clinic === c.key).reduce((s, d) => s + VOLUME_BY_DOCTOR[d.key].booked * factor, 0) })).filter((x) => x.v > 0)
  const cmax = Math.max(...clinics.map((x) => x.v), 1)
  const types = (Object.keys(BY_TYPE) as (keyof typeof BY_TYPE)[]).map((k) => ({ k, v: BY_TYPE[k] * share }))
  const tmax = Math.max(...types.map((x) => x.v))
  const kpis: Kpi[] = [
    { icon: "calendar-tick", label: t("volume.kAppts"), value: n(total), delta: "+6%", tone: "success", caption: t("vsPrev") },
    { icon: "chart-2", label: t("volume.kAvg"), value: n(total / Math.max(open, 1)), delta: t("volume.kAvgDelta", { n: open }), tone: "info", caption: t("volume.kAvgCap") },
    { icon: "tick-circle", tile: "success", label: t("volume.kDone"), value: "89%", delta: n(total * 0.898), tone: "success", caption: t("volume.kDoneCap") },
    { icon: "video", label: t("volume.kTele"), value: "16%", delta: t("pts", { n: "+3" }), tone: "info", caption: t("vsPrev") },
  ]
  const cols: Column<ReportDoctor>[] = [
    { key: "doctor", head: t("col.doctor"), width: "minmax(0,2.5fr)", cell: (d) => <DoctorCell d={d} /> },
    { key: "booked", head: t("volume.booked"), cell: (d) => n(VOLUME_BY_DOCTOR[d.key].booked * factor) },
    { key: "completed", head: t("volume.completed"), cell: (d) => n(VOLUME_BY_DOCTOR[d.key].completed * factor) },
    { key: "cancelled", head: t("volume.cancelled"), cell: (d) => n(VOLUME_BY_DOCTOR[d.key].cancelled * factor) },
    { key: "noShow", head: t("volume.noShow"), cell: (d) => n(VOLUME_BY_DOCTOR[d.key].noShow * factor) },
    { key: "completion", head: t("volume.completion"), width: "minmax(0,1.3fr)", cell: (d) => <Completion d={d} /> },
  ]
  return (
    <>
      <Kpis items={kpis} />
      <ReportCard title={t("volume.perDay")} description={t("volume.perDaySub", { range })}>
        <VBars
          values={days.map((d) => d.value)}
          labels={days.map((d) => String(Number(d.date.slice(8, 10))))}
          vmax={Math.max(40, Math.ceil(max / 45) * 45)}
          highlight={days.findIndex((d) => d.value === max)}
          height={180}
          ariaLabel={t("volume.perDay")}
        />
      </ReportCard>
      <Grid2>
        <ReportCard title={t("volume.byClinic")} description={t("volume.byClinicSub", { n: n(total) })}>
          <HBars rows={clinics.map(({ c, v }) => ({ key: c.key, label: bi(c.name, locale), value: n(v), amount: v, color: CLINIC_COLOR[c.key] }))} vmax={cmax * 1.1} />
        </ReportCard>
        <ReportCard title={t("volume.byType")} description={t("volume.byTypeSub")}>
          <HBars rows={types.map(({ k, v }) => ({ key: k, label: t(`volume.type.${k}`), value: n(v), amount: v, color: k === "telehealth" ? "bg-chart-2" : "bg-chart-1" }))} vmax={tmax * 1.02} />
        </ReportCard>
      </Grid2>
      <ReportCard title={t("volume.byDoctor")} description={t("volume.byDoctorSub")}>
        <ReportTable
          rows={doctors}
          columns={cols}
          rowKey={(d) => d.key}
          item={(d) => {
            const v = VOLUME_BY_DOCTOR[d.key]
            return (
              <Item
                title={bi(d.name, locale)}
                sub={t("volume.item", { clinic: bi(CLINICS.find((c) => c.key === d.clinic)!.name, locale), booked: n(v.booked * factor), noShow: n(v.noShow * factor) })}
                end={pct((v.completed / v.booked) * 100)}
              />
            )
          }}
        />
      </ReportCard>
    </>
  )
}

function Completion({ d }: { d: ReportDoctor }) {
  const v = VOLUME_BY_DOCTOR[d.key]
  const p = Math.round((v.completed / v.booked) * 100)
  return (
    <span className="flex items-center gap-3">
      <span className="h-1.5 w-22.5 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", p >= 90 ? "bg-success" : "bg-warning")} style={{ width: `${p}%` }} />
      </span>
      <span className="text-xs tabular-nums">{p}%</span>
    </span>
  )
}

/* ================================================================== 2 · no-shows & cancellations */

function NoShowsReport() {
  return (
    <ReportShell
      report="no-shows"
      csv={({ doctors }) => ({
        name: "repeat-no-shows",
        head: ["Patient", "Mobile", "No-shows", "Last no-show"],
        rows: REPEAT_NOSHOWS.filter((r) => doctors.some((d) => d.key === r.doctor)).map((r) => [r.name.en, r.mobile, r.count, r.last]),
      })}
    >
      <NoShowsBody />
    </ReportShell>
  )
}

function NoShowsBody() {
  const t = useTranslations("appointments.reports")
  const locale = useLocale()
  const dates = useDates()
  const { doctors, scale, n } = useR()
  const rows = REPEAT_NOSHOWS.filter((r) => doctors.some((d) => d.key === r.doctor))
  const reasons = (Object.keys(CANCEL_REASONS) as (keyof typeof CANCEL_REASONS)[]).map((k) => ({ k, v: scale(CANCEL_REASONS[k]) }))
  const rmax = Math.max(...reasons.map((r) => r.v), 1)
  const wd = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
  const wday = useWeekday()
  const kpis: Kpi[] = [
    { icon: "close-circle", tile: "destructive", label: t("noShows.kRate"), value: "6.2%", delta: t("pts", { n: "−1.1" }), tone: "success", caption: t("vsPrev") },
    { icon: "calendar-2", tile: "warning", label: t("noShows.kCancel"), value: n(scale(131)), delta: "6.7%", tone: "warning", caption: t("noShows.kCancelCap") },
    { icon: "timer-1", tile: "warning", label: t("noShows.kLate"), value: n(scale(48)), delta: t("noShows.kLateDelta"), tone: "warning", caption: t("noShows.kLateCap") },
    { icon: "money-remove", tile: "destructive", label: t("noShows.kLost"), value: t("sar", { n: n(scale(41300)) }), delta: n(scale(244)), tone: "destructive", caption: t("noShows.kLostCap") },
  ]
  const warn = (name: string) => toast.success(t("noShows.warned"), { description: t("noShows.warnedText", { name }) })
  const status = (c: number) => (
    <StatusBadge tone={c >= 3 ? "destructive" : "warning"}>{c >= 3 ? t("noShows.blocked") : t("noShows.oneMore")}</StatusBadge>
  )
  const cols: Column<(typeof REPEAT_NOSHOWS)[number]>[] = [
    { key: "patient", head: t("col.patient"), width: "minmax(0,1.6fr)", cell: (r) => bi(r.name, locale) },
    { key: "mobile", head: t("noShows.mobile"), width: "minmax(0,1.2fr)", cell: (r) => <bdi dir="ltr" className="tabular-nums">{r.mobile}</bdi> },
    { key: "count", head: t("noShows.count"), width: "minmax(0,0.8fr)", cell: (r) => <span className={cn("tabular-nums", r.count >= 3 && "text-destructive")}>{r.count}</span> },
    { key: "last", head: t("noShows.last"), cell: (r) => dates.short(r.last) },
    { key: "status", head: t("noShows.status"), width: "minmax(0,1.5fr)", cell: (r) => status(r.count) },
    {
      key: "act",
      head: <span className="sr-only">{t("noShows.warn")}</span>,
      width: "9rem",
      cell: (r) => (
        <Button variant="outline" size="sm" onClick={() => warn(bi(r.name, locale))}>
          <Icon name="sms" size={20} />
          {t("noShows.warn")}
        </Button>
      ),
    },
  ]
  return (
    <>
      <Kpis items={kpis} />
      <Grid2>
        <ReportCard title={t("noShows.byDay")} description={t("noShows.byDaySub")}>
          <VBars
            values={NOSHOW_BY_WEEKDAY}
            labels={wd.map((_, i) => wday(i))}
            vmax={12}
            ticks={[12, 9, 6, 3, 0]}
            tick={(v) => `${v}%`}
            highlight={6}
            height={140}
            ariaLabel={t("noShows.byDay")}
          />
        </ReportCard>
        <ReportCard title={t("noShows.reasons")} description={t("noShows.reasonsSub", { n: n(scale(131)), late: n(scale(48)) })}>
          <HBars rows={reasons.map((r, i) => ({ key: r.k, label: t(`noShows.reason.${r.k}`), value: n(r.v), amount: r.v, color: i === 0 ? "bg-warning" : "bg-chart-1" }))} vmax={rmax * 1.03} />
        </ReportCard>
      </Grid2>
      <ReportCard title={t("noShows.repeat")} description={t("noShows.repeatSub")}>
        <ReportTable
          rows={rows}
          columns={cols}
          rowKey={(r) => r.mobile}
          item={(r) => (
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{bi(r.name, locale)}</span>
                <span className="text-xs text-muted-foreground">{t("noShows.lastItem", { date: dates.short(r.last) })}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn("text-sm font-medium tabular-nums", r.count >= 3 && "text-destructive")}>{r.count}</span>
                {status(r.count)}
              </div>
            </div>
          )}
        />
      </ReportCard>
    </>
  )
}

/* ================================================================== 3 · doctor utilisation */

const utilTone = (p: number): StatusTone => (p > 90 ? "warning" : p < 70 ? "destructive" : "success")
const UTIL_BAR: Record<string, string> = { warning: "bg-warning", destructive: "bg-destructive", success: "bg-chart-1" }

function UtilisationReport() {
  return (
    <ReportShell
      report="utilisation"
      csv={({ doctors }) => ({
        name: "doctor-utilisation",
        head: ["Doctor", "Available h", "Booked h", "Utilisation %", "Idle slots", "Overtime h"],
        rows: doctors.map((d) => {
          const h = HOURS_BY_DOCTOR[d.key]
          return [d.name.en, h.available, h.booked, Math.round((h.booked / h.available) * 100), h.idle, h.overtime]
        }),
      })}
    >
      <UtilisationBody />
    </ReportShell>
  )
}

function UtilisationBody() {
  const t = useTranslations("appointments.reports")
  const locale = useLocale()
  const { doctors, n, range, scale } = useR()
  const sum = (k: "available" | "booked" | "idle") => doctors.reduce((s, d) => s + HOURS_BY_DOCTOR[d.key][k], 0)
  const util = Math.round((sum("booked") / Math.max(sum("available"), 1)) * 100)
  const kpis: Kpi[] = [
    { icon: "activity", label: t("utilisation.kUtil"), value: `${util}%`, delta: t("pts", { n: "+4" }), tone: "success", caption: t("vsPrev") },
    { icon: "timer-1", tile: "warning", label: t("utilisation.kIdle"), value: t("hours", { n: n(scale(64)) }), delta: n(sum("idle")), tone: "warning", caption: t("utilisation.kIdleCap") },
    { icon: "warning-2", tile: "destructive", label: t("utilisation.kOver"), value: "5", delta: t("utilisation.kOverDelta"), tone: "destructive", caption: t("utilisation.kOverCap") },
    { icon: "chart-2", label: t("utilisation.kBusy"), value: "10–11", delta: t("utilisation.kBusyDelta"), tone: "info", caption: t("utilisation.kBusyCap") },
  ]
  const p = (d: ReportDoctor) => Math.round((HOURS_BY_DOCTOR[d.key].booked / HOURS_BY_DOCTOR[d.key].available) * 100)
  const cols: Column<ReportDoctor>[] = [
    { key: "doctor", head: t("col.doctor"), width: "minmax(0,2.4fr)", cell: (d) => <DoctorCell d={d} /> },
    { key: "available", head: t("utilisation.available"), cell: (d) => t("hours", { n: HOURS_BY_DOCTOR[d.key].available }) },
    { key: "booked", head: t("utilisation.booked"), cell: (d) => t("hours", { n: HOURS_BY_DOCTOR[d.key].booked }) },
    { key: "util", head: t("utilisation.util"), width: "minmax(0,1.3fr)", cell: (d) => <StatusBadge tone={utilTone(p(d))}>{p(d)}%</StatusBadge> },
    { key: "idle", head: t("utilisation.idle"), cell: (d) => HOURS_BY_DOCTOR[d.key].idle },
    {
      key: "overtime",
      head: t("utilisation.overtime"),
      cell: (d) => <span className={cn(HOURS_BY_DOCTOR[d.key].overtime > 4 && "text-destructive")}>{t("hours", { n: HOURS_BY_DOCTOR[d.key].overtime })}</span>,
    },
  ]
  return (
    <>
      <Kpis items={kpis} />
      <Grid2>
        <ReportCard title={t("utilisation.byDoctor")} description={t("utilisation.byDoctorSub")}>
          <HBars rows={doctors.map((d) => ({ key: d.key, label: bi(d.name, locale), value: `${p(d)}%`, amount: p(d), color: UTIL_BAR[utilTone(p(d))] }))} vmax={100} />
        </ReportCard>
        <ReportCard title={t("utilisation.busy")} description={t("utilisation.busySub")}>
          <Heatmap />
        </ReportCard>
      </Grid2>
      <ReportCard title={t("utilisation.hours")} description={range}>
        <ReportTable
          rows={doctors}
          columns={cols}
          rowKey={(d) => d.key}
          item={(d) => {
            const h = HOURS_BY_DOCTOR[d.key]
            return <Item title={bi(d.name, locale)} sub={t("utilisation.item", { booked: h.booked, available: h.available, idle: h.idle })} end={<StatusBadge tone={utilTone(p(d))}>{p(d)}%</StatusBadge>} />
          }}
        />
      </ReportCard>
    </>
  )
}

const HEAT_BG = ["bg-blue-100", "bg-blue-200", "bg-blue-300", "bg-blue-400", "bg-blue-500", "bg-blue-600"]

/** Busy hours (design: Sun–Thu × 08–15, blue 100 → 600) with a Quiet → Busy legend. */
function Heatmap() {
  const t = useTranslations("appointments.reports")
  const days = ["sun", "mon", "tue", "wed", "thu"] as const
  const wday = useWeekday()
  const hours = ["08", "09", "10", "11", "12", "13", "14", "15"]
  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      <div role="grid" aria-label={t("utilisation.busy")} className="grid min-w-90 grid-cols-[2.5rem_repeat(8,minmax(0,1fr))] gap-1 text-xs">
        <span />
        {hours.map((h) => (
          <span key={h} className="text-center text-muted-foreground tabular-nums">
            {h}
          </span>
        ))}
        {days.map((d, r) => (
          <React.Fragment key={d}>
            <span className="self-center text-muted-foreground">{wday(r)}</span>
            {HEAT[r].map((lv, c) => (
              <span
                key={c}
                role="gridcell"
                aria-label={t("utilisation.cell", { day: t(`weekday.${d}`), hour: hours[c], n: lv })}
                className={cn("h-7 rounded-md", HEAT_BG[lv - 1])}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden>
        {t("utilisation.quiet")}
        {HEAT_BG.map((c) => (
          <span key={c} className={cn("h-2 w-4 rounded-sm", c)} />
        ))}
        {t("utilisation.busyLabel")}
      </div>
    </div>
  )
}

/* ================================================================== 4 · waiting time */

function WaitingReport() {
  return (
    <ReportShell
      report="waiting-time"
      csv={({ doctors }) => ({
        name: "longest-waits",
        head: ["Patient", "Doctor", "Checked in", "Called in", "Wait (min)"],
        rows: LONGEST_WAITS.filter((w) => doctors.some((d) => d.key === w.doctor)).map((w) => [w.name.en, RDOCTORS.find((d) => d.key === w.doctor)!.name.en, w.checkIn, w.calledIn, w.wait]),
      })}
    >
      <WaitingBody />
    </ReportShell>
  )
}

function WaitingBody() {
  const t = useTranslations("appointments.reports")
  const locale = useLocale()
  const { doctors, n, scale } = useR()
  const rows = LONGEST_WAITS.filter((w) => doctors.some((d) => d.key === w.doctor))
  const doc = (k: string) => bi(RDOCTORS.find((d) => d.key === k)!.name, locale)
  const kpis: Kpi[] = [
    { icon: "timer-1", label: t("waiting.kAvg"), value: t("min", { n: 12 }), delta: t("min", { n: "−2" }), tone: "success", caption: t("vsPrev") },
    { icon: "activity", label: t("waiting.kMedian"), value: t("min", { n: 9 }), delta: t("min", { n: "−1" }), tone: "info", caption: t("vsPrev") },
    { icon: "warning-2", tile: "warning", label: t("waiting.kOver"), value: "4%", delta: n(scale(71)), tone: "warning", caption: t("waiting.kOverCap") },
    { icon: "danger", tile: "destructive", label: t("waiting.kLongest"), value: t("min", { n: 52 }), delta: t("waiting.kLongestDelta"), tone: "destructive", caption: t("waiting.kLongestCap") },
  ]
  const waitBadge = (m: number) => <StatusBadge tone={m > 45 ? "destructive" : "warning"}>{t("min", { n: m })}</StatusBadge>
  const cols: Column<(typeof LONGEST_WAITS)[number]>[] = [
    { key: "patient", head: t("col.patient"), width: "minmax(0,1.6fr)", cell: (w) => bi(w.name, locale) },
    { key: "doctor", head: t("col.doctor"), width: "minmax(0,1.5fr)", cell: (w) => doc(w.doctor) },
    { key: "in", head: t("waiting.checkedIn"), width: "minmax(0,0.9fr)", cell: (w) => <span className="tabular-nums">{w.checkIn}</span> },
    { key: "called", head: t("waiting.calledIn"), width: "minmax(0,0.9fr)", cell: (w) => <span className="tabular-nums">{w.calledIn}</span> },
    { key: "wait", head: t("waiting.wait"), width: "minmax(0,0.9fr)", cell: (w) => waitBadge(w.wait) },
    { key: "reason", head: t("waiting.reasonCol"), width: "minmax(0,1.7fr)", cell: (w) => <span className="text-xs text-muted-foreground">{t(`waiting.reason.${w.reason}`)}</span> },
  ]
  return (
    <>
      <Kpis items={kpis} />
      <Grid2>
        <ReportCard title={t("waiting.byHour")} description={t("waiting.byHourSub")}>
          <VBars values={WAIT_BY_HOUR} labels={["08", "09", "10", "11", "12", "13", "14", "15"]} vmax={20} highlight={3} height={140} ariaLabel={t("waiting.byHour")} />
        </ReportCard>
        <ReportCard title={t("waiting.byDoctor")} description={t("waiting.byDoctorSub")}>
          <HBars
            rows={doctors.map((d) => ({ key: d.key, label: bi(d.name, locale), value: t("min", { n: WAIT_BY_DOCTOR[d.key] }), amount: WAIT_BY_DOCTOR[d.key], color: WAIT_BY_DOCTOR[d.key] > 15 ? "bg-warning" : "bg-chart-1" }))}
            vmax={25}
          />
        </ReportCard>
      </Grid2>
      <ReportCard title={t("waiting.longest")} description={t("waiting.longestSub")}>
        <ReportTable
          rows={rows}
          columns={cols}
          rowKey={(w) => w.name.en}
          item={(w) => <Item title={bi(w.name, locale)} sub={`${w.checkIn} → ${w.calledIn} · ${t(`waiting.reason.${w.reason}`)}`} end={waitBadge(w.wait)} />}
        />
      </ReportCard>
    </>
  )
}

/* ================================================================== 5 · booking channels & lead time */

const noShowTone = (v: number): StatusTone => (v < 5 ? "success" : v < 8 ? "warning" : "destructive")

function ChannelsReport() {
  return (
    <ReportShell
      report="channels"
      csv={({ scale }) => ({
        name: "booking-channels",
        head: ["Channel", "Bookings", "No-show %", "Cancelled %", "Avg lead (days)"],
        rows: CHANNELS.map((c) => [c.key, scale(c.bookings), c.noShow, c.cancelled, c.lead]),
      })}
    >
      <ChannelsBody />
    </ReportShell>
  )
}

function ChannelsBody() {
  const t = useTranslations("appointments.reports")
  const { scale, n } = useR()
  const total = CHANNELS.reduce((s, c) => s + scale(c.bookings), 0)
  const kpis: Kpi[] = [
    { icon: "global", label: t("channels.channel.online"), value: "46%", delta: t("pts", { n: "+5" }), tone: "success", caption: t("vsPrev") },
    { icon: "call", label: t("channels.channel.phone"), value: "31%", delta: t("pts", { n: "−3" }), tone: "neutral", caption: t("vsPrev") },
    { icon: "profile-2user", tile: "warning", label: t("channels.channel.walkIn"), value: "15%", delta: n(scale(292)), tone: "neutral", caption: t("channels.kWalkCap") },
    { icon: "calendar-2", label: t("channels.kLead"), value: t("days", { n: "3.4" }), delta: t("channels.kLeadDelta"), tone: "info", caption: t("channels.kLeadCap") },
  ]
  const cols: Column<(typeof CHANNELS)[number]>[] = [
    { key: "channel", head: t("col.channel"), width: "minmax(0,3fr)", cell: (c) => t(`channels.channel.${c.key}`) },
    { key: "bookings", head: t("channels.bookings"), cell: (c) => n(scale(c.bookings)) },
    { key: "noShow", head: t("channels.noShow"), cell: (c) => <StatusBadge tone={noShowTone(c.noShow)}>{pct(c.noShow, 1)}</StatusBadge> },
    { key: "cancelled", head: t("channels.cancelled"), cell: (c) => pct(c.cancelled, 1) },
    { key: "lead", head: t("channels.avgLead"), cell: (c) => t("days", { n: c.lead.toFixed(1) }) },
  ]
  return (
    <>
      <Kpis items={kpis} />
      <Grid2>
        <ReportCard title={t("channels.donut")} description={t("channels.donutSub", { n: n(total) })}>
          <Donut rows={CHANNELS.map((c) => ({ key: c.key, label: t(`channels.channel.${c.key}`), value: c.share, color: c.color }))} center="46%" caption="" />
        </ReportCard>
        <ReportCard title={t("channels.lead")} description={t("channels.leadSub", { avg: "3.4" })}>
          <div className="@max-[30rem]/rpt:hidden">
            <VBars
              values={LEAD_BUCKETS.map((b) => b.value)}
              labels={LEAD_BUCKETS.map((b) => t(`channels.bucket.${b.key}`))}
              vmax={30}
              ticks={[30, 23, 15, 8, 0]}
              tick={(v) => `${v}%`}
              highlight={2}
              height={130}
              ariaLabel={t("channels.lead")}
            />
          </div>
          <div className="@min-[30rem]/rpt:hidden">
            <VBars
              values={LEAD_BUCKETS.map((b) => b.value)}
              labels={LEAD_BUCKETS.map((b) => t(`channels.bucketShort.${b.key}`))}
              vmax={30}
              ticks={[30, 23, 15, 8, 0]}
              tick={(v) => `${v}%`}
              highlight={2}
              height={130}
              ariaLabel={t("channels.lead")}
            />
          </div>
        </ReportCard>
      </Grid2>
      <ReportCard title={t("channels.byChannel")} description={t("channels.byChannelSub")}>
        <ReportTable
          rows={CHANNELS}
          columns={cols}
          rowKey={(c) => c.key}
          item={(c) => (
            <Item
              title={t(`channels.channel.${c.key}`)}
              sub={t("channels.item", { n: n(scale(c.bookings)), c: pct(c.cancelled, 1) })}
              end={<StatusBadge tone={noShowTone(c.noShow)}>{pct(c.noShow, 1)}</StatusBadge>}
            />
          )}
        />
      </ReportCard>
    </>
  )
}

/* ================================================================== 6 · reminders */

function RemindersReport() {
  return (
    <ReportShell
      report="reminders"
      csv={({ scale }) => ({
        name: "reminders",
        head: ["Channel", "Sent", "Delivered %", "Confirmed %", "Cost (SAR)"],
        rows: REMINDER_CHANNELS.map((c) => [c.key, scale(c.sent), c.delivered, c.confirmed, scale(c.cost)]),
      })}
    >
      <RemindersBody />
    </ReportShell>
  )
}

function RemindersBody() {
  const t = useTranslations("appointments.reports")
  const { scale, n, range } = useR()
  const kpis: Kpi[] = [
    { icon: "sms", label: t("reminders.kSent"), value: n(scale(3812)), delta: "97%", tone: "info", caption: t("reminders.kSentCap") },
    { icon: "tick-circle", tile: "success", label: t("reminders.kConfirmed"), value: "71%", delta: t("pts", { n: "+6" }), tone: "success", caption: t("vsPrev") },
    { icon: "close-circle", tile: "destructive", label: t("reminders.kNoShow"), value: "4.1%", delta: "11.8%", tone: "success", caption: t("reminders.kNoShowCap") },
    { icon: "money-remove", label: t("reminders.kCost"), value: t("sar", { n: n(scale(1140)) }), delta: t("reminders.kCostDelta"), tone: "neutral", caption: t("reminders.kCostCap") },
  ]
  const steps = (Object.keys(FUNNEL) as (keyof typeof FUNNEL)[]).map((k) => ({ k, v: scale(FUNNEL[k]) }))
  const confirmTone = (v: number): StatusTone => (v >= 80 ? "success" : "warning")
  const cols: Column<(typeof REMINDER_CHANNELS)[number]>[] = [
    { key: "channel", head: t("col.channel"), width: "minmax(0,3fr)", cell: (c) => t(`reminders.${c.key}`) },
    { key: "sent", head: t("reminders.sent"), cell: (c) => n(scale(c.sent)) },
    { key: "delivered", head: t("reminders.delivered"), cell: (c) => pct(c.delivered, 1) },
    { key: "confirmed", head: t("reminders.confirmed"), cell: (c) => <StatusBadge tone={confirmTone(c.confirmed)}>{pct(c.confirmed, 1)}</StatusBadge> },
    { key: "cost", head: t("reminders.cost"), cell: (c) => t("sar", { n: n(scale(c.cost)) }) },
  ]
  return (
    <>
      <Kpis items={kpis} />
      <Grid2>
        <ReportCard title={t("reminders.rate")} description={t("reminders.rateSub")}>
          <div className="flex flex-col gap-4">
            <VBars
              values={[4.1, 11.8]}
              labels={[t("reminders.with"), t("reminders.without")]}
              vmax={15}
              ticks={[15, 10, 8, 5, 0]}
              tick={(v) => `${v}%`}
              highlight={0}
              height={130}
              ariaLabel={t("reminders.rate")}
            />
            <p className="text-sm text-success">{t("reminders.cut", { n: 65 })}</p>
          </div>
        </ReportCard>
        <ReportCard title={t("reminders.funnel")} description={range}>
          <HBars rows={steps.map((s) => ({ key: s.k, label: t(`reminders.step.${s.k}`), value: n(s.v), amount: s.v, color: s.k === "confirmed" ? "bg-success" : "bg-chart-1" }))} vmax={steps[0].v * 1.02} />
        </ReportCard>
      </Grid2>
      <ReportCard title={t("reminders.byChannel")} description={t("reminders.byChannelSub")}>
        <ReportTable
          rows={[...REMINDER_CHANNELS]}
          columns={cols}
          rowKey={(c) => c.key}
          item={(c) => (
            <Item
              title={t(`reminders.${c.key}`)}
              sub={t("reminders.item", { n: n(scale(c.sent)), d: pct(c.delivered, 1) })}
              end={<StatusBadge tone={confirmTone(c.confirmed)}>{pct(c.confirmed, 1)}</StatusBadge>}
            />
          )}
        />
      </ReportCard>
    </>
  )
}
