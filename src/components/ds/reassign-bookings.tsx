"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"

/**
 * DS "Move bookings" block (design v4.6–v4.7) — one component for every dialog that has to put bookings somewhere else.
 *  · target "doctor" (Deactivate doctor, Request leave): Move to another doctor (default; expands to the doctor
 *    picker) · Spread across available doctors · Cancel bookings and text patients. Label "Future bookings · {n}".
 *  · target "clinic" (Pause clinic): Move to the next open days (default, "date"; expands to a per-day preview) ·
 *    Move to another clinic or branch (expands to the clinic picker) · Cancel bookings. Label "Bookings in these dates · {n}".
 * Cards: p-3, radius 10, gap 12; selected = accent fill + primary border, others card + border; only the selected card
 * expands. Picker: card panel, border, radius 8, clipped; search; rows split by 1px dividers — radio · avatar (doctors)
 * · name + second line · coverage badge (under the second line when narrow); list capped at ~4 rows. Coverage:
 * Success covers all, Warning covers some, Neutral (on leave / unavailable) = row disabled at 55%.
 * The block only shows and reports choices; the dialog computes the candidates and applies the plan.
 */

export type ReassignChoice = "doctor" | "spread" | "date" | "clinic" | "cancel"
export type Coverage = { state: "all" | "some"; covered: number; total: number } | { state: "leave"; until: string } | { state: "unavailable" }
export type ReassignCandidate = {
  key: string
  name: string
  /** Second line: role, or where the clinic is / how far. */
  sub: string
  /** Doctors only. */
  initials?: string
  coverage: Coverage
}
export type ReassignPreview = { days: { key: string; label: string; n: number }[]; waiting: number }

const TONE: Record<Coverage["state"], StatusTone> = { all: "success", some: "warning", leave: "neutral", unavailable: "neutral" }
export const isOpen = (c: Coverage) => c.state === "all" || c.state === "some"

