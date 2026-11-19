"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { HEMOLYSIS_SENSITIVE, analyteOf, testOf, timeOf, type LabOrder, type Panel, type Result } from "../data"
import { orderHref } from "../href"
import { criticals, minsToDeadline, refText, trendOf, tubesToCollect, uncalledCriticals, valueText } from "../machine"
import { FLAG_TEXT, FlagChip, Latin, TrendIcon, ltrRun } from "../parts"
import { labCan } from "../roles"
import { useLabRole } from "../store"
import { useLabText } from "../text"

const shown = (p: Panel) => p.state === "validate" || p.state === "released"

/** Panel heading: its own title (the design's "Diabetes"), else the test name. */
export function usePanelTitle() {
  const { b } = useLabText()
  return (p: Panel) => (p.title ? b(p.title) : b(testOf(p.test)?.name ?? { en: p.test, ar: p.test }))
}

/**
 * Widget / Lab Results: the critical banner (until the call is logged), one card per resulted panel (wide table or
 * compact rows), then the pending tests (on analyzer → Enter results; in queue). Wide from a 672px container.
 */
export function LabResults({ order: o, onLogCall }: { order: LabOrder; onLogCall: () => void }) {
  return (
    <div className="@container/res flex min-w-0 flex-col gap-4">
      <CriticalBanner order={o} onLogCall={onLogCall} />
      {o.panels.filter(shown).map((p) => (
        <PanelCard key={p.test} order={o} panel={p} />
      ))}
      <PendingTests order={o} />
    </div>
  )
}

/* ------------------------------------------------------------------ critical banner */

