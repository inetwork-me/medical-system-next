"use client"

import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"

import { bi } from "@/lib/mock/bi"
import { ATTENTION, ATTENTION_UPDATED, BEDS, ER_CAPACITY, KPIS, TODAY_APPOINTMENTS, VISITS, VISITS_YEAR } from "@/lib/mock/dashboard"
import { csvBlob, saveBlob, stamp, xlsxBook, type XlsxSheet } from "@/lib/export/files"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup } from "@/components/ui/radio-group"

type Section = "kpis" | "visits" | "attention" | "appointments" | "beds"
const SECTIONS: Section[] = ["kpis", "visits", "attention", "appointments", "beds"]

/**
 * Dashboard › Export — same flow as Patients › Export: centred dialog (bottom sheet on mobile) with format
 * (Excel / PDF / CSV) and the sections to include; the file is built in the browser from the dashboard data,
 * then a DS success toast confirms it.
 */
export function DashboardExport() {
  const t = useTranslations("dashboard")
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon name="export" size={20} />
        {t("export")}
      </Button>
      <DashboardExportDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function DashboardExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("dashboard")
  const tx = useTranslations("dashboard.exportDialog")
  const tp = useTranslations("patients.exportDialog")
  const tc = useTranslations("common")
  const format = useFormatter()
  const locale = useLocale()
  const dates = useDates()
  const [fmt, setFmt] = React.useState<"excel" | "pdf" | "csv">("excel")
  const [pick, setPick] = React.useState<Record<Section, boolean>>({ kpis: true, visits: true, attention: true, appointments: true, beds: true })
  const [busy, setBusy] = React.useState(false)
  const chosen = SECTIONS.filter((s) => pick[s])
  const n = (v: number) => format.number(v, "integer")

  /** Each section as a titled table (one sheet in Excel, one table in PDF, one block in CSV). */
  const tables = (): Record<Section, XlsxSheet> => {
    const month = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { month: "short", numberingSystem: "latn" })
    return {
      kpis: {
        name: tx("sections.kpis"),
        head: [tx("col.metric"), tx("col.value"), tx("col.change")],
        rows: [
          [t("kpi.totalPatients"), n(KPIS.totalPatients.value), `${KPIS.totalPatients.delta} ${t("kpi.vsLastMonth")}`],
          [t("kpi.appointmentsToday"), n(KPIS.appointmentsToday.value), `${KPIS.appointmentsToday.delta} ${t("kpi.vsYesterday")}`],
          [t("kpi.critical"), n(KPIS.critical.value), `${KPIS.critical.delta} ${t("kpi.since", { time: KPIS.critical.since })}`],
          [t("kpi.waitTime"), t("kpi.minutes", { n: KPIS.waitTime.minutes }), `${t("kpi.minutes", { n: KPIS.waitTime.deltaMinutes })} ${t("kpi.vsLastWeek")}`],
        ],
      },
      visits: {
        name: t("visits.title"),
        head: [tx("col.month"), t("visits.inPerson"), t("visits.telehealth")],
        rows: VISITS.inPerson.map((v, i) => [`${month.format(new Date(VISITS_YEAR, i, 15))} ${VISITS_YEAR}`, n(v), n(VISITS.telehealth[i])]),
      },
      attention: {
        name: t("attention.title"),
        head: [tx("col.time"), tx("col.item"), tx("col.details")],
        rows: [
          ...ATTENTION.map((a) => [a.time, bi(a.title, locale), bi(a.detail, locale)]),
          ["", t("attention.erCapacity"), t("attention.erBeds", { used: ER_CAPACITY.used, total: ER_CAPACITY.total })],
        ],
      },
      appointments: {
        name: t("appointments.title"),
        head: [t("appointments.time"), t("appointments.patient"), "MRN", t("appointments.doctor"), t("appointments.status")],
        rows: TODAY_APPOINTMENTS.map((a) => [a.time, bi(a.patient, locale), a.mrn, bi(a.doctor, locale), tc(`status.${a.status}`)]),
      },
      beds: {
        name: t("beds.title"),
        head: [tx("col.department"), tx("col.occupied"), tx("col.total"), tx("col.rate")],
        rows: BEDS.map((b) => [bi(b.name, locale), n(b.used), n(b.total), `${Math.round((b.used / b.total) * 100)}%`]),
      },
    }
  }

  const run = async () => {
    if (!chosen.length) return
    const all = tables()
    const sheets = chosen.map((s) => all[s])
    const base = `dashboard-${stamp()}`
    const label = { excel: "Excel", pdf: "PDF", csv: "CSV" }[fmt]
    setBusy(true)
    try {
      if (fmt === "excel") saveBlob(xlsxBook(sheets, { rtl: locale === "ar" }), `${base}.xlsx`)
      else if (fmt === "csv") {
        // One file: each section as a titled block, separated by a blank row.
        const width = Math.max(...sheets.map((s) => s.head.length))
        const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")]
        const rows = sheets.flatMap((s, i) => [...(i ? [pad([])] : []), pad([s.name]), pad(s.head), ...s.rows.map(pad)])
        saveBlob(csvBlob(rows[0], rows.slice(1)), `${base}.csv`)
      } else {
        const blocks: PdfBlock[] = [
          { kind: "brand", title: tx("pdfBrand"), subtitle: tx("pdfMeta", { date: dates.short(new Date()), time: ATTENTION_UPDATED }) },
          { kind: "title", text: tx("pdfTitle") },
        ]
        for (const s of sheets) blocks.push({ kind: "title", text: s.name }, { kind: "table", head: s.head, rows: s.rows })
        saveBlob(await pdfDocument(blocks, { dir: locale === "ar" ? "rtl" : "ltr", title: base }), `${base}.pdf`)
      }
      onOpenChange(false)
      toast.success(tp("downloaded"), { description: tx("downloadedText", { count: chosen.length, format: label }) })
    } catch {
      toast.error(tp("failed"), { description: tp("failedText"), retry: () => void run() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="export"
      title={tp("title")}
      description={tx("description")}
      width="sm:max-w-125"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={run} loading={busy} disabled={!chosen.length}>
          {!busy && <Icon name="export" size={20} />}
          {tp("confirm")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium">{tp("format")}</p>
        <RadioGroup value={fmt} onValueChange={(v) => setFmt(v as typeof fmt)} className="gap-2">
          <RadioOption value="excel" title={tp("excel")} description={tx("excelHint")} />
          <RadioOption value="pdf" title={tp("pdf")} description={tp("pdfHint")} />
          <RadioOption value="csv" title={tp("csv")} />
        </RadioGroup>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-medium">{tx("include")}</legend>
        {SECTIONS.map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={pick[k]} onCheckedChange={(v) => setPick((s) => ({ ...s, [k]: v === true }))} />
            {k === "kpis" ? tx("sections.kpis") : t(`${k}.title`)}
          </label>
        ))}
      </fieldset>
    </ResponsiveDialog>
  )
}
