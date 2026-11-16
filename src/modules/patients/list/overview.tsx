"use client"

import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { Cell, Pie, PieChart } from "recharts"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { StatCard } from "@/components/ds/stat-card"
import { Widget, WidgetMenu } from "@/components/ds/widget"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { KPI_DELTAS, REGIONS, patientStats } from "../data"
import { usePatientsStore } from "../store"

/** Patients list · KPI row (Total / New this month / VIP / Incomplete). */
export function PatientsKpis() {
  const t = useTranslations("patients.kpi")
  const format = useFormatter()
  const { patients } = usePatientsStore()
  const s = React.useMemo(() => patientStats(patients), [patients])
  const n = (v: number) => format.number(v, "integer")
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
      <StatCard icon="profile-2user" label={t("total")} value={n(s.total)} delta={KPI_DELTAS.total} caption={t("vsLastMonth")} />
      <StatCard icon="user-add" tile="info" label={t("newThisMonth")} value={n(s.newThisMonth)} delta={KPI_DELTAS.newThisMonth} caption={t("vsLastMonth")} />
      <StatCard icon="star-1" label={t("vip")} value={n(s.vip)} delta={KPI_DELTAS.vip} deltaTone="info" caption={t("thisMonth")} />
      <StatCard icon="warning-2" tile="warning" label={t("incomplete")} value={n(s.incomplete)} delta={KPI_DELTAS.incomplete} caption={t("thisWeek")} />
    </div>
  )
}

/** Widget / Patients by Gender + Age Groups + Patients by Region — 3 across from xl, 2 + 1 on tablet, stacked on mobile. */
export function PatientsCharts() {
  const { patients } = usePatientsStore()
  const s = React.useMemo(() => patientStats(patients), [patients])
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
      <GenderWidget stats={s} />
      <AgesWidget stats={s} />
      <RegionsWidget stats={s} className="md:col-span-2 xl:col-span-1" />
    </div>
  )
}

type Stats = ReturnType<typeof patientStats>
const pct = (part: number, total: number) => Math.round((part / Math.max(total, 1)) * 100)

function GenderWidget({ stats }: { stats: Stats }) {
  const t = useTranslations("patients.gender")
  const format = useFormatter()
  const rows = [
    { key: "male", label: t("male"), value: stats.gender.male, color: "var(--chart-1)" },
    { key: "female", label: t("female"), value: stats.gender.female, color: "var(--chart-2)" },
    { key: "unset", label: t("unset"), value: stats.gender.unset, color: "var(--muted-foreground)" },
  ]
  const config = Object.fromEntries(rows.map((r) => [r.key, { label: r.label, color: r.color }])) satisfies ChartConfig
  return (
    <Widget title={t("title")} description={t("description")} action={<WidgetMenu />}>
      <div className="flex justify-center">
        <div className="relative size-40">
          <ChartContainer config={config} className="aspect-square size-40">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <Pie data={rows} dataKey="value" nameKey="key" innerRadius={54} outerRadius={80} paddingAngle={1.5} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell key={r.key} fill={r.color} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums">{format.number(stats.total, "integer")}</span>
            <span className="text-xs text-muted-foreground">{t("patients")}</span>
          </div>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-sm">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: r.color }} />
            <span className="flex-1">{r.label}</span>
            <span className="font-medium tabular-nums" dir="ltr">
              {format.number(r.value, "integer")} · {pct(r.value, stats.total)}%
            </span>
          </li>
        ))}
      </ul>
    </Widget>
  )
}

/** Age groups: 4 columns, tallest bar in chart-1, others in the light brand blue (as designed). */
function AgesWidget({ stats }: { stats: Stats }) {
  const t = useTranslations("patients.ages")
  const shares = stats.ageGroups.map((g) => ({ ...g, pct: pct(g.count, stats.total) }))
  const max = Math.max(...shares.map((g) => g.pct))
  return (
    <Widget title={t("title")} description={t("description")} action={<WidgetMenu />}>
      <div className="flex flex-1 flex-col justify-end gap-3">
        <div className="flex h-44 items-end gap-3" role="img" aria-label={shares.map((g) => `${t(g.key)} ${g.pct}%`).join(", ")}>
          {shares.map((g) => (
            <div key={g.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs font-medium tabular-nums">{g.pct}%</span>
              <span
                className={cn("w-full rounded-t-md", g.pct === max ? "bg-chart-1" : "bg-blue-200")}
                style={{ height: `${(g.pct / 45) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {shares.map((g) => (
            <div key={g.key} className="flex flex-1 flex-col items-center text-center">
              <span className="text-xs font-medium">{t(g.key)}</span>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {g.range}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Widget>
  )
}

/** Region bars: label + share, 6px track; fill scaled so 50 % spans the full width (design scale). */
function RegionsWidget({ stats, className }: { stats: Stats; className?: string }) {
  const t = useTranslations("patients.regions")
  const locale = useLocale()
  return (
    <Widget className={className} title={t("title")} description={t("description")} action={<WidgetMenu />}>
      <ul className="flex flex-col gap-3">
        {stats.regions.map((r) => {
          const p = pct(r.count, stats.total)
          return (
            <li key={r.key} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">{bi(REGIONS[r.key].long, locale)}</span>
                <span className="font-medium tabular-nums">{p}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(100, (p / 50) * 100)}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Widget>
  )
}
