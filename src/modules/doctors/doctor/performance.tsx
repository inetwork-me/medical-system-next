"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { VBars } from "@/components/reports/parts"
import { StatusBadge } from "@/components/ds/status-badge"
import { Widget } from "@/components/ds/widget"
import { useClinics } from "@/modules/clinics/store"
import { DOCTORS_TODAY, HISTORY_MONTHS, historyOf, reviewsOf, type Doctor } from "../data"
import { useDoctors } from "../store"
import { ltr, useDoctorText } from "../text"
import { DoctorPage, useCurrentDoctor } from "./frame"
import { shortName } from "./patients"

const MONTH_FROM = "2026-11-01"

/**
 * Doctor page · Performance: Widget / Doctor Performance — Visits per month (Jun → Nov, this month highlighted) beside
 * Patient reviews (360) when wide, then "Compared with <clinic>": the doctor against the average of the clinic's
 * doctors (table when wide; rows with the doctor's figure in the result colour otherwise).
 */
export function DoctorPerformance() {
  const d = useCurrentDoctor()
  return (
    <DoctorPage>
      <div className="@container/pf flex flex-col gap-4 @5xl/pf:gap-6">
        <div className="grid grid-cols-1 gap-4 @5xl/pf:grid-cols-[minmax(0,1fr)_22.5rem] @5xl/pf:items-start @5xl/pf:gap-6">
          <Visits doctor={d} />
          <Reviews doctor={d} />
        </div>
        <Compare doctor={d} />
      </div>
    </DoctorPage>
  )
}

function Visits({ doctor: d }: { doctor: Doctor }) {
  const t = useTranslations("doctors.perf")
  const { dates } = useDoctorText()
  const vals = historyOf(d)
  const vmax = Math.max(800, Math.ceil(Math.max(...vals) / 200) * 200)
  const range = `${dates.month(HISTORY_MONTHS[0])} – ${dates.monthYear(HISTORY_MONTHS[5])}`
  return (
    <Widget title={t("chart")} description={t("chartText", { range, month: dates.month(DOCTORS_TODAY) })} className="gap-4 p-4 md:p-5">
      <div className="hidden @lg/widget:block">
        <VBars values={vals} labels={HISTORY_MONTHS.map((m) => dates.month(m))} vmax={vmax} highlight={5} height={180} ariaLabel={t("chart")} />
      </div>
      <div className="@lg/widget:hidden">
        <VBars values={vals} labels={HISTORY_MONTHS.map((m) => dates.month(m))} vmax={vmax} highlight={5} height={140} ariaLabel={t("chart")} />
      </div>
    </Widget>
  )
}

function Reviews({ doctor: d }: { doctor: Doctor }) {
  const t = useTranslations("doctors.perf")
  const { b, dates } = useDoctorText()
  const list = reviewsOf(d)
  return (
    <Widget title={t("reviews")} description={ltr(t("reviewsText", { rating: d.month.rating, n: d.month.reviews }))} className="gap-2 p-4 md:p-5">
      <ul className="flex flex-col divide-y">
        {list.map((r, i) => (
          <li key={i} className="flex flex-col gap-1 py-3 first:pt-1 last:pb-0">
            <span className="text-xs tracking-wider text-warning" role="img" aria-label={t("stars", { n: r.stars })}>
              {"★".repeat(r.stars)}
              {"☆".repeat(5 - r.stars)}
            </span>
            <p className="text-sm text-foreground">{b(r.text)}</p>
            <span className="text-xs text-muted-foreground tabular-nums">{t("by", { by: b(r.by), date: dates.dayMonth(r.date) })}</span>
          </li>
        ))}
      </ul>
    </Widget>
  )
}

type Measure = { k: "visits" | "consult" | "wait" | "noShow" | "return" | "rating" | "revenue"; mine: number; avg: number; higherBetter: boolean; show: (n: number) => string }

