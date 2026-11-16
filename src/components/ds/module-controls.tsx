"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

/**
 * DS sheet 08 · Filter Chip: 32px pill, px-3, gap-1.5, 12 Medium label + 12 Regular count.
 * Default = card + border · Selected = primary fill, count in blue-200 (primary-foreground/70 here).
 */
export function FilterChip({
  selected = false,
  count,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean; count?: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-selected={selected || undefined}
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-[selected]:border-primary data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary/90",
        className
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className={cn("font-normal tabular-nums", selected ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * DS sheet 08 · Pagination: "Showing 1–8 of 1,284" (12 muted) at the start; pages at the end —
 * outline 32px prev/next (chevrons mirror in RTL), 32px page cells, current = primary.
 */
export function Pagination({
  page,
  pageCount,
  info,
  onPage,
  className,
}: {
  page: number
  pageCount: number
  /** Pre-formatted "Showing x–y of z" line (use t("common.pagination.showing", …)). */
  info?: React.ReactNode
  onPage: (page: number) => void
  className?: string
}) {
  const t = useTranslations("common.a11y")
  const pages = pageWindow(page, pageCount)
  return (
    <nav className={cn("flex items-center gap-2", className)} aria-label={t("pagination")}>
      {info && <p className="min-w-0 flex-1 text-xs text-muted-foreground tabular-nums">{info}</p>}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("previousPage")}>
          <Icon name="arrow-left-1" size={16} />
        </Button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="flex size-8 items-center justify-center text-xs font-medium text-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-md text-xs font-medium tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                p === page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {p}
            </button>
          )
        )}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          aria-label={t("nextPage")}
        >
          <Icon name="arrow-right-1" size={16} />
        </Button>
      </div>
    </nav>
  )
}

function pageWindow(page: number, count: number): (number | "…")[] {
  if (count <= 5) return Array.from({ length: count }, (_, i) => i + 1)
  if (page <= 3) return [1, 2, 3, "…", count]
  if (page >= count - 2) return [1, "…", count - 2, count - 1, count]
  return [1, "…", page, "…", count]
}

/** DS sheet 08 · Progress Field: label 14 Medium + value 14 Medium muted, 8px bar, helper 12 muted; gap 8. */
export function ProgressField({
  label,
  value,
  valueLabel,
  helper,
  tone,
  className,
}: {
  label: React.ReactNode
  value: number
  valueLabel?: React.ReactNode
  helper?: React.ReactNode
  tone?: React.ComponentProps<typeof Progress>["tone"]
  className?: string
}) {
  const id = React.useId()
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span id={id} className="min-w-0 flex-1 text-foreground">
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          <bdi>{valueLabel ?? `${value}%`}</bdi>
        </span>
      </div>
      <Progress value={value} tone={tone} aria-labelledby={id} />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}
