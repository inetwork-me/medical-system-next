"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { parseDay, useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { WidgetMenu } from "@/components/ds/widget"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TODAY } from "../data"
import { Attention, PCard, PersonalInfo, ProfileCard, useSoon } from "./side"
import { usePatient, useText } from "./use-patient"

/* ================================================================== ring stats */

/** 88px progress ring; 8px stroke. Arabic fills counter-clockwise (mirrored), as designed. */
function Ring({ frac, hi, children }: { frac: number; hi: boolean; children: React.ReactNode }) {
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-22">
      <svg viewBox="0 0 88 88" className="size-22 -rotate-90 rtl:-scale-y-100" aria-hidden>
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" className={hi ? "stroke-card" : "stroke-muted"} />
        {frac > 0 && (
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${c * Math.min(Math.max(frac, 0), 1)} ${c}`}
            className={hi ? "stroke-primary" : "stroke-chart-1"}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** Widget / Patient Rings: Visits (highlighted) · Lab results · Paid · Profile. 4 across when the column is wide, else 2 × 2. */
export function Rings({ className }: { className?: string }) {
  const t = useTranslations("patients.page.rings")
  const { n } = useText()
  const data = usePatient()
  if (!data) return null
  const { visits, labs, money, profile } = data.summary
  const paidPct = money.payable ? Math.round((money.paid / money.payable) * 100) : 0
  const items = [
    {
      key: "visits",
      title: t("visits"),
      frac: visits.planned ? visits.done / visits.planned : 0,
      value: `${visits.done}/${visits.planned}`,
      caption: t("visitsCaption"),
    },
    {
      key: "labs",
      title: t("labs"),
      frac: labs.total ? labs.normal / labs.total : 0,
      value: labs.total ? `${labs.normal}/${labs.total}` : "—",
      caption: labs.total ? t("labsCaption") : t("labsNone"),
    },
    {
      key: "paid",
      title: t("paid"),
      frac: money.payable ? money.paid / money.payable : 0,
      value: money.payable ? `${paidPct}%` : "—",
      caption: t("paidCaption", { amount: n(money.paid) }),
    },
    {
      key: "profile",
      title: t("profile"),
      frac: profile.complete / profile.total,
      value: `${profile.complete}/${profile.total}`,
      caption: t("profileCaption"),
    },
  ]
  return (
    <div className={cn("grid grid-cols-2 gap-3 xl:@min-[30rem]/mid:grid-cols-4", className)}>
      {items.map((it, i) => {
        const hi = i === 0
        return (
          <div key={it.key} className={cn("flex flex-col items-center gap-2.5 rounded-xl px-2.5 py-3.5", hi ? "bg-accent" : "border bg-card")}>
            <p className={cn("text-center text-xs font-medium", hi ? "text-accent-foreground" : "text-foreground")}>{it.title}</p>
            <Ring frac={it.frac} hi={hi}>
              <bdi dir="ltr" className="text-lg leading-6 font-semibold tabular-nums">
                {it.value}
              </bdi>
              <span className="max-w-18 truncate text-xs text-muted-foreground">{it.caption}</span>
            </Ring>
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================== weight trend */

const weightConfig = {
  kg: { label: "Weight", color: "var(--chart-1)" },
} satisfies ChartConfig

/** Widget / Patient Weight Trend: range select, latest value + change badge, area line 12 (or 6) months. */
export function WeightTrend({ className }: { className?: string }) {
  const t = useTranslations("patients.page.weight")
  const dates = useDates()
  const { b, locale } = useText()
  const rtl = locale === "ar"
  const [range, setRange] = React.useState<"12" | "6">("12")
  const data = usePatient()
  if (!data) return null
  const all = data.record.weight
  if (!all.length) {
    return (
      <PCard className={className} title={t("title")}>
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-xs text-muted-foreground">{t("emptyText")}</p>
        </div>
      </PCard>
    )
  }
  const series = all.slice(range === "12" ? 0 : 6).map((w) => ({
    month: w.month,
    label: dates.month(w.month),
    kg: w.kg,
    tip: dates.monthYear(w.month),
  }))
  const first = series[0]
  const last = series[series.length - 1]
  const delta = Math.round((last.kg - first.kg) * 10) / 10
  const lo = Math.floor((Math.min(...series.map((s) => s.kg)) - 2) / 5) * 5
  const step = Math.max(5, Math.ceil((Math.max(...series.map((s) => s.kg)) + 2 - lo) / 4 / 5) * 5)
  const hi = lo + step * 4
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + i * step)
  const note = data.record.weightNote
  const since = dates.monthYear(first.month)

  return (
    <PCard
      className={className}
      title={t("title")}
      action={
        <Select value={range} onValueChange={(v) => setRange(v as "12" | "6")}>
          <SelectTrigger className="w-38" aria-label={t("title")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="12">{t("range12")}</SelectItem>
            <SelectItem value="6">{t("range6")}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums">{t("value", { kg: last.kg })}</span>
        <StatusBadge tone={delta >= 0 ? "success" : "warning"}>
          <bdi dir="ltr">{`${delta >= 0 ? "+" : "−"}${Math.abs(delta)}`}</bdi> {rtl ? "كجم" : "kg"}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">{note ? t("note", { date: since, note: b(note) }) : t("since", { date: since })}</span>
      </div>
      <ChartContainer config={{ kg: { ...weightConfig.kg, label: t("label") } }} className="aspect-auto h-44 w-full">
        <AreaChart
          data={series}
          margin={{
            top: 6,
            right: rtl ? 6 : 14,
            bottom: 0,
            left: rtl ? 14 : 6,
          }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-kg)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-kg)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            reversed={rtl}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
            tickFormatter={(v: string, i: number) => (series.length > 6 && i % 2 === 0 ? "" : v)}
          />
          <YAxis domain={[lo, hi]} ticks={ticks} width={28} orientation={rtl ? "right" : "left"} tickLine={false} axisLine={false} tickMargin={rtl ? 12 : 4} />
          <ChartTooltip
            defaultIndex={series.length - 1}
            cursor={false}
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_, p) => p?.[0]?.payload?.tip}
                formatter={(v) => <span className="font-medium tabular-nums">{t("value", { kg: Number(v) })}</span>}
              />
            }
          />
          <Area
            dataKey="kg"
            type="monotone"
            stroke="var(--color-kg)"
            strokeWidth={2}
            fill="url(#weight-fill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{
              r: 5,
              fill: "var(--card)",
              stroke: "var(--color-kg)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ChartContainer>
    </PCard>
  )
}

/* ================================================================== bars (visits per month, vitals) */

/** Simple bar chart (design `_bars`): y labels, 5 gridlines, light bars with one highlighted. Mirrors in Arabic. */
export function MiniBars({
  values,
  labels,
  vmax,
  highlight,
  height = 120,
  ariaLabel,
}: {
  values: number[]
  labels: string[]
  vmax: number
  highlight: number
  height?: number
  ariaLabel: string
}) {
  const ticks = [4, 3, 2, 1, 0].map((i) => Math.round((vmax / 4) * i * 10) / 10)
  return (
    <div className="flex gap-2" role="img" aria-label={ariaLabel}>
      <div className="flex flex-col justify-between text-end text-xs text-muted-foreground tabular-nums" style={{ height }}>
        {ticks.map((v) => (
          <span key={v} className="-my-2 leading-4">
            {v}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="relative" style={{ height }}>
          {ticks.map((v, i) => (
            <span key={v} className="absolute inset-x-0 h-px bg-border" style={{ top: `${(i / 4) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-2 px-1">
            {values.map((v, i) => (
              <span key={i} className="flex h-full flex-1 items-end justify-center">
                <span
                  className={cn("w-full max-w-6 rounded-t-[3px]", i === highlight ? "bg-chart-1" : "bg-blue-200")}
                  style={{
                    height: `${Math.max((v / vmax) * 100, v > 0 ? 2 : 1)}%`,
                  }}
                />
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 px-1">
          {labels.map((l, i) => (
            <span key={i} className="flex-1 truncate text-center text-xs text-muted-foreground">
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Widget / Patient Visits Chart: year badge, visits this year, last 6 months (busiest highlighted). */
export function VisitsChart({ className }: { className?: string }) {
  const t = useTranslations("patients.page.visitsChart")
  const dates = useDates()
  const { locale } = useText()
  const data = usePatient()
  if (!data) return null
  const year = TODAY.slice(0, 4)
  const visits = data.record.visits
  const thisYear = visits.filter((v) => v.date.startsWith(year)).length
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = parseDay(TODAY)
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - 5 + i)
    return d.toISOString().slice(0, 7)
  })
  const values = months.map((m) => visits.filter((v) => v.date.startsWith(m)).length)
  const labels = months.map((m) => (locale === "ar" ? String(Number(m.slice(5))) : dates.month(`${m}-01`)))
  const max = Math.max(...values)
  return (
    <PCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          {t("title")}
          <Badge variant="outline" className="tabular-nums">
            {year}
          </Badge>
        </span>
      }
    >
      <div className="flex items-end gap-1.5">
        <span className="text-2xl leading-8 font-semibold tabular-nums">{thisYear}</span>
        <span className="pb-1 text-xs text-muted-foreground">{t("thisYear", { count: thisYear })}</span>
      </div>
      <MiniBars
        values={values}
        labels={labels}
        vmax={Math.max(4, max)}
        highlight={max > 0 ? values.lastIndexOf(max) : -1}
        ariaLabel={months.map((m, i) => `${labels[i]}: ${values[i]}`).join(", ")}
      />
    </PCard>
  )
}

/* ================================================================== files (overview) */

export function FilesMini({ className }: { className?: string }) {
  const t = useTranslations("patients.page")
  const { b } = useText()
  const data = usePatient()
  if (!data) return null
  const { patient, record } = data
  return (
    <PCard
      className={className}
      title={t("filesMini.title")}
      description={t("filesMini.count", { count: record.files.length })}
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/patients/${patient.id}/files`}>
            {t("filesMini.all")}
            <Icon name="arrow-right-1" size={16} />
          </Link>
        </Button>
      }
    >
      {record.files.length ? (
        <ul className="flex flex-col gap-3">
          {record.files.slice(0, 4).map((f) => (
            <li key={f.name} className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-medium text-accent-foreground">{f.ext}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium">{b(f.title)}</span>
                <bdi dir="ltr" className="text-xs text-muted-foreground tabular-nums rtl:text-right">
                  {f.ext} · {f.size}
                </bdi>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">{t("files.emptyText")}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${patient.id}/files`}>
              <Icon name="document-upload" size={16} />
              {t("files.upload")}
            </Link>
          </Button>
        </div>
      )}
    </PCard>
  )
}

/* ================================================================== clinical notes */

export function Notes({ className }: { className?: string }) {
  const t = useTranslations("patients.page.notes")
  const date = useDates().short
  const { b } = useText()
  const soon = useSoon()
  const data = usePatient()
  if (!data) return null
  const notes = data.record.notes.slice(0, 2)
  return (
    <PCard
      className={className}
      title={t("title")}
      description={notes.length ? t("description") : undefined}
      action={
        <Button variant="ghost" size="sm" onClick={soon}>
          <Icon name="add" size={16} />
          {t("add")}
        </Button>
      }
    >
      {notes.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 xl:@min-[30rem]/mid:grid-cols-2">
          {notes.map((note) => (
            <li key={note.date + note.title.en} className="flex flex-col gap-1 rounded-lg bg-muted p-3.5">
              <p className="text-sm font-medium">{b(note.title)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{t("byline", { by: b(note.by), date: date(note.date) })}</p>
              <p className="text-xs">{b(note.body)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-xs text-muted-foreground">{t("emptyText")}</p>
        </div>
      )}
    </PCard>
  )
}

/* ================================================================== calendar */

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** Widget / Patient Calendar: month grid (weeks start Sunday), today outlined, booked = primary, requested = accent. */
export function PatientCalendar({ className }: { className?: string }) {
  const t = useTranslations("patients.page.calendar")
  const dates = useDates()
  const [month, setMonth] = React.useState(() => TODAY.slice(0, 7))
  const data = usePatient()
  if (!data) return null
  const marks = new Map(data.record.appointments.map((a) => [a.date, a.kind]))
  const first = parseDay(`${month}-01`)
  const start = new Date(first)
  start.setUTCDate(1 - first.getUTCDay())
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const weeks = Math.ceil((first.getUTCDay() + daysInMonth) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    return d
  })
  const shift = (k: number) => {
    const d = new Date(first)
    d.setUTCMonth(d.getUTCMonth() + k)
    setMonth(ymd(d).slice(0, 7))
  }
  const inMonth = data.record.appointments.filter((a) => a.date.startsWith(month))
  const booked = inMonth.filter((a) => a.kind === "booked").length
  const requested = inMonth.length - booked
  const weekdays = t("weekdays").split(",")

  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5 text-card-foreground", className)}>
      <header className="flex items-center gap-1.5">
        <h2 className="flex-1 text-lg font-semibold" aria-live="polite">
          {dates.monthLong(first)}
        </h2>
        <Button variant="outline" size="icon-sm" aria-label={t("prev")} onClick={() => shift(-1)}>
          <Icon name="arrow-left-1" size={16} />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label={t("next")} onClick={() => shift(1)}>
          <Icon name="arrow-right-1" size={16} />
        </Button>
      </header>
      <table className="w-full table-fixed border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            {weekdays.map((w, i) => (
              <th key={i} scope="col" className="pb-1 font-normal text-muted-foreground">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: weeks }, (_, w) => (
            <tr key={w}>
              {cells.slice(w * 7, w * 7 + 7).map((d) => {
                const key = ymd(d)
                const out = !key.startsWith(month)
                const mark = out ? undefined : marks.get(key)
                const today = key === TODAY
                return (
                  <td key={key} className="p-0">
                    <span
                      aria-label={[dates.long(key), mark && t(mark, { count: 1 }).split(" ·")[0], today && t("today")].filter(Boolean).join(" · ")}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md tabular-nums",
                        out ? "text-muted-foreground" : "text-foreground",
                        mark && "font-medium",
                        mark === "booked" && "bg-primary text-primary-foreground",
                        mark === "requested" && "bg-accent text-accent-foreground",
                        today && "font-medium ring-1 ring-primary ring-inset",
                      )}
                    >
                      {d.getUTCDate()}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-primary" />
          {t("booked", { count: booked })}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-accent" />
          {t("requested", { count: requested })}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] border border-primary bg-card" />
          {t("today")}
        </li>
      </ul>
    </section>
  )
}

/* ================================================================== billing summary */

const signed = (v: number, n: (v: number) => string) => (v < 0 ? `−${n(Math.abs(v))}` : n(v))

function BillRow({ label, amount, kind, n }: { label: string; amount?: number; kind: "group" | "item" | "total"; n: (v: number) => string }) {
  return (
    <div className={cn("flex items-center gap-2 border-b px-3 py-2.5 text-xs last:border-0", kind === "item" && "ps-6", kind === "total" && "bg-muted")}>
      <span className={cn("flex-1", kind === "item" ? "text-muted-foreground" : "font-medium")}>{label}</span>
      {amount !== undefined && (
        <bdi dir="ltr" className={cn("font-medium tabular-nums", kind === "total" && "text-sm text-warning-soft-foreground")}>
          {signed(amount, n)}
        </bdi>
      )}
    </div>
  )
}

export function BillingSummary({ className }: { className?: string }) {
  const t = useTranslations("patients.page.billing")
  const dates = useDates()
  const { b, n } = useText()
  const data = usePatient()
  if (!data) return null
  const { billing } = data.record
  return (
    <PCard className={className} title={t("title")} description={t("since", { date: dates.monthYear(billing.since) })} action={<WidgetMenu />}>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-2 border-b bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground">
          <span className="flex-1">{t("description")}</span>
          <span>{t("amount")}</span>
        </div>
        <BillRow kind="group" label={t("services")} n={n} />
        {billing.services.length ? (
          billing.services.map((s) => <BillRow key={s.label.en} kind="item" label={b(s.label)} amount={s.amount} n={n} />)
        ) : (
          <BillRow kind="item" label={t("noServices")} n={n} />
        )}
        {billing.coverage.length > 0 && (
          <>
            <BillRow kind="group" label={t("coverage")} n={n} />
            {billing.coverage.map((s) => (
              <BillRow key={s.label.en} kind="item" label={b(s.label)} amount={s.amount} n={n} />
            ))}
          </>
        )}
        <BillRow kind="total" label={t("balance")} amount={billing.balance} n={n} />
      </div>
    </PCard>
  )
}

/* ================================================================== page layout */

/**
 * Overview (Patient page · 1440 / 768 / 390). One DOM order, three layouts:
 *  · xl+  3 columns — 280 profile · fill (rings, weight, visits + files, notes) · 280 calendar + billing
 *  · md   2-column grid — profile | personal, attention, rings 2×2, weight, visits | files, notes, calendar | billing
 *  · <md  stack — attention, personal, rings 2×2, weight, visits, files, notes, calendar, billing
 *         (the profile card sits above the tabs in the frame)
 * Column wrappers are `display: contents` below xl so the cards join the outer grid and take their `order`.
 */
export function OverviewLayout() {
  const col = "contents xl:flex xl:flex-col xl:gap-6"
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-[280px_minmax(0,1fr)_280px] xl:items-start">
      <div className={col}>
        <ProfileCardSlot />
        <PersonalInfoSlot />
        <AttentionSlot />
      </div>
      <div className={cn(col, "xl:@container/mid xl:min-w-0")}>
        <Rings className="order-3 md:order-4 md:col-span-2" />
        <WeightTrend className="order-4 md:order-5 md:col-span-2" />
        <div className="contents xl:order-6 xl:grid xl:grid-cols-1 xl:gap-6 xl:@min-[30rem]/mid:grid-cols-2">
          <VisitsChart className="order-5 md:order-6" />
          <FilesMini className="order-6 md:order-7" />
        </div>
        <Notes className="order-7 md:order-8 md:col-span-2" />
      </div>
      <div className={col}>
        <PatientCalendar className="order-8 md:order-9" />
        <BillingSummary className="order-9 md:order-10" />
      </div>
    </div>
  )
}

const ProfileCardSlot = () => <ProfileCard className="hidden md:order-1 md:flex" />
const PersonalInfoSlot = () => <PersonalInfo className="order-2 md:order-2" />
const AttentionSlot = () => <Attention className="order-1 md:order-3 md:col-span-2" />
