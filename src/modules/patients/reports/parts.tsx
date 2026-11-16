"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { Cell, Pie, PieChart } from "recharts"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon, type IconName } from "@/components/ds/icon"
import { FilterChip, Pagination } from "@/components/ds/module-controls"
import { StatCard } from "@/components/ds/stat-card"
import { EmptyState } from "@/components/ds/states"
import type { StatusTone } from "@/components/ds/status-badge"
import { Widget, WidgetMenu } from "@/components/ds/widget"
import { ModuleTabsNav, PageContainer } from "@/components/shell/page"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { allPatients, type Patient } from "../data"
import { useText } from "../profile/use-patient"
import { usePatientsStore } from "../store"
import type { ReportKey } from "./data"

/* ================================================================== page shell */

export type Csv = { name: string; head: string[]; rows: (string | number)[][] }

/**
 * Report page (Patients · Report · <name> · 1440 / 768 / 390): back to Reports, title + description,
 * Print · Export (CSV of the filtered rows), module tabs, filters, KPIs, body.
 */
export function ReportShell({
  report,
  filters,
  kpis,
  csv,
  children,
}: {
  report: ReportKey
  filters?: React.ReactNode
  kpis?: React.ReactNode
  csv: () => Csv
  children: React.ReactNode
}) {
  const t = useTranslations("patients.reports")
  const { patients } = usePatientsStore()
  const total = patients.length || allPatients().length
  const exportCsv = () => {
    const { name, head, rows } = csv()
    const lines = [head, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(t("exported"), { description: t("exportedText", { count: rows.length }) })
  }
  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
        <Link href="/patients/reports">
          <Icon name="arrow-left" size={20} />
          {t("back")}
        </Link>
      </Button>
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t(`cards.${report}.title`)}</h1>
          <p className="text-sm text-muted-foreground">{t(`cards.${report}.page`)}</p>
        </div>
        <div className="flex gap-2 *:flex-1 md:*:flex-none">
          <Button variant="outline" className="h-10 md:h-9" onClick={() => window.print()}>
            <Icon name="printer" size={20} />
            {t("print")}
          </Button>
          <Button className="h-10 md:h-9" onClick={exportCsv}>
            <Icon name="export" size={20} />
            {t("export")}
          </Button>
        </div>
      </div>
      <ModuleTabsNav module="patients" counts={{ list: total.toLocaleString("en-US") }} />
      {filters}
      {kpis}
      {children}
    </PageContainer>
  )
}

/* ================================================================== filters */

export type SelectSpec = { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; width?: string }

