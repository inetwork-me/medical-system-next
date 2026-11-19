"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { bi } from "@/lib/mock/bi"
import { csvBlob, saveBlob, xlsxBlob } from "@/lib/export/files"
import { pdfDocument } from "@/lib/export/pdf"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { RadioGroup } from "@/components/ui/radio-group"
import { doctorById, hhmm, type DoctorId } from "../data"
import { useAppointmentsOn } from "../store"

/**
 * Appointments › Export (same flow as Patients / Dashboard): format → the visible range (day, week or month,
 * ticked doctors) is built in the browser → file saved → DS success toast.
 */
export function ExportDialog({
  open,
  onOpenChange,
  days,
  doctors,
  rangeLabel,
  fileStem,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  days: string[]
  doctors: DoctorId[]
  rangeLabel: string
  fileStem: string
}) {
  const t = useTranslations("appointments")
  const tx = useTranslations("appointments.exportDialog")
  const tp = useTranslations("patients.exportDialog")
  const tc = useTranslations("common")
  const locale = useLocale()
  const dates = useDates()
  const [fmt, setFmt] = React.useState<"excel" | "pdf" | "csv">("excel")
  const [busy, setBusy] = React.useState(false)
  const on = useAppointmentsOn()
  const list = React.useMemo(() => days.flatMap((d) => on(d)).filter((a) => doctors.includes(a.doctor)), [days, doctors, on])

  const run = async () => {
    const head = [tx("col.date"), tx("col.time"), tx("col.minutes"), tx("col.patient"), tx("col.doctor"), tx("col.clinic"), tx("col.reason"), tx("col.type"), tx("col.status")]
    const rows = list.map((a) => {
      const d = doctorById(a.doctor)
      return [
        dates.short(a.date),
        `${hhmm(a.start)}–${hhmm(a.start + a.duration)}`,
        String(a.duration),
        a.patient ? bi(a.patient, locale) : t("calendar.bookedSlot"),
        bi(d.name, locale),
        bi(d.clinic, locale),
        a.reason ? bi(a.reason, locale) : "—",
        a.telehealth ? tx("video") : tx("inClinic"),
        t(`status.${a.status}`),
      ]
    })
    const name = `appointments-${fileStem}`
    setBusy(true)
    try {
      if (fmt === "excel") saveBlob(xlsxBlob(head, rows, { sheet: tx("pdfTitle"), rtl: locale === "ar" }), `${name}.xlsx`)
      else if (fmt === "csv") saveBlob(csvBlob(head, rows), `${name}.csv`)
      else {
        const blob = await pdfDocument(
          [
            { kind: "brand", title: tx("pdfBrand"), subtitle: rangeLabel },
            { kind: "title", text: tx("pdfTitle") },
            { kind: "meta", text: tx("description", { range: rangeLabel, count: list.length }) },
            { kind: "table", head, rows, weights: [1.1, 1.1, 0.6, 1.6, 1.6, 1.1, 1.3, 0.9, 1] },
          ],
          { dir: locale === "ar" ? "rtl" : "ltr", title: name }
        )
        saveBlob(blob, `${name}.pdf`)
      }
      onOpenChange(false)
      toast.success(tx("downloaded"), { description: tx("downloadedText", { count: list.length, format: { excel: "Excel", pdf: "PDF", csv: "CSV" }[fmt] }) })
    } catch {
      toast.error(tx("failed"), { description: tx("failedText"), retry: () => void run() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="export"
      title={tx("title")}
      description={tx("description", { range: rangeLabel, count: list.length })}
      width="sm:max-w-125"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={run} loading={busy} disabled={!list.length}>
          {!busy && <Icon name="export" size={20} />}
          {tx("confirm")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium">{tx("format")}</p>
        <RadioGroup value={fmt} onValueChange={(v) => setFmt(v as typeof fmt)} className="gap-2">
          <RadioOption value="excel" title={tp("excel")} description={tx("excelHint")} />
          <RadioOption value="pdf" title={tp("pdf")} description={tx("pdfHint")} />
          <RadioOption value="csv" title={tp("csv")} />
        </RadioGroup>
      </div>
    </ResponsiveDialog>
  )
}
