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
  type InvoiceEvent,
  type Payment,
  type PayMethod,
  type Signer,
  type ContractEvent,
} from "./data"
import { round2 } from "./money"
import { currentUserId } from "./session"

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
  /** The co-pay hit its per-visit cap (the insurer pays the rest). */
  capped: boolean
}

export function totals(inv: Invoice): InvoiceTotals {
  const subtotal = round2(inv.lines.reduce((s, l) => s + lineNet(l), 0))
  const vat = round2(inv.lines.reduce((s, l) => s + lineVat(l), 0))
  const total = round2(subtotal + vat)
  // Co-pay as issued: a percentage of the total, capped per visit when the class has a cap; the insurer pays the rest.
  const patientShare = inv.payer === "cash" ? total : round2(Math.min((total * inv.copay.pct) / 100, inv.copay.cap ?? Infinity))
  const insurerShare = round2(total - patientShare)
  const paid = round2(inv.payments.reduce((s, p) => s + p.amount, 0))
  const rates = [...new Set(inv.lines.map((l) => l.vatRate))]
  return { subtotal, vat, total, insurerShare, patientShare, paid, balance: round2(Math.max(0, patientShare - paid)), vatRate: rates.length === 1 ? rates[0] : null, capped: inv.payer !== "cash" && inv.copay.cap != null && patientShare === inv.copay.cap }
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
 * covers. Used when an invoice is created from a visit; the invoice stores the rule it was issued with (`copay`).
 */
export function copayRuleFor(ins: Pick<Insurer, "copay">, cls: InsurerClass | undefined): { pct: number; cap?: number } {
  const capped = ins.copay.capPerVisit != null && cls != null && ins.copay.classes.includes(cls)
  return capped ? { pct: ins.copay.pct, cap: ins.copay.capPerVisit } : { pct: ins.copay.pct }
}

export function copayFor(ins: Pick<Insurer, "copay">, cls: InsurerClass | undefined, total: number) {
  const r = copayRuleFor(ins, cls)
  return round2(Math.min((total * r.pct) / 100, r.cap ?? Infinity))
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
 * Draft until sent; then waiting for the next signer in order (the signed-in user → "Waiting for you", anyone else
 * → "Waiting for them"); once all signed: Signed → Ends in N days (60) → Ended.
 */
export function contractStatus(c: Pick<Contract, "sent" | "signers" | "end">, today = BILL_TODAY, me: string | undefined = currentUserId()): ContractStatus {
  if (!c.sent) return "draft"
  const next = nextSigner(c)
  // "Waiting for you" only when the next signer is the signed-in user; anyone else's turn is "Waiting for them".
  if (next) return next.side === "center" && next.userId != null && next.userId === me ? "awaitingYou" : "awaitingThem"
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

/* ------------------------------------------------------------------ payments */

export type PaymentError = "amount" | "overBalance" | "approval" | "closed"

/** Card methods go through a card machine (terminal + slip approval code); cash and transfers don't. */
export const usesTerminal = (m: PayMethod) => m === "mada" || m === "card" || m === "applepay"

/** Check a payment before saving it. Amounts above the balance are refused (refunds need a credit note). */
export function paymentError(inv: Invoice, p: Pick<Payment, "amount" | "method" | "approvalCode">): PaymentError | null {
  if (!canCollect(inv)) return "closed"
  if (!(p.amount > 0)) return "amount"
  if (round2(p.amount) > totals(inv).balance) return "overBalance"
  // The approval code is optional (design: no asterisk); when given it's the slip's 6 digits.
  if (usesTerminal(p.method) && p.approvalCode && !/^\d{6}$/.test(p.approvalCode)) return "approval"
  return null
}

/** Record a payment: appended to the issued invoice (lines and totals never change), with a history event. */
export function recordPayment(inv: Invoice, p: Payment): Invoice {
  const amount = round2(p.amount)
  const event: InvoiceEvent = { at: p.at, kind: "paid", paid: { amount, method: p.method, byName: p.byName } }
  return { ...inv, payments: [...inv.payments, { ...p, amount }], events: [...inv.events, event] }
}

/** Send to patient: SMS + email to the guardian (children) or the patient; logged in the history. */
export function sendInvoice(inv: Invoice, to: "guardian" | "patient", at: string): Invoice {
  return { ...inv, events: [...inv.events, { at, kind: "sent", sent: { to } }] }
}

/* ------------------------------------------------------------------ claims flow */

/** Ready claims that still need a pre-auth under their insurer's rule are held back from the batch too. */
export function heldBack(c: Claim, ins: Pick<Insurer, "preauthRule"> | undefined) {
  if (c.status === "needsPreauth") return true
  return c.status === "ready" && !!ins && !c.preauthNo && needsPreauth(ins, c.amount)
}

/** Send a batch: each ready claim goes to NPHIES and waits for the insurer (In review). */
export const submitClaim = (c: Claim, at: string): Claim => ({ ...c, status: "review", submittedAt: at })

/** Fix & resend: the pre-auth no., the approval letter and a note go back with the claim; it's In review again. */
export function resendClaim(c: Claim, fix: { preauthNo: string; attachments: Claim["attachments"]; note?: string }, at: string): Claim {
  return { ...c, status: "review", preauthNo: fix.preauthNo.trim(), attachments: fix.attachments, note: fix.note?.trim() || undefined, resentAt: at, submittedAt: at }
}

/** Ask for approval: a pre-auth request goes to the insurer; the claim stays held back until it answers. */
export const askPreauth = (c: Claim, at: string): Claim => ({ ...c, preauthRequestedAt: at })

/* ------------------------------------------------------------------ signing */

export type SignRefusal = "notSent" | "locked" | "notYourTurn"

/** Only the next signer in order may sign; a draft or a locked document can't be signed. */
export function canSignNow(c: Pick<Contract, "sent" | "locked" | "signers">, signer: Pick<Signer, "order" | "userId" | "side">, me: string | undefined = currentUserId()): SignRefusal | null {
  if (!c.sent) return "notSent"
  if (c.locked) return "locked"
  if (nextSigner(c)?.order !== signer.order) return "notYourTurn"
  // A center signature can only be given by that user, signed in as themselves.
  return signer.side === "center" && signer.userId !== me ? "notYourTurn" : null
}

/**
 * Record a Nafath signature on the next signer: time, Nafath transaction id and the signed PDF's hash are stored with
 * the (stored, never shown) national ID. After the last signature the document locks; the caller sends the copies and
 * files it with the party (HR file for staff, the partner / insurer record for companies) — logged as events.
 */
export function signContract(c: Contract, order: number, proof: { at: string; nafathTxn: string; pdfHash: string }): Contract {
  const who = c.signers.find((s) => s.order === order)?.name
  const signers = c.signers.map((s) => (s.order === order ? { ...s, status: "signed" as const, signedAt: proof.at, nafathTxn: proof.nafathTxn, pdfHash: proof.pdfHash } : s))
  const done = signers.every((s) => s.status === "signed")
  const day = proof.at.slice(0, 10)
  const events: ContractEvent[] = [...c.events, { at: day, kind: "signed", who }]
  if (done) events.push({ at: day, kind: "locked" }, { at: day, kind: "copies", who: c.party.short ?? c.party.name }, { at: day, kind: "filed" })
  return { ...c, signers, locked: done, events }
}

/** A stand-in for the signed PDF's SHA-256 (the real one hashes the rendered document). */
export function pdfHashOf(c: Pick<Contract, "no" | "version">, at: string) {
  let h = 2166136261
  for (const ch of `${c.no}|${c.version}|${at}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return `sha256:${(h >>> 0).toString(16).padStart(8, "0")}${c.no.replace(/\D/g, "")}`
}
