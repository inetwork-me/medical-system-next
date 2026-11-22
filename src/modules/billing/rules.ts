import {
  BILL_TODAY,
  ENDING_DAYS,
  daysBetween,
  type Claim,
  type ClaimStatus,
  type Contract,
  type ContractStatus,
  type BillDocument,
  type DocStatus,
  type Insurer,
  type InsurerClass,
  type InsurerStatus,
  type Invoice,
  type InvoiceLine,
  type InvoiceStatus,
  type Signer,
} from "./data"
import { round2 } from "./money"

/*
 * Billing rules (brief §4), pure functions over the data model. Screens never compute money or statuses themselves.
 */

/* ------------------------------------------------------------------ invoices */

export const lineNet = (l: InvoiceLine) => round2(l.price * l.qty)
export const lineVat = (l: InvoiceLine) => round2(lineNet(l) * l.vatRate)
export const lineTotal = (l: InvoiceLine) => round2(lineNet(l) + lineVat(l))

export type InvoiceTotals = {
  subtotal: number
  vat: number
  total: number
  insurerShare: number
  patientShare: number
  paid: number
  balance: number
  /** The VAT rate printed in the header ("VAT 15%"); null when lines mix rates. */
  vatRate: number | null
}

export function totals(inv: Invoice): InvoiceTotals {
  const subtotal = round2(inv.lines.reduce((s, l) => s + lineNet(l), 0))
  const vat = round2(inv.lines.reduce((s, l) => s + lineVat(l), 0))
  const total = round2(subtotal + vat)
  const insurerShare = inv.payer === "cash" ? 0 : round2((total * inv.insurerPct) / 100)
  const patientShare = round2(total - insurerShare)
  const paid = round2(inv.payments.reduce((s, p) => s + p.amount, 0))
  const rates = [...new Set(inv.lines.map((l) => l.vatRate))]
  return { subtotal, vat, total, insurerShare, patientShare, paid, balance: round2(Math.max(0, patientShare - paid)), vatRate: rates.length === 1 ? rates[0] : null }
}

/** Status from the money: a refund (credit note) wins, then the patient balance. */
export function invoiceStatus(inv: Invoice): InvoiceStatus {
  if (inv.refunded) return "refunded"
  const t = totals(inv)
  if (t.balance <= 0) return "paid"
  return t.paid > 0 ? "part" : "unpaid"
}

/** Collect shows on unpaid and partly paid invoices. */
export const canCollect = (inv: Invoice) => {
  const s = invoiceStatus(inv)
  return s === "unpaid" || s === "part"
}

/** "ZATCA reported" shows only once the API confirmed (reported or cleared). */
export const zatcaConfirmed = (inv: Invoice) => inv.zatca.status === "reported" || inv.zatca.status === "cleared"

/**
 * Co-pay from the insurer agreement (brief §4): a percentage of the total, capped per visit for the classes the cap
 * covers. Used when an invoice is created from a visit; an issued invoice keeps the shares it was issued with.
 */
export function copayFor(ins: Pick<Insurer, "copay">, cls: InsurerClass | undefined, total: number) {
  const share = round2((total * ins.copay.pct) / 100)
  const capped = ins.copay.capPerVisit != null && cls != null && ins.copay.classes.includes(cls)
  return capped ? Math.min(share, ins.copay.capPerVisit!) : share
}

/* ------------------------------------------------------------------ claims */

/** Claims list "To fix": rejected ones and those held back for a pre-auth. */
export const toFix = (c: Pick<Claim, "status">) => c.status === "rejected" || c.status === "needsPreauth"

/** Does this claim need a pre-authorization under the insurer's rule? (amount threshold, imaging) */
export function needsPreauth(ins: Pick<Insurer, "preauthRule">, amount: number, imaging = false) {
  return (ins.preauthRule.above != null && amount > ins.preauthRule.above) || (!!ins.preauthRule.imaging && imaging)
}

export const CLAIM_ORDER: ClaimStatus[] = ["rejected", "needsPreauth", "ready", "review", "part", "approved"]

/* ------------------------------------------------------------------ insurers */

/** Active → Ending (from 60 days before validTo) → Ended; Waiting for their signature until the agreement is signed. */
export function insurerStatus(ins: Pick<Insurer, "signed" | "validTo">, today = BILL_TODAY): InsurerStatus {
  if (!ins.signed) return "awaitingSignature"
  if (!ins.validTo) return "active"
  const left = daysBetween(today, ins.validTo)
  if (left < 0) return "ended"
  return left <= ENDING_DAYS ? "ending" : "active"
}

export const daysLeft = (validTo: string, today = BILL_TODAY) => daysBetween(today, validTo)

/** A paper's status: stored "checking" (uploaded, waiting for a manager) wins; then expiry. */
export function docStatus(d: Pick<BillDocument, "status" | "validTo">, today = BILL_TODAY): DocStatus {
  if (d.status === "checking") return "checking"
  if (!d.validTo) return d.status
  const left = daysBetween(today, d.validTo)
  if (left < 0) return "expired"
  return left <= ENDING_DAYS ? "renew" : "valid"
}

/* ------------------------------------------------------------------ contracts */

/** Signers in order; the next one is the first who hasn't signed. */
export const ordered = (c: Pick<Contract, "signers">) => [...c.signers].sort((a, b) => a.order - b.order)
export const nextSigner = (c: Pick<Contract, "signers">): Signer | undefined => ordered(c).find((s) => s.status !== "signed")
export const signedCount = (c: Pick<Contract, "signers">) => c.signers.filter((s) => s.status === "signed").length

/**
 * Draft until sent; then waiting for the next signer in order (the center's signatory → "Waiting for you",
 * the other side → "Waiting for them"); once all signed: Signed → Ends in N days (60) → Ended.
 */
export function contractStatus(c: Pick<Contract, "sent" | "signers" | "end">, today = BILL_TODAY): ContractStatus {
  if (!c.sent) return "draft"
  const next = nextSigner(c)
  if (next) return next.side === "center" ? "awaitingYou" : "awaitingThem"
  const left = daysBetween(today, c.end)
  if (left < 0) return "ended"
  return left <= ENDING_DAYS ? "ending" : "signed"
}

export const toSign = (s: ContractStatus) => s === "awaitingYou" || s === "awaitingThem"

/** National IDs show only their last 3 digits: "10•••••417" (EN) / "الهوية تنتهي بـ 417" (AR, in the copy). */
export const idTail = (id: string) => id.slice(-3)
export const maskId = (id: string) => `${id.slice(0, 2)}•••••${id.slice(-3)}`

/** Monthly pay from a staff contract's breakdown. */
export const monthlyPay = (t: { basic: number; housing: number; transport: number; allowances: { amount: number }[] }) =>
  t.basic + t.housing + t.transport + t.allowances.reduce((s, a) => s + a.amount, 0)

/** Labor Law: at most 48 working hours a week. */
export const MAX_WEEK_HOURS = 48
