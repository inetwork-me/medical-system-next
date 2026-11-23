"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { csvBlob, saveBlob, xlsxBlob } from "@/lib/export/files"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BILL_TODAY, CENTER, insurerOf, type Claim, type Contract, type Invoice } from "./data"
import { inClaimFilter, type ClaimFilter } from "./claims"
import { inContractFilter, visibleContracts, type ContractFilter } from "./contracts"
import { claimCounts, contractCounts, invoiceCounts } from "./counts"
import { useListView } from "./list-view"
import { formatMoney } from "./money"
import { billCan } from "./roles"
import { contractStatus, daysLeft, invoiceStatus, totals } from "./rules"
import { currentUser } from "./session"
import { logExport, useAllContracts, useAllInvoices, useBatchSent, useBillRole, useClaims, useContracts, useInvoices } from "./store"
import { useBillText } from "./text"

export type ExportWhat = "summary" | "invoices" | "claims" | "contracts"
type Period = "thisMonth" | "last7" | "lastMonth" | "thisYear"
type Format = "excel" | "csv" | "pdf"

/** The period's first and last day (the demo's today is BILL_TODAY). */
function range(p: Period): [string, string] {
  const d = new Date(`${BILL_TODAY}T12:00`)
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
  if (p === "last7") return [iso(new Date(d.getTime() - 6 * 864e5)), BILL_TODAY]
  if (p === "lastMonth") return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1, 12)), iso(new Date(d.getFullYear(), d.getMonth(), 0, 12))]
  if (p === "thisYear") return [`${d.getFullYear()}-01-01`, BILL_TODAY]
  return [`${BILL_TODAY.slice(0, 8)}01`, BILL_TODAY]
}
const within = (iso: string, [a, z]: [string, string]) => iso.slice(0, 10) >= a && iso.slice(0, 10) <= z

/**
 * Overlay · Export (Export on Overview, Invoices, Claims, Contracts): What (defaults to the current tab), Period,
 * Format (Excel / CSV / PDF), "Only what the filter shows (Unpaid)", "VAT on its own column", "Patient names" (off by
 * default — PDPL), the logging note. Download builds the file in the browser, logs the export (who, what, when) and
 * confirms with `export-ready`. Respects the role's access: each "What" is only offered when its tab is.
 */
