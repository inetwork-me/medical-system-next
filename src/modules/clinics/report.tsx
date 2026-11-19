"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { VBars } from "@/components/reports/parts"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CLINICS_TODAY, LONG_WAIT, MONTH_FROM, type Clinic } from "./data"
import { ClinicsFrame } from "./frame"
import { useClinics } from "./store"
import { useClinicText } from "./text"

/** Utilisation under 60% shows in warning (design: ENT 22%). */
const LOW_USE = 60

function useExportReport(rows: Clinic[]) {
  const t = useTranslations("clinics.report")
  const { b, min, locale } = useClinicText()
  return () => {
    const file = `clinics-report-${stamp()}.xlsx`
    const head = (["clinic", "visits", "utilisation", "wait", "noShow", "revenue"] as const).map((k) => t(`col.${k}`))
    const body = rows.map((c) => [
      b(c.name),
      String(c.month.visits),
      `${c.month.utilisation}%`,
      c.today.avgWait ? min(c.today.avgWait) : "—",
      c.month.noShow ? `${c.month.noShow}%` : "—",
      t("revenue", { n: c.month.revenue }),
    ])
    saveBlob(xlsxBlob(head, body, { sheet: t("sheet"), rtl: locale === "ar" }), file)
    toast.success(t("exported"), { description: t("exportedText", { file }) })
  }
}

/**
 * Clinics · Reports: Widget / Clinics Report — "Visits by clinic" bars (month to date, the busiest clinic highlighted)
 * and "Clinic comparison" sorted by visits: table when wide (≥ 56rem: visits, utilisation bar, avg wait > 20 min in
 * warning, no-show, revenue), rows with a utilisation bar otherwise. Export (page action and card) downloads the table.
 */
export function ClinicsReportPage() {
  const t = useTranslations("clinics.report")
  const { b, min, dates } = useClinicText()
  const clinics = useClinics().filter((c) => !c.isNew)
  const rows = [...clinics].sort((a, z) => z.month.visits - a.month.visits)
  const exportReport = useExportReport(rows)
  const peak = Math.max(...clinics.map((c) => c.month.visits), 1)
  const vmax = Math.max(1400, Math.ceil(peak / 350) * 350)
  const ticks = [4, 3, 2, 1, 0].map((i) => (vmax / 4) * i)
  const tick = (v: number) => (v >= 1000 ? `${Math.floor(v / 100) / 10}K` : String(v))
  // Latin percentage kept left-to-right inside Arabic text (LRI … PDI).
  const pct = (n: number) => `\u2066${n}%\u2069`
  const range = dates.dayRange(MONTH_FROM, CLINICS_TODAY).replace(" – ", "–")
  const exportBtn = (
    <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={exportReport}>
      <Icon name="export" size={16} />
      {t("export")}
    </Button>
  )
  return (
    <ClinicsFrame
      actions={
        <Button variant="outline" onClick={exportReport}>
          <Icon name="export" size={24} />
          {t("export")}
        </Button>
      }
    >
      <Widget title={t("chart")} description={range} className="gap-4 p-4 md:p-5">
        <VBars
          values={clinics.map((c) => c.month.visits)}
          labels={clinics.map((c) => b(c.short))}
          vmax={vmax}
          ticks={ticks}
          tick={tick}
          highlight={clinics.findIndex((c) => c.month.visits === peak)}
          height={180}
          ariaLabel={t("chart")}
        />
      </Widget>
      <Widget title={t("compare")} description={t("sorted")} className="gap-4 p-4 md:p-5" action={exportBtn}>
        <div className="@container/rep">
          <div className="hidden overflow-hidden rounded-lg border @4xl/rep:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr className="h-10">
                  <th scope="col" className="ps-4 text-start font-medium">{t("col.clinic")}</th>
                  <th scope="col" className="w-23 px-3 text-start font-medium">{t("col.visits")}</th>
                  <th scope="col" className="w-38 px-3 text-start font-medium">{t("col.utilisation")}</th>
                  <th scope="col" className="w-23 px-3 text-start font-medium">{t("col.wait")}</th>
                  <th scope="col" className="w-23 px-3 text-start font-medium">{t("col.noShow")}</th>
                  <th scope="col" className="w-31 px-3 pe-4 text-start font-medium">{t("col.revenue")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.key}>
                    <td className="py-2.5 ps-4 font-medium">{b(c.name)}</td>
                    <td className="px-3 tabular-nums">{c.month.visits.toLocaleString("en")}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <Progress value={c.month.utilisation} tone={c.month.utilisation < LOW_USE ? "warning" : "default"} className="h-1.5 w-20" />
                        <span className="text-xs font-medium tabular-nums" dir="ltr">
                          {c.month.utilisation}%
                        </span>
                      </div>
                    </td>
                    <td className={cn("px-3 tabular-nums", c.today.avgWait > LONG_WAIT && "text-warning-soft-foreground")}>
                      {c.today.avgWait ? min(c.today.avgWait) : "—"}
                    </td>
                    <td className="px-3 tabular-nums">{c.month.noShow ? <bdi dir="ltr">{c.month.noShow}%</bdi> : "—"}</td>
                    <td className="px-3 pe-4 tabular-nums">{t("revenue", { n: c.month.revenue })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y @4xl/rep:hidden">
            {rows.map((c) => (
              <li key={c.key} className="flex flex-col gap-1.5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{b(c.name)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{t("visits", { n: c.month.visits.toLocaleString("en") })}</span>
                </div>
                <Progress value={c.month.utilisation} tone={c.month.utilisation < LOW_USE ? "warning" : "default"} className="h-1.5" />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {c.today.avgWait
                    ? t("line", { u: pct(c.month.utilisation), w: min(c.today.avgWait), r: t("revenue", { n: c.month.revenue }) })
                    : t("lineNoWait", { u: pct(c.month.utilisation), r: t("revenue", { n: c.month.revenue }) })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Widget>
    </ClinicsFrame>
  )
}
