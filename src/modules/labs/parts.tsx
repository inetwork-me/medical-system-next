"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi, type Bi } from "@/lib/mock/bi"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { TUBES, type Flag, type OrderStatus, type Priority, type TubeKey } from "./data"

/* Shared Labs atoms (Widgets page "Labs widgets · components"): tube dot, flag chip, STAT chip, status badge. */

/** Bilingual mock text for the current locale. */
export function useB() {
  const locale = useLocale()
  return (v: Bi) => bi(v, locale)
}

/** Latin text (codes, units, test abbreviations, barcodes) kept LTR inside Arabic. */
export function Latin({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {children}
    </bdi>
  )
}

/* ------------------------------------------------------------------ tube */

/**
 * Tube cap colour dot: a circle with the physical cap colour (the module's only hard-coded colours) and a border.
 * Always shown next to its name (TubeLabel) — never colour alone. Sizes from the design: 12 (lists), 14, 16 (guide).
 */
export function TubeDot({ tube, size = 12, className }: { tube: TubeKey; size?: 12 | 14 | 16; className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="tube-dot"
      className={cn("inline-block shrink-0 rounded-full border border-border", className)}
      style={{ backgroundColor: TUBES[tube].hex, width: size, height: size }}
    />
  )
}

/** Dot + tube name. `full` = "Gold · SST", else the short colour name ("Gold"). */
export function TubeLabel({
  tube,
  full,
  size = 12,
  gap = "gap-1.5",
  className,
  textClassName = "text-xs text-muted-foreground",
}: {
  tube: TubeKey
  full?: boolean
  size?: 12 | 14 | 16
  gap?: string
  className?: string
  textClassName?: string
}) {
  const b = useB()
  return (
    <span data-slot="tube-label" className={cn("inline-flex items-center", gap, className)}>
      <TubeDot tube={tube} size={size} />
      <span className={textClassName}>{b(full ? TUBES[tube].full : TUBES[tube].name)}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ chips */

const CHIP_TONES = {
  neutral: "border border-border bg-card text-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
} as const

/** Small chip (DS chip, small): pill, 3/10 padding, 12 Medium. */
export function LabChip({ tone = "neutral", className, children }: { tone?: keyof typeof CHIP_TONES; className?: string; children: React.ReactNode }) {
  return (
    <span
      data-slot="lab-chip"
      data-tone={tone}
      className={cn("inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-0.75 text-xs font-medium whitespace-nowrap", CHIP_TONES[tone], className)}
    >
      {children}
    </span>
  )
}

/** Flag tone: High = warning, Low = info, Critical = destructive. */
export const FLAG_TONE: Record<Flag, "warning" | "info" | "destructive"> = { H: "warning", L: "info", C: "destructive" }

/** Result value colour by flag (the design colours the value itself, plus the chip). */
export const FLAG_TEXT: Record<Flag, string> = {
  H: "text-warning-soft-foreground",
  L: "text-info-soft-foreground",
  C: "text-destructive",
}

/** Flag chip: High / Low / Critical. Without a flag shows "Normal" in muted text (or nothing with `hideNormal`). */
export function FlagChip({ flag, hideNormal, className }: { flag: Flag | null; hideNormal?: boolean; className?: string }) {
  const t = useTranslations("labs.flag")
  if (!flag) return hideNormal ? null : <span className={cn("text-xs text-muted-foreground", className)}>{t("normal")}</span>
  return (
    <LabChip tone={FLAG_TONE[flag]} className={className}>
      {t(flag)}
    </LabChip>
  )
}

/** Priority chip: STAT = destructive soft; routine = outline chip. `statOnly` renders nothing for routine. */
export function PriorityChip({ priority, statOnly, className }: { priority: Priority; statOnly?: boolean; className?: string }) {
  const t = useTranslations("labs.priority")
  if (priority === "routine" && statOnly) return null
  return (
    <LabChip tone={priority === "stat" ? "destructive" : "neutral"} className={className}>
      {t(priority)}
    </LabChip>
  )
}

/** STAT chip (shorthand). */
export const StatChip = ({ className }: { className?: string }) => <PriorityChip priority="stat" className={className} />

/* ------------------------------------------------------------------ status */

export const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  collect: "neutral",
  lab: "info",
  validate: "warning",
  ready: "success",
  rejected: "destructive",
}

/** Order status badge: To collect · In lab · To validate · Ready · Recollect. */
export function LabStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations("labs.status")
  return (
    <StatusBadge tone={STATUS_TONE[status]} className={className}>
      {t(status)}
    </StatusBadge>
  )
}

/** Trend icon next to the previous value (16, coloured by flag). */
export function TrendIcon({ dir, flag }: { dir: "up" | "down"; flag: Flag | null }) {
  return <Icon name={dir === "up" ? "trend-up" : "trend-down"} size={16} className={flag ? FLAG_TEXT[flag] : "text-muted-foreground"} />
}

/** Known design gaps (Add test, Scan sample, Call next, Show more): the button shows a "coming soon" toast. */
export function useSoon() {
  const t = useTranslations("labs.soon")
  return () => toast.info(t("title"), { description: t("text") })
}
