"use client"

import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import type { DateRange } from "react-day-picker"

import { bi } from "@/lib/mock/bi"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { DateRangePicker } from "@/components/ds/pickers"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup } from "@/components/ui/radio-group"
import { REGIONS, type Patient } from "../data"

type Col = "name" | "contact" | "lastVisit" | "tags"

/**
 * Overlay · Export (centred dialog; mobile bottom sheet): format (Excel / PDF / CSV), period, columns.
 * CSV is generated in the browser from the current (filtered) list; Excel / PDF are queued (server job later).
 */
export function ExportDialog({ open, onOpenChange, rows }: { open: boolean; onOpenChange: (o: boolean) => void; rows: Patient[] }) {
  const t = useTranslations("patients.exportDialog")
  const tTags = useTranslations("patients.tags")
  const tc = useTranslations("common.actions")
  const format = useFormatter()
  const locale = useLocale()
  const [fmt, setFmt] = React.useState<"excel" | "pdf" | "csv">("excel")
  const [period, setPeriod] = React.useState<DateRange | undefined>({ from: new Date(2026, 10, 1), to: new Date(2026, 10, 15) })
  const [cols, setCols] = React.useState<Record<Col, boolean>>({ name: true, contact: true, lastVisit: true, tags: false })

  const run = () => {
    onOpenChange(false)
    if (fmt !== "csv") {
      toast.info(t("started"), { description: t("startedText", { format: fmt === "excel" ? "Excel" : "PDF" }) })
      return
    }
    const head: string[] = []
    if (cols.name) head.push("Name", "MRN")
    if (cols.contact) head.push("Mobile", "Region")
    if (cols.lastVisit) head.push("Last visit")
    if (cols.tags) head.push("Tags")
    const lines = rows.map((p) => {
      const r: string[] = []
      if (cols.name) r.push(bi(p.name, locale), p.mrn)
      if (cols.contact) r.push(p.mobile ?? "", bi(REGIONS[p.region].short, locale))
      if (cols.lastVisit) r.push(p.lastVisit)
      if (cols.tags) r.push(p.tags.map((x) => tTags(x)).join(" | "))
      return r.map((c) => `"${c.replaceAll('"', '""')}"`).join(",")
    })
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(t("downloaded"), { description: t("downloadedText", { count: rows.length }) })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="export"
      title={t("title")}
      description={t("description", { count: format.number(rows.length, "integer") })}
      width="sm:max-w-125"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("cancel")}
        </Button>
      }
      primary={
        <Button onClick={run}>
          <Icon name="export" size={20} />
          {t("confirm")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium">{t("format")}</p>
        <RadioGroup value={fmt} onValueChange={(v) => setFmt(v as typeof fmt)} className="gap-2">
          <RadioOption value="excel" title={t("excel")} description={t("excelHint")} />
          <RadioOption value="pdf" title={t("pdf")} description={t("pdfHint")} />
          <RadioOption value="csv" title={t("csv")} />
        </RadioGroup>
      </div>
      <Field label={t("period")}>
        {(c) => <DateRangePicker {...c} value={period} onChange={setPeriod} placeholder="—" daysLabel={(n) => String(n)} />}
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-medium">{t("columns")}</legend>
        {(
          [
            ["name", t("colName")],
            ["contact", t("colContact")],
            ["lastVisit", t("colLastVisit")],
            ["tags", t("colTags")],
          ] as [Col, string][]
        ).map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={cols[k]} onCheckedChange={(v) => setCols((s) => ({ ...s, [k]: v === true }))} />
            {label}
          </label>
        ))}
      </fieldset>
    </ResponsiveDialog>
  )
}
