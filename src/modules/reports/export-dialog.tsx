"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { csvBlob, saveBlob, xlsxBook } from "@/lib/export/files"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CLINICS, REP_NOW } from "./data"
import {
  CLINIC_ROWS,
  DOCTOR_ROWS,
  LAB_TURNAROUND,
  QUALITY,
  REJECTIONS,
  REVENUE_BY_MONTH,
  TOP_DIAGNOSES,
  VISITS_A_DAY,
  WHO_PAID,
  lastWorkingDays,
} from "./dashboards-data"
import { Strip } from "./strip"
import { ltrRun, useB, useNumbers, usePeriodText } from "./parts"
import { logReport, useFilters } from "./store"

/*
 * Export (dashboards, reports): PDF / Excel / CSV of what the page shows. The content is aggregates only — reports
 * never carry patient names or IDs — and every export is logged (who, what, when, format).
 */

export type ExportSection = { title: string; kind: "chart" | "table"; head: string[]; rows: string[][] }
export type ExportContent = { name: string; slug: string; scope: string; sections: ExportSection[] }

/** A dashboard's export: its charts (as their figures) and its table, in the page's language. */
export function useDashboardExport(area: "operations" | "finance" | "clinical" | "doctors"): ExportContent {
  const t = useTranslations("reports.dash")
  const tt = useTranslations("shell.tabs.reports")
  const b = useB()
  const n = useNumbers()
  const locale = useLocale()
  const f = useFilters(area)
  const clinic = (id: string) => b(CLINICS.find((c) => c.id === id)!.name)
  const keep = (id: string) => f.clinic === "all" || f.clinic === id
  const sar = (v: number) => (locale === "ar" ? `${n.count(v)} ر.س` : `SAR ${n.count(v)}`)
  const base = { name: tt(area), slug: area, scope: area }
  if (area === "operations")
    return {
      ...base,
      sections: [
        { title: t("ops.day"), kind: "chart", head: [t("ops.col.day"), t("ops.col.visits")], rows: lastWorkingDays().map((d, i) => [d, String(VISITS_A_DAY[i])]) },
        { title: t("ops.byClinic"), kind: "chart", head: [t("ops.col.clinic"), t("ops.col.visits")], rows: CLINIC_ROWS.filter((r) => keep(r.clinic)).map((r) => [clinic(r.clinic), n.count(r.visits)]) },
        {
          title: t("ops.table"),
          kind: "table",
          head: [t("ops.col.clinic"), t("ops.col.visits"), t("ops.col.noShows"), t("ops.col.wait"), t("ops.col.rooms")],
          rows: CLINIC_ROWS.filter((r) => keep(r.clinic)).map((r) => [clinic(r.clinic), n.count(r.visits), n.percent(r.noShow), t("ops.min", { n: r.wait }), `${r.rooms}%`]),
        },
      ],
    }
  if (area === "finance")
    return {
      ...base,
      sections: [
        { title: t("fin.month"), kind: "chart", head: [t("fin.col.month"), t("fin.col.revenue")], rows: REVENUE_BY_MONTH.map((m) => [m.month, sar(m.value)]) },
        { title: t("fin.paid"), kind: "chart", head: [t("fin.col.payer"), t("fin.col.share")], rows: WHO_PAID.map((x) => [b(x.name), `${x.share}%`]) },
        {
          title: t("fin.rejections"),
          kind: "table",
          head: [t("fin.col.reason"), t("fin.col.claims"), t("fin.col.amount"), t("fin.col.share"), t("fin.col.mostFrom")],
          rows: REJECTIONS.map((r) => [b(r.reason), String(r.claims), sar(r.amount), `${r.share}%`, r.mostFrom ? b(r.mostFrom) : "—"]),
        },
      ],
    }
  if (area === "clinical")
    return {
      ...base,
      sections: [
        { title: t("clin.dx"), kind: "chart", head: [t("clin.col.code"), t("clin.col.diagnosis"), t("clin.col.visits")], rows: TOP_DIAGNOSES.map((d) => [d.code, b(d.name), n.count(d.count)]) },
        { title: t("clin.lab"), kind: "chart", head: [t("clin.col.test"), t("clin.col.hours")], rows: LAB_TURNAROUND.map((l) => [b(l.test), l.hours.toFixed(1)]) },
        { title: t("clin.quality"), kind: "table", head: [t("clin.col.indicator"), t("clin.col.value"), t("clin.col.goal")], rows: QUALITY.map((q) => [b(q.name), `${q.value}%`, `${q.under ? "<" : "≥"} ${q.goal}%`]) },
      ],
    }
  const rows = DOCTOR_ROWS.filter((r) => keep(r.clinic))
  return {
    ...base,
    sections: [
      { title: t("doc.visits"), kind: "chart", head: [t("doc.col.doctor"), t("doc.col.visits")], rows: rows.map((r) => [b(r.name), String(r.visits)]) },
      { title: t("doc.rating"), kind: "chart", head: [t("doc.col.doctor"), t("doc.col.rating")], rows: rows.map((r) => [b(r.name), r.rating.toFixed(1)]) },
      {
        title: t("doc.table"),
        kind: "table",
        head: [t("doc.col.doctor"), t("doc.col.clinic"), t("doc.col.visits"), t("doc.col.avg"), t("doc.col.notes"), t("doc.col.rating")],
        rows: rows.map((r) => [b(r.name), clinic(r.clinic), String(r.visits), t("doc.min", { n: r.avgVisit }), `${r.notesOnTime}%`, r.rating.toFixed(1)]),
      },
    ],
  }
}

