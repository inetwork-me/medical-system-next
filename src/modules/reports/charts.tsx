"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * The reports charts, drawn with plain elements (as the dashboards in the other modules): a column chart with a
 * left axis and a labelled horizontal-bar list. Every chart has a text alternative for screen readers.
 */

/**
 * Columns with a y axis (5 ticks from 0 to `max`) and labels under; the `highlight` column is dark (today, this
 * month), the rest light. `label` describes the chart for screen readers.
 */
export function ColumnChart({
  values,
  labels,
  max,
  ticks,
  highlight = values.length - 1,
  label,
  tickFormat = (n) => String(n),
  className,
}: {
  values: number[]
  labels: string[]
  max: number
  ticks: number[]
  highlight?: number
  label: string
  tickFormat?: (n: number) => string
  className?: string
}) {
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div className="flex h-[200px] gap-3" role="img" aria-label={label}>
        <div className="flex flex-col-reverse justify-between pb-0 text-xs text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-mb-2 leading-4 first:mb-0 last:mt-[-6px]" dir="ltr">
              {tickFormat(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col-reverse justify-between" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="border-t border-border" />
            ))}
          </div>
          <div className="relative flex h-full items-end justify-around gap-2 px-2" aria-hidden>
            {values.map((v, i) => (
              <span key={i} className={cn("w-full max-w-[18px] rounded-t-[3px]", i === highlight ? "bg-primary" : "bg-primary/25")} style={{ height: `${(v / max) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3" aria-hidden>
        <span className="invisible text-xs tabular-nums" dir="ltr">
          {tickFormat(ticks[ticks.length - 1])}
        </span>
        <div className="flex flex-1 justify-around px-2 text-xs text-muted-foreground">
          {labels.map((l, i) => (
            <span key={i} className="w-full max-w-[18px] text-center">
              {l}
            </span>
          ))}
        </div>
      </div>
    </figure>
  )
}

export type BarRow = { key: string; label: React.ReactNode; value: string; ratio: number; color?: string; muted?: React.ReactNode }

/** Labelled horizontal bars: name and value on one line, the bar under (0–1 of the track). */
export function BarList({ rows, className, label }: { rows: BarRow[]; className?: string; label: string }) {
  return (
    <ul className={cn("flex flex-col gap-4", className)} aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-2">
          <span className="flex items-baseline gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-foreground">{r.label}</span>
            {r.muted && <span className="text-xs text-muted-foreground tabular-nums">{r.muted}</span>}
            <bdi dir="ltr" className="text-foreground tabular-nums">
              {r.value}
            </bdi>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(1, r.ratio) * 100)}%`, background: r.color ?? "var(--primary)" }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A thin inline bar for tables (rooms in use, share, quality). */
export function InlineBar({ ratio, color, className }: { ratio: number; color?: string; className?: string }) {
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(1, ratio) * 100)}%`, background: color ?? "var(--primary)" }} />
    </span>
  )
}
