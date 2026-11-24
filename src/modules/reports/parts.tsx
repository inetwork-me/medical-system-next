"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { bi, type Bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { toast } from "@/components/ds/toast"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { previousOf, type ReportFilters } from "./data"
import { changeOf, type ChangeKind, type MeasureId } from "./measures"

/* Shared Reports atoms (Widgets page "Reports widgets · components"). */

/** Bilingual mock text for the current locale. */
export function useB() {
  const locale = useLocale()
  return (v: Bi) => bi(v, locale)
}

/** Numbers, codes, percentages and file names stay Latin and LTR inside Arabic. */
export function Latin({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  )
}
export const ltrRun = (s: string) => `⁦${s}⁩`
const MINUS = "−"

/** Latin-digit number formats for every reports surface. */
export function useNumbers() {
  const locale = useLocale()
  const ar = locale === "ar"
  const int = new Intl.NumberFormat("en-US")
  const one = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  const two = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
  return {
    count: (n: number) => int.format(n),
    percent: (n: number) => `${one.format(n)}%`,
    /** Money, short: "SAR 182k" / "SAR 2.84M"; Arabic "182 ألف ر.س" / "2.84 مليون" (brief §4). */
    money: (n: number, opts?: { unit?: boolean }) => {
      if (Math.abs(n) >= 1_000_000) return ar ? `${two.format(n / 1_000_000)} مليون${opts?.unit ? " ر.س" : ""}` : `SAR ${two.format(n / 1_000_000)}M`
      if (Math.abs(n) >= 1_000) return ar ? `${int.format(Math.round(n / 1_000))} ألف ر.س` : `SAR ${int.format(Math.round(n / 1_000))}k`
      return ar ? `${int.format(n)} ر.س` : `SAR ${int.format(n)}`
    },
  }
}

/**
 * Change text + tone: a signed number with no unit word (brief §4) — "+6%" relative, "−1.2 pt" percentage points,
 * "−0.4 h" / "+0.8" absolute (English keeps the short unit, Arabic leaves it to the label), "same" when flat.
 * Good = green; bad = red, or amber where the design calls it a watch (area cards: `bad: "warning"`).
 */
export function useChange() {
  const locale = useLocale()
  const t = useTranslations("reports")
  return (measure: MeasureId, now: number, before: number, kind: ChangeKind = "relative", opts?: { unit?: string; bad?: StatusTone }) => {
    const c = changeOf(measure, now, before, kind)
    if (c.value === 0) return { text: t("same"), tone: "neutral" as StatusTone }
    const sign = c.value > 0 ? "+" : MINUS
    const abs = Math.abs(c.value)
    const num = kind === "relative" ? `${Number.isInteger(abs) ? abs : abs.toFixed(1)}%` : `${Number.isInteger(abs) && kind === "points" ? abs : abs.toFixed(1)}`
    const unit = locale === "ar" || kind === "relative" ? "" : kind === "points" ? " pt" : opts?.unit ? ` ${opts.unit}` : ""
    return { text: `${sign}${num}${unit}`, tone: (c.good ? "success" : (opts?.bad ?? "destructive")) as StatusTone }
  }
}

export function ChangeBadge({ measure, now, before, kind = "relative", unit, bad, className }: { measure: MeasureId; now: number; before: number; kind?: ChangeKind; unit?: string; bad?: StatusTone; className?: string }) {
  const c = useChange()(measure, now, before, kind, { unit, bad })
  return (
    <StatusBadge tone={c.tone} className={className}>
      <span dir="ltr">{c.text}</span>
    </StatusBadge>
  )
}

/** "1–22 Nov 2026" / "1–22 نوفمبر 2026", and the comparison chip "vs October" / "مقارنة بأكتوبر". */
export function usePeriodText() {
  const t = useTranslations("reports.filters")
  const dates = useDates()
  const locale = useLocale()
  const monthName = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { month: "long", timeZone: "UTC", numberingSystem: "latn" }).format(new Date(`${iso}T12:00:00Z`))
  return {
    /** "1–22 Nov 2026" (no spaces around the dash, as drawn); across months "28 Oct–3 Nov 2026". */
    range: (f: Pick<ReportFilters, "from" | "to">) => {
      if (f.from === f.to) return dates.short(f.from)
      const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { ...o, timeZone: "UTC", numberingSystem: "latn" })
      const d = (iso: string) => new Date(`${iso}T12:00:00Z`)
      const my = fmt({ month: locale === "ar" ? "long" : "short", year: "numeric" })
      if (f.from.slice(0, 7) === f.to.slice(0, 7)) return `${+f.from.slice(8)}–${+f.to.slice(8)} ${my.format(d(f.to))}`
      const dm = fmt({ day: "numeric", month: locale === "ar" ? "long" : "short" })
      return `${dm.format(d(f.from))}–${dm.format(d(f.to))} ${f.to.slice(0, 4)}`
    },
    compare: (f: ReportFilters) => {
      if (!f.compare) return t("noCompare")
      const p = previousOf(f)
      return p.wholeMonth ? t("vsMonth", { month: monthName(p.from) }) : t("vsDays", { n: (Date.parse(f.to) - Date.parse(f.from)) / 86_400_000 + 1 })
    },
    /** For sentences and toasts: "vs October" without the chip. */
    monthBefore: (f: ReportFilters) => monthName(previousOf(f).from),
  }
}

/** Steps not built yet in this round: a "coming soon" toast (removed as each step lands). */
export function useSoon() {
  const t = useTranslations("reports.soon")
  return () => toast.info(t("title"), { description: t("text") })
}