export function ExportDialog({ initial, onOpenChange }: { initial: ExportWhat; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("billing.export")
  const ts = useTranslations("billing.status")
  const tk = useTranslations("billing.kind")
  const { b, ar, locale, date, patient, payerName, insurerShort } = useBillText()
  const role = useBillRole()
  const invoicesAll = useAllInvoices()
  const invoices = useInvoices()
  const claims = useClaims()
  const contractsAll = visibleContracts(useAllContracts(), role)
  const contracts = visibleContracts(useContracts(), role)
  const batchSent = useBatchSent()
  const views = { invoices: useListView("invoices"), claims: useListView("claims"), contracts: useListView("contracts") }
  const allowed: ExportWhat[] = (["summary", "invoices", "claims", "contracts"] as ExportWhat[]).filter((w) =>
    w === "claims" ? billCan(role, "claims") || billCan(role, "viewMoney") : w === "contracts" ? billCan(role, "allContracts") || billCan(role, "viewMoney") : billCan(role, "viewMoney")
  )
  const [what, setWhat] = React.useState<ExportWhat>(allowed.includes(initial) ? initial : (allowed[0] ?? "invoices"))
  const [period, setPeriod] = React.useState<Period>("thisMonth")
  const [format, setFormat] = React.useState<Format>("excel")
  const [onlyFilter, setOnlyFilter] = React.useState(true)
  const [vat, setVat] = React.useState(true)
  const [names, setNames] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const ids = { only: React.useId(), vat: React.useId(), names: React.useId() }
  const view = what === "summary" ? undefined : views[what]
  const filter = view?.filter ?? "all"
  const hasPatients = what === "invoices" || what === "claims"
  const money = (n: number) => formatMoney(n, locale)
  const [from, to] = range(period)
  const dm = (iso: string) => date(iso).replace(/\s\d{4}$/, "")
  const periodLabel = (p: Period) => {
    const [a, z] = range(p)
    return t(`period.${p}`, { from: dm(a).replace(/\s\S+$/, ""), to: dm(z), month: date(a).replace(/^\d+\s/, "").replace(/\s\d{4}$/, ""), year: a.slice(0, 4) })
  }

  /** The table to export: header + rows, as the screen words them. */
  function table(): { head: string[]; rows: string[][] } {
    const nameCol = names ? [t("col.patient")] : []
    if (what === "invoices") {
      const rows = invoicesAll.filter((x) => within(x.issuedAt, [from, to]) && (!onlyFilter || filter === "all" || invoiceStatus(x) === filter))
      return {
        head: [t("col.invoice"), t("col.date"), t("col.mrn"), ...nameCol, t("col.payer"), ...(vat ? [t("col.subtotal"), t("col.vat")] : []), t("col.total"), t("col.patientPays"), t("col.paid"), t("col.balance"), t("col.status")],
        rows: rows.map((x: Invoice) => {
          const tt = totals(x)
          const p = patient(x.patient)
          return [x.no, x.issuedAt.slice(0, 10), p.mrn, ...(names ? [b(p.name)] : []), payerName(x), ...(vat ? [money(tt.subtotal), money(tt.vat)] : []), money(tt.total), money(tt.patientShare), money(tt.paid), money(tt.balance), ts(`invoice.${invoiceStatus(x)}`)]
        }),
      }
    }
    if (what === "claims") {
      const rows = claims.filter((x) => within(x.createdAt, [from, to]) && (!onlyFilter || inClaimFilter(x, filter as ClaimFilter)))
      return {
        head: [t("col.claim"), t("col.date"), t("col.invoice"), t("col.mrn"), ...nameCol, t("col.insurer"), t("col.amount"), t("col.status")],
        rows: rows.map((x: Claim) => {
          const p = patient(x.patient)
          return [x.no, x.createdAt.slice(0, 10), x.invoiceNo, p.mrn, ...(names ? [b(p.name)] : []), insurerOf(x.insurer) ? insurerShort(x.insurer) : x.insurer, money(x.amount), ts(`claim.${x.status}`)]
        }),
      }
    }
    if (what === "contracts") {
      const rows = contractsAll.filter((x) => (!onlyFilter || inContractFilter(x, filter as ContractFilter)) && x.start <= to && x.end >= from)
      return {
        head: [t("col.contract"), t("col.type"), t("col.party"), t("col.start"), t("col.end"), t("col.status")],
        rows: rows.map((x: Contract) => [x.no, tk(x.kind), b(x.party.name), x.start, x.end, ts(`contract.${contractStatus(x)}`, { n: daysLeft(x.end) })]),
      }
    }
    // Summary (Overview): the KPIs behind the page.
    const ic = invoiceCounts(invoices)
    const cc = claimCounts(claims, batchSent)
    const kc = contractCounts(contracts)
    return {
      head: [t("col.measure"), t("col.value")],
      rows: [
        [t("summary.invoices"), String(ic.all)],
        [t("summary.unpaid"), `${ic.unpaid} · ${money(ic.unpaidBalance)}`],
        [t("summary.claimsReview"), `${cc.review} · ${money(cc.reviewAmount)}`],
        [t("summary.claimsPaid"), money(cc.paidAmount)],
        [t("summary.contracts"), String(kc.all)],
        [t("summary.toSign"), String(kc.toSign)],
      ],
    }
  }

  const download = async () => {
    setBusy(true)
    const { head, rows } = table()
    const name = `billing-${what}-${from.slice(0, 7)}.${format === "excel" ? "xlsx" : format}`
    try {
      if (format === "csv") saveBlob(csvBlob(head, rows), name)
      else if (format === "excel") saveBlob(xlsxBlob(head, rows, { sheet: t(`what.${what}`), rtl: ar }), name)
      else {
        const blocks: PdfBlock[] = [
          { kind: "brand", title: b(CENTER.name), subtitle: `${t(`what.${what}`)} · ${periodLabel(period)}` },
          { kind: "table", head, rows },
          { kind: "note", text: t("pdfNote", { n: rows.length }) },
        ]
        saveBlob(await pdfDocument(blocks, { dir: ar ? "rtl" : "ltr", title: name }), name)
      }
      // Every export is logged: who, what, when, the period, the format and whether names went out (PDPL).
      logExport({ at: new Date().toISOString(), by: currentUser()?.key ?? "session", what, period, format, rows: rows.length, names: hasPatients && names, filter: onlyFilter ? filter : "all" })
      onOpenChange(false)
      toast.success(t("readyToast"), { description: <bdi>{t("readyToastText", { file: name })}</bdi> })
    } catch {
      toast.error(t("failed"), { description: t("failedText"), retry: () => void download() })
    } finally {
      setBusy(false)
    }
  }

  const filterName = what === "summary" ? "" : t(`filterName.${what}.${filter}` as never)
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="export"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void download()} disabled={busy}>
          {t("download")}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <Field label={t("whatLabel")} required>
          {(fp) => (
            <Select value={what} onValueChange={(v) => setWhat(v as ExportWhat)}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowed.map((w) => (
                  <SelectItem key={w} value={w}>
                    {t(`what.${w}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("periodLabel")} required>
          {(fp) => (
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["thisMonth", "last7", "lastMonth", "thisYear"] as Period[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {periodLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("formatLabel")} required>
        {(fp) => (
          <Segmented
            {...fp}
            value={format}
            onValueChange={setFormat}
            aria-label={t("formatLabel")}
            className="w-full *:flex-1"
            options={[
              { value: "excel", label: "Excel" },
              { value: "csv", label: "CSV" },
              { value: "pdf", label: "PDF" },
            ]}
          />
        )}
      </Field>
      <div className="flex flex-col gap-3">
        {what !== "summary" && (
          <label htmlFor={ids.only} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox id={ids.only} checked={onlyFilter} onCheckedChange={(v) => setOnlyFilter(v === true)} />
            {t("onlyFilter", { filter: filterName })}
          </label>
        )}
        {what === "invoices" && (
          <label htmlFor={ids.vat} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox id={ids.vat} checked={vat} onCheckedChange={(v) => setVat(v === true)} />
            {t("vatColumn")}
          </label>
        )}
        {hasPatients && (
          <label htmlFor={ids.names} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox id={ids.names} checked={names} onCheckedChange={(v) => setNames(v === true)} />
            {t("names")}
          </label>
        )}
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
        <Icon name="info-circle" size={18} className="shrink-0" />
        <span>{hasPatients ? t("note") : t("noteLogged")}</span>
      </p>
    </ResponsiveDialog>
  )
}
