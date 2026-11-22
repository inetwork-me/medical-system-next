"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isModuleEnabled } from "@/lib/modules"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { patientHref } from "@/modules/patients/href"
import { BILL_TODAY, CENTER, type Invoice, type InvoiceStatus } from "./data"
import { invoiceCounts } from "./counts"
import { invoiceHref } from "./href"
import { formatMoney, useMoney } from "./money"
import { InitialsAvatar, InvoiceStatusBadge, Latin, ZatcaLine, useSoon } from "./parts"
import { billCan } from "./roles"
import { canCollect, invoiceStatus, totals, zatcaConfirmed } from "./rules"
import { useBillRole, useInvoices } from "./store"
import { useBillText } from "./text"

export type InvoiceFilter = "all" | InvoiceStatus
const FILTERS: InvoiceFilter[] = ["all", "unpaid", "part", "paid", "refunded"]
const FILTERS_COMPACT: InvoiceFilter[] = ["all", "unpaid", "part"]
const PAGE_WIDE = 8
const PAGE_COMPACT = 6

const byNewest = (a: Invoice, b: Invoice) => b.issuedAt.localeCompare(a.issuedAt) || b.no.localeCompare(a.no)

/** Download all: the month's list as a PDF (the rows loaded here), then the pdf-downloaded toast. */
function useListPdf() {
  const t = useTranslations("billing")
  const { b, ar, payerName, patient } = useBillText()
  const dates = useDates()
  const locale = ar ? "ar" : "en"
  const ts = useTranslations("billing.status.invoice")
  return async (rows: Invoice[]) => {
    const month = dates.monthLong(BILL_TODAY)
    const name = `Invoices-${BILL_TODAY.slice(0, 7)}.pdf`
    const blocks: PdfBlock[] = [
      { kind: "brand", title: b(CENTER.name), subtitle: t("invoice.seller", { vat: CENTER.vatNo, cr: CENTER.cr, city: b(CENTER.city) }) },
      { kind: "title", text: t("invoices.pdfTitle", { month }) },
      {
        kind: "table",
        head: [t("invoices.col.invoice"), t("invoices.col.patient"), t("invoices.col.payer"), t("invoices.col.total"), t("invoices.col.patientPays"), t("invoices.col.status")],
        rows: rows.map((x) => {
          const tt = totals(x)
          return [x.no, b(patient(x.patient).name), payerName(x), formatMoney(tt.total, locale), formatMoney(tt.patientShare, locale), ts(invoiceStatus(x))]
        }),
        weights: [1.2, 1.8, 1.2, 1, 1, 1],
        endAlign: [3, 4],
      },
    ]
    const run = async () => {
      try {
        saveBlob(await pdfDocument(blocks, { dir: ar ? "rtl" : "ltr", title: name }), name)
        toast.success(t("pdf.done"), { description: t("pdf.doneText") })
      } catch {
        toast.error(t("pdf.failed"), { description: t("pdf.failedText"), retry: () => void run() })
      }
    }
    await run()
  }
}

/**
 * Widget / Bill Invoices. Wide: header (title, "November · all reported to ZATCA", Download all), search + status
 * filter (All · Unpaid · Partly paid · Paid · Refunded), table Invoice · Patient · Payer · Total · Patient pays ·
 * Status (+ ZATCA reported) · action (Collect on unpaid / partly paid, else View), "Showing 8 of 214" + Show more.
 * Compact: 3 filters, a card list that opens the invoice, "Show 208 more".
 */
