"use client"

import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { bi } from "@/lib/mock/bi"
import {
  APPOINTMENTS_SUMMARY,
  ATTENTION,
  ATTENTION_UPDATED,
  BEDS,
  ER_CAPACITY,
  KPIS,
  STATUS_TONE,
  TODAY_APPOINTMENTS,
  VISITS,
  VISITS_YEAR,
} from "@/lib/mock/dashboard"
import { Icon } from "@/components/ds/icon"
import { ProgressField } from "@/components/ds/module-controls"
import { StatCard } from "@/components/ds/stat-card"
import { StatusBadge } from "@/components/ds/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/* ------------------------------------------------------------------ shared */

/** Widget card (Widgets page): rounded-xl, border, p-6, gap-5; header = title 18 SemiBold + description 12 muted + action at the end. */
function Widget({
  title,
  description,
  action,
  className,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("@container/widget flex min-w-0 flex-col gap-5 rounded-xl border bg-card p-6 text-card-foreground", className)}>
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** Ghost "more" menu on widget headers (not specified in the design beyond the button; offers Refresh). */
function WidgetMenu() {
  const t = useTranslations("common.widget")
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("more")}>
          <Icon name="more" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Icon name="refresh" size={16} />
          {t("refresh")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/* ------------------------------------------------------------------ KPIs */

/** KPI row: 1 col on mobile, 2 from sm, 4 from xl (sheet 06). Icon tiles tinted by meaning. */
export function KpiRow() {
  const t = useTranslations("dashboard.kpi")
  const tc = useTranslations("common")
  const format = useFormatter()
  const n = (v: number) => format.number(v, "integer")
  const { waitTime } = KPIS
  const sign = waitTime.deltaMinutes < 0 ? "−" : "+"
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
      <StatCard icon="profile-2user" label={t("totalPatients")} value={n(KPIS.totalPatients.value)} delta={KPIS.totalPatients.delta} caption={tc("stat.vsLastMonth")} />
      <StatCard
        icon="calendar-tick"
        tile="info"
        label={t("appointmentsToday")}
        value={n(KPIS.appointmentsToday.value)}
        delta={KPIS.appointmentsToday.delta}
        deltaTone="info"
        caption={t("vsYesterday")}
      />
      <StatCard
        icon="danger"
        tile="destructive"
        label={t("critical")}
        value={n(KPIS.critical.value)}
        delta={KPIS.critical.delta}
        deltaTone="destructive"
        caption={t("since", { time: KPIS.critical.since })}
      />
      <StatCard
        icon="clock"
        label={t("waitTime")}
        value={t("minutes", { n: waitTime.minutes })}
        delta={t.rich("minutesDelta", { sign, n: Math.abs(waitTime.deltaMinutes), num: (c) => <bdi dir="ltr">{c}</bdi> })}
        deltaTone="success"
        caption={t("vsLastWeek")}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ Patient visits */

const visitsConfig = {
  inPerson: { label: "In-person", color: "var(--chart-1)" },
  telehealth: { label: "Telehealth", color: "var(--chart-2)" },
} satisfies ChartConfig

/**
 * Widget / Patient Visits: grouped bars (in-person = chart-1, telehealth = chart-2), 0–100 axis with 5 gridlines.
 * Wide: 12 months + range select ("This year"); narrow card (<480px, mobile): last 6 months + more menu.
 * Arabic: time flows right → left (XAxis reversed, YAxis on the right).
 */
export function VisitsWidget({ className }: { className?: string }) {
  const t = useTranslations("dashboard.visits")
  const format = useFormatter()
  const rtl = useLocale() === "ar"
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const compact = width > 0 && width < 480
  const months = compact ? 6 : 12
  const [range, setRange] = React.useState("thisYear")

  const config = { inPerson: { ...visitsConfig.inPerson, label: t("inPerson") }, telehealth: { ...visitsConfig.telehealth, label: t("telehealth") } }
  const data = VISITS.inPerson
    .map((v, i) => ({
      month: format.dateTime(new Date(VISITS_YEAR, i, 1), { month: "short", calendar: "gregory" }),
      inPerson: v,
      telehealth: VISITS.telehealth[i],
    }))
    .slice(12 - months)
  const bars = [
    <Bar key="in" dataKey="inPerson" fill="var(--color-inPerson)" radius={[3, 3, 0, 0]} />,
    <Bar key="tele" dataKey="telehealth" fill="var(--color-telehealth)" radius={[3, 3, 0, 0]} />,
  ]

  return (
    <div ref={ref} className={cn("min-w-0", className)}>
      <Widget
        className="h-full"
        title={t("title")}
        description={compact ? t("descriptionShort") : t("description", { year: VISITS_YEAR })}
        action={
          compact ? (
            <WidgetMenu />
          ) : (
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-33" aria-label={t("range")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="thisYear">{t("thisYear")}</SelectItem>
                <SelectItem value="lastYear">{t("lastYear")}</SelectItem>
                <SelectItem value="last6">{t("last6")}</SelectItem>
              </SelectContent>
            </Select>
          )
        }
      >
        <div className="flex items-center gap-4">
          {(["inPerson", "telehealth"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-[2px]" style={{ background: config[k].color }} />
              {config[k].label}
            </span>
          ))}
        </div>
        <ChartContainer config={config} className="aspect-auto h-60 w-full min-h-60 flex-1">
          <BarChart data={data} barGap={3} barSize={10} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              reversed={rtl}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={months === 12 ? 1 : 0}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              width={32}
              orientation={rtl ? "right" : "left"}
              tickLine={false}
              axisLine={false}
              tickMargin={rtl ? 12 : 4}
            />
            <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
            {rtl ? bars.reverse() : bars}
          </BarChart>
        </ChartContainer>
      </Widget>
    </div>
  )
}

/* ------------------------------------------------------------------ Needs attention */

const ATTN_TONE = {
  destructive: "bg-destructive-soft text-destructive",
  warning: "bg-warning-soft text-warning-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  accent: "bg-accent text-primary",
} as const

/** Widget / Needs Attention: tinted 36px tiles, title + detail, time at the end; divider; ER capacity progress (warning). */
export function AttentionWidget({ className }: { className?: string }) {
  const t = useTranslations("dashboard.attention")
  const locale = useLocale()
  const pct = Math.round((ER_CAPACITY.used / ER_CAPACITY.total) * 100)
  return (
    <Widget className={className} title={t("title")} description={t("description", { count: ATTENTION.length, time: ATTENTION_UPDATED })} action={<WidgetMenu />}>
      <ul className="flex flex-col gap-1">
        {ATTENTION.map((a) => (
          <li key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", ATTN_TONE[a.tone])}>
              <Icon name={a.icon} size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">{bi(a.title, locale)}</p>
              <p className="text-xs text-muted-foreground">{bi(a.detail, locale)}</p>
            </div>
            <time className="text-xs text-muted-foreground tabular-nums">{a.time}</time>
          </li>
        ))}
      </ul>
      <div className="h-px bg-border" />
      <ProgressField
        label={t("erCapacity")}
        value={pct}
        tone="warning"
        helper={t("erBeds", { used: ER_CAPACITY.used, total: ER_CAPACITY.total })}
      />
    </Widget>
  )
}

/* ------------------------------------------------------------------ Today's appointments */

function RowMenu({ mrn }: { mrn: string }) {
  const t = useTranslations("dashboard.appointments")
  const tw = useTranslations("common.widget")
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={tw("more")}>
          <Icon name="more" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/patients/${mrn}`}>
            <Icon name="profile-circle" size={16} />
            {t("openPatient")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Widget / Today's Appointments (md+: table — Department hidden, Doctor from lg) and
 * Widget / Appointments List (mobile: one row per appointment with avatar, time · doctor, MRN, status).
 */
export function AppointmentsWidget({ className }: { className?: string }) {
  const t = useTranslations("dashboard.appointments")
  const ts = useTranslations("common.status")
  const locale = useLocale()
  const { scheduled, remainingThisHour } = APPOINTMENTS_SUMMARY

  return (
    <Widget
      className={className}
      title={t("title")}
      description={
        <>
          <span className="md:hidden">{t("descriptionShort", { count: scheduled, left: remainingThisHour })}</span>
          <span className="hidden md:inline">{t("description", { count: scheduled, left: remainingThisHour })}</span>
        </>
      }
      action={
        <>
          <IfModule id="appointments">
            <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
              <Link href="/appointments">
                {t("viewAll")}
                <Icon name="arrow-right-1" size={16} />
              </Link>
            </Button>
          </IfModule>
          <div className="md:hidden">
            <WidgetMenu />
          </div>
        </>
      }
    >
      {/* md+: table */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("patient")}</TableHead>
              <TableHead className="hidden w-37.5 lg:table-cell">{t("doctor")}</TableHead>
              <TableHead className="w-16">{t("time")}</TableHead>
              <TableHead className="w-30">{t("status")}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TODAY_APPOINTMENTS.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{a.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{bi(a.patient, locale)}</p>
                      <p className="text-xs text-muted-foreground">
                        <bdi dir="ltr">{t("mrn", { mrn: a.mrn })}</bdi>
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{bi(a.doctor, locale)}</TableCell>
                <TableCell className="tabular-nums">{a.time}</TableCell>
                <TableCell>
                  <StatusBadge tone={STATUS_TONE[a.status]}>{ts(a.status)}</StatusBadge>
                </TableCell>
                <TableCell>
                  <RowMenu mrn={a.mrn} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* mobile: list */}
      <ul className="flex flex-col md:hidden">
        {TODAY_APPOINTMENTS.map((a) => (
          <li key={a.id} className="flex items-start gap-3 border-b py-3 last:border-0">
            <Avatar>
              <AvatarFallback>{a.initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">{bi(a.patient, locale)}</p>
              <p className="text-xs text-muted-foreground">
                <span className="tabular-nums">{a.time}</span> · {bi(a.doctor, locale)}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                <bdi dir="ltr">{t("mrn", { mrn: a.mrn })}</bdi>
              </p>
            </div>
            <StatusBadge tone={STATUS_TONE[a.status]}>{ts(a.status)}</StatusBadge>
          </li>
        ))}
      </ul>
    </Widget>
  )
}

/* ------------------------------------------------------------------ Bed occupancy */

/**
 * Widget / Bed Occupancy: 168px donut (chart-1…5, 1.5° gaps) with the overall rate in the middle,
 * legend rows (swatch · department · used/total). Slices are each department's share of occupied beds.
 */
export function BedsWidget({ className }: { className?: string }) {
  const t = useTranslations("dashboard.beds")
  const locale = useLocale()
  const used = BEDS.reduce((s, b) => s + b.used, 0)
  const total = BEDS.reduce((s, b) => s + b.total, 0)
  const config = Object.fromEntries(BEDS.map((b) => [b.id, { label: bi(b.name, locale), color: b.color }])) satisfies ChartConfig
  const data = BEDS.map((b) => ({ id: b.id, name: bi(b.name, locale), used: b.used }))

  return (
    <Widget className={className} title={t("title")} description={t("description")} action={<WidgetMenu />}>
      <div className="flex justify-center">
        <div className="relative size-42">
          <ChartContainer config={config} className="aspect-square size-42">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
              <Pie data={data} dataKey="used" nameKey="id" innerRadius={55} outerRadius={84} paddingAngle={1.5} startAngle={90} endAngle={-270} stroke="none">
                {data.map((d) => (
                  <Cell key={d.id} fill={`var(--color-${d.id})`} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{Math.round((used / total) * 100)}%</span>
            <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
              {t("occupied", { used, total })}
            </span>
          </div>
        </div>
      </div>
      <ul className="flex flex-col gap-2.5">
        {BEDS.map((b) => (
          <li key={b.id} className="flex items-center gap-2 text-sm">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: b.color }} />
            <span className="min-w-0 flex-1 truncate">{bi(b.name, locale)}</span>
            <span className="font-medium tabular-nums" dir="ltr">
              {b.used}/{b.total}
            </span>
          </li>
        ))}
      </ul>
    </Widget>
  )
}
