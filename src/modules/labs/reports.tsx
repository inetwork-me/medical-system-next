"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { saveBlob, stamp, xlsxBook } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { HBars, VBars } from "@/components/reports/parts"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { LAB_REPORT, testOf } from "./data"
import { LabFrame } from "./frame"
import { ltrRun } from "./parts"
import { LabCard } from "./samples"
import { useLabText } from "./text"

const R = LAB_REPORT
const REASON_COLOR: Record<string, string> = { hemolyzed: "bg-destructive", clotted: "bg-warning", qns: "bg-warning" }

type Tile = { label: string; value: string; line: string; tone: "success" | "warning" | "muted" }

/** The figures every report surface shows (page, export). */
function useReportText() {
  const t = useTranslations("labs.reports")
  const tr = useTranslations("labs.reject")
  const { b } = useLabText()
  const dates = useDates()
  const n = (v: number) => v.toLocaleString("en-US")
  const prev = dates.monthLong("2026-10-01").split(" ")[0]
  const prevShort = dates.month("2026-10-01")
  // "1–19 Nov 2026" (no spaces around the dash, as designed).
  const range = dates.dayRange(R.from, R.to).replace(/\s*[–-]\s*/, "–")
  const tiles: Tile[] = [
    { label: t("kpi.tests"), value: n(R.testsDone), line: t("kpi.testsDelta", { n: ltrRun(`+${R.testsDeltaPct}%`), prev: prevShort }), tone: "success" },
    { label: t("kpi.tat"), value: t("kpi.tatValue", { n: R.routineTatH }), line: t("kpi.tatTarget", { n: R.routineTargetH }), tone: "success" },
    { label: t("kpi.stat"), value: `${R.statWithin1hPct}%`, line: t("kpi.statTarget", { n: ltrRun(`${R.statTargetPct}%`) }), tone: "success" },
    { label: t("kpi.rejected"), value: `${R.rejectedPct}%`, line: t("kpi.rejectedTarget", { n: ltrRun(`${R.rejectedTargetPct}%`) }), tone: "muted" },
    {
      label: t("kpi.critical"),
      value: `${R.criticalOnTime} / ${R.criticalTotal}`,
      line: t("kpi.criticalLate", { n: R.criticalTotal - R.criticalOnTime, min: R.criticalLateMin }),
      tone: R.criticalOnTime < R.criticalTotal ? "warning" : "success",
    },
  ]
  const top = R.topTests.map((x) => ({ key: x.test, label: b(testOf(x.test)?.name ?? { en: x.test, ar: x.test }), value: n(x.n), amount: x.n }))
  const reasons = R.rejections.map((x) => ({ key: x.reason, label: tr(x.reason), value: n(x.n), amount: x.n, color: REASON_COLOR[x.reason] }))
  const rejectedTotal = R.rejections.reduce((s, x) => s + x.n, 0)
  return { t, tiles, top, reasons, rejectedTotal, range, prev, n }
}

/**
 * Widget / Lab Report: This month — 5 tiles (tests done, routine TAT, STAT within 1 h, rejected %, critical calls in
 * 30 min; compact shows the first four), Tests per day (last 2 weeks Sun–Thu, today highlighted), Top tests and Why
 * samples were rejected (bars). Sample month figures from the design.
 */
export function LabReport() {
  const { t, tiles, top, reasons, rejectedTotal, range, prev } = useReportText()
  const { ar } = useLabText()
  const days = ar ? ["ح", "ن", "ث", "ر", "خ"] : ["S", "M", "T", "W", "T"]
  return (
    <div className="@container/lr flex min-w-0 flex-col gap-4 md:gap-6">
      <LabCard title={t("month")} text={<bdi>{t("monthText", { range: ltrRun(range), prev })}</bdi>}>
        <dl className="grid grid-cols-2 gap-3 @4xl/lr:grid-cols-5">
          {tiles.map((x, i) => (
            <div key={x.label} className={cn("flex flex-col gap-1 rounded-lg bg-muted p-3", i === 4 && "hidden @4xl/lr:flex")}>
              <dt className="text-xs text-muted-foreground">{x.label}</dt>
              <dd className="text-lg font-semibold text-foreground tabular-nums">
                <bdi>{x.value}</bdi>
              </dd>
              <dd className={cn("text-xs", x.tone === "success" ? "text-success" : x.tone === "warning" ? "text-warning-soft-foreground" : "text-muted-foreground")}>
                <bdi>{x.line}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </LabCard>

      <LabCard title={t("perDay")} text={t("perDayText")}>
        <VBars values={R.perDay} labels={[...days, ...days]} vmax={400} highlight={R.perDay.length - 1} height={170} ariaLabel={t("perDayAria")} />
      </LabCard>

      <div className="grid grid-cols-1 gap-4 md:gap-6 @4xl/lr:grid-cols-2">
        <LabCard title={t("top")} text={t("topText")}>
          <HBars rows={top} vmax={1200} />
        </LabCard>
        <LabCard title={t("reasons")} text={t("reasonsText", { n: rejectedTotal })}>
          <HBars rows={reasons} vmax={40} />
        </LabCard>
      </div>
    </div>
  )
}

/** Lab · Reports (module tab): Export (workbook of the month); the report. */
export function ReportsPage() {
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.lab")
  const { ar } = useLabText()
  const { t, tiles, top, reasons, range } = useReportText()
  const exportBook = () => {
    const file = `lab-report-${stamp()}.xlsx`
    saveBlob(
      xlsxBook(
        [
          { name: t("month"), head: ["", range], rows: tiles.map((x) => [x.label, `${x.value} · ${x.line}`]) },
          { name: t("perDay"), head: ["#", t("perDay")], rows: R.perDay.map((v, i) => [String(i + 1), String(v)]) },
          { name: t("top"), head: ["", ""], rows: top.map((x) => [x.label, x.value]) },
          { name: t("reasons"), head: ["", ""], rows: reasons.map((x) => [x.label, x.value]) },
        ],
        { rtl: ar }
      ),
      file
    )
    toast.success(t("exported"), { description: file })
  }
  return (
    <LabFrame
      actions={
        <Button variant="outline" onClick={exportBook}>
          <Icon name="export" size={24} />
          {t("export")}
        </Button>
      }
    >
      <PageTitle title={tt("reports")} crumbs={[{ label: tn("lab"), href: "/lab" }]} />
      <LabReport />
    </LabFrame>
  )
}
