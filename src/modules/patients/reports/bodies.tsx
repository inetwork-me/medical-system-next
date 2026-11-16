"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { allPatients, MISSING_FIELDS, type BranchKey, type MissingField } from "../data"
import { useText } from "../profile/use-patient"
import { toggleTag, usePatientsStore } from "../store"
import {
  BRANCH,
  CLINIC,
  CLINIC_COUNTS,
  DEPT,
  DOCTOR,
  REPORTS,
  REG_DAYS,
  STAFF,
  STAY_DEPT,
  STAY_STEPS,
  STAY_TARGET,
  activityRows,
  duplicateGroups,
  dupValues,
  incompleteRows,
  inPeriod,
  isOutpatient,
  registrationRows,
  stayRows,
  visitRows,
  type ActionKind,
  type Booking,
  type DupField,
  type DupReason,
  type Period,
  type ReportKey,
  type Source,
  type VClinic,
  type VStatus,
} from "./data"
import { Chips, Donut, HBars, Kpis, PatientCell, ReportCard, ReportFilters, ReportShell, ReportTable, VBars, useDuration, type SelectSpec } from "./parts"

const pad = (n: number) => String(n).padStart(2, "0")
const nov = (day: number) => `2026-11-${pad(day)}`

/** "15 Nov · 10:02" */
function useWhen() {
  const dates = useDates()
  return (day: number, time: string) => `${dates.dayMonth(nov(day))} · ${time}`
}

function usePeriodSelect(value: Period, onChange: (p: Period) => void): SelectSpec {
  const t = useTranslations("patients.reports")
  return {
    value,
    onChange: (v) => onChange(v as Period),
    label: t("period.label"),
    width: "md:w-45",
    options: [
      { value: "all", label: t("period.all") },
      { value: "last7", label: t("period.last7") },
    ],
  }
}

const ACTION_TONE: Record<ActionKind, StatusTone> = { added: "success", edited: "info", deleted: "destructive", merged: "neutral", banned: "warning" }
const VISIT_TONE: Record<VStatus, StatusTone> = { completed: "success", inProgress: "info", confirmed: "success", pending: "warning", cancelled: "destructive", noShow: "neutral" }

/* ================================================================== index (Reports tab) */

