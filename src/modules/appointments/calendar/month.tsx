"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { StatusBadge } from "@/components/ds/status-badge"
import { ALMOST_FULL, dayCount, isClosed, monthCells, TODAY } from "../data"

/**
 * Calendar · Month (design · Widget / Appt · Month): Sunday-first grid. md+: date + "n appts" chip (muted for past
 * days, blue from today on) + "Almost full"; Fridays "Closed"; days of other months greyed. Mobile: date + 1–3 dots.
 * A day opens the Day view.
 */
export function MonthGrid({ date, onOpenDay }: { date: string; onOpenDay: (d: string) => void }) {
  const t = useTranslations("appointments.calendar")
  const dates = useDates()
  const cells = monthCells(date)
  const month = date.slice(0, 7)
  const weekdays = t("weekdaysMini").split(",")
  const heads = cells.slice(0, 7).map((d) => dates.weekdayShort(d))

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div role="grid" aria-label={dates.monthLong(`${month}-01`)}>
        <div role="row" className="grid grid-cols-7 border-b">
          {heads.map((w, i) => (
            <div key={i} role="columnheader" className="p-2 text-center text-xs font-medium text-muted-foreground">
              <span className="hidden md:inline">{w}</span>
              <span className="md:hidden">{weekdays[i]}</span>
            </div>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, w) => (
          <div key={w} role="row" className="grid grid-cols-7 border-b last:border-b-0">
            {cells.slice(w * 7, w * 7 + 7).map((d) => (
              <Cell key={d} day={d} out={!d.startsWith(month)} onOpen={() => onOpenDay(d)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Cell({ day, out, onOpen }: { day: string; out: boolean; onOpen: () => void }) {
  const t = useTranslations("appointments.calendar")
  const dates = useDates()
  const closed = isClosed(day)
  const today = day === TODAY
  const past = day < TODAY
  const count = out || closed ? 0 : dayCount(day)
  const dots = count >= 30 ? 3 : count >= 15 ? 2 : count > 0 ? 1 : 0
  const n = Number(day.slice(8, 10))
  const label = [dates.full(day), closed ? t("closed") : t("apptsFull", { count }), count >= ALMOST_FULL && t("almostFull")].filter(Boolean).join(" · ")

  return (
    <div role="gridcell" className={cn("min-w-0", (out || closed) && "bg-muted", today && !out && "bg-accent md:bg-transparent")}>
      <button
        type="button"
        onClick={onOpen}
        disabled={out}
        aria-label={label}
        aria-current={today ? "date" : undefined}
        className={cn(
          "flex h-13 w-full flex-col items-center gap-1 p-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-26 md:items-start md:p-2",
          !out && "cursor-pointer hover:bg-muted/60",
          today && "md:bg-accent"
        )}
      >
        <span
          className={cn(
            "flex size-6.5 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
            today && !out ? "bg-primary text-primary-foreground" : out || closed ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {n}
        </span>
        {!out && (
          <>
            {/* md+: count chip, closed label, almost full */}
            <span className="hidden flex-col items-start gap-1 md:flex">
              {closed ? (
                <span className="text-xs text-muted-foreground">{t("closed")}</span>
              ) : (
                count > 0 && (
                  <span className={cn("rounded-sm px-1.5 py-0.5 text-xs whitespace-nowrap", past ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground")}>
                    {t("appts", { count })}
                  </span>
                )
              )}
              {count >= ALMOST_FULL && <StatusBadge tone="warning">{t("almostFull")}</StatusBadge>}
            </span>
            {/* mobile: dots */}
            {dots > 0 && (
              <span aria-hidden className="flex gap-0.5 md:hidden">
                {Array.from({ length: dots }, (_, i) => (
                  <span key={i} className={cn("size-1 rounded-full", past ? "bg-muted-foreground" : "bg-primary")} />
                ))}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  )
}
