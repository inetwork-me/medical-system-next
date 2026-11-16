import * as React from "react"

import { cn } from "@/lib/utils"
import { Icon, type IconName } from "@/components/ds/icon"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"

const TILE = {
  accent: "bg-accent text-primary",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
} as const

/**
 * DS sheet 08 · Stat Card: card p-6 gap-4; top row = optional 40px icon tile (rounded-lg, tinted by meaning)
 * + label 14 Medium muted; value 24 SemiBold tabular; footer = Status Badge delta + 12 muted caption.
 * Keep a row consistent: all with icons or all without.
 */
export function StatCard({
  label,
  value,
  icon,
  tile = "accent",
  delta,
  deltaTone = "success",
  caption,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  icon?: IconName
  tile?: keyof typeof TILE
  delta?: React.ReactNode
  deltaTone?: StatusTone
  caption?: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="stat-card" className={cn("flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-6", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TILE[tile])}>
            <Icon name={icon} size={20} />
          </span>
        )}
        <span className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-card-foreground tabular-nums">
        <bdi>{value}</bdi>
      </div>
      {(delta || caption) && (
        <div className="flex flex-wrap items-center gap-2">
          {delta && <StatusBadge tone={deltaTone}>{delta}</StatusBadge>}
          {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
        </div>
      )}
    </div>
  )
}
