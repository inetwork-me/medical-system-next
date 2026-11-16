import * as React from "react"

import { cn } from "@/lib/utils"

const TONES = {
  success: "bg-success-soft text-success-soft-foreground [--dot:var(--success)]",
  warning: "bg-warning-soft text-warning-soft-foreground [--dot:var(--warning)]",
  destructive: "bg-destructive-soft text-destructive-soft-foreground [--dot:var(--destructive)]",
  info: "bg-info-soft text-info-soft-foreground [--dot:var(--info)]",
  neutral: "bg-secondary text-muted-foreground [--dot:var(--muted-foreground)]",
} as const

export type StatusTone = keyof typeof TONES

/**
 * DS sheet 08 · Status Badge: soft fill + 6px dot + 12 Medium label, px-2 py-0.5, rounded-sm, gap 6.
 * The label always carries the meaning (status is never shown by colour alone).
 * Latin values like "+12.5%" are isolated so they read correctly inside Arabic text.
 */
export function StatusBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: StatusTone }) {
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
      {...props}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--dot)" />
      <bdi>{children}</bdi>
    </span>
  )
}
