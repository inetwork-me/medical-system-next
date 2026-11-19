"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { VBars } from "@/components/reports/parts"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useClinics } from "@/modules/clinics/store"
import { DOCTORS_TODAY, type Doctor } from "./data"
import { DoctorsFrame } from "./frame"
import { DoctorName } from "./link"
import { useDoctors } from "./store"
import { useDoctorText } from "./text"

const MONTH_FROM = "2026-11-01"
/** Utilisation under 60% shows in warning (design: Dr. Tariq Hamdan 34%), like the Clinics report. */
const LOW_USE = 60
/** Rows (and bars) shown before "Show more" — the design's 9. */
const FIRST = 9
// Latin figures kept left-to-right inside Arabic text (LRI … PDI).
const iso = (s: string) => `⁦${s}⁩`
const firstName = (name: string) => name.replace(/^(Dr\.|د\.)\s*/, "").split(/\s+/)[0]

/**
 * Doctors · Reports (Widget / Doctors Report, Wide | Compact): "Visits by doctor" bars for month to date (first names
 * when wide, initials when compact; the busiest highlighted) and "Doctor comparison" sorted by visits — table when wide
 * (doctor, clinic, visits, utilisation bar, average consult, no-show, rating, revenue), rows with a utilisation bar
 * otherwise. Every active doctor is ranked; the first 9 show, then "Show more". Export (page action and card) downloads
 * the whole table.
 */
export function DoctorsReportPage() {
  const t = useTranslations("doctors.report")
  const { b, dates, locale } = useDoctorText()
  const clinics = useClinics()
  const [all, setAll] = React.useState(false)
  const rows = useDoctors()
    .filter((d) => d.active && d.month.visits > 0)
    .sort((a, z) => z.month.visits - a.month.visits)
  const shown = all ? rows : rows.slice(0, FIRST)
  const bars = rows.slice(0, FIRST)
  const short = (d: Doctor) => {
    const c = clinics.find((x) => x.key === d.clinic)
    return c ? b(c.short) : ""
  }
  const peak = Math.max(...bars.map((d) => d.month.visits), 1)
  const vmax = Math.max(500, Math.ceil(peak / 125) * 125)
  const ticks = [4, 3, 2, 1, 0].map((i) => (vmax / 4) * i)
  const range = dates.dayRange(MONTH_FROM, DOCTORS_TODAY).replace(" – ", "–")
  const rating = (d: Doctor) => (d.month.rating && d.month.rating !== "–" ? `★ ${d.month.rating}` : "—")

  const exportReport = () => {
    const file = `doctors-report-${stamp()}.xlsx`
    const head = (["doctor", "clinic", "visits", "utilisation", "consult", "noShow", "rating", "revenue"] as const).map((k) => t(`col.${k}`))
    const body = rows.map((d) => [
      b(d.name),
      short(d),
      String(d.month.visits),
      `${d.month.utilisation}%`,
      t("min", { n: d.month.consult }),
      `${d.month.noShow.toFixed(1)}%`,
      d.month.rating,
      t("revenue", { n: d.month.revenue }),
    ])
    saveBlob(xlsxBlob(head, body, { sheet: t("sheet"), rtl: locale === "ar" }), file)
    toast.success(t("exported"), { description: t("exportedText", { file }) })
  }
  const exportBtn = (
    <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={exportReport}>
      <Icon name="export" size={16} />
      {t("export")}
    </Button>
  )
  const bar = (u: number, className: string) => <Progress value={u} tone={u < LOW_USE ? "warning" : "default"} className={className} aria-hidden />

  return (
    <DoctorsFrame
      actions={
        <Button variant="outline" onClick={exportReport}>
          <Icon name="export" size={24} />
          {t("export")}
        </Button>
      }
    >
      <Widget title={t("chart")} description={range} className="gap-4 p-4 md:p-5">
        {bars.length === 0 ? (
          <EmptyState icon="chart-2" title={t("empty")} className="py-10" />
        ) : (
          <div className="@container/bars">
            {(["wide", "compact"] as const).map((v) => (
              <div key={v} className={v === "wide" ? "hidden @3xl/bars:block" : "@3xl/bars:hidden"}>
                <VBars
                  values={bars.map((d) => d.month.visits)}
                  labels={bars.map((d) => (v === "wide" ? firstName(b(d.name)) : d.initials))}
                  vmax={vmax}
                  ticks={ticks}
                  highlight={0}
                  height={v === "wide" ? 170 : 130}
                  ariaLabel={t("chart")}
                />
              </div>
            ))}
          </div>
        )}
      </Widget>

      <Widget title={t("compare")} description={t("sorted")} className="gap-4 p-4 md:p-5" action={exportBtn}>
        <div className="@container/rep flex flex-col gap-2">
          <div className="hidden overflow-hidden rounded-lg border @4xl/rep:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr className="h-10">
                  <th scope="col" className="ps-4 text-start font-medium">{t("col.doctor")}</th>
                  <th scope="col" className="w-28 px-3 text-start font-medium">{t("col.clinic")}</th>
                  <th scope="col" className="w-20 px-3 text-start font-medium">{t("col.visits")}</th>
                  <th scope="col" className="w-38 px-3 text-start font-medium">{t("col.utilisation")}</th>
                  <th scope="col" className="w-28 px-3 text-start font-medium">{t("col.consult")}</th>
                  <th scope="col" className="w-23 px-3 text-start font-medium">{t("col.noShow")}</th>
                  <th scope="col" className="w-20 px-3 text-start font-medium">{t("col.rating")}</th>
                  <th scope="col" className="w-31 px-3 pe-4 text-start font-medium">{t("col.revenue")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((d) => (
                  <tr key={d.key} className="h-13">
                    <td className="ps-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback>{d.initials}</AvatarFallback>
                        </Avatar>
                        <DoctorName en={d.name.en} className="truncate font-medium">
                          {b(d.name)}
                        </DoctorName>
                      </div>
                    </td>
                    <td className="truncate px-3 text-muted-foreground">{short(d)}</td>
                    <td className="px-3 tabular-nums">{d.month.visits.toLocaleString("en")}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        {bar(d.month.utilisation, "h-1.5 w-26")}
                        <span className="w-9 text-end text-xs tabular-nums" dir="ltr">
                          {d.month.utilisation}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 tabular-nums">{t("min", { n: d.month.consult })}</td>
                    <td className="px-3 tabular-nums">
                      <bdi dir="ltr">{d.month.noShow.toFixed(1)}%</bdi>
                    </td>
                    <td className="px-3 tabular-nums">
                      <bdi dir="ltr">{rating(d)}</bdi>
                    </td>
                    <td className="px-3 pe-4 tabular-nums">{t("revenue", { n: d.month.revenue })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y @4xl/rep:hidden">
            {shown.map((d) => (
              <li key={d.key} className="flex flex-col gap-2 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <DoctorName en={d.name.en} className="truncate text-sm font-medium">
                    {b(d.name)}
                  </DoctorName>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t("visits", { n: d.month.visits.toLocaleString("en") })}</span>
                </div>
                {bar(d.month.utilisation, "h-1.5")}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("line", { u: iso(`${d.month.utilisation}%`), m: d.month.consult, r: iso(d.month.rating) })}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > FIRST && (
            <Button variant="ghost" size="sm" className="self-center" onClick={() => setAll((v) => !v)}>
              {all ? t("showLess") : t("showMore", { n: rows.length - FIRST })}
              <Icon name={all ? "arrow-up-1" : "arrow-down"} size={16} />
            </Button>
          )}
        </div>
      </Widget>
    </DoctorsFrame>
  )
}