function Compare({ doctor: d }: { doctor: Doctor }) {
  const t = useTranslations("doctors.perf")
  const tm = useTranslations("doctors.month")
  const { b, dates, clinicName } = useDoctorText()
  const clinic = useClinics().find((c) => c.key === d.clinic)
  const peers = useDoctors().filter((x) => x.clinic === d.clinic && x.active)
  const avg = (f: (x: Doctor) => number, digits = 0) => {
    const v = peers.reduce((s, x) => s + f(x), 0) / Math.max(1, peers.length)
    return Math.round(v * 10 ** digits) / 10 ** digits
  }
  const m = d.month
  const measures: Measure[] = [
    { k: "visits", mine: m.visits, avg: avg((x) => x.month.visits), higherBetter: true, show: (n) => n.toLocaleString("en") },
    { k: "consult", mine: m.consult, avg: avg((x) => x.month.consult), higherBetter: false, show: (n) => tm("min", { n }) },
    { k: "wait", mine: m.wait, avg: avg((x) => x.month.wait), higherBetter: false, show: (n) => tm("min", { n }) },
    { k: "noShow", mine: m.noShow, avg: clinic?.month.noShow ?? avg((x) => x.month.noShow, 1), higherBetter: false, show: (n) => `${n}%` },
    { k: "return", mine: m.returnRate, avg: avg((x) => x.month.returnRate), higherBetter: true, show: (n) => `${n}%` },
    { k: "rating", mine: Number(m.rating), avg: Number(clinic?.month.rating ?? avg((x) => Number(x.month.rating), 1)), higherBetter: true, show: (n) => n.toFixed(1) },
    { k: "revenue", mine: m.revenue, avg: avg((x) => x.month.revenue), higherBetter: true, show: (n) => t("revenueValue", { n }) },
  ]
  const result = (x: Measure) => (x.mine === x.avg ? "same" : x.mine > x.avg === x.higherBetter ? "better" : "worse")
  const tone = { better: "success", worse: "warning", same: "neutral" } as const
  const name = clinicName(d.clinic)
  return (
    <Widget
      title={t("compare", { clinic: name })}
      description={ltr(t("compareText", { range: dates.dayRange(MONTH_FROM, DOCTORS_TODAY).replace(" – ", "–"), n: peers.length }))}
      className="gap-4 p-4 md:p-5"
    >
      <div className="hidden overflow-hidden rounded-lg border @4xl/widget:block">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr className="h-10">
              <th scope="col" className="ps-4 text-start font-medium">{t("col.measure")}</th>
              <th scope="col" className="w-38 px-3 text-start font-medium">{shortName(b(d.name))}</th>
              <th scope="col" className="w-38 px-3 text-start font-medium">{t("col.clinic")}</th>
              <th scope="col" className="w-38 px-3 pe-4 text-start font-medium">{t("col.diff")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {measures.map((x) => {
              const r = result(x)
              return (
                <tr key={x.k} className="h-10">
                  <th scope="row" className="ps-4 text-start font-medium">{t(`m.${x.k}`)}</th>
                  <td className="px-3 tabular-nums">{ltr(x.show(x.mine))}</td>
                  <td className="px-3 text-muted-foreground tabular-nums">{ltr(x.show(x.avg))}</td>
                  <td className="px-3 pe-4">
                    <StatusBadge tone={tone[r]}>{t(r)}</StatusBadge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col divide-y @4xl/widget:hidden">
        {measures.map((x) => {
          const r = result(x)
          return (
            <li key={x.k} className="flex items-center gap-2.5 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{t(`m.${x.k}`)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{ltr(t("clinicValue", { v: x.show(x.avg) }))}</span>
              </div>
              <span
                className={cn("text-sm font-medium tabular-nums", r === "better" ? "text-success" : r === "worse" ? "text-warning-soft-foreground" : "text-foreground")}
                aria-label={`${x.show(x.mine)} · ${t(r)}`}
              >
                {ltr(x.show(x.mine))}
              </span>
            </li>
          )
        })}
      </ul>
    </Widget>
  )
}
