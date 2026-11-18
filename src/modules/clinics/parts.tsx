import * as React from "react"

import { cn } from "@/lib/utils"
import { Icon, type IconName } from "@/components/ds/icon"
import type { TileTone } from "./data"

const TILE: Record<TileTone, string> = {
  info: "bg-info-soft text-info-soft-foreground",
  accent: "bg-accent text-primary",
  success: "bg-success-soft text-success-soft-foreground",
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  muted: "bg-muted text-muted-foreground",
}

/** Clinic icon tile: 40px (52 in the clinic header), rounded-lg, tinted per clinic. */
export function ClinicTile({ icon, tone, size = 40, className }: { icon: IconName; tone: TileTone; size?: 40 | 52; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg", size === 52 ? "size-13" : "size-10", TILE[tone], className)}>
      <Icon name={icon} size={size === 52 ? 24 : 20} />
    </span>
  )
}

/** Muted figure box (card stats, month figures): label 12 muted over a 14 Medium value. */
export function StatBox({ label, value, className, valueClassName }: { label: React.ReactNode; value: React.ReactNode; className?: string; valueClassName?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-muted p-2.5", className)}>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground tabular-nums", valueClassName)}>{value}</span>
    </div>
  )
}
