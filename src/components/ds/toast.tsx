"use client"

import * as React from "react"
import { toast as sonner } from "sonner"

import { Icon, type IconName } from "@/components/ds/icon"
import { cn } from "@/lib/utils"

/**
 * DS sheet 10 · Toast — the only toast the app shows (never call sonner's `toast()` directly).
 *  · 4 tones: Success (tick-circle, emerald-600) · Info (info-circle, sky-600) · Warning (warning-2, amber-500)
 *    · Destructive (danger, red-600). No neutral / icon-less toast.
 *  · Card 360 wide, p-4, gap-3, rounded-xl, border, bg-card, shadow-lg. Icon 20 · title 14 Medium · description
 *    12 muted (gap 2px) · optional ONE action as a Link button (sm, primary) under the text · ghost sm close
 *    (close-circle 24) at the end. Mirrors in RTL through logical order.
 *  · Bottom-end on desktop/tablet, top on mobile (Toaster) · auto-hides after 5s, errors stay until closed.
 * Patients overlays use it for: patient updated, draft saved, files merged (+ Undo), not a duplicate (+ Undo).
 */

export type ToastTone = "success" | "info" | "warning" | "error"

const TONES: Record<ToastTone, { icon: IconName; className: string }> = {
  success: { icon: "tick-circle", className: "text-success" },
  info: { icon: "info-circle", className: "text-info" },
  warning: { icon: "warning-2", className: "text-warning" },
  error: { icon: "danger", className: "text-destructive" },
}

export type ToastOptions = {
  description?: React.ReactNode
  /** Max one action (DS rule), rendered as a link under the text. */
  action?: { label: string; onClick: () => void }
  /** Close button label for screen readers. */
  closeLabel?: string
}

export function ToastCard({
  tone,
  title,
  description,
  action,
  onClose,
  closeLabel = "Close",
  className,
}: { tone: ToastTone; title: React.ReactNode; onClose?: () => void } & ToastOptions & { className?: string }) {
  const t = TONES[tone]
  return (
    <div
      data-slot="toast"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex w-full items-start gap-3 rounded-xl border bg-card p-4 font-sans text-card-foreground shadow-lg sm:w-90", className)}
    >
      <Icon name={t.icon} size={20} className={cn("shrink-0", t.className)} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex h-8 cursor-pointer items-center text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="-my-1.5 -me-1.5 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Icon name="close-circle" size={24} />
        </button>
      )}
    </div>
  )
}

function show(tone: ToastTone, title: React.ReactNode, opts: ToastOptions = {}) {
  return sonner.custom(
    (id) => (
      <ToastCard
        tone={tone}
        title={title}
        description={opts.description}
        closeLabel={opts.closeLabel ?? (document.documentElement.lang === "ar" ? "إغلاق" : "Close")}
        action={
          opts.action && {
            label: opts.action.label,
            onClick: () => {
              sonner.dismiss(id)
              opts.action!.onClick()
            },
          }
        }
        onClose={() => sonner.dismiss(id)}
      />
    ),
    { duration: tone === "error" ? Infinity : 5000 },
  )
}

/** The app's toast API (DS sheet 10). */
export const notify = {
  success: (title: React.ReactNode, opts?: ToastOptions) => show("success", title, opts),
  info: (title: React.ReactNode, opts?: ToastOptions) => show("info", title, opts),
  warning: (title: React.ReactNode, opts?: ToastOptions) => show("warning", title, opts),
  error: (title: React.ReactNode, opts?: ToastOptions) => show("error", title, opts),
}
