"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isTabEnabled } from "@/lib/modules"
import { SESSION_USER } from "@/lib/mock/shell"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { QrCode } from "@/components/ds/qr-code"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  BILL_NOW,
  CENTER,
  CREDIT_REASONS,
  REFUND_APPROVAL_LIMIT,
  REFUND_APPROVER,
  STAFF,
  insurerOf,
  type CreditEvent,
  type CreditNote,
  type CreditReason,
  type Invoice,
  type RefundMethod,
} from "./data"
import { claimsHref, creditNoteHref, INVOICES_HREF, invoiceHref } from "./href"
import { formatMoney, useMoney } from "./money"
import { nphies, toAdjustmentBundle } from "./nphies"
import { ClaimStatusBadge, Latin, ltrRun } from "./parts"
import { billCan } from "./roles"
import { creditedLines, creditPreview, issueCreditNote, lineNet, lineTotal, lineVat, needsApproval, nextCreditNo, paidBack, paidByCard, refundMethods } from "./rules"
import { ApproveRefundDialog, refundCard, ROLE_LABEL } from "./refund-approval"
import { currentUser } from "./session"
import { getClaim, getCreditNote, getCreditNotes, getInvoice, saveCreditIssue, saveCreditNote, useBillRole, useClaim, useCreditNote, useInvoice } from "./store"
import { useBillText } from "./text"
import { applyZatcaCredit, zatca, zatcaCreditQr, zatcaCreditRequest } from "./zatca"

const timeOf = (iso: string) => iso.slice(11, 16)
const pctRun = (n: number) => ltrRun(`${n}%`)
const n2 = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

/* ------------------------------------------------------------------ small parts */