type Format = "pdf" | "xlsx" | "csv"

/**
 * Overlay · Export the report (Export). Format PDF / Excel / CSV; charts, tables, "filters and date on the first page";
 * note: no patient names, every export logged. Download → export-ready ("{file} · saved to Downloads").
 */
export function ExportDialog({ content, onOpenChange, initial }: { content: ExportContent; onOpenChange: (open: boolean) => void; initial?: { format?: Format; tables?: boolean; charts?: boolean } }) {
  const t = useTranslations("reports.export")
  const locale = useLocale()
  const p = usePeriodText()
  const f = useFilters(content.scope)
  const [format, setFormat] = React.useState<Format>(initial?.format ?? "pdf")
  const [charts, setCharts] = React.useState(initial?.charts ?? true)
  const [tables, setTables] = React.useState(initial?.tables ?? true)
  const [cover, setCover] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const id = React.useId()
  const sections = content.sections.filter((s) => (s.kind === "chart" ? charts : tables))
  const nothing = sections.length === 0
  const file = `${content.slug}-${f.to.slice(0, 7)}.${format}`

  const download = async () => {
    if (nothing || busy) return
    setBusy(true)
    try {
      const filterLine = `${p.range(f)} · ${p.compare(f)}`
      if (format === "pdf") {
        const blocks: PdfBlock[] = [{ kind: "title", text: content.name }]
        if (cover) blocks.push({ kind: "meta", text: filterLine })
        for (const s of sections) blocks.push({ kind: "title", text: s.title }, { kind: "table", head: s.head, rows: s.rows })
        blocks.push({ kind: "note", text: t("note") })
        saveBlob(await pdfDocument(blocks, { dir: locale === "ar" ? "rtl" : "ltr", title: file }), file)
      } else if (format === "xlsx") {
        const sheets = sections.map((s, i) => ({ name: `${i + 1}`, head: s.head, rows: s.rows }))
        if (cover) sheets.unshift({ name: "0", head: [content.name], rows: [[filterLine]] })
        saveBlob(xlsxBook(sheets, { rtl: locale === "ar" }), file)
      } else {
        const s = sections.find((x) => x.kind === "table") ?? sections[0]
        saveBlob(csvBlob(s.head, s.rows), file)
      }
      logReport({ at: REP_NOW, kind: "export", what: content.slug, detail: `${format} · ${filterLine}` })
      onOpenChange(false)
      toast.success(t("toast"), { description: t("toastText", { file: ltrRun(file) }) })
    } catch {
      toast.error(t("failed"), { description: t("failedText"), retry: () => void download() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={`${content.name} · ${p.range(f).replace(/\s\d{4}$/, "")}`}
      icon="export"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void download()} disabled={nothing || busy}>
          {busy ? t("making") : t("download")}
        </Button>
      }
    >
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-f`} className="text-xs font-medium text-foreground">
          {t("format")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <Segmented
          value={format}
          onValueChange={setFormat}
          aria-labelledby={`${id}-f`}
          options={[
            { value: "pdf", label: "PDF" },
            { value: "xlsx", label: "Excel" },
            { value: "csv", label: "CSV" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        {(
          [
            ["c", t("charts"), charts, setCharts, format === "csv"],
            ["t", t("tables"), tables, setTables, false],
            ["v", t("cover"), cover, setCover, format === "csv"],
          ] as const
        ).map(([k, label, v, set, off]) => (
          <label key={k} htmlFor={`${id}-${k}`} className="flex cursor-pointer items-center gap-2 text-sm aria-disabled:cursor-default aria-disabled:opacity-50" aria-disabled={off || undefined}>
            <Checkbox id={`${id}-${k}`} checked={v && !off} disabled={off} onCheckedChange={(x) => set(x === true)} />
            {label}
          </label>
        ))}
        {format === "csv" && <p className="text-xs text-muted-foreground">{t("csvNote")}</p>}
        {nothing && <p className="text-xs text-destructive">{t("nothing")}</p>}
      </div>
      <Strip tone="info" icon="shield-tick">
        {t("note")}
      </Strip>
    </ResponsiveDialog>
  )
}

/** The Overview's export: the four KPIs and the area figures. */
export function useOverviewExport(): ExportContent {
  const t = useTranslations("reports.export")
  const tt = useTranslations("shell.tabs.reports")
  const n = useNumbers()
  return {
    name: tt("overview"),
    slug: "reports-overview",
    scope: "overview",
    sections: [
      {
        title: t("kpis"),
        kind: "table",
        head: [t("measure"), t("value")],
        rows: [
          [tt("operations"), n.count(8412)],
          [tt("finance"), n.money(2_840_000)],
          [`${tt("operations")} · %`, "9.8%"],
          [`${tt("finance")} · %`, "4.1%"],
        ],
      },
    ],
  }
}
