import * as React from "react"

import { cn } from "@/lib/utils"
import { Icon, type IconName } from "@/components/ds/icon"
import { Spinner } from "@/components/ds/spinner"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * DS sheet 10 · Empty State (No results / No data): centred, p-8, gap-3; 56px muted circle with a 24 icon,
 * title 18 SemiBold, description 12 muted, actions row (gap-2).
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon: IconName
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="empty-state" className={cn("flex flex-col items-center gap-3 p-8 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  )
}

/** DS sheet 08 · Loading State: card, p-8, gap-3, centred md spinner + title 14 Medium + caption 12 muted. */
export function LoadingState({
  title,
  description,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="loading-state"
      role="status"
      aria-live="polite"
      className={cn("flex min-h-50 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-8 text-center", className)}
    >
      <Spinner size="md" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

/** DS sheet 08 · Skeleton Card: stat-card placeholder (tile + label, value, caption). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border bg-card p-6", className)} aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <Skeleton className="h-3 w-30" />
      </div>
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-3 w-40" />
    </div>
  )
}

/** DS sheet 08 · Skeleton Row: table-row placeholder (avatar + two lines, then cell bars). */
export function SkeletonRow({ cells = [110, 100, 90, 72], className }: { cells?: number[]; className?: string }) {
  return (
    <div className={cn("flex h-14 items-center gap-4 border-b bg-card px-4", className)} aria-hidden>
      <div className="flex flex-1 items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-2.5 w-30 rounded-full" />
          <Skeleton className="h-2 w-18 rounded-full" />
        </div>
      </div>
      {cells.map((w, i) => (
        <Skeleton key={i} className="hidden h-2.5 rounded-full md:block" style={{ width: w }} />
      ))}
    </div>
  )
}
