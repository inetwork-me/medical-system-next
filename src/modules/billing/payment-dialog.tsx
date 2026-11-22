"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { SESSION_USER } from "@/lib/mock/shell"
import { Field } from "@/components/ds/field"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useIsMobile } from "@/hooks/use-media-query"
import { BILL_NOW, TERMINALS, type Invoice, type PayMethod } from "./data"
import { amount as amountText, formatMoney, round2, useMoney } from "./money"
import { ltrRun } from "./parts"
import { billCan } from "./roles"
import { paymentError, recordPayment, totals, usesTerminal, type PaymentError } from "./rules"
import { getInvoice, saveInvoice, useBillRole, useInvoice } from "./store"
import { useBillText } from "./text"
import { currentUser } from "./session"

const METHODS: PayMethod[] = ["cash", "mada", "card", "applepay", "transfer"]
// Mobile sheet: 4 methods (Transfer is a desk task).
const METHODS_MOBILE: PayMethod[] = ["cash", "mada", "card", "applepay"]

/** Patient pays / Paid / Balance box (dialog summary): bordered, rows 12 muted label · 14 value. */
function SummaryBox({ inv }: { inv: Invoice }) {
  const t = useTranslations("billing.invoice.pay")
  const money = useMoney()
  const tt = totals(inv)
  const rows: [string, string, string][] = [
    [t("patientPays"), money(tt.patientShare), "text-foreground"],
    [t("paid"), money(tt.paid), "text-success"],
    [t("balance"), money(tt.balance), tt.balance > 0 ? "text-destructive" : "text-foreground"],
  ]
  return (
    <div className="rounded-lg border px-3">
      {rows.map(([k, v, c]) => (
        <div key={k} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
          <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{k}</span>
          <span className={cn("text-sm tabular-nums", c)}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Overlay · Record payment (Collect, Record payment): the patient share / paid / balance; Paid by Cash · mada ·
 * Card · Apple Pay · Transfer (4 on mobile); amount prefilled with the balance; card machine and approval code for
 * card methods; "Send the receipt by SMS". Save payment swaps to the payment-recorded toast. A payment is added to
 * the issued invoice — its lines and totals never change; more than the balance is refused (refunds = credit note).
 */
export function RecordPaymentDialog({ invoiceNo, onOpenChange }: { invoiceNo: string; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("billing.payment")
  const tm = useTranslations("billing")
  const { b, ar, patient, locale } = useBillText()
  const role = useBillRole()
  const mobile = useIsMobile()
  const inv = useInvoice(invoiceNo)
  const balance = inv ? totals(inv).balance : 0
  const [method, setMethod] = React.useState<PayMethod>("mada")
  const [amount, setAmount] = React.useState(() => amountText(balance).replace(/,/g, ""))
  const [terminal, setTerminal] = React.useState(TERMINALS[0].key)
  const [approval, setApproval] = React.useState("")
  const [sms, setSms] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const smsId = React.useId()
  if (!inv) return null

  const p = patient(inv.patient)
  const card = usesTerminal(method)
  const value = Number(amount.replace(/,/g, ""))
  const error: PaymentError | null = paymentError(inv, { amount: value, method, approvalCode: card ? approval.trim() : undefined })
  const options = (mobile ? METHODS_MOBILE : METHODS).map((m) => ({ value: m, label: tm(`method.${m}`) }))

  const save = () => {
    setTried(true)
    if (error || !billCan(role, "collect")) return
    const cur = getInvoice(inv.no)
    if (!cur) return
    const next = recordPayment(cur, {
      invoiceNo: inv.no,
      amount: value,
      method,
      terminal: card ? terminal : undefined,
      approvalCode: card && approval.trim() ? approval.trim() : undefined,
      // Recorded by the signed-in user (the session's user record; the shell's profile name as a fallback).
      by: currentUser()?.id ?? "session",
      byName: currentUser()?.name ?? SESSION_USER.name,
      at: BILL_NOW,
      smsReceipt: sms && !!p.mobile,
    })
    saveInvoice(next)
    onOpenChange(false)
    const left = totals(next).balance
    const sent = sms && !!p.mobile
    toast.success(t("toast", { amount: formatMoney(round2(value), locale, { whole: true }), method: tm(`methodIn.${method}`) }), {
      description:
        left <= 0
          ? t(sent ? "toastFull" : "toastFullNoSms", { no: ltrRun(inv.no) })
          : t(sent ? "toastPart" : "toastPartNoSms", { balance: formatMoney(left, locale) }),
    })
  }

  const unit = <span className="shrink-0 text-sm text-foreground ltr:-me-1 rtl:-ms-1">{ar ? "ر.س" : "SAR"}</span>
  const errorText = (e: PaymentError) => t(`error.${e}`, { amount: formatMoney(balance, locale) })

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={<bdi>{t("sub", { no: ltrRun(inv.no), name: b(p.name) })}</bdi>}
      icon="wallet-money"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("save")}</Button>}
    >
      <SummaryBox inv={inv} />

      <Field label={t("paidBy")} required>
        {(fp) => (
          <Segmented
            {...fp}
            value={method}
            onValueChange={setMethod}
            aria-label={t("paidBy")}
            className="w-full *:flex-1"
            options={options}
          />
        )}
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("amount")} required error={tried && error && error !== "approval" ? errorText(error) : undefined}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            startIcon={ar ? undefined : unit}
            end={ar ? unit : undefined}
            className="tabular-nums"
          />
        </Field>
        {card && (
          <Field label={t("terminal")}>
            {(fp) => (
              <Select value={terminal} onValueChange={setTerminal}>
                <SelectTrigger {...fp} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMINALS.map((x) => (
                    <SelectItem key={x.key} value={x.key}>
                      {b(x.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}
      </div>

      {card && (
        <Field label={t("approval")} helper={t("approvalHint")} error={tried && error === "approval" ? errorText(error) : undefined}>
          <Input inputMode="numeric" maxLength={6} dir="ltr" value={approval} onChange={(e) => setApproval(e.target.value.replace(/\D/g, ""))} className="tabular-nums" />
        </Field>
      )}

      <div className={cn("flex items-center gap-3 rounded-lg border p-3", !p.mobile && "opacity-70")}>
        <label htmlFor={smsId} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
          <span className="text-sm font-medium">{t("sms")}</span>
          {p.mobile && (
            <span className="text-xs text-muted-foreground">
              <bdi>{t("smsTo", { phone: ltrRun(p.mobile), owner: p.mobileOwner ? b(p.mobileOwner) : b(p.name) })}</bdi>
            </span>
          )}
        </label>
        <Switch id={smsId} checked={sms && !!p.mobile} onCheckedChange={setSms} disabled={!p.mobile} />
      </div>
    </ResponsiveDialog>
  )
}
