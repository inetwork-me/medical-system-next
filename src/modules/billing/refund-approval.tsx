"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Bi } from "@/lib/mock/bi"
import { BILL_NOW, STAFF, userById, type Invoice, type PayMethod, type RefundMethod } from "./data"
import { useMoney } from "./money"
import { ltrRun } from "./parts"
import { billCan, type BillRole } from "./roles"
import { approveRefund, rejectRefund } from "./rules"
import { currentUser } from "./session"
import { getCreditNote, getInvoice, saveRefundDecision, useBillRole, useCreditNote, useInvoice } from "./store"
import { useBillText } from "./text"

const CARD: PayMethod[] = ["mada", "card", "applepay"]

/** The card a refund goes back to: the invoice's (last) card payment — brand + last 4 digits. */
export function refundCard(inv: Invoice) {
  const p = [...inv.payments].reverse().find((x) => CARD.includes(x.method))
  return p ? { brand: p.method as "mada" | "card" | "applepay", last4: p.last4 } : undefined
}

/**
 * Where the money goes, as a phrase: "back to mada" / "ترجع لمدى", "back in cash", "as credit for the next visit".
 * `card` reads "mada card ending in 4410" / "بطاقة مدى تنتهي بـ 4410" (masked: the last 4 digits only).
 */
export function useRefundTo() {
  const t = useTranslations("billing.refundApproval")
  return {
    phrase: (method: RefundMethod, inv: Invoice) =>
      method === "card" ? t("backTo.card", { brand: refundCard(inv)?.brand ?? "card" }) : t(`backTo.${method}`),
    card: (inv: Invoice) => {
      const c = refundCard(inv)
      return c?.last4 ? t("cardEnding", { brand: c.brand, last4: ltrRun(c.last4) }) : t("cardOnly", { brand: c?.brand ?? "card" })
    },
  }
}

/** The requester's role as stored on the request ("reception"). */
export const ROLE_LABEL: Record<BillRole, Bi> = {
  reception: { en: "reception", ar: "الاستقبال" },
  billing: { en: "billing", ar: "الفوترة" },
  finance: { en: "finance", ar: "المالية" },
  lead: { en: "billing lead", ar: "مسؤول الفوترة" },
  hr: { en: "HR", ar: "الموارد البشرية" },
  signatory: { en: "management", ar: "الإدارة" },
  doctor: { en: "doctor", ar: "طبيب" },
}

/** "Nora" from "Nora Al-Fahad" (the toast names the requester by first name). */
const firstName = (s: string) => (/^(Dr\.|د\.)/.test(s) ? s.split(" ").slice(0, 2).join(" ") : s.split(" ")[0])

/**
 * Overlay · Approve the refund (finance manager; Review on "Refund to approve" in Needs attention, or on the credit
 * note): patient, invoice, reason, refund amount, back to (masked card "ending in 4410"), asked by; Your note; the info
 * on when the money arrives. Reject (note required — it goes to the requester) → `refund-rejected`; Approve refund →
 * `refund-approved`.
 */
export function ApproveRefundDialog({ cnNo, onOpenChange, initialNote = "" }: { cnNo: string; onOpenChange: (open: boolean) => void; initialNote?: string }) {
  const t = useTranslations("billing.refundApproval")
  const td = useTranslations("billing.creditNote.dialog")
  const { b, patient, insurerShort, date } = useBillText()
  const money = useMoney()
  const to = useRefundTo()
  const role = useBillRole()
  const c = useCreditNote(cnNo)
  const inv = useInvoice(c?.invoiceNo ?? "")
  const [note, setNote] = React.useState(initialNote)
  const [tried, setTried] = React.useState(false)
  if (!c || !inv || !c.refund || !c.approval) return null

  const p = patient(inv.patient)
  const asker = userById(c.by)
  const dm = date(inv.issuedAt).replace(/\s\d{4}$/, "")
  const allowed = billCan(role, "approveRefund")
  const card = c.refund.method === "card"
  const me = currentUser() ?? { ...STAFF[c.approval.approver], key: c.approval.approver }

  const decide = (approve: boolean) => {
    if (!allowed) return
    if (!approve && !note.trim()) {
      setTried(true)
      return
    }
    const cur = getCreditNote(cnNo)
    const curInv = getInvoice(inv.no)
    if (!cur || !curInv) return
    if (approve) {
      const r = approveRefund(cur, curInv, { at: BILL_NOW, byName: me.name, note })
      saveRefundDecision(r.cn, r.invoice)
      toast.success(t("approvedToast"), {
        description: card
          ? t("approvedText", { amount: money(c.refund!.amount), to: to.phrase("card", inv) })
          : t("approvedDue", { amount: money(c.refund!.amount), to: to.phrase(c.refund!.method, inv) }),
      })
    } else {
      const r = rejectRefund(cur, { at: BILL_NOW, byName: me.name, note }, curInv)
      saveRefundDecision(r.cn, r.invoice)
      toast.success(t("rejectedToast"), { description: t("rejectedText", { name: firstName(b(c.approval!.askedBy)), g: asker?.female ? "female" : "male" }) })
    }
    onOpenChange(false)
  }

  const rows: [string, React.ReactNode][] = [
    [t(p.sex === "f" ? "patientF" : "patient"), inv.payer === "cash" ? t("selfPay", { name: b(p.name) }) : `${b(p.name)} · ${insurerShort(inv.payer)}`],
    [t("invoice"), <bdi key="i">{t("invoiceValue", { no: ltrRun(inv.no), date: dm })}</bdi>],
    [t("reason"), b(c.approval.note)],
    [t("refund"), money(c.refund.amount)],
    [t("backToLabel"), card ? to.card(inv) : td(`method.${c.refund.method}`)],
    [t(asker?.female ? "askedByF" : "askedBy"), <bdi key="a">{t("askedValue", { name: b(c.approval.askedBy), role: b(c.approval.askedRole), time: c.approval.askedAt.slice(11, 16) })}</bdi>],
  ]

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={<bdi>{t("text", { no: ltrRun(c.no), name: b(p.name) })}</bdi>}
      icon="money-send"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => decide(false)} disabled={!allowed}>
          {t("reject")}
        </Button>
      }
      primary={
        <Button onClick={() => decide(true)} disabled={!allowed}>
          {t("approve")}
        </Button>
      }
    >
      <div className="rounded-lg border px-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
            <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{k}</span>
            <span className="min-w-0 flex-1 text-sm text-foreground tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <Field label={t("note")} error={tried && !note.trim() ? t("noteError", { name: firstName(b(c.approval.askedBy)) }) : undefined}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </Field>
      <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
        <Icon name="info-circle" size={18} className="shrink-0" />
        <span>{t(`info.${c.refund.method}`)}</span>
      </p>
      {!allowed && <p className="text-xs text-muted-foreground">{t("onlyFinance")}</p>}
    </ResponsiveDialog>
  )
}