export function ReassignBookings({
  target,
  count,
  department,
  leave,
  value,
  onValueChange,
  picked,
  onPick,
  candidates = [],
  preview,
  className,
}: {
  target: "doctor" | "clinic"
  /** Bookings being moved. */
  count: number
  /** The department or clinic: name ("Pediatrics" / "الأطفال") and the adjective form for the Spread hint ("أطفال"). */
  department: { name: string; short: string }
  /** Request leave: "Move to a cover doctor". */
  leave?: boolean
  value: ReassignChoice
  onValueChange: (v: ReassignChoice) => void
  /** The picked doctor / clinic key. */
  picked?: string
  onPick: (key: string) => void
  /** Doctors (target doctor) or clinics (target clinic), best coverage first. */
  candidates?: ReassignCandidate[]
  /** Move to the next open days: bookings per day and the waiting list. */
  preview?: ReassignPreview
  className?: string
}) {
  const t = useTranslations("common.reassign")
  const choices: ReassignChoice[] = target === "doctor" ? ["doctor", "spread", "cancel"] : ["date", "clinic", "cancel"]
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const dept = { dept: department.name, deptShort: department.short }
  const labelId = React.useId()

  const title = (c: ReassignChoice) => (c === "doctor" && leave ? t("doctor.titleLeave") : t(`${c}.title`))
  const hint = (c: ReassignChoice) => t(`${c}.hint`, dept)
  // Arrow keys move the choice (WAI-ARIA radio group); RTL flips left / right.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl"
    const next = e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight") ? 1 : e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft") ? -1 : 0
    if (!next) return
    e.preventDefault()
    const c = choices[(i + next + choices.length) % choices.length]
    onValueChange(c)
    refs.current[c]?.focus()
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={labelId} className="text-sm font-medium tabular-nums">
        {t(target === "doctor" ? "labelDoctor" : "labelClinic", { n: count })}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
        {choices.map((c, i) => {
          const on = value === c
          return (
            <div key={c} className={cn("flex flex-col gap-3 rounded-[10px] border p-3", on ? "border-primary bg-accent" : "border-border bg-card")}>
              <button
                ref={(el) => {
                  refs.current[c] = el
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => onValueChange(c)}
                onKeyDown={(e) => onKey(e, i)}
                className="-m-1 flex cursor-pointer items-start gap-2.5 rounded-md p-1 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <RadioDot on={on} className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{title(c)}</span>
                  <span className="text-xs text-muted-foreground">{hint(c)}</span>
                </span>
              </button>
              {on && (c === "doctor" || c === "clinic") && (
                <>
                  <Picker
                    kind={c}
                    candidates={candidates}
                    picked={picked}
                    onPick={onPick}
                    search={c === "doctor" ? t("doctor.search", dept) : t("clinic.search")}
                    label={title(c)}
                  />
                  <p className="text-xs text-muted-foreground">{t(c === "doctor" ? "doctor.foot" : "clinic.foot")}</p>
                </>
              )}
              {on && c === "date" && preview && (
                <>
                  <dl className="flex flex-col rounded-lg border bg-card px-3 py-0.5">
                    {preview.days.map((d) => (
                      <div key={d.key} className="flex items-center gap-3 border-b py-2.5">
                        <dt className="w-35 shrink-0 text-xs text-muted-foreground">{d.label}</dt>
                        <dd className="text-sm font-medium tabular-nums">{t("date.bookings", { n: d.n })}</dd>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 py-2.5">
                      <dt className="w-35 shrink-0 text-xs text-muted-foreground">{t("date.waiting")}</dt>
                      <dd className={cn("text-sm font-medium tabular-nums", preview.waiting > 0 ? "text-warning-soft-foreground" : "text-muted-foreground")}>
                        {preview.waiting > 0 ? t("date.waitingValue", { n: preview.waiting }) : t("date.waitingNone")}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">{t("date.foot")}</p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RadioDot({ on, className }: { on: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border bg-card", on ? "border-primary" : "border-input", className)}>
      {on && <span className="size-2 rounded-full bg-primary" />}
    </span>
  )
}

/** Doctor / clinic picker: search + a radio list (arrow keys move within it, disabled rows are skipped). */
function Picker({
  kind,
  candidates,
  picked,
  onPick,
  search,
  label,
}: {
  kind: "doctor" | "clinic"
  candidates: ReassignCandidate[]
  picked?: string
  onPick: (key: string) => void
  search: string
  label: string
}) {
  const t = useTranslations("common.reassign")
  const [q, setQ] = React.useState("")
  const rows = React.useRef<Record<string, HTMLDivElement | null>>({})
  const query = q.trim().toLowerCase()
  const list = query ? candidates.filter((c) => `${c.name} ${c.sub}`.toLowerCase().includes(query)) : candidates
  const enabled = list.filter((c) => isOpen(c.coverage))
  const focusKey = enabled.some((c) => c.key === picked) ? picked : enabled[0]?.key

  const badge = (c: Coverage) =>
    c.state === "leave" ? t("onLeave", { date: c.until }) : c.state === "unavailable" ? t(kind === "doctor" ? "unavailableDoctor" : "unavailableClinic") : t("covers", { n: c.covered, total: c.total })
  const onKey = (e: React.KeyboardEvent, key: string) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl"
    const step = e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight") ? 1 : e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft") ? -1 : 0
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      onPick(key)
      return
    }
    if (!step || !enabled.length) return
    e.preventDefault()
    const i = enabled.findIndex((c) => c.key === key)
    const next = enabled[(i + step + enabled.length) % enabled.length]
    onPick(next.key)
    rows.current[next.key]?.focus()
  }

  return (
    <div className="@container/rb overflow-hidden rounded-lg border bg-card">
      <div className="p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={search} aria-label={search} startIcon={<Icon name="search-normal-1" size={16} />} />
      </div>
      <div role="radiogroup" aria-label={label} className="max-h-80 overflow-y-auto @sm/rb:max-h-60 border-t">
        {list.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("noMatch")}</p>}
        {list.map((c) => {
          const open = isOpen(c.coverage)
          const on = c.key === picked && open
          const text = badge(c.coverage)
          const b = (
            <StatusBadge tone={TONE[c.coverage.state]} className="shrink-0 tabular-nums">
              {text}
            </StatusBadge>
          )
          return (
            <div
              key={c.key}
              ref={(el) => {
                rows.current[c.key] = el
              }}
              role="radio"
              aria-checked={on}
              aria-disabled={!open || undefined}
              aria-label={`${c.name}, ${c.sub}, ${text}${open ? "" : ` — ${t("cantPick")}`}`}
              tabIndex={open && c.key === focusKey ? 0 : -1}
              onClick={() => open && onPick(c.key)}
              onKeyDown={(e) => open && onKey(e, c.key)}
              className={cn(
                "flex items-center gap-2.5 border-b px-3 py-2.5 outline-none last:border-b-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
                on ? "bg-accent" : "bg-card",
                open ? "cursor-pointer hover:bg-accent/60" : "cursor-not-allowed opacity-55"
              )}
            >
              <RadioDot on={on} />
              {c.initials && (
                <Avatar size="sm" aria-hidden>
                  <AvatarFallback>{c.initials}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="w-full truncate text-sm font-medium">{c.name}</span>
                <span className="w-full truncate text-xs text-muted-foreground tabular-nums">{c.sub}</span>
                <span className="mt-1 @sm/rb:hidden">{b}</span>
              </div>
              <span className="hidden @sm/rb:inline-flex">{b}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