/** Bordered label / value rows (dialog summaries): 12 muted label (140) · 14 value. */
function Rows({ rows }: { rows: [string, string, ("success" | "destructive" | "muted")?][] }) {
  return (
    <div className="rounded-lg border px-3">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
          <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{k}</span>
          <span className={cn("text-sm tabular-nums", tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground")}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function Note({ tone, icon, children }: { tone: "info" | "success" | "warning" | "destructive"; icon: IconName; children: React.ReactNode }) {
  return (
    <p
      role={tone === "destructive" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-lg p-3 text-xs",
        tone === "info" && "bg-info-soft text-info-soft-foreground",
        tone === "success" && "bg-success-soft text-success-soft-foreground",
        tone === "warning" && "bg-warning-soft text-warning-soft-foreground",
        tone === "destructive" && "bg-destructive-soft text-destructive-soft-foreground"
      )}
    >
      <Icon name={icon} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

function SumRow({ label, value, tone, last }: { label: string; value: string; tone?: "success" | "destructive"; last?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5", !last && "border-b")}>
      <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 text-sm tabular-nums", tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground")}>{value}</span>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

function Card({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  )
}

/** "The consultation stays on the invoice." / "2 items stay…" / "Nothing is left…" — what the credit leaves. */
function useStays() {
  const t = useTranslations("billing.creditNote")
  return (inv: Invoice, credited: Set<number>, key: "stays" | "after") => {
    const left = inv.lines.filter((_, i) => !credited.has(i))
    if (key === "stays") return left.length === 0 ? t("stays.none") : left.length === 1 && left[0].source?.kind === "consult" ? t("stays.consult") : t("stays.items", { n: left.length })
    const no = ltrRun(inv.no)
    return left.length === 0 ? t("after.none", { no }) : left.length === 1 && left[0].source?.kind === "consult" ? t("after.consult", { no }) : t("after.items", { no, n: left.length })
  }
}

/* ------------------------------------------------------------------ dialog */

export type CreditDialogInitial = { lines?: number[]; reason?: CreditReason; step?: 1 | 2; method?: RefundMethod; note?: string }

/**
 * Overlay · Credit note · 1 → 2 (Invoice page → Credit note).
 * 1 · what to credit: the note (an issued invoice can't change), the lines with their amounts incl. VAT (already
 *     credited lines are locked), the reason, and the live split: credit with VAT, off the insurer's claim, patient's part.
 * 2 · refund: the patient's new share, already paid, to refund; Refund by (only methods that fit how they paid), the
 *     approval note, "Print a refund receipt", the NPHIES note; Back · Issue credit note → the Credit note page. A refund
 *     over the limit (SAR 500) is the Over limit state: the warning names the finance manager, a note for them, Cancel ·
 *     Send for approval — the credit note is issued now and the money waits for approval (`approval-requested`).
 */
export function CreditNoteDialog({
  invoiceNo,
  onOpenChange,
  initial,
  preview,
}: {
  invoiceNo: string
  onOpenChange: (open: boolean) => void
  initial?: CreditDialogInitial
  /** Dev stories: show the dialog against this invoice state (e.g. before a seeded credit note existed). */
  preview?: Invoice
}) {
  const t = useTranslations("billing.creditNote.dialog")
  const tr = useTranslations("billing.creditNote")
  const tm = useTranslations("billing")
  const { b, patient, insurerShort, locale } = useBillText()
  const money = useMoney()
  const router = useRouter()
  const role = useBillRole()
  const stored = useInvoice(invoiceNo)
  const inv = preview ?? stored
  const [step, setStep] = React.useState<1 | 2>(initial?.step ?? 1)
  const [lines, setLines] = React.useState<number[]>(initial?.lines ?? [])
  const [reason, setReason] = React.useState<CreditReason | "">(initial?.reason ?? "")
  const [tried, setTried] = React.useState(false)
  const [receipt, setReceipt] = React.useState(true)
  const [method, setMethod] = React.useState<RefundMethod | undefined>(initial?.method)
  const [forApprover, setForApprover] = React.useState(initial?.note ?? "")
  const receiptId = React.useId()
  if (!inv) return null

  const p = patient(inv.patient)
  const done = creditedLines(inv)
  const credits = inv.credits ?? []
  const a = creditPreview(inv, lines)
  const ins = inv.payer === "cash" ? undefined : inv.payer
  const methods = refundMethods(inv)
  const how = methods.includes(method as RefundMethod) ? (method as RefundMethod) : methods[0]
  // Over the limit the money always waits for the finance manager (nobody approves their own refund on the way out).
  const overLimit = a.refund > 0 && needsApproval(a.refund)
  const approver = STAFF[REFUND_APPROVER]
  const limit = formatMoney(REFUND_APPROVAL_LIMIT, locale, { whole: true })
  const errors = { lines: lines.length === 0, reason: !reason }
  const invalid = errors.lines || errors.reason
  const sex = p.sex ?? "m"
  const lastPay = inv.payments[inv.payments.length - 1]

  const toggle = (i: number, on: boolean) => setLines((cur) => (on ? [...new Set([...cur, i])].sort((x, y) => x - y) : cur.filter((x) => x !== i)))
  const next = () => {
    setTried(true)
    if (!invalid) setStep(2)
  }

  const issue = () => {
    if (!reason || !billCan(role, "creditNote")) return
    const cur = getInvoice(inv.no)
    if (!cur) return
    const claim = cur.claimNo ? getClaim(cur.claimNo) : undefined
    const no = nextCreditNo(getCreditNotes().map((c) => c.no), BILL_NOW)
    const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-cn`
    const user = currentUser()
    const r = issueCreditNote(cur, claim, {
      no,
      lines,
      reason,
      method: how,
      receipt,
      at: BILL_NOW,
      by: user?.id ?? "session",
      byName: user?.name ?? SESSION_USER.name,
      uuid,
      approval: overLimit ? { approver: REFUND_APPROVER, askedRole: ROLE_LABEL[role], note: forApprover } : undefined,
    })
    saveCreditIssue(r.cn, r.invoice, r.claim)
    onOpenChange(false)
    router.push(creditNoteHref(no))
    if (overLimit) toast.success(t("approvalToast"), { description: t("approvalToastText", { name: b(approver.name), g: approver.female ? "female" : "male" }) })
    // ZATCA (type 381, referencing the invoice) and the NPHIES claim adjustment, behind their stubs.
    zatca
      .report(zatcaCreditRequest(r.cn), r.cn.zatca.type)
      .then((res) => {
        const c = getCreditNote(no)
        if (c) saveCreditNote(applyZatcaCredit(c, res, BILL_NOW))
      })
      .catch(() => undefined)
    if (r.claim && ins)
      nphies
        .adjust(toAdjustmentBundle(r.claim, no, BILL_NOW))
        .then(() => {
          const c = getCreditNote(no)
          if (c?.claim) saveCreditNote({ ...c, claim: { ...c.claim, sentAt: BILL_NOW }, events: [...c.events, { at: BILL_NOW, kind: "claimAdjusted", insurer: ins }] })
        })
        .catch(() => undefined)
  }

  const insurerLabel = (pct: boolean) =>
    pct ? tr("sum.insurerPct", { insurer: insurerShort(inv.payer), pct: pctRun(100 - inv.copay.pct) }) : tr("sum.insurer", { insurer: insurerShort(inv.payer) })
  const patientLabel = (pct: boolean) => (pct ? tr("sum.patientPct", { pct: pctRun(inv.copay.pct) }) : tr("sum.patient"))

  if (step === 1)
    return (
      <ResponsiveDialog
        open
        onOpenChange={onOpenChange}
        title={t("title1")}
        description={<bdi>{t("sub1", { no: ltrRun(inv.no) })}</bdi>}
        icon="receipt-minus"
        width="sm:max-w-140"
        secondary={
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
        }
        primary={<Button onClick={next}>{t("next")}</Button>}
      >
        {tried && invalid && (
          <Note tone="destructive" icon="warning-2">
            {t("alert")}
          </Note>
        )}
        <Note tone="info" icon="info-circle">
          {t("info")}
        </Note>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">{t("lines")}</legend>
          <div className={cn("rounded-lg border px-3", tried && errors.lines && "border-destructive")}>
            {inv.lines.map((l, i) => {
              const locked = done.has(i)
              const on = lines.includes(i)
              const id = `cn-line-${i}`
              const by = credits.find((c) => c.lines.includes(i))?.cn
              return (
                <div key={i} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
                  <Checkbox id={id} checked={locked || on} disabled={locked} onCheckedChange={(v) => toggle(i, v === true)} aria-invalid={tried && errors.lines ? true : undefined} />
                  <label htmlFor={id} className={cn("min-w-0 flex-1 text-sm", locked ? "text-muted-foreground" : "cursor-pointer text-foreground")}>
                    {b(l.item)}
                    {locked && by && (
                      <span className="ms-2 text-xs text-muted-foreground">
                        <bdi>{t("lineCredited", { cn: ltrRun(by) })}</bdi>
                      </span>
                    )}
                  </label>
                  <span className={cn("shrink-0 text-sm tabular-nums", on && !locked ? "text-foreground" : "text-muted-foreground")}>{money(lineTotal(l))}</span>
                </div>
              )
            })}
          </div>
          {tried && errors.lines && <p className="text-xs text-destructive">{t("linesError")}</p>}
        </fieldset>
        <Field label={t("reason")} required error={tried && errors.reason ? t("reasonError") : undefined}>
          {(fp) => (
            <Select value={reason} onValueChange={(v) => setReason(v as CreditReason)}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue placeholder={t("reasonPick")} />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {tr(`reason.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Rows
          rows={[
            [t("creditVat"), money(a.total)],
            ...(ins ? ([[insurerLabel(a.pctSplit), money(a.insurer)]] as [string, string][]) : []),
            [patientLabel(a.pctSplit), money(a.patient)],
          ]}
        />
      </ResponsiveDialog>
    )

  const first = b(p.name).split(" ")[0]
  const refund = a.refund > 0
  const methodHow = lastPay ? tm(`methodIn.${lastPay.method}`) : tm("methodIn.cash")
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={refund ? t("title2") : t("title2None")}
      description={refund ? <bdi>{t("sub2", { amount: money(a.refund), name: first })}</bdi> : t("sub2None")}
      icon="money-send"
      width="sm:max-w-140"
      secondary={
        overLimit ? (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setStep(1)}>
            {t("back")}
          </Button>
        )
      }
      primary={<Button onClick={issue}>{overLimit ? t("approval") : t("issue")}</Button>}
    >
      <Rows
        rows={[
          [t("newShare"), money(a.after.patient)],
          [t("paid"), money(a.paid)],
          refund ? [t("toRefund"), money(a.refund), "success"] : [t("owes"), money(a.owes), a.owes > 0 ? "destructive" : undefined],
        ]}
      />
      {refund ? (
        <>
          <Field label={t("refundBy")} required>
            {(fp) => (
              <Segmented
                {...fp}
                value={how}
                onValueChange={setMethod}
                aria-label={t("refundBy")}
                className="w-full *:flex-1"
                options={methods.map((m) => ({ value: m, label: m === "card" ? t("method.cardTo", { brand: refundCard(inv)?.brand ?? "card" }) : t(`method.${m}`) }))}
              />
            )}
          </Field>
          {overLimit ? (
            <>
              <Note tone="warning" icon="warning-2">
                {t("overLimit", { limit, name: b(approver.name), role: locale === "ar" ? approver.role.ar : approver.role.en.toLowerCase(), g: approver.female ? "female" : "male" })}
              </Note>
              <Field label={t("noteFor", { name: b(approver.name).split(" ")[0] })}>
                <Textarea value={forApprover} onChange={(e) => setForApprover(e.target.value)} rows={3} />
              </Field>
            </>
          ) : (
            <>
              <Note tone="info" icon="info-circle">
                {t(paidByCard(inv) ? "noteCard" : "noteCash", { sex, how: methodHow, limit })}
              </Note>
              <label htmlFor={receiptId} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox id={receiptId} checked={receipt} onCheckedChange={(v) => setReceipt(v === true)} />
                {t("receipt")}
              </label>
            </>
          )}
        </>
      ) : (
        <Note tone="info" icon="info-circle">
          {t("noteNone", { sex, owes: money(a.owes) })}
        </Note>
      )}
      {ins && a.insurer > 0 && (
        <Note tone="success" icon="tick-circle">
          <bdi>
            {inv.claimNo
              ? t("nphies", { insurer: insurerShort(ins), amount: money(a.insurer), claim: ltrRun(inv.claimNo) })
              : t("nphiesNoClaim", { insurer: insurerShort(ins), amount: money(a.insurer) })}
          </bdi>
        </Note>
      )}
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ paper */

/**
 * Widget / Bill Credit Note — the tax credit note paper (same letterhead and ZATCA QR as the invoice): "Tax credit
 * note", "CN-2611-0012 · issued …", status; patient, MRN, against invoice, insurer + class, reason, claim; the reason
 * note; the credited lines (compact: item + total); subtotal, VAT, total credited, off the insurer's claim, patient's
 * part, refunded; footer: ZATCA + UUID and "the original invoice is unchanged".
 */
export function CreditNotePaper({ cn: c, inv, className }: { cn: CreditNote; inv: Invoice; className?: string }) {
  const t = useTranslations("billing.creditNote")
  const ti = useTranslations("billing.invoice")
  const { b, patient, payerName, date } = useBillText()
  const dates = useDates()
  const money = useMoney()
  const stays = useStays()
  const p = patient(inv.patient)
  const ins = inv.payer === "cash" ? undefined : insurerOf(inv.payer)
  const lines = c.lines.map((i) => inv.lines[i]).filter(Boolean)
  const back = paidBack(c)
  const rates = [...new Set(lines.map((l) => l.vatRate))]
  const rate = rates.length === 1 ? rates[0] : null
  const vatLabel = (k: "line" | "sum") => (rate == null ? t(`${k}.vatMixed`) : t(`${k}.vat`, { rate: pctRun(Math.round(rate * 100)) }))
  const z = c.zatca
  const uuid = `${z.uuid.slice(0, 4)}…${z.uuid.slice(-4)}`
  const a = c.amounts
  // Percentages only when no cap was involved before or after (else the split isn't 80 / 20).
  const pct = !!ins && Math.abs(a.before.patient - (a.before.total * inv.copay.pct) / 100) < 0.01 && Math.abs(a.after.patient - (a.after.total * inv.copay.pct) / 100) < 0.01
  const note = [t(`reasonNote.${c.reason}`), stays(inv, new Set([...c.lines, ...(inv.credits ?? []).filter((x) => x.cn <= c.no).flatMap((x) => x.lines)]), "stays")]
    .filter(Boolean)
    .join(" ")
  const insurerShort = ins ? b(ins.short) : ""

  return (
    <article data-bill-paper aria-label={t("paper")} className={cn("@container/paper rounded-lg border bg-card shadow-md", className)}>
      <div className="flex flex-col gap-5 p-4 @xl/paper:p-9">
        <header className="flex items-start gap-3">
          <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-accent text-primary">
            <Icon name="receipt-minus" size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-lg font-semibold text-foreground">{b(CENTER.name)}</p>
            <p className="text-xs text-muted-foreground">
              <bdi>{ti("seller", { vat: ltrRun(CENTER.vatNo), cr: ltrRun(CENTER.cr), city: b(CENTER.city) })}</bdi>
            </p>
          </div>
          <div className="hidden flex-col items-center gap-0.5 @xl/paper:flex">
            <span className="inline-flex rounded-md border bg-white p-1">
              <QrCode value={zatcaCreditQr(c)} size={88} quiet={2} label={ti("qr")} />
            </span>
            <span className="text-xs text-muted-foreground">{ti("zatca")}</span>
          </div>
        </header>

        <div aria-hidden className="h-px bg-border" />

        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-xl font-semibold text-foreground">{t("paper")}</h2>
            <p className="text-xs text-muted-foreground">
              <bdi>{t("issued", { no: ltrRun(c.no), date: date(c.issuedAt), time: timeOf(c.issuedAt) })}</bdi>
            </p>
          </div>
          {c.approval?.status === "pending" ? (
            <StatusBadge tone="warning">{t("status.approval")}</StatusBadge>
          ) : (
            <StatusBadge tone={back ? "success" : "neutral"}>{t(back ? "status.refunded" : "status.issued")}</StatusBadge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5 @xl/paper:grid-cols-3">
          <Info label={t("field.patient")}>{b(p.name)}</Info>
          <Info label={t("field.mrn")}>
            <Latin>{p.mrn}</Latin>
          </Info>
          <Info label={t("field.against")}>
            <bdi>{t("against", { no: ltrRun(inv.no), date: dates.dayMonth(inv.issuedAt) })}</bdi>
          </Info>
          <Info label={t("field.insurer")}>{ins ? ti("insurerClass", { name: b(ins.name), cls: ltrRun(inv.class ?? "—") }) : payerName(inv)}</Info>
          <Info label={t("field.reason")}>{t(`reasonShort.${c.reason}`)}</Info>
          <Info label={t("field.claim")}>{inv.claimNo ? <Latin>{inv.claimNo}</Latin> : "—"}</Info>
        </div>

        {note && (
          <Note tone="info" icon="info-circle">
            {note}
          </Note>
        )}

        <div className="overflow-hidden rounded-[10px] border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-normal">{t("line.item")}</th>
                <th className="hidden w-12 px-1.5 py-2 text-start font-normal @xl/paper:table-cell">{t("line.qty")}</th>
                <th className="hidden w-[88px] px-1.5 py-2 text-start font-normal @xl/paper:table-cell">{t("line.price")}</th>
                <th className="hidden w-[88px] px-1.5 py-2 text-start font-normal @xl/paper:table-cell">{vatLabel("line")}</th>
                <th className="w-[100px] px-3 py-2 text-start font-normal">{t("line.total")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 text-foreground">{b(l.item)}</td>
                  <td className="hidden px-1.5 py-2 tabular-nums @xl/paper:table-cell">{l.qty}</td>
                  <td className="hidden px-1.5 py-2 tabular-nums @xl/paper:table-cell">{n2(lineNet(l) / l.qty)}</td>
                  <td className="hidden px-1.5 py-2 tabular-nums @xl/paper:table-cell">{n2(lineVat(l))}</td>
                  <td className="px-3 py-2 tabular-nums">{n2(lineTotal(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="flex w-full flex-col @xl/paper:w-80">
            <SumRow label={t("sum.subtotal")} value={money(a.subtotal)} />
            <SumRow label={vatLabel("sum")} value={money(a.vat)} />
            <SumRow label={t("sum.total")} value={money(a.total)} />
            {ins && (
              <SumRow
                label={pct ? t("sum.insurerPct", { insurer: insurerShort, pct: pctRun(100 - inv.copay.pct) }) : t("sum.insurer", { insurer: insurerShort })}
                value={money(a.insurer)}
              />
            )}
            <SumRow label={pct ? t("sum.patientPct", { pct: pctRun(inv.copay.pct) }) : t("sum.patient")} value={money(a.patient)} last={!back} />
            {back && <SumRow label={t(`sum.refunded.${back.method}`)} value={money(back.amount)} tone="success" last />}
          </div>
        </div>

        <footer className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <p>
            <bdi>
              {z.status === "reported" || z.status === "cleared"
                ? t(`footer.${z.status}`, { date: date(z.reportedAt ?? c.issuedAt), time: timeOf(z.reportedAt ?? c.issuedAt), uuid: ltrRun(uuid) })
                : t(`footer.${z.status}`, { uuid: ltrRun(uuid) })}
            </bdi>
          </p>
          <p>
            <bdi>{t("footer.against", { no: ltrRun(inv.no) })}</bdi>
          </p>
        </footer>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ side */

function useCreditEventText(zatcaDone: boolean, c: CreditNote) {
  const t = useTranslations("billing.creditNote.history")
  const { b, insurerShort } = useBillText()
  const money = useMoney()
  return (e: CreditEvent) => {
    if (e.text) return b(e.text)
    const name = e.byName ? b(e.byName) : ""
    if (e.kind === "issued") return t(zatcaDone ? "issued" : "issuedPending", { name })
    if (e.kind === "claimAdjusted") return t("claimAdjusted", { insurer: insurerShort(e.insurer ?? "") })
    if (e.kind === "approvalRequested") return t("approvalRequested", { name, amount: money(c.refund?.amount ?? 0), approver: c.approval ? b(STAFF[c.approval.approver].name) : "" })
    if (e.kind === "refundApproved") return t("refundApproved", { name })
    if (e.kind === "refundRejected") return t("refundRejected", { name })
    if (e.refund) return t(e.refund.receipt ? "refundedReceipt" : "refunded", { amount: money(e.refund.amount), how: t(`how.${e.refund.method}`) })
    return ""
  }
}

/**
 * Widget / Bill Credit Note Side: Refund to the patient (new share, already paid, refunded, how + who, Download refund
 * receipt), Invoice after this (total, insurer pays, patient pays, balance, Open invoice), the insurer's claim (old →
 * new, status, Open claims — off with the Claims tab), History.
 */
export function CreditNoteSide({ cn: c, inv }: { cn: CreditNote; inv: Invoice }) {
  const t = useTranslations("billing.creditNote")
  const tp = useTranslations("billing.pdf")
  const { b, patient, insurerShort, ar } = useBillText()
  const dates = useDates()
  const money = useMoney()
  const stays = useStays()
  const claim = useClaim(c.claim?.no ?? "")
  const a = c.amounts
  const zatcaDone = c.zatca.status === "reported" || c.zatca.status === "cleared"
  const eventText = useCreditEventText(zatcaDone, c)
  const events = [...c.events].sort((x, y) => x.at.localeCompare(y.at))
  const sameDay = (iso: string) => iso.slice(0, 10) === c.issuedAt.slice(0, 10)
  const ins = inv.payer === "cash" ? undefined : inv.payer
  const sex = patient(inv.patient).sex ?? "m"
  const owes = Math.max(0, a.after.patient - a.paid)
  const back = paidBack(c)
  const balance = Math.max(0, a.after.patient - (a.paid - (back?.amount ?? 0)))
  const role = useBillRole()
  const [reviewing, setReviewing] = React.useState(false)
  const ap = c.approval
  const methodLabel = (m: RefundMethod) => (m === "card" ? t("dialog.method.cardTo", { brand: refundCard(inv)?.brand ?? "card" }) : t(`dialog.method.${m}`))
  const roleText = (r: { en: string; ar: string }) => (ar ? r.ar : r.en.toLowerCase())
  const approver = ap ? STAFF[ap.approver] : undefined
  const upTo = new Set([...(inv.credits ?? []).filter((x) => x.cn <= c.no).flatMap((x) => x.lines)])
  const pdf = () => toast.success(tp("done"), { description: tp("doneText") })

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("refund.title")} description={c.refund ? t("refund.text", { sex }) : t("refund.textNone")}>
        <div className="flex flex-col">
          <SumRow label={t("refund.newShare")} value={money(a.after.patient)} />
          <SumRow label={t("refund.paid")} value={money(a.paid)} />
          {c.refund && ap && ap.status !== "approved" ? (
            <>
              <SumRow label={t(ap.status === "pending" ? "refund.waiting" : "refund.kept")} value={money(c.refund.amount)} />
              <SumRow label={t("refund.to")} value={ap.status === "pending" ? methodLabel(c.refund.method) : t("refund.keptAs")} last />
            </>
          ) : c.refund ? (
            <>
              <SumRow label={t("refund.refunded")} value={money(c.refund.amount)} tone="success" />
              <SumRow label={t("refund.how")} value={t(`refund.method.${c.refund.method}`, { name: b(c.refund.byName), brand: refundCard(inv)?.brand ?? "card" })} last />
            </>
          ) : (
            <SumRow label={t("refund.owes")} value={money(owes)} tone={owes > 0 ? "destructive" : undefined} last />
          )}
        </div>
        {ap && approver && ap.status !== "approved" && (
          <Note tone={ap.status === "pending" ? "warning" : "info"} icon={ap.status === "pending" ? "clock" : "info-circle"}>
            {ap.status === "pending"
              ? t("refund.pending", { name: b(approver.name), role: roleText(approver.role), g: approver.female ? "female" : "male", time: timeOf(ap.askedAt) })
              : t("refund.rejected", { name: b(approver.name), g: approver.female ? "female" : "male", note: ap.decisionNote ? b(ap.decisionNote) : "" })}
          </Note>
        )}
        {ap?.status === "pending" && billCan(role, "approveRefund") && (
          <Button className="w-full" onClick={() => setReviewing(true)}>
            {t("refund.review")}
          </Button>
        )}
        {back && (
          <Button variant="outline" className="w-full" onClick={pdf}>
            <Icon name="document-download" size={24} />
            {t("refund.receipt")}
          </Button>
        )}
        {reviewing && <ApproveRefundDialog cnNo={c.no} onOpenChange={setReviewing} />}
      </Card>

      <Card title={t("after.title")} description={<bdi>{stays(inv, upTo, "after")}</bdi>}>
        <div className="flex flex-col">
          <SumRow label={t("after.total")} value={money(a.after.total)} />
          {ins && <SumRow label={t("after.insurerPays", { insurer: insurerShort(ins) })} value={money(a.after.insurer)} />}
          <SumRow label={t("after.patientPays")} value={money(a.after.patient)} />
          <SumRow label={t("after.balance")} value={money(balance)} tone={balance > 0 ? "destructive" : "success"} last />
        </div>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={invoiceHref(inv.no)}>{t("after.open")}</Link>
        </Button>
      </Card>

      {c.claim && ins && (
        <Card title={t("claim.title", { insurer: insurerShort(ins) })} description={t("claim.text")}>
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Latin className="text-sm text-foreground">{c.claim.no}</Latin>
              <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <bdi>{money(c.claim.from)}</bdi>
                <span aria-hidden>{ar ? "←" : "→"}</span>
                <bdi>{money(c.claim.to)}</bdi>
              </span>
            </div>
            {claim && <ClaimStatusBadge status={claim.status} />}
          </div>
          {isTabEnabled("billing", "claims") && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={claimsHref({ q: c.claim.no })}>{t("claim.open")}</Link>
            </Button>
          )}
        </Card>
      )}

      <Card title={t("history.title")}>
        <ol className="flex flex-col gap-4">
          {events.map((e, i) => (
            <li key={i} className="flex gap-2.5 text-xs">
              <span className="w-10 shrink-0 text-muted-foreground tabular-nums">{sameDay(e.at) ? timeOf(e.at) : dates.dayMonth(e.at)}</span>
              <span className="min-w-0 flex-1 text-foreground">{eventText(e)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

/**
 * Credit note page (`/billing/invoices/credit-note?no=CN-2611-0012`): inner page of Invoices — header Back · "Billing /
 * Invoices" over "CN-2611-0012 · Abdullah Al-Shammari"; actions Download PDF · Open invoice; the paper beside the side
 * column (stacked below 1088 px of content). Mobile: Back · "Credit note" · ⋯ replaces the app bar.
 */
export function CreditNotePage() {
  const t = useTranslations("billing.creditNote")
  const tp = useTranslations("billing.pdf")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const { b, patient } = useBillText()
  const c = useCreditNote(useSearchParams().get("no") ?? "")
  const inv = useInvoice(c?.invoiceNo ?? "")
  const pdf = () => toast.success(tp("done"), { description: tp("doneText") })

  if (!c || !inv) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="receipt-minus"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={INVOICES_HREF}>
                  <Icon name="arrow-left" size={16} />
                  {t("backToList")}
                </Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }

  const actions = (
    <>
      <Button variant="outline" onClick={pdf} className="max-md:flex-1">
        <Icon name="document-download" size={24} />
        {t("download")}
      </Button>
      <Button asChild className="max-md:flex-1">
        <Link href={invoiceHref(inv.no)}>{t("openInvoice")}</Link>
      </Button>
    </>
  )
  return (
    <>
      <PageTitle
        title={t("title", { no: c.no, name: b(patient(inv.patient).name) })}
        crumbs={[
          { label: tn("billing"), href: "/billing" },
          { label: tt("invoices"), href: INVOICES_HREF },
        ]}
        back={invoiceHref(inv.no)}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={invoiceHref(inv.no)} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
        <ActionMenu
          title={c.no}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[[{ key: "print", icon: "printer", label: t("download"), onSelect: pdf }]]}
        />
      </div>
      <PageContainer className="@container/cn">
        <PageHeader actions={actions} />
        <div className="grid gap-4 @[68rem]/cn:grid-cols-[minmax(0,1fr)_360px] @[68rem]/cn:items-start @[68rem]/cn:gap-6">
          <CreditNotePaper cn={c} inv={inv} />
          <CreditNoteSide cn={c} inv={inv} />
        </div>
      </PageContainer>
    </>
  )
}
