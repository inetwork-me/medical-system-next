"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import type { Bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { RadioOption } from "@/components/ds/radio-option"
import { notify } from "@/components/ds/toast"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import type { Patient } from "../data"
import type { Invoice, PatientRecord } from "../profile/record"
import { useText } from "../profile/use-patient"
import { usePatientsStore, type Collection } from "../store"

/** Print only the element marked data-print-area (see globals.css). */
export function printArea() {
  const html = document.documentElement
  html.setAttribute("data-printing", "")
  const done = () => {
    html.removeAttribute("data-printing")
    window.removeEventListener("afterprint", done)
  }
  window.addEventListener("afterprint", done)
  window.print()
}

/** "Download PDF" for receipt / statement: builds the PDF in the browser, saves it, confirms with a DS toast. */
function usePdfDownload() {
  const t = useTranslations("patients.pay.pdf")
  const rtl = useLocale() === "ar"
  const [busy, setBusy] = React.useState(false)
  const run = async (name: string, blocks: PdfBlock[]) => {
    setBusy(true)
    try {
      saveBlob(await pdfDocument(blocks, { dir: rtl ? "rtl" : "ltr", title: name }), name)
      notify.success(t("ready"), { description: t("readyText", { name }) })
    } catch {
      notify.error(t("failed"), { description: t("failedText") })
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

function useSar() {
  const t = useTranslations("patients.pay")
  const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (v: number, decimals = true) => t("sar", { amount: decimals ? fmt.format(v) : new Intl.NumberFormat("en-US").format(v) })
}

/** Label / value box (muted rows, design `kv`). */
function KV({ rows, className }: { rows: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("overflow-hidden rounded-lg bg-muted", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3 border-b border-border px-3 py-2.5 text-xs last:border-0">
          <dt className="flex-1 text-muted-foreground">{k}</dt>
          <dd className="font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ================================================================== collect → received */

const METHODS = ["mada", "cash", "card"] as const
const METHOD_LABEL: Record<Collection["method"], Bi> = { mada: { en: "Mada", ar: "مدى" }, cash: { en: "Cash", ar: "كاش" }, card: { en: "Card", ar: "بطاقة" } }

/**
 * Overlay · Collect payment (invoice totals, amount, method, SMS) → Overlay · Payment received
 * (receipt, method, amount, balance; Print receipt · Done). Writes the payment to the session store.
 */
export function CollectFlow({
  patient,
  invoice,
  due,
  open,
  onOpenChange,
}: {
  patient: Patient
  invoice: Invoice
  due: number
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const t = useTranslations("patients.pay")
  const dates = useDates()
  const { b } = useText()
  const sar = useSar()
  const { collect } = usePatientsStore()
  const [amount, setAmount] = React.useState(due.toFixed(2))
  const [method, setMethod] = React.useState<Collection["method"]>("mada")
  const [sms, setSms] = React.useState(!!patient.mobile)
  const [tried, setTried] = React.useState(false)
  const [done, setDone] = React.useState<Collection | null>(null)
  const [printOpen, setPrintOpen] = React.useState(false)

  const value = Number(amount.replace(/,/g, ""))
  const error = !amount.trim() || !value ? t("collect.errorEmpty") : value > due + 0.001 ? t("collect.errorMore", { due }) : null

  const reset = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      setAmount(due.toFixed(2))
      setTried(false)
    }
  }
  const confirm = () => {
    setTried(true)
    if (error) return
    const c = collect(patient.id, { invoice: invoice.no, amount: Math.round(value * 100) / 100, method })
    reset(false)
    setDone(c)
  }

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={reset}
        icon="wallet-money"
        width="sm:max-w-125"
        title={t("collect.title")}
        description={t("collect.text", { invoice: invoice.no, date: dates.dayMonth(invoice.date) })}
        secondary={
          <Button variant="outline" onClick={() => reset(false)}>
            <CancelLabel />
          </Button>
        }
        primary={
          <Button onClick={confirm}>
            <Icon name="tick-circle" size={20} />
            {t("collect.confirm", { amount: Number.isFinite(value) && value > 0 ? new Intl.NumberFormat("en-US").format(value) : "0" })}
          </Button>
        }
      >
        <KV
          rows={[
            [t("collect.total"), sar(invoice.total, false)],
            [t("collect.covered"), sar(invoice.insurance, false)],
            [t("collect.due"), sar(due, false)],
          ]}
        />
        <Field label={t("collect.amount")} required error={tried && error ? error : undefined}>
          <Input
            dir="ltr"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            onBlur={() => setTried(true)}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium">{t("collect.method")}</p>
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as Collection["method"])} className="gap-2" aria-label={t("collect.method")}>
            {METHODS.map((m) => (
              <RadioOption key={m} value={m} title={t(`collect.${m}`)} description={m === "mada" ? t("collect.madaHint") : undefined} />
            ))}
          </RadioGroup>
        </div>
        {patient.mobile && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={sms} onCheckedChange={(v) => setSms(v === true)} />
            {t("collect.sms")}
          </label>
        )}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={!!done}
        onOpenChange={(o) => !o && setDone(null)}
        icon="tick-circle"
        tone="success"
        width="sm:max-w-110"
        title={t("received.title")}
        description={sms && patient.mobile ? t("received.text", { phone: patient.mobile }) : t("received.textNoSms")}
        secondary={
          <Button variant="outline" onClick={() => setPrintOpen(true)}>
            <Icon name="printer" size={20} />
            {t("received.print")}
          </Button>
        }
        primary={<Button onClick={() => setDone(null)}>{t("received.done")}</Button>}
      >
        {done && (
          <KV
            rows={[
              [
                t("received.receipt"),
                <bdi key="r" dir="ltr">
                  {done.receipt}
                </bdi>,
              ],
              [t("received.method"), b(METHOD_LABEL[done.method])],
              [t("received.amount"), sar(done.amount)],
              [t("received.balance"), sar(Math.max(0, due - done.amount), false)],
            ]}
          />
        )}
      </ResponsiveDialog>

      {done && (
        <ReceiptDialog
          open={printOpen}
          onOpenChange={setPrintOpen}
          data={{
            no: done.receipt,
            date: done.at.slice(0, 10),
            status: "paid",
            method: METHOD_LABEL[done.method],
            patient,
            service: invoice.service,
            doctor: null,
            subtotal: invoice.total,
            insurance: invoice.insurance,
            paid: done.amount,
            due: Math.max(0, due - done.amount),
          }}
        />
      )}
    </>
  )
}

function CancelLabel() {
  const t = useTranslations("common.actions")
  return <>{t("cancel")}</>
}

/* ================================================================== receipt */

export type ReceiptData = {
  no: string
  date: string
  status: "paid" | "pending" | "refunded" | "partial" | "void"
  method: Bi | null
  patient: Patient
  service: Bi
  doctor: Bi | null
  subtotal: number
  insurance: number
  paid: number
  due: number
}

/** Overlay · Receipt: clinic header, patient / service / doctor, subtotal, VAT, paid; Download PDF · Print. */
export function ReceiptDialog({ data: r, open, onOpenChange }: { data: ReceiptData; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("patients.pay")
  const dates = useDates()
  const { b } = useText()
  const sar = useSar()
  const pdf = usePdfDownload()
  const text = t("receipt.text", {
    status: r.status === "paid" ? t("receipt.paidOn") : t("receipt.issuedOn"),
    date: dates.short(r.date),
    method: r.method ? b(r.method) : "—",
  })
  const rows: [string, React.ReactNode][] = [
    [
      t("receipt.patient"),
      <span key="p">
        {b(r.patient.name)} · <bdi dir="ltr">{r.patient.mrn}</bdi>
      </span>,
    ],
    [t("receipt.service"), b(r.service)],
    ...(r.doctor ? ([[t("receipt.doctor"), b(r.doctor)]] as [string, React.ReactNode][]) : []),
    [t("receipt.subtotal"), sar(r.subtotal)],
    ...(r.insurance ? ([[t("receipt.insurance"), `−${sar(r.insurance)}`]] as [string, React.ReactNode][]) : []),
    [t("receipt.vatLine"), sar(0)],
    [t("receipt.paid"), sar(r.paid)],
    ...(r.due > 0 ? ([[t("receipt.due"), sar(r.due)]] as [string, React.ReactNode][]) : []),
  ]
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="receipt-2"
      width="sm:max-w-140"
      title={t("receipt.title", { no: r.no })}
      description={text}
      secondary={
        <Button
          variant="outline"
          loading={pdf.busy}
          onClick={() =>
            pdf.run(`receipt-${r.no}.pdf`, [
              { kind: "brand", title: t("receipt.clinic"), subtitle: t("receipt.vat") },
              { kind: "title", text: t("receipt.title", { no: r.no }) },
              { kind: "meta", text },
              { kind: "kv", rows: rows.map(([k, v], i) => [k, i === 0 ? `${b(r.patient.name)} · ${r.patient.mrn}` : String(v)]) },
              { kind: "note", text: t("receipt.thanks") },
            ])
          }
        >
          {!pdf.busy && <Icon name="document-download" size={20} />}
          {t("receipt.pdf")}
        </Button>
      }
      primary={
        <Button onClick={printArea}>
          <Icon name="printer" size={20} />
          {t("receipt.print")}
        </Button>
      }
    >
      <div data-print-area className="flex flex-col gap-3 rounded-lg border bg-background p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Icon name="hospital" size={18} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{t("receipt.clinic")}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{t("receipt.vat")}</span>
          </div>
        </div>
        <KV rows={rows} className="bg-card" />
        <p className="text-center text-xs text-muted-foreground">{t("receipt.thanks")}</p>
      </div>
    </ResponsiveDialog>
  )
}

/* ================================================================== statement */

/** Overlay · Account statement (print preview): A4 page with billed items, insurance, paid and the balance. */
export function StatementDialog({
  patient,
  record,
  open,
  onOpenChange,
}: {
  patient: Patient
  record: PatientRecord
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const t = useTranslations("patients.pay")
  const dates = useDates()
  const { b } = useText()
  const n = (v: number) => new Intl.NumberFormat("en-US").format(v)
  const pdf = usePdfDownload()
  const billed = record.invoices.filter((i) => i.status !== "void").sort((a, z) => a.date.localeCompare(z.date))
  const lines: { date: string; item: string; amount: number }[] = [
    ...billed.map((i) => ({ date: dates.short(i.date), item: b(i.service), amount: i.total })),
    ...record.billing.coverage.map((c) => ({ date: "", item: b(c.label), amount: c.amount })),
  ]
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="printer"
      width="sm:max-w-180"
      title={t("statement.title")}
      description={t("statement.text")}
      secondary={
        <Button
          variant="outline"
          loading={pdf.busy}
          onClick={() =>
            pdf.run(`statement-${patient.mrn}.pdf`, [
              { kind: "brand", title: t("receipt.clinic"), subtitle: t("receipt.vat") },
              { kind: "title", text: t("statement.heading") },
              {
                kind: "meta",
                text: t("statement.meta", { name: b(patient.name), mrn: patient.mrn, from: dates.short(record.billing.since), to: dates.short(new Date()) }),
              },
              {
                kind: "table",
                head: [t("statement.date"), t("statement.item"), t("statement.amount")],
                weights: [1.2, 3, 1.2],
                endAlign: [2],
                rows: [
                  ...lines.map((l) => [l.date, l.item, l.amount < 0 ? `−${n(-l.amount)}` : n(l.amount)]),
                  ["", t("statement.balance"), n(record.billing.balance)],
                ],
              },
            ])
          }
        >
          {!pdf.busy && <Icon name="document-download" size={20} />}
          {t("statement.pdf")}
        </Button>
      }
      primary={
        <Button onClick={printArea}>
          <Icon name="printer" size={20} />
          {t("statement.print")}
        </Button>
      }
    >
      <div className="flex justify-center rounded-lg bg-muted p-3 md:p-5">
        <div data-print-area className="flex w-full max-w-149 flex-col gap-3.5 bg-card p-5 shadow-md md:p-7">
          <h3 className="text-xl font-semibold">{t("statement.heading")}</h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("statement.meta", { name: b(patient.name), mrn: patient.mrn, from: dates.short(record.billing.since), to: dates.short(new Date()) })}
          </p>
          <table className="w-full overflow-hidden rounded-md border text-xs">
            <thead className="bg-muted">
              <tr className="text-start">
                <th className="px-2.5 py-2 text-start font-medium md:w-30">{t("statement.date")}</th>
                <th className="px-2.5 py-2 text-start font-medium">{t("statement.item")}</th>
                <th className="px-2.5 py-2 text-end font-medium">{t("statement.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2.5 py-2 tabular-nums">{l.date}</td>
                  <td className="px-2.5 py-2">{l.item}</td>
                  <td className="px-2.5 py-2 text-end tabular-nums">
                    <bdi dir="ltr">{l.amount < 0 ? `−${n(-l.amount)}` : n(l.amount)}</bdi>
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted font-medium">
                <td className="px-2.5 py-2" />
                <td className="px-2.5 py-2">{t("statement.balance")}</td>
                <td className="px-2.5 py-2 text-end tabular-nums">{n(record.billing.balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