/** Filters row: selects (full width on mobile) + chips that wrap (sheet 08 filter bar). */
export function ReportFilters({ selects, chips, className }: { selects: SelectSpec[]; chips?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2", className)}>
      {selects.map((s) => (
        <Select key={s.label} value={s.value} onValueChange={s.onChange}>
          <SelectTrigger aria-label={s.label} className={cn("w-full", s.width ?? "md:w-40")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {s.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
    </div>
  )
}

export function Chips<K extends string>({ value, onChange, items }: { value: K; onChange: (k: K) => void; items: { key: K; label: string; count: number }[] }) {
  const format = useFormatter()
  return (
    <>
      {items.map((c) => (
        <FilterChip key={c.key} selected={value === c.key} count={format.number(c.count, "integer")} onClick={() => onChange(c.key)}>
          {c.label}
        </FilterChip>
      ))}
    </>
  )
}

/* ================================================================== KPIs */

export type Kpi = { icon: IconName; tile?: React.ComponentProps<typeof StatCard>["tile"]; label: string; value: React.ReactNode; delta?: React.ReactNode; tone?: StatusTone; caption?: string }

export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
      {items.map((k) => (
        <StatCard key={k.label} icon={k.icon} tile={k.tile} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} caption={k.caption} />
      ))}
    </div>
  )
}

/* ================================================================== cards + tables */

export function ReportCard({ title, description, className, children }: { title: React.ReactNode; description?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Widget className={cn("@container/rpt min-w-0", className)} title={title} description={description} action={<WidgetMenu />}>
      {children}
    </Widget>
  )
}

export type Column<T> = { key: string; head: React.ReactNode; width?: string; cell: (row: T) => React.ReactNode }

/**
 * Report table: table with pagination when the card is ≥ 50rem wide (desktop), a list with "Load more" below
 * (tablet / mobile), as designed. Page size 7 (design) unless given.
 */
export function ReportTable<T>({
  rows,
  columns,
  item,
  rowKey,
  pageSize = 7,
}: {
  rows: T[]
  columns: Column<T>[]
  item: (row: T) => React.ReactNode
  rowKey: (row: T) => string
  pageSize?: number
}) {
  const t = useTranslations()
  const format = useFormatter()
  const [page, setPage] = React.useState(1)
  const [count, setCount] = React.useState(pageSize)
  // New rows (filters changed) → back to the first page.
  const [seen, setSeen] = React.useState(rows)
  if (seen !== rows) {
    setSeen(rows)
    setPage(1)
    setCount(pageSize)
  }
  if (!rows.length) {
    return <EmptyState icon="search-normal-1" title={t("patients.reports.noRows")} description={t("patients.reports.noRowsText")} />
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const slice = rows.slice((current - 1) * pageSize, current * pageSize)
  const cols = columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ")
  const n = (v: number) => format.number(v, "integer")
  return (
    <>
      <div className="hidden flex-col gap-4 @min-[50rem]/rpt:flex">
        <div className="overflow-hidden rounded-lg border" role="table">
          <div role="row" className="grid items-center gap-3 border-b bg-muted px-4 py-2.5 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: cols }}>
            {columns.map((c) => (
              <span key={c.key} role="columnheader">
                {c.head}
              </span>
            ))}
          </div>
          {slice.map((r) => (
            <div key={rowKey(r)} role="row" className="grid min-h-14 items-center gap-3 border-b px-4 py-2.5 text-sm last:border-0" style={{ gridTemplateColumns: cols }}>
              {columns.map((c) => (
                <div key={c.key} role="cell" className="min-w-0">
                  {c.cell(r)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <Pagination
          page={current}
          pageCount={pageCount}
          onPage={setPage}
          info={t("common.pagination.showing", { from: n((current - 1) * pageSize + 1), to: n((current - 1) * pageSize + slice.length), total: n(rows.length) })}
        />
      </div>
      <div className="flex flex-col gap-3 @min-[50rem]/rpt:hidden">
        <ul>
          {rows.slice(0, count).map((r) => (
            <li key={rowKey(r)} className="border-b py-3 first:pt-0 last:border-0">
              {item(r)}
            </li>
          ))}
        </ul>
        {count < rows.length && (
          <Button variant="outline" className="h-10" onClick={() => setCount((c) => c + pageSize)}>
            {t("patients.reports.loadMore")}
          </Button>
        )}
      </div>
    </>
  )
}

/** Avatar + name + MRN (links to the patient page). */
export function PatientCell({ patient, mrn }: { patient: Patient | null; mrn: string }) {
  const { b } = useText()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback>{patient?.initials ?? "—"}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        {patient ? (
          <Link href={`/patients/${patient.id}`} className="truncate font-medium hover:underline">
            {b(patient.name)}
          </Link>
        ) : (
          <span className="font-medium">—</span>
        )}
        <bdi dir="ltr" className="text-xs text-muted-foreground tabular-nums rtl:text-right">
          MRN {mrn}
        </bdi>
      </div>
    </div>
  )
}

/* ================================================================== charts */

/** Vertical bars (design `_bars`): y labels, 5 gridlines, chart-1 highlight, light bars otherwise. Mirrors in RTL. */
export function VBars({ values, labels, vmax, highlight, height = 200, ariaLabel }: { values: number[]; labels: string[]; vmax: number; highlight?: number; height?: number; ariaLabel: string }) {
  const ticks = [4, 3, 2, 1, 0].map((i) => Math.round((vmax / 4) * i))
  return (
    <div className="flex gap-3" role="img" aria-label={ariaLabel}>
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
          <div className="absolute inset-0 flex items-end">
            {values.map((v, i) => (
              <span key={i} className="flex h-full flex-1 items-end justify-center px-0.5">
                <span
                  className={cn("w-full max-w-4.5 rounded-t-[4px]", highlight === undefined || i === highlight ? "bg-chart-1" : "bg-blue-200")}
                  style={{ height: `${Math.max((v / vmax) * 100, v > 0 ? 1 : 0)}%` }}
                />
              </span>
            ))}
          </div>
        </div>
        <div className="flex">
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

/** Horizontal bars list (design `_hbars`): label + value on top, 8px track. */
export function HBars({ rows, vmax }: { rows: { key: string; label: string; value: string; amount: number; color?: string }[]; vmax: number }) {
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1">{r.label}</span>
            <span className="font-medium tabular-nums">{r.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", r.color ?? "bg-chart-1")} style={{ width: `${Math.min(100, (r.amount / vmax) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Donut + legend (booking source). */
export function Donut({ rows, center, caption }: { rows: { key: string; label: string; value: number; color: string }[]; center: string; caption: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1
  const config = Object.fromEntries(rows.map((r) => [r.key, { label: r.label, color: r.color }])) satisfies ChartConfig
  return (
    <div className="flex flex-col items-center gap-4 @min-[22rem]/rpt:flex-row">
      <div className="relative size-37.5 shrink-0">
        <ChartContainer config={config} className="aspect-square size-37.5">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="key" innerRadius={51} outerRadius={75} paddingAngle={1.5} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.key} fill={r.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{center}</span>
          <span className="text-xs text-muted-foreground">{caption}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-sm">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: r.color }} />
            <span className="flex-1">{r.label}</span>
            <span className="font-medium tabular-nums">{Math.round((r.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "1h 42m" / "1س 42د" */
export function useDuration() {
  const t = useTranslations("patients.reports")
  return (min: number) => {
    const h = Math.floor(min / 60)
    const m = String(min % 60).padStart(h ? 2 : 1, "0")
    return h ? t("hm", { h, m }) : t("m", { m })
  }
}