export function InvoicesList({ onCollect }: { onCollect: (no: string) => void }) {
  const t = useTranslations("billing.invoices")
  const { patient } = useBillText()
  const dates = useDates()
  const soon = useSoon()
  const pdf = useListPdf()
  const invoices = useInvoices()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<InvoiceFilter>("all")
  const c = invoiceCounts(invoices)
  const q = query.trim().toLowerCase()
  const matches = (x: Invoice) => {
    if (!q) return true
    const p = patient(x.patient)
    return [x.no, p.mrn, p.name.en].some((v) => v.toLowerCase().includes(q)) || p.name.ar.includes(query.trim())
  }
  const rows = invoices.filter((x) => matches(x) && (filter === "all" || invoiceStatus(x) === filter)).sort(byNewest)
  // Without a search the totals include the rest of the month; a search only looks through the loaded invoices.
  const total = q ? rows.length : c[filter]
  const pending = invoices.filter((x) => !zatcaConfirmed(x)).length
  const month = dates.monthLong(BILL_TODAY).replace(/\s*\d{4}$/, "")
  const label = (f: InvoiceFilter) => t(`filter.${f}`, { n: c[f] })

  return (
    <section aria-labelledby="bill-invoices" className="@container/inv flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/inv:p-5">
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="bill-invoices" className="text-lg font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">{pending ? t("subtitlePending", { month, n: pending }) : t("subtitle", { month })}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void pdf(rows)}>
          <Icon name="document-download" size={24} />
          {t("downloadAll")}
        </Button>
      </header>

      <div className="flex flex-col gap-2 @4xl/inv:flex-row @4xl/inv:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/inv:w-75"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/inv:ms-auto @4xl/inv:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: label(f) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "all"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/inv:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: label(f) }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="receipt-2"
          title={t("empty")}
          description={t("emptyText")}
          className="py-12"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setFilter("all")
              }}
            >
              {t("clear")}
            </Button>
          }
        />
      ) : (
        <>
          <InvoicesTable rows={rows.slice(0, PAGE_WIDE)} onCollect={onCollect} />
          <InvoiceCards rows={rows.slice(0, PAGE_COMPACT)} />
          <footer className="hidden items-center gap-3 @4xl/inv:flex">
            <span className="flex-1 text-xs text-muted-foreground">{t("showing", { shown: Math.min(PAGE_WIDE, rows.length), total })}</span>
            {total > PAGE_WIDE && (
              <Button variant="outline" size="sm" onClick={soon}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {total > PAGE_COMPACT && (
            <Button variant="outline" size="sm" className="w-full @4xl/inv:hidden" onClick={soon}>
              {t("showMoreN", { n: total - Math.min(PAGE_COMPACT, rows.length) })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ wide: table */

function PatientCell({ inv }: { inv: Invoice }) {
  const { b, patient } = useBillText()
  const p = patient(inv.patient)
  const linked = p.patientId && isModuleEnabled("patients")
  const name = <span className="truncate text-sm text-foreground">{b(p.name)}</span>
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <InitialsAvatar initials={p.initials} />
      <div className="flex min-w-0 flex-col">
        {linked ? (
          <Link href={patientHref(p.patientId!)} className="truncate rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {name}
          </Link>
        ) : (
          name
        )}
        <Latin className="truncate text-xs text-muted-foreground">{p.mrn}</Latin>
      </div>
    </div>
  )
}

function RowAction({ inv, onCollect, size = "sm" }: { inv: Invoice; onCollect: (no: string) => void; size?: "sm" }) {
  const t = useTranslations("billing.invoices")
  const role = useBillRole()
  if (canCollect(inv) && billCan(role, "collect"))
    return (
      <Button size={size} onClick={() => onCollect(inv.no)}>
        {t("collect")}
      </Button>
    )
  return (
    <Button size={size} variant="outline" asChild>
      <Link href={invoiceHref(inv.no)}>{t("view")}</Link>
    </Button>
  )
}

function InvoicesTable({ rows, onCollect }: { rows: Invoice[]; onCollect: (no: string) => void }) {
  const t = useTranslations("billing.invoices")
  const { payerName } = useBillText()
  const money = useMoney()
  const dates = useDates()
  const th = "h-10 px-1.5 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/inv:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[160px]" />
          <col />
          <col className="w-[162px]" />
          <col className="w-[116px]" />
          <col className="w-[116px]" />
          <col className="w-[152px]" />
          <col className="w-[112px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.invoice")}</th>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.payer")}</th>
            <th className={th}>{t("col.total")}</th>
            <th className={th}>{t("col.patientPays")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => {
            const tt = totals(x)
            return (
              <tr key={x.no} className="border-t">
                <td className={td}>
                  <Link
                    href={invoiceHref(x.no)}
                    className="flex flex-col gap-0.5 rounded-sm text-xs outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Latin className="text-foreground">{x.no}</Latin>
                    <span className="text-muted-foreground">{dates.dayMonth(x.issuedAt)}</span>
                  </Link>
                </td>
                <td className={td}>
                  <PatientCell inv={x} />
                </td>
                <td className={cn(td, "truncate text-muted-foreground")}>{payerName(x)}</td>
                <td className={cn(td, "whitespace-nowrap tabular-nums")}>{money(tt.total)}</td>
                <td className={cn(td, "whitespace-nowrap tabular-nums")}>{money(tt.patientShare)}</td>
                <td className={td}>
                  <div className="flex flex-col items-start gap-[3px]">
                    <InvoiceStatusBadge status={invoiceStatus(x)} />
                    <ZatcaLine status={x.zatca.status} />
                  </div>
                </td>
                <td className={cn(td, "text-end")}>
                  <RowAction inv={x} onCollect={onCollect} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ compact: cards */

function InvoiceCards({ rows }: { rows: Invoice[] }) {
  const t = useTranslations("billing.invoices")
  const { b, patient, payerName } = useBillText()
  const money = useMoney()
  return (
    <ul className="flex flex-col @4xl/inv:hidden">
      {rows.map((x) => {
        const p = patient(x.patient)
        return (
          <li key={x.no} className="border-b last:border-b-0">
            <Link
              href={invoiceHref(x.no)}
              aria-label={t("open", { no: x.no })}
              className="flex items-center gap-2.5 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <InitialsAvatar initials={p.initials} className="self-start" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm text-foreground">{b(p.name)}</span>
                <span className="truncate text-xs text-muted-foreground">{t("sub", { no: `⁦${x.no}⁩`, payer: payerName(x) })}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <InvoiceStatusBadge status={invoiceStatus(x)} />
                  <span className="text-xs text-muted-foreground tabular-nums">{t("patientPays", { amount: money(totals(x).patientShare) })}</span>
                </span>
              </div>
              <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center text-foreground">
                <Icon name="arrow-right-1" size={24} />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
