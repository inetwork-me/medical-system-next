"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { REP_NOW, REP_TODAY, addDays, nextSend, type Schedule } from "./data"
import { useB } from "./parts"
import { repCan } from "./roles"
import { ScheduleDialog } from "./schedule-dialog"
import { logSend, useRepRole, useSchedules } from "./store"

/** "Every Sunday · 08:00" / "Every day · 07:00" / "1st of the month · 09:00" / "Every 3 months" (Riyadh time). */
export function useWhenText() {
  const t = useTranslations("reports.schedules.when")
  const locale = useLocale()
  const ar = locale === "ar"
  return (s: Schedule) => {
    if (s.frequency === "quarterly") return t("quarterly")
    if (s.frequency === "daily") return t("daily", { time: s.time })
    if (s.frequency === "monthly") return s.day === 1 ? t("first", { time: s.time }) : t("monthly", { day: ar ? String(s.day) : ordinal(s.day), time: s.time })
    const wd = new Intl.DateTimeFormat(ar ? "ar" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 22 + s.day, 12)))
    // Arabic reads "كل أحد", not "كل الأحد".
    return t("weekly", { day: ar ? wd.replace(/^ال/, "") : wd, time: s.time })
  }
}
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`

/** Next send: "Today 23:00" / "Tomorrow 07:00" / "Sun 29 Nov" / "1 Dec"; a paused schedule has none ("—"). */
export function useNextText() {
  const t = useTranslations("reports.schedules.next")
  const locale = useLocale()
  const dates = useDates()
  return (s: Schedule) => {
    if (s.status === "paused") return "—"
    const at = nextSend(s, REP_NOW)
    const d = at.slice(0, 10)
    const time = at.slice(11, 16)
    if (d === REP_TODAY) return t("today", { time })
    if (d === addDays(REP_TODAY, 1)) return t("tomorrow", { time })
    if (s.frequency === "weekly") {
      const wd = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { weekday: locale === "ar" ? "long" : "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`))
      return `${wd} ${dates.dayMonth(d)}`
    }
    return dates.dayMonth(d)
  }
}

function Status({ s, reason }: { s: Schedule; reason?: boolean }) {
  const t = useTranslations("reports.schedules.status")
  const b = useB()
  const tone = s.status === "active" ? "success" : s.status === "failed" ? "destructive" : "neutral"
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge tone={tone}>{t(s.status)}</StatusBadge>
      {reason && s.failure && <span className="text-xs text-muted-foreground">{b(s.failure)}</span>}
    </span>
  )
}

/**
 * Widget / Rep Schedules: "Scheduled reports · Sent by email as PDF or Excel · times are Riyadh time". Table: Report,
 * When, Sends to (people · format), Next send, Status (Active / Paused / Last send failed + reason) and the action —
 * Send now (active; report-sent, logged), Edit (paused) or Fix (failed) → the Schedule dialog. Compact: a list with the
 * send icon, name, "Every day · 07:00 · 5 people · PDF", the status badge and the action.
 */
export function SchedulesList() {
  const t = useTranslations("reports.schedules")
  const b = useB()
  const list = useSchedules()
  const when = useWhenText()
  const next = useNextText()
  const role = useRepRole()
  const can = repCan(role, "schedule")
  const [open, setOpen] = React.useState<Schedule | null>(null)
  const to = (s: Schedule) => t("to", { n: s.recipients.length, format: s.format === "pdf" ? "PDF" : "Excel" })
  const sendNow = (s: Schedule) => {
    logSend(s, REP_NOW)
    toast.success(t("sent"), { description: t("sentText") })
  }
  const action = (s: Schedule, compact?: boolean) => {
    if (!can) return null
    const name = b(s.targetName)
    if (s.status === "failed")
      return (
        <Button size="sm" variant={compact ? "outline" : "default"} onClick={() => setOpen(s)} aria-label={t("fixLabel", { name })}>
          {t("fix")}
        </Button>
      )
    if (s.status === "paused")
      return (
        <Button size="sm" variant="outline" onClick={() => setOpen(s)} aria-label={t("editLabel", { name })}>
          {t("edit")}
        </Button>
      )
    return (
      <Button size="sm" variant="outline" onClick={() => sendNow(s)} aria-label={t("sendNowLabel", { name })}>
        {t("sendNow")}
      </Button>
    )
  }

  return (
    <section aria-labelledby="rep-sched" className="@container/sc flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/sc:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rep-sched" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("text")}</p>
      </header>
      {list.length === 0 ? (
        <EmptyState icon="calendar-2" title={t("empty")} description={t("emptyText")} className="py-12" />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border @4xl/sc:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col />
                <col className="w-[212px]" />
                <col className="w-[142px]" />
                <col className="w-[162px]" />
                <col className="w-[180px]" />
                <col className="w-[100px]" />
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  {(["report", "when", "to", "next", "status"] as const).map((c) => (
                    <th key={c} className="h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4">
                      {t(`col.${c}`)}
                    </th>
                  ))}
                  <th className="h-10 pe-4">
                    <span className="sr-only">{t("col.action")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="truncate px-2 py-3 ps-4 text-foreground">{b(s.targetName)}</td>
                    <td className="px-2 py-3 text-muted-foreground">
                      <bdi>{when(s)}</bdi>
                    </td>
                    <td className="px-2 py-3 text-foreground">{to(s)}</td>
                    <td className="px-2 py-3 text-foreground">{next(s)}</td>
                    <td className="px-2 py-2">
                      <Status s={s} reason />
                    </td>
                    <td className="py-2 pe-4 text-end">{action(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col @4xl/sc:hidden">
            {list.map((s) => (
              <li key={s.id} className="flex items-start gap-3 border-b py-3 last:border-b-0">
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon name="send-2" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm text-foreground">{b(s.targetName)}</span>
                  <span className="text-xs text-muted-foreground">
                    <bdi>{when(s)}</bdi> · {to(s)}
                  </span>
                  <Status s={s} />
                </span>
                <span className="shrink-0">{action(s, true)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {open && <ScheduleDialog target={open.target} targetName={open.targetName} existing={open} onOpenChange={(o) => !o && setOpen(null)} />}
    </section>
  )
}
