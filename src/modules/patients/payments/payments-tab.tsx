"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"

import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { FilterChip } from "@/components/ds/module-controls"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Link } from "@/i18n/navigation"
import { useText } from "../profile/use-patient"
import { Kpis, ReportTable } from "../reports/parts"
import { METHOD, transactions, type Tx, type TxStatus } from "./data"
import { ReceiptDialog } from "./overlays"

/**
 * Patients · Payments tab (1440 / 768 / 390): KPI row + Widget / Transactions — search (receipt or patient),
 * status chips (All / Paid / Pending / Refunded / Insurance), period; table with receipts (pagination) on wide
 * cards, list with Load more below. The receipt icon opens Overlay · Receipt.
 */
export function PaymentsKpis() {
  const t = useTranslations("patients.pay.kpi")
  const sar = useSarInt()
  return (
    <Kpis
      items={[
        { icon: "wallet-money", label: t("collected"), value: sar(482350), delta: t("collectedDelta"), caption: t("collectedCap") },
        { icon: "clock", tile: "warning", label: t("outstanding"), value: sar(36900), delta: "264", tone: "warning", caption: t("outstandingCap") },
        { icon: "refresh", tile: "info", label: t("refunds"), value: sar(4120), delta: "38", tone: "neutral", caption: t("refundsCap") },
        { icon: "shield-tick", label: t("claims"), value: "1,108", delta: t("claimsDelta"), tone: "info", caption: t("claimsCap") },
      ]}
    />
  )
}

function useSarInt() {
  const t = useTranslations("patients.pay")
  return (v: number) => t("sar", { amount: new Intl.NumberFormat("en-US").format(v) })
}
function useSar2() {
  const t = useTranslations("patients.pay")
  const f = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (v: number) => t("sar", { amount: f.format(v) })
}

const TONE: Record<TxStatus, StatusTone> = { paid: "success", pending: "warning", refunded: "neutral", partial: "info" }
type Chip = "all" | "paid" | "pending" | "refunded" | "insurance"
type Period = "month" | "week" | "today"

export function TransactionsCard() {
  const t = useTranslations("patients.pay")
  const format = useFormatter()
  const dates = useDates()
  const { b } = useText()
  const sar = useSar2()
  const [q, setQ] = React.useState("")
  const [chip, setChip] = React.useState<Chip>("all")
  const [period, setPeriod] = React.useState<Period>("month")
  const [receipt, setReceipt] = React.useState<Tx | null>(null)
  const all = transactions()
  const base = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    return all.filter(
      (x) =>
        (period === "month" || (period === "week" ? x.day >= 9 : x.day === 15)) &&
        (!s || x.no.toLowerCase().includes(s) || x.patient.name.en.toLowerCase().includes(s) || x.patient.name.ar.includes(q.trim()) || x.patient.mrn.includes(s))
    )
  }, [all, q, period])
  const match = (x: Tx, c: Chip) => c === "all" || (c === "insurance" ? x.method === "insurance" : x.status === c)
  const rows = React.useMemo(() => base.filter((x) => match(x, chip)), [base, chip])
  const when = (x: Tx) => `${dates.dayMonth(`2026-11-${String(x.day).padStart(2, "0")}`)} · ${x.time}`
  const chips: Chip[] = ["all", "paid", "pending", "refunded", "insurance"]
  const receiptBtn = (x: Tx) => (
    <Button variant="ghost" size="icon-sm" aria-label={t("viewReceipt", { no: x.no })} onClick={() => setReceipt(x)}>
      <Icon name="receipt-2" size={20} />
    </Button>
  )

  return (
    <section className="@container/rpt flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="md:w-70"
        />
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <FilterChip key={c} selected={chip === c} count={format.number(base.filter((x) => match(x, c)).length, "integer")} onClick={() => setChip(c)}>
              {t(`chips.${c}`)}
            </FilterChip>
          ))}
        </div>
        <span className="hidden flex-1 md:block" />
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="hidden w-38 md:flex" aria-label={t("periodLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {(["month", "week", "today"] as const).map((p) => (
              <SelectItem key={p} value={p}>
                {t(`period.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ReportTable
        rows={rows}
        pageSize={8}
        rowKey={(x) => x.no}
        columns={[
          { key: "date", head: t("col.date"), width: "7.5rem", cell: (x) => <span className="tabular-nums">{when(x)}</span> },
          {
            key: "no",
            head: t("col.receipt"),
            width: "6.5rem",
            cell: (x) => (
              <button type="button" onClick={() => setReceipt(x)} className="cursor-pointer font-medium text-primary tabular-nums hover:underline">
                {x.no}
              </button>
            ),
          },
          {
            key: "patient",
            head: t("col.patient"),
            width: "minmax(0,1fr)",
            cell: (x) => (
              <Link href={`/patients/${x.patient.id}`} className="truncate font-medium hover:underline">
                {b(x.patient.name)}
              </Link>
            ),
          },
          { key: "service", head: t("col.service"), width: "minmax(0,1.1fr)", cell: (x) => <span className="truncate">{b(x.service)}</span> },
          { key: "method", head: t("col.method"), width: "6rem", cell: (x) => b(METHOD[x.method]) },
          { key: "amount", head: t("col.amount"), width: "7rem", cell: (x) => <span className="font-medium tabular-nums">{sar(x.amount)}</span> },
          { key: "status", head: t("col.status"), width: "6.5rem", cell: (x) => <StatusBadge tone={TONE[x.status]}>{t(`status.${x.status}`)}</StatusBadge> },
          { key: "act", head: <span className="sr-only">{t("col.receipt")}</span>, width: "2.25rem", cell: receiptBtn },
        ]}
        item={(x) => (
          <button type="button" onClick={() => setReceipt(x)} className="flex w-full cursor-pointer items-start gap-3 text-start">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">{b(x.patient.name)}</span>
              <span className="text-xs text-muted-foreground">
                {b(x.service)} · {b(METHOD[x.method])}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                <bdi dir="ltr">{x.no}</bdi> · {when(x)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-medium tabular-nums">{sar(x.amount)}</span>
              <StatusBadge tone={TONE[x.status]}>{t(`status.${x.status}`)}</StatusBadge>
            </div>
          </button>
        )}
      />
      {receipt && (
        <ReceiptDialog
          open
          onOpenChange={(o) => !o && setReceipt(null)}
          data={{
            no: receipt.no,
            date: `2026-11-${String(receipt.day).padStart(2, "0")}`,
            status: receipt.status,
            method: METHOD[receipt.method],
            patient: receipt.patient,
            service: receipt.service,
            doctor: receipt.doctor,
            subtotal: receipt.amount,
            insurance: 0,
            paid: receipt.status === "paid" ? receipt.amount : receipt.status === "partial" ? Math.round(receipt.amount / 2) : 0,
            due: receipt.status === "pending" ? receipt.amount : receipt.status === "partial" ? receipt.amount - Math.round(receipt.amount / 2) : 0,
          }}
        />
      )}
    </section>
  )
}