export function ReportsIndex() {
  const t = useTranslations("patients.reports")
  const { b } = useText()
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
      {REPORTS.map((r) => (
        <article key={r.key} className="flex flex-col gap-3.5 rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
              <Icon name={r.icon} size={22} />
            </span>
            <span className="flex-1" />
            <Badge variant="secondary">{b(r.badge)}</Badge>
          </div>
          <h2 className="text-lg font-semibold">{t(`cards.${r.key}.title`)}</h2>
          <p className="flex-1 text-sm text-muted-foreground">{t(`cards.${r.key}.desc`)}</p>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs text-muted-foreground">{t("meta")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/reports/${r.key}`}>
                {t("open")}
                <Icon name="arrow-right-1" size={16} />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

export function ReportBody({ report }: { report: ReportKey }) {
  switch (report) {
    case "activity":
      return <ActivityReport />
    case "registrations":
      return <RegistrationsReport />
    case "stay":
      return <StayReport />
    case "visits":
      return <VisitsReport />
    case "duplicates":
      return <DuplicatesReport />
    case "incomplete":
      return <IncompleteReport />
  }
}

/* ================================================================== 1 · activity log */

function ActivityReport() {
  const t = useTranslations("patients.reports")
  const { b } = useText()
  const when = useWhen()
  const [period, setPeriod] = React.useState<Period>("all")
  const [staff, setStaff] = React.useState("all")
  const [chip, setChip] = React.useState<"all" | ActionKind>("all")
  const all = activityRows()
  const base = React.useMemo(() => all.filter((r) => inPeriod(r.day, period) && (staff === "all" || r.staff === staff)), [all, period, staff])
  const rows = React.useMemo(() => base.filter((r) => chip === "all" || r.kind === chip), [base, chip])
  const kinds: ActionKind[] = ["added", "edited", "deleted", "merged", "banned"]
  const periodSel = usePeriodSelect(period, setPeriod)

  return (
    <ReportShell
      report="activity"
      csv={() => ({
        name: "patient-activity",
        head: ["When", "Staff", "Action", "Patient", "MRN", "Change", "Branch"],
        rows: rows.map((r) => [when(r.day, r.time), b(STAFF[r.staff].name), t(`action.${r.kind}`), r.patient ? b(r.patient.name) : "—", r.mrn, b(r.change), b(BRANCH[r.branch])]),
      })}
    >
      <section className="@container/rpt flex min-w-0 flex-col gap-5 rounded-xl border bg-card p-4 md:p-6">
        <ReportFilters
          selects={[periodSel, { value: staff, onChange: setStaff, label: t("allStaff"), options: [{ value: "all", label: t("allStaff") }, ...Object.entries(STAFF).map(([k, s]) => ({ value: k, label: b(s.name) }))] }]}
          chips={
            <Chips
              value={chip}
              onChange={setChip}
              items={[{ key: "all" as const, label: t("activity.chips.all"), count: base.length }, ...kinds.map((k) => ({ key: k, label: t(`activity.chips.${k}`), count: base.filter((r) => r.kind === k).length }))]}
            />
          }
        />
        <ReportTable
          rows={rows}
          pageSize={8}
          rowKey={(r) => r.id}
          columns={[
            { key: "when", head: t("col.when"), width: "7.5rem", cell: (r) => <span className="tabular-nums">{when(r.day, r.time)}</span> },
            { key: "staff", head: t("col.staff"), width: "minmax(0,1.1fr)", cell: (r) => <StaffCell id={r.staff} /> },
            { key: "action", head: t("col.action"), width: "6rem", cell: (r) => <StatusBadge tone={ACTION_TONE[r.kind]}>{t(`action.${r.kind}`)}</StatusBadge> },
            { key: "patient", head: t("col.patient"), width: "minmax(0,1.1fr)", cell: (r) => <PatientCell patient={r.patient} mrn={r.mrn} /> },
            { key: "change", head: t("col.change"), width: "minmax(0,1.4fr)", cell: (r) => <span className="text-xs">{b(r.change)}</span> },
            { key: "branch", head: t("col.branch"), width: "5rem", cell: (r) => <span className="text-muted-foreground">{b(BRANCH[r.branch])}</span> },
          ]}
          item={(r) => (
            <div className="flex items-start gap-3">
              <Avatar size="sm">
                <AvatarFallback>{STAFF[r.staff].initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{b(STAFF[r.staff].name)}</span>
                  <StatusBadge tone={ACTION_TONE[r.kind]}>{t(`action.${r.kind}`)}</StatusBadge>
                </div>
                <span className="text-xs">{b(r.change)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {r.patient ? b(r.patient.name) : "—"} · <bdi dir="ltr">MRN {r.mrn}</bdi> · {b(BRANCH[r.branch])}
                </span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{when(r.day, r.time)}</span>
            </div>
          )}
        />
      </section>
    </ReportShell>
  )
}

function StaffCell({ id }: { id: string }) {
  const { b } = useText()
  const s = STAFF[id]
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback>{s.initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{b(s.name)}</span>
        <span className="truncate text-xs text-muted-foreground">{b(s.role)}</span>
      </div>
    </div>
  )
}

/* ================================================================== 2 · registrations */

function RegistrationsReport() {
  const t = useTranslations("patients.reports")
  const format = useFormatter()
  const dates = useDates()
  const { b, n } = useText()
  const when = useWhen()
  const [period, setPeriod] = React.useState<Period>("all")
  const [branch, setBranch] = React.useState<"all" | BranchKey>("all")
  const [staff, setStaff] = React.useState("all")
  const [chip, setChip] = React.useState<"all" | Source>("all")
  const all = registrationRows()
  const base = React.useMemo(() => all.filter((r) => inPeriod(r.day, period) && (branch === "all" || r.branch === branch) && (staff === "all" || r.staff === staff)), [all, period, branch, staff])
  const rows = React.useMemo(() => base.filter((r) => chip === "all" || r.source === chip), [base, chip])
  const days = REG_DAYS.map((_, i) => i + 1).filter((d) => inPeriod(d, period))
  const perDay = days.map((d) => rows.filter((r) => r.day === d).length)
  const max = Math.max(0, ...perDay)
  const busiest = days[perDay.indexOf(max)] ?? 1
  const incomplete = rows.filter((r) => !r.complete).length
  const sources: Source[] = ["walkin", "online", "referral", "insurance"]
  const periodSel = usePeriodSelect(period, setPeriod)
  const busiestLabel = new Intl.DateTimeFormat(b({ en: "en-GB", ar: "ar" }), { weekday: "short", day: "numeric", month: "short", numberingSystem: "latn", timeZone: "UTC" })
    .format(new Date(`${nov(busiest)}T12:00:00Z`))
    .replace(/[,،]/, "")
    .replace(/\bSept\b/, "Sep")

  return (
    <ReportShell
      report="registrations"
      csv={() => ({
        name: "registrations",
        head: ["Registered", "Patient", "MRN", "Branch", "Registered by", "Source", "Profile"],
        rows: rows.map((r) => [when(r.day, r.time), b(r.patient.name), r.patient.mrn, b(BRANCH[r.branch]), b(STAFF[r.staff].name), t(`source.${r.source}`), t(`status.${r.complete ? "complete" : "incomplete"}`)]),
      })}
      filters={
        <ReportFilters
          selects={[
            periodSel,
            { value: branch, onChange: (v) => setBranch(v as "all" | BranchKey), label: t("allBranches"), options: [{ value: "all", label: t("allBranches") }, ...(Object.keys(BRANCH) as BranchKey[]).map((k) => ({ value: k, label: b(BRANCH[k]) }))] },
            { value: staff, onChange: setStaff, label: t("allStaff"), options: [{ value: "all", label: t("allStaff") }, ...["RA", "HF", "SO", "MQ"].map((k) => ({ value: k, label: b(STAFF[k].name) }))] },
          ]}
          chips={<Chips value={chip} onChange={setChip} items={[{ key: "all" as const, label: t("registrations.chips.all"), count: base.length }, ...sources.map((s) => ({ key: s, label: t(`registrations.chips.${s}`), count: base.filter((r) => r.source === s).length }))]} />}
        />
      }
      kpis={
        <Kpis
          items={[
            { icon: "user-add", label: t("registrations.kpi.new"), value: n(rows.length), delta: t("registrations.kpi.newDelta"), caption: t("registrations.kpi.newCap") },
            { icon: "calendar-2", tile: "info", label: t("registrations.kpi.avg"), value: format.number(Math.round((rows.length / Math.max(days.length, 1)) * 10) / 10), delta: t("registrations.kpi.avgDelta"), tone: "info", caption: t("registrations.kpi.avgCap") },
            { icon: "chart-2", label: t("registrations.kpi.busiest"), value: busiestLabel, delta: n(max), tone: "info", caption: t("registrations.kpi.busiestCap") },
            { icon: "warning-2", tile: "warning", label: t("registrations.kpi.incomplete"), value: n(incomplete), delta: `${Math.round((incomplete / Math.max(rows.length, 1)) * 100)}%`, tone: "warning", caption: t("registrations.kpi.incompleteCap") },
          ]}
        />
      }
    >
      <ReportCard title={t("registrations.chart")} description={t("registrations.chartDesc", { period: t(`period.${period}`), branch: branch === "all" ? t("allBranches") : b(BRANCH[branch]) })}>
        <VBars values={perDay} labels={days.map(String)} vmax={Math.max(40, Math.ceil(max / 10) * 10)} highlight={perDay.indexOf(max)} ariaLabel={days.map((d, i) => `${dates.dayMonth(nov(d))}: ${perDay[i]}`).join(", ")} />
      </ReportCard>
      <ReportCard title={t("registrations.table")} description={t("registrations.tableDesc", { count: rows.length })}>
        <ReportTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "when", head: t("col.registered"), width: "8rem", cell: (r) => <span className="tabular-nums">{when(r.day, r.time)}</span> },
            { key: "patient", head: t("col.patient"), cell: (r) => <PatientCell patient={r.patient} mrn={r.patient.mrn} /> },
            { key: "branch", head: t("col.branch"), width: "6.5rem", cell: (r) => b(BRANCH[r.branch]) },
            { key: "by", head: t("col.registeredBy"), width: "minmax(0,0.9fr)", cell: (r) => <StaffInline id={r.staff} /> },
            { key: "source", head: t("col.source"), width: "6.5rem", cell: (r) => t(`source.${r.source}`) },
            { key: "profile", head: t("col.profile"), width: "7rem", cell: (r) => <StatusBadge tone={r.complete ? "success" : "warning"}>{t(`status.${r.complete ? "complete" : "incomplete"}`)}</StatusBadge> },
          ]}
          item={(r) => (
            <div className="flex items-start gap-3">
              <Avatar size="sm">
                <AvatarFallback>{r.patient.initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{b(r.patient.name)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  <bdi dir="ltr">MRN {r.patient.mrn}</bdi> · {b(BRANCH[r.branch])} · {t(`source.${r.source}`)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {when(r.day, r.time)} · {t("by", { name: b(STAFF[r.staff].name) })}
                </span>
              </div>
              <StatusBadge tone={r.complete ? "success" : "warning"}>{t(`status.${r.complete ? "complete" : "incomplete"}`)}</StatusBadge>
            </div>
          )}
        />
      </ReportCard>
    </ReportShell>
  )
}

function StaffInline({ id }: { id: string }) {
  const { b } = useText()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        <AvatarFallback>{STAFF[id].initials}</AvatarFallback>
      </Avatar>
      <span className="truncate">{b(STAFF[id].name)}</span>
    </div>
  )
}

/* ================================================================== 3 · length of stay */

function StayReport() {
  const t = useTranslations("patients.reports")
  const { b, n } = useText()
  const dur = useDuration()
  const [dept, setDept] = React.useState("all")
  const [chip, setChip] = React.useState<"all" | "emergency" | "outpatient" | "over">("all")
  const all = stayRows()
  const base = React.useMemo(() => all.filter((r) => dept === "all" || r.dept === dept), [all, dept])
  const match = (r: (typeof all)[number], c: typeof chip) =>
    c === "all" || (c === "emergency" && r.dept === "emergency") || (c === "outpatient" && isOutpatient(r.dept)) || (c === "over" && r.minutes > STAY_TARGET)
  const rows = React.useMemo(() => base.filter((r) => match(r, chip)), [base, chip]) // eslint-disable-line react-hooks/exhaustive-deps
  const longest = all.reduce((a, r) => (r.minutes > a.minutes ? r : a), all[0])
  const over = all.filter((r) => r.minutes > STAY_TARGET).length
  const splitTotal = STAY_STEPS.reduce((s, x) => s + x[1], 0)

  return (
    <ReportShell
      report="stay"
      csv={() => ({
        name: "length-of-stay",
        head: ["Patient", "MRN", "Department", "Check-in", "Exit", "Minutes", "Staff on duty"],
        rows: rows.map((r) => [b(r.patient.name), r.patient.mrn, b(DEPT[r.dept]), r.in, r.out, r.minutes, b(r.staff)]),
      })}
      filters={
        <ReportFilters
          selects={[
            { value: "today", onChange: () => {}, label: t("period.label"), width: "md:w-50", options: [{ value: "today", label: t("period.today") }] },
            { value: dept, onChange: setDept, label: t("allDepartments"), width: "md:w-42", options: [{ value: "all", label: t("allDepartments") }, ...STAY_DEPT.map(([k]) => ({ value: k, label: b(DEPT[k]) }))] },
          ]}
          chips={
            <Chips
              value={chip}
              onChange={setChip}
              items={(["all", "emergency", "outpatient", "over"] as const).map((k) => ({ key: k, label: t(`stay.chips.${k}`), count: base.filter((r) => match(r, k)).length }))}
            />
          }
        />
      }
      kpis={
        <Kpis
          items={[
            { icon: "clock", label: t("stay.kpi.avg"), value: dur(102), delta: t("stay.kpi.avgDelta"), caption: t("stay.kpi.avgCap") },
            { icon: "activity", tile: "info", label: t("stay.kpi.median"), value: dur(75), delta: t("stay.kpi.medianDelta"), tone: "info", caption: t("stay.kpi.medianCap") },
            { icon: "danger", tile: "destructive", label: t("stay.kpi.longest"), value: dur(longest.minutes), delta: longest.dept === "emergency" ? t("stay.kpi.er") : b(DEPT[longest.dept]), tone: "destructive", caption: b(longest.patient.name) },
            { icon: "warning-2", tile: "warning", label: t("stay.kpi.over"), value: `${Math.floor((over / all.length) * 100)}%`, delta: n(over), tone: "warning", caption: t("stay.kpi.overCap") },
          ]}
        />
      }
    >
      <div className="grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ReportCard title={t("stay.byDept")} description={t("stay.byDeptDesc")}>
          <HBars vmax={180} rows={STAY_DEPT.map(([k, m]) => ({ key: k, label: b(DEPT[k]), value: dur(m), amount: m, color: m > STAY_TARGET ? "bg-warning" : "bg-chart-1" }))} />
        </ReportCard>
        <ReportCard title={t("stay.split")} description={t("stay.splitDesc", { time: dur(102) })}>
          <div className="flex flex-col gap-3">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {STAY_STEPS.map(([label, m, c]) => (
                <span key={label.en} className="h-full" style={{ width: `${(m / splitTotal) * 100}%`, background: `var(--${c})` }} />
              ))}
            </div>
            <ul className="flex flex-col gap-2.5">
              {STAY_STEPS.map(([label, m, c]) => (
                <li key={label.en} className="flex items-center gap-2 text-sm">
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--${c})` }} />
                  <span className="flex-1">{b(label)}</span>
                  <span className="font-medium tabular-nums">{dur(m)}</span>
                </li>
              ))}
            </ul>
          </div>
        </ReportCard>
      </div>
      <ReportCard title={t("stay.table")} description={t("stay.tableDesc", { count: rows.length })}>
        <ReportTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "patient", head: t("col.patient"), cell: (r) => <PatientCell patient={r.patient} mrn={r.patient.mrn} /> },
            { key: "dept", head: t("col.department"), width: "7.5rem", cell: (r) => b(DEPT[r.dept]) },
            { key: "in", head: t("col.checkIn"), width: "5.5rem", cell: (r) => <span className="tabular-nums">{r.in}</span> },
            { key: "out", head: t("col.exit"), width: "5.5rem", cell: (r) => <span className="tabular-nums">{r.out}</span> },
            { key: "dur", head: t("col.duration"), width: "minmax(0,0.8fr)", cell: (r) => <Duration minutes={r.minutes} /> },
            { key: "staff", head: t("col.onDuty"), width: "minmax(0,0.9fr)", cell: (r) => <span className="text-xs text-muted-foreground">{b(r.staff)}</span> },
          ]}
          item={(r) => (
            <div className="flex items-start gap-3">
              <Avatar size="sm">
                <AvatarFallback>{r.patient.initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{b(r.patient.name)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {b(DEPT[r.dept])} · <bdi dir="ltr">{r.in} – {r.out}</bdi>
                </span>
                <span className="text-xs text-muted-foreground">{b(r.staff)}</span>
              </div>
              <Duration minutes={r.minutes} stacked />
            </div>
          )}
        />
      </ReportCard>
    </ReportShell>
  )
}

function Duration({ minutes, stacked }: { minutes: number; stacked?: boolean }) {
  const t = useTranslations("patients.reports")
  const dur = useDuration()
  const over = minutes > STAY_TARGET
  return (
    <div className={cn("flex gap-2", stacked ? "flex-col items-end gap-1" : "flex-wrap items-center")}>
      <span className={cn("font-medium tabular-nums", over && "text-destructive")}>{dur(minutes)}</span>
      {over && <StatusBadge tone="warning">{t("status.overTarget")}</StatusBadge>}
    </div>
  )
}

/* ================================================================== 4 · visits */

const SOURCE_COLOR: Record<Booking, string> = { online: "var(--chart-1)", walkin: "var(--chart-2)", phone: "var(--chart-3)", referral: "var(--chart-4)" }

function VisitsReport() {
  const t = useTranslations("patients.reports")
  const { b, n } = useText()
  const when = useWhen()
  const [period, setPeriod] = React.useState<Period>("all")
  const [doctor, setDoctor] = React.useState("all")
  const [clinic, setClinic] = React.useState<"all" | VClinic>("all")
  const [chip, setChip] = React.useState<"all" | "completed" | "confirmed" | "cancelled" | "noShow">("all")
  const all = visitRows()
  const base = React.useMemo(
    () => all.filter((r) => inPeriod(r.day, period) && (doctor === "all" || r.doctor === doctor) && (clinic === "all" || r.clinic === clinic)),
    [all, period, doctor, clinic]
  )
  const rows = React.useMemo(() => base.filter((r) => chip === "all" || r.status === chip), [base, chip])
  const completed = base.filter((r) => r.status === "completed").length
  const lost = base.filter((r) => r.status === "cancelled" || r.status === "noShow").length
  const revenue = base.reduce((s, r) => s + r.amount, 0)
  const pct = (v: number) => `${Math.round((v / Math.max(base.length, 1)) * 100)}%`
  const byClinic = CLINIC_COUNTS.map(([c]) => ({ c, v: rows.filter((r) => r.clinic === c).length }))
  const maxClinic = Math.max(...byClinic.map((x) => x.v), 1)
  const bookings: Booking[] = ["online", "walkin", "phone", "referral"]
  const periodSel = usePeriodSelect(period, setPeriod)
  const sar = (v: number) => b({ en: `SAR ${n(v)}`, ar: `${n(v)} ر.س` })

  return (
    <ReportShell
      report="visits"
      csv={() => ({
        name: "patient-visits",
        head: ["When", "Patient", "MRN", "Doctor", "Clinic", "Booking", "Status", "Amount (SAR)"],
        rows: rows.map((r) => [when(r.day, r.time), b(r.patient.name), r.patient.mrn, b(DOCTOR[r.doctor].name), b(CLINIC[r.clinic]), t(`source.${r.booking}`), t(`status.${r.status}`), r.amount]),
      })}
      filters={
        <ReportFilters
          selects={[
            periodSel,
            { value: doctor, onChange: setDoctor, label: t("allDoctors"), options: [{ value: "all", label: t("allDoctors") }, ...Object.entries(DOCTOR).map(([k, d]) => ({ value: k, label: b(d.name) }))] },
            { value: clinic, onChange: (v) => setClinic(v as "all" | VClinic), label: t("allClinics"), options: [{ value: "all", label: t("allClinics") }, ...CLINIC_COUNTS.map(([k]) => ({ value: k, label: b(CLINIC[k]) }))] },
          ]}
          chips={
            <Chips
              value={chip}
              onChange={setChip}
              items={(["all", "completed", "confirmed", "cancelled", "noShow"] as const).map((k) => ({ key: k, label: t(`visits.chips.${k}`), count: k === "all" ? base.length : base.filter((r) => r.status === k).length }))}
            />
          }
        />
      }
      kpis={
        <Kpis
          items={[
            { icon: "calendar-tick", label: t("visits.kpi.visits"), value: n(base.length), delta: t("visits.kpi.visitsDelta"), caption: t("visits.kpi.visitsCap") },
            { icon: "tick-circle", tile: "success", label: t("visits.kpi.completed"), value: pct(completed), delta: n(completed), caption: t("visits.kpi.completedCap") },
            { icon: "close-circle", tile: "destructive", label: t("visits.kpi.cancelled"), value: pct(lost), delta: n(lost), tone: "destructive", caption: t("visits.kpi.cancelledCap") },
            { icon: "wallet-money", label: t("visits.kpi.revenue"), value: sar(revenue), delta: t("visits.kpi.revenueDelta"), caption: t("visits.kpi.revenueCap") },
          ]}
        />
      }
    >
      <div className="grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ReportCard title={t("visits.byClinic")} description={t("visits.byClinicDesc", { period: t(`period.${period}`), count: n(rows.length) })}>
          <div className="hidden @min-[40rem]/rpt:block">
            <VBars
              height={180}
              values={byClinic.map((x) => x.v)}
              labels={byClinic.map((x) => b(CLINIC[x.c]))}
              vmax={Math.max(100, Math.ceil(maxClinic / 100) * 100)}
              highlight={0}
              ariaLabel={byClinic.map((x) => `${b(CLINIC[x.c])}: ${x.v}`).join(", ")}
            />
          </div>
          <div className="@min-[40rem]/rpt:hidden">
            <HBars vmax={maxClinic} rows={byClinic.map((x, i) => ({ key: x.c, label: b(CLINIC[x.c]), value: n(x.v), amount: x.v, color: i === 0 ? "bg-chart-1" : "bg-blue-200" }))} />
          </div>
        </ReportCard>
        <ReportCard title={t("visits.source")} description={t("visits.sourceDesc")}>
          <Donut
            rows={bookings.map((k) => ({ key: k, label: t(`source.${k}`), value: rows.filter((r) => r.booking === k).length, color: SOURCE_COLOR[k] }))}
            center={`${Math.round((rows.filter((r) => r.booking === "online").length / Math.max(rows.length, 1)) * 100)}%`}
            caption={t("visits.online")}
          />
        </ReportCard>
      </div>
      <ReportCard title={t("visits.table")} description={t("visits.tableDesc", { count: n(rows.length) })}>
        <ReportTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "when", head: t("col.when"), width: "7.5rem", cell: (r) => <span className="tabular-nums">{when(r.day, r.time)}</span> },
            { key: "patient", head: t("col.patient"), cell: (r) => <PatientCell patient={r.patient} mrn={r.patient.mrn} /> },
            { key: "doctor", head: t("col.doctor"), width: "minmax(0,0.9fr)", cell: (r) => <span className="truncate">{b(DOCTOR[r.doctor].name)}</span> },
            { key: "clinic", head: t("col.clinic"), width: "6.5rem", cell: (r) => b(CLINIC[r.clinic]) },
            { key: "booking", head: t("col.booking"), width: "5.5rem", cell: (r) => <span className="text-muted-foreground">{t(`source.${r.booking}`)}</span> },
            { key: "status", head: t("col.status"), width: "7.5rem", cell: (r) => <StatusBadge tone={VISIT_TONE[r.status]}>{t(`status.${r.status}`)}</StatusBadge> },
            { key: "amount", head: t("col.amount"), width: "6rem", cell: (r) => <span className="font-medium tabular-nums">{sar(r.amount)}</span> },
          ]}
          item={(r) => (
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{b(r.patient.name)}</span>
                <span className="text-xs text-muted-foreground">
                  {b(DOCTOR[r.doctor].name)} · {b(CLINIC[r.clinic])}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {when(r.day, r.time)} · {t(`source.${r.booking}`)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-medium tabular-nums">{sar(r.amount)}</span>
                <StatusBadge tone={VISIT_TONE[r.status]}>{t(`status.${r.status}`)}</StatusBadge>
              </div>
            </div>
          )}
        />
      </ReportCard>
    </ReportShell>
  )
}

/* ================================================================== 5 · duplicates */

const DUP_FIELDS: DupField[] = ["name", "phone", "whatsapp", "nationalId", "birth", "visits", "lastVisit"]
const GROUPS_PAGE = 5

function DuplicatesReport() {
  const t = useTranslations("patients.reports")
  const { b, n } = useText()
  const { patients, setTags } = usePatientsStore()
  const [branch, setBranch] = React.useState<"all" | BranchKey>("all")
  const [chip, setChip] = React.useState<"all" | DupReason>("all")
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set())
  const [count, setCount] = React.useState(GROUPS_PAGE)
  const groups = React.useMemo(() => duplicateGroups(patients).filter((g) => !dismissed.has(g.id)), [patients, dismissed])
  const base = groups.filter((g) => branch === "all" || g.keep.branch === branch || g.drop.branch === branch)
  const shown = base.filter((g) => chip === "all" || g.reasons.includes(chip))
  const reasons: DupReason[] = ["phone", "whatsapp", "nationalId", "nameBirth"]

  const dismiss = (g: (typeof groups)[number]) => {
    setDismissed((s) => new Set(s).add(g.id))
    const before = g.keep.tags
    if (before.includes("duplicate")) setTags(g.keep.id, toggleTag(before, "duplicate", false))
    toast.info(t("duplicates.dismissed"), {
      description: t("duplicates.dismissedText"),
      action: {
        label: t("duplicates.undo"),
        onClick: () => {
          setDismissed((s) => {
            const next = new Set(s)
            next.delete(g.id)
            return next
          })
          setTags(g.keep.id, before)
        },
      },
    })
  }

  return (
    <ReportShell
      report="duplicates"
      csv={() => ({
        name: "duplicate-patients",
        head: ["Confidence", "Reason", "Keep MRN", "Keep name", "Merge MRN", "Merge name"],
        rows: shown.map((g) => [g.high ? "High" : "Medium", g.reasons.map((r) => t(`duplicates.reason.${r}`)).join(" | "), g.keep.mrn, b(g.keep.name), g.drop.mrn, b(g.drop.name)]),
      })}
      filters={
        <ReportFilters
          selects={[{ value: branch, onChange: (v) => setBranch(v as "all" | BranchKey), label: t("allBranches"), options: [{ value: "all", label: t("allBranches") }, ...(Object.keys(BRANCH) as BranchKey[]).map((k) => ({ value: k, label: b(BRANCH[k]) }))] }]}
          chips={<Chips value={chip} onChange={setChip} items={[{ key: "all" as const, label: t("duplicates.chips.all"), count: base.length }, ...reasons.map((r) => ({ key: r, label: t(`duplicates.chips.${r}`), count: base.filter((g) => g.reasons.includes(r)).length }))]} />}
        />
      }
      kpis={
        <Kpis
          items={[
            { icon: "people", tile: "info", label: t("duplicates.kpi.groups"), value: n(groups.length), delta: t("duplicates.kpi.groupsDelta"), tone: "warning", caption: t("duplicates.kpi.groupsCap") },
            { icon: "profile-2user", label: t("duplicates.kpi.affected"), value: n(51), delta: "4%", tone: "info", caption: t("duplicates.kpi.affectedCap") },
            { icon: "danger", tile: "destructive", label: t("duplicates.kpi.high"), value: n(groups.filter((g) => g.high).length), delta: n(groups.filter((g) => g.high).length), tone: "destructive", caption: t("duplicates.kpi.highCap") },
            { icon: "tick-circle", tile: "success", label: t("duplicates.kpi.merged"), value: n(19), delta: t("duplicates.kpi.mergedDelta"), caption: t("duplicates.kpi.mergedCap") },
          ]}
        />
      }
    >
      {shown.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="people" title={t("duplicates.none")} description={t("duplicates.noneText")} className="py-14" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.slice(0, count).map((g) => (
            <DupGroupCard key={g.id} group={g} onDismiss={() => dismiss(g)} />
          ))}
          {count < shown.length && (
            <Button variant="outline" className="h-10" onClick={() => setCount((c) => c + GROUPS_PAGE)}>
              {t("loadMore")}
            </Button>
          )}
        </div>
      )}
    </ReportShell>
  )
}

function DupGroupCard({ group: g, onDismiss }: { group: ReturnType<typeof duplicateGroups>[number]; onDismiss: () => void }) {
  const t = useTranslations("patients.reports.duplicates")
  const { b, n } = useText()
  const dates = useDates()
  const nameMatch = g.matched.includes("name") && !g.reasons.includes("nameBirth")
  const actions = (
    <>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        {t("notDup")}
      </Button>
      <Button size="sm" asChild>
        <Link href={`/patients/merge?a=${g.keep.id}&b=${g.drop.id}`}>{t("mergeInto", { mrn: g.keep.mrn })}</Link>
      </Button>
    </>
  )
  return (
    <section className="@container/dup flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5">
      <header className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={g.high ? "destructive" : "warning"}>{g.high ? t("high") : t("medium")}</StatusBadge>
        {g.reasons.map((r) => (
          <Badge key={r} variant="outline">
            {t(`reason.${r}`)}
          </Badge>
        ))}
        {nameMatch && <Badge variant="outline">{t("sameName")}</Badge>}
        <span className="flex-1" />
        <div className="hidden items-center gap-2 @min-[40rem]/dup:flex">{actions}</div>
      </header>
      <div className="grid gap-3 @min-[40rem]/dup:grid-cols-2 @min-[40rem]/dup:gap-4">
        {(["keep", "drop"] as const).map((side) => {
          const p = g[side]
          const v = dupValues(g, side)
          const vals: Record<DupField, React.ReactNode> = {
            name: b(p.name),
            phone: v.phone ? <bdi dir="ltr">{v.phone}</bdi> : null,
            whatsapp: v.whatsapp ? <bdi dir="ltr">{v.whatsapp}</bdi> : null,
            nationalId: v.nationalId ? <bdi dir="ltr">{`${v.nationalId.slice(0, 4)} ${v.nationalId.slice(4, 7)} ${v.nationalId.slice(7)}`}</bdi> : null,
            birth: v.birth ? dates.short(v.birth) : null,
            visits: n(v.visits),
            lastVisit: v.lastVisit ? dates.short(v.lastVisit) : null,
          }
          return (
            <div key={side} className={cn("flex flex-col gap-2.5 rounded-xl border p-4", side === "keep" && "bg-background")}>
              <div className="flex items-center gap-2.5">
                <Avatar>
                  <AvatarFallback>{p.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/patients/${p.id}`} className="truncate text-sm font-medium hover:underline">
                    {b(p.name)}
                  </Link>
                  <bdi dir="ltr" className="text-xs text-muted-foreground tabular-nums rtl:text-right">
                    MRN {p.mrn}
                  </bdi>
                </div>
                <Badge variant={side === "keep" ? "default" : "secondary"}>{side === "keep" ? t("keep") : t("merge")}</Badge>
              </div>
              <dl className="flex flex-col gap-0.5">
                {DUP_FIELDS.filter((f) => f !== "name").map((f) => {
                  const hit = g.matched.includes(f)
                  return (
                    <div key={f} className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-xs", hit && "bg-accent")}>
                      <dt className="w-27 shrink-0 text-muted-foreground">{t(`field.${f}`)}</dt>
                      <dd className={cn("min-w-0 flex-1 font-medium tabular-nums", hit ? "text-accent-foreground" : !vals[f] && "text-muted-foreground")}>{vals[f] ?? "—"}</dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 @min-[40rem]/dup:hidden *:h-10">{actions}</div>
    </section>
  )
}

/* ================================================================== 6 · incomplete records */

const chipFields = ["nationalId", "address", "nationality", "birthDate"] as const

function IncompleteReport() {
  const t = useTranslations("patients.reports")
  const { b, n } = useText()
  const dates = useDates()
  const { patients } = usePatientsStore()
  const [branch, setBranch] = React.useState<"all" | BranchKey>("all")
  const [staff, setStaff] = React.useState("all")
  const [chip, setChip] = React.useState<"all" | (typeof chipFields)[number]>("all")
  const all = React.useMemo(() => incompleteRows(patients), [patients])
  const base = all.filter((r) => (branch === "all" || r.patient.branch === branch) && (staff === "all" || r.staff === staff))
  const rows = base.filter((r) => chip === "all" || r.missing.includes(chip))
  const counts = MISSING_FIELDS.map((f) => ({ f, v: base.filter((r) => r.missing.includes(f)).length }))
  const most = [...counts].sort((a, z) => z.v - a.v)[0]
  const total = patients.length || allPatients().length
  const half = Math.ceil(counts.length / 2)

  return (
    <ReportShell
      report="incomplete"
      csv={() => ({
        name: "incomplete-records",
        head: ["Patient", "MRN", "Missing", "Completeness", "Last visit", "Registered by"],
        rows: rows.map((r) => [b(r.patient.name), r.patient.mrn, r.missing.map((f) => t(`incomplete.field.${f}`)).join(" | "), `${Math.round(r.completeness * 100)}%`, r.patient.lastVisit, b(STAFF[r.staff].name)]),
      })}
      filters={
        <ReportFilters
          selects={[
            { value: branch, onChange: (v) => setBranch(v as "all" | BranchKey), label: t("allBranches"), options: [{ value: "all", label: t("allBranches") }, ...(Object.keys(BRANCH) as BranchKey[]).map((k) => ({ value: k, label: b(BRANCH[k]) }))] },
            { value: staff, onChange: setStaff, label: t("allStaff"), options: [{ value: "all", label: t("allStaff") }, ...["RA", "HF", "SO", "MQ"].map((k) => ({ value: k, label: b(STAFF[k].name) }))] },
          ]}
          chips={<Chips value={chip} onChange={setChip} items={[{ key: "all" as const, label: t("incomplete.chips.all"), count: base.length }, ...chipFields.map((f) => ({ key: f, label: t(`incomplete.chips.${f}`), count: base.filter((r) => r.missing.includes(f)).length }))]} />}
        />
      }
      kpis={
        <Kpis
          items={[
            { icon: "warning-2", tile: "warning", label: t("incomplete.kpi.files"), value: n(all.length), delta: t("incomplete.kpi.filesDelta"), caption: t("incomplete.kpi.filesCap") },
            { icon: "chart-2", label: t("incomplete.kpi.share"), value: `${Math.round((all.length / total) * 100)}%`, delta: n(total), tone: "info", caption: t("incomplete.kpi.shareCap") },
            { icon: "personalcard", tile: "info", label: t("incomplete.kpi.most"), value: t(`incomplete.field.${most.f}`), delta: n(most.v), tone: "warning", caption: t("incomplete.kpi.mostCap") },
            { icon: "tick-circle", tile: "success", label: t("incomplete.kpi.completed"), value: n(14), delta: t("incomplete.kpi.completedDelta"), caption: t("incomplete.kpi.completedCap") },
          ]}
        />
      }
    >
      <ReportCard title={t("incomplete.chart")} description={t("incomplete.chartDesc")}>
        <div className="grid gap-3.5 @min-[40rem]/rpt:grid-cols-2 @min-[40rem]/rpt:gap-10">
          {[counts.slice(0, half), counts.slice(half)].map((col, i) => (
            <HBars key={i} vmax={80} rows={col.map(({ f, v }) => ({ key: f, label: t(`incomplete.field.${f}`), value: n(v), amount: v, color: v > 50 ? "bg-warning" : "bg-chart-1" }))} />
          ))}
        </div>
      </ReportCard>
      <ReportCard title={t("incomplete.table")} description={t("incomplete.tableDesc", { count: n(rows.length) })}>
        <ReportTable
          rows={rows}
          rowKey={(r) => r.patient.id}
          columns={[
            { key: "patient", head: t("col.patient"), cell: (r) => <PatientCell patient={r.patient} mrn={r.patient.mrn} /> },
            { key: "missing", head: t("col.missing"), width: "minmax(0,1.2fr)", cell: (r) => <MissingBadges fields={r.missing} /> },
            { key: "pct", head: t("col.completeness"), width: "9rem", cell: (r) => <Completeness value={r.completeness} /> },
            { key: "last", head: t("col.lastVisit"), width: "6.5rem", cell: (r) => <span className="tabular-nums">{r.patient.lastVisit ? dates.short(r.patient.lastVisit) : "—"}</span> },
            { key: "by", head: t("col.registeredBy"), width: "minmax(0,0.7fr)", cell: (r) => <span className="truncate text-muted-foreground">{b(STAFF[r.staff].name)}</span> },
            { key: "act", head: <span className="sr-only">{t("incomplete.complete")}</span>, width: "6.5rem", cell: (r) => <CompleteButton id={r.patient.id} /> },
          ]}
          item={(r) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <PatientCell patient={r.patient} mrn={r.patient.mrn} />
                </div>
                <CompleteButton id={r.patient.id} />
              </div>
              <MissingBadges fields={r.missing} />
              <Completeness value={r.completeness} />
            </div>
          )}
        />
      </ReportCard>
    </ReportShell>
  )
}

function MissingBadges({ fields }: { fields: MissingField[] }) {
  const t = useTranslations("patients.reports.incomplete.field")
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map((f) => (
        <StatusBadge key={f} tone="warning">
          {t(f)}
        </StatusBadge>
      ))}
    </div>
  )
}

function Completeness({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-22 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", value >= 0.85 ? "bg-success" : "bg-warning")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{pct}%</span>
    </div>
  )
}

function CompleteButton({ id }: { id: string }) {
  const t = useTranslations("patients.reports.incomplete")
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/patients/${id}/edit`}>
        <Icon name="edit-2" size={16} />
        {t("complete")}
      </Link>
    </Button>
  )
}