function CriticalBanner({ order: o, onLogCall }: { order: LabOrder; onLogCall: () => void }) {
  const t = useTranslations("labs.order.banner")
  const { b, doctorName } = useLabText()
  const role = useLabRole()
  const c = uncalledCriticals(o)[0]
  if (!c) return null
  const a = analyteOf(c.result.analyte)!
  const overdue = minsToDeadline(c) < 0
  const hemolysis = HEMOLYSIS_SENSITIVE.includes(c.result.analyte)
  const name = b(a.name)
  // "potassium" inside the sentence; abbreviations (HbA1c, LDL) and Arabic stay as they are.
  const inSentence = (n: string) => (/[A-Z].*[A-Z0-9]/.test(n) || /[\u0600-\u06FF]/.test(n) ? n : n.toLowerCase())
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive bg-destructive-soft p-4 @2xl/res:flex-row @2xl/res:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2.5 text-destructive-soft-foreground">
        <Icon name="danger" size={22} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">
            <bdi>{t("title", { analyte: inSentence(name), value: ltrRun(`${valueText(c.result.analyte, c.result.value)} ${c.result.unit}`) })}</bdi>
          </span>
          <span className="text-xs">
            <bdi>{t(overdue ? "overdue" : "text", { doctor: doctorName(o.doctorId), time: timeOf(c.deadline) })}</bdi>
            {hemolysis && <> {t("hemolysis")}</>}
          </span>
        </div>
      </div>
      {labCan(role, "logCall") && (
        <Button variant="destructive" size="sm" onClick={onLogCall}>
          <Icon name="call-calling" size={24} />
          {t("log")}
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ panel card */

function PreviousText({ r }: { r: Result }) {
  const dates = useDates()
  if (!r.previous) return <>—</>
  const v = valueText(r.analyte, r.previous.value)
  return <>{r.previous.date ? `${v} · ${dates.month(r.previous.date)}` : v}</>
}

function PanelCard({ order: o, panel: p }: { order: LabOrder; panel: Panel }) {
  const t = useTranslations("labs.order.panel")
  const { b } = useLabText()
  const title = usePanelTitle()(p)
  const meta = p.resultedAt
    ? p.results[0]?.instrument
      ? t("meta", { time: timeOf(p.resultedAt), instrument: p.results[0].instrument })
      : t("metaNoInst", { time: timeOf(p.resultedAt) })
    : ""
  const critical = new Set(criticals(o).map((c) => c.result.analyte))
  const th = "h-10 px-1.5 text-start text-xs font-medium text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 @2xl/res:p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <StatusBadge tone="success">{p.state === "released" ? t("released") : t("resulted")}</StatusBadge>
        {meta && (
          <span className="hidden flex-1 text-end text-xs text-muted-foreground tabular-nums @2xl/res:block">
            <bdi>{meta}</bdi>
          </span>
        )}
      </header>
      {meta && (
        <span className="text-xs text-muted-foreground tabular-nums @2xl/res:hidden">
          <bdi>{meta}</bdi>
        </span>
      )}

      {p.results.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noResults")}</p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border @2xl/res:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col />
                <col className="w-[102px]" />
                <col className="w-[102px]" />
                <col className="w-[92px]" />
                <col className="w-[112px]" />
                <col className="w-[142px]" />
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  {(["test", "result", "flag", "unit", "ref", "prev"] as const).map((k) => (
                    <th key={k} className={th}>
                      {t(`col.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.results.map((r) => {
                  const trend = r.flag ? trendOf(r) : null
                  return (
                    <tr key={r.analyte} className={cn("border-t", critical.has(r.analyte) && "bg-destructive-soft")}>
                      <td className={td}>{b(analyteOf(r.analyte)!.name)}</td>
                      <td className={cn(td, r.flag ? cn("text-lg font-semibold", FLAG_TEXT[r.flag]) : "font-medium")}>
                        <Latin>{valueText(r.analyte, r.value)}</Latin>
                      </td>
                      <td className={td}>
                        <FlagChip flag={r.flag} />
                      </td>
                      <td className={cn(td, "text-muted-foreground")}>
                        <Latin>{r.unit}</Latin>
                      </td>
                      <td className={cn(td, "text-muted-foreground")}>
                        <Latin>{refText(r)}</Latin>
                      </td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                          <PreviousText r={r} />
                          {trend && <TrendIcon dir={trend} flag={r.flag} />}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col @2xl/res:hidden">
            {p.results.map((r) => {
              const crit = critical.has(r.analyte)
              const value = (
                <Latin>
                  {valueText(r.analyte, r.value)} {r.unit}
                </Latin>
              )
              return (
                <li key={r.analyte} className={cn("flex flex-col gap-1 px-2 py-2.5", crit ? "rounded-lg bg-destructive-soft" : "border-b last:border-b-0")}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-medium">{b(analyteOf(r.analyte)!.name)}</span>
                    <span className={cn("text-sm font-medium", r.flag ? FLAG_TEXT[r.flag] : "text-foreground")}>{value}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-xs text-muted-foreground tabular-nums">
                      {r.previous ? (
                        <RefLine r={r} />
                      ) : (
                        t("refOnly", { ref: refText(r) })
                      )}
                    </span>
                    <FlagChip flag={r.flag} hideNormal />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function RefLine({ r }: { r: Result }) {
  const t = useTranslations("labs.order.panel")
  const dates = useDates()
  const v = valueText(r.analyte, r.previous!.value)
  return <bdi>{t("refLine", { ref: refText(r), prev: r.previous!.date ? `${v} · ${dates.month(r.previous!.date)}` : v })}</bdi>
}

/* ------------------------------------------------------------------ pending */

function PendingTests({ order: o }: { order: LabOrder }) {
  const t = useTranslations("labs.order.pending")
  const role = useLabRole()
  const title = usePanelTitle()
  const pending = o.panels.filter((p) => !shown(p))
  if (!pending.length) return null
  const waitingSample = (p: Panel) => tubesToCollect(o).some((x) => x.tests.includes(p.test))
  const stateOf = (p: Panel) => (waitingSample(p) ? t("collect") : p.state === "draft" ? t("draft") : p.state === "analyzer" ? t("analyzer") : t("waiting"))
  return (
    <ul className="flex flex-col rounded-xl border bg-card px-4 py-1 @2xl/res:px-5">
      {pending.map((p) => {
        const canEnter = (p.state === "analyzer" || p.state === "draft") && !waitingSample(p) && labCan(role, "enter")
        return (
          <li key={p.test} className="flex items-center gap-2.5 border-b py-3 last:border-b-0">
            <Icon name="timer-1" size={18} className="shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-foreground">{title(p)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {p.dueAt && !waitingSample(p) ? t("due", { state: stateOf(p), time: timeOf(p.dueAt) }) : stateOf(p)}
              </span>
            </div>
            {canEnter && (
              <Button variant="outline" size="sm" asChild>
                <Link href={orderHref(o.no, "entry", { test: p.test })}>{t("enter")}</Link>
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
