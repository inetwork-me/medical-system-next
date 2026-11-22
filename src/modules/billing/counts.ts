import {
  OTHER_CLAIMS,
  OTHER_CONTRACTS,
  OTHER_INVOICES,
  OTHER_UNPAID,
  insurerOf,
  type Claim,
  type ClaimStatus,
  type Contract,
  type ContractKind,
  type Invoice,
  type InvoiceStatus,
} from "./data"
import { round2 } from "./money"
import { contractStatus, heldBack, invoiceStatus, toFix, toSign, totals } from "./rules"

/*
 * Module counts: the design's rows (with this session's changes) plus the aggregates for the rest of November,
 * so tabs, filters, tiles and KPIs agree with each other and move when a row changes.
 */

export function invoiceCounts(invoices: Invoice[]) {
  const by: Record<InvoiceStatus, number> = { ...OTHER_INVOICES }
  let unpaidBalance = OTHER_UNPAID.balance
  for (const inv of invoices) {
    const s = invoiceStatus(inv)
    by[s]++
    if (s === "unpaid") unpaidBalance += totals(inv).balance
  }
  const all = by.unpaid + by.part + by.paid + by.refunded
  return { all, ...by, unpaidBalance: round2(unpaidBalance), over30: OTHER_UNPAID.over30 }
}

export function claimCounts(claims: Claim[], batchSent: boolean) {
  const by: Record<ClaimStatus, number> = { ready: 0, review: 0, approved: OTHER_CLAIMS.approved, part: OTHER_CLAIMS.part, rejected: OTHER_CLAIMS.rejected, needsPreauth: OTHER_CLAIMS.needsPreauth }
  let readyAmount = 0
  let reviewAmount = OTHER_CLAIMS.review.amount
  by.review += OTHER_CLAIMS.review.count
  for (const r of OTHER_CLAIMS.ready) {
    if (batchSent) {
      by.review += r.count
      reviewAmount += r.amount
    } else {
      by.ready += r.count
      readyAmount += r.amount
    }
  }
  for (const c of claims) {
    by[c.status]++
    if (c.status === "ready") readyAmount += c.amount
    if (c.status === "review") reviewAmount += c.amount
  }
  return {
    ...by,
    toFix: claims.filter(toFix).length + OTHER_CLAIMS.rejected + OTHER_CLAIMS.needsPreauth,
    readyAmount: round2(readyAmount),
    reviewAmount: round2(reviewAmount),
    /** Paid this month = the aggregate plus the sample claims already paid. */
    paidAmount: round2(OTHER_CLAIMS.paidAmount + claims.filter((c) => c.paidAt).reduce((s, c) => s + (c.approvedAmount ?? c.amount), 0)),
    answerDays: OTHER_CLAIMS.answerDays,
    rejectedPct: OTHER_CLAIMS.rejectedPct,
  }
}

export function contractCounts(contracts: Contract[]) {
  const kind: Record<ContractKind, number> = { staff: OTHER_CONTRACTS.staff, partner: OTHER_CONTRACTS.partner, insurer: OTHER_CONTRACTS.insurer }
  let awaitingYou = OTHER_CONTRACTS.awaitingYou
  let awaitingThem = OTHER_CONTRACTS.awaitingThem
  let ending = OTHER_CONTRACTS.ending
  for (const c of contracts) {
    kind[c.kind]++
    const s = contractStatus(c)
    if (s === "awaitingYou") awaitingYou++
    if (s === "awaitingThem") awaitingThem++
    if (s === "ending") ending++
  }
  const sign = awaitingYou + awaitingThem
  return { all: kind.staff + kind.partner + kind.insurer, ...kind, toSign: sign, awaitingYou, awaitingThem, ending, toAct: sign + ending }
}

export const inSign = (c: Contract) => toSign(contractStatus(c))

/**
 * Submit claims: the batch per insurer (this month's other ready claims + the ready rows not held back) and the
 * held-back claims (needs pre-auth, or a ready claim the insurer's rule says needs one).
 */
export function readyBatch(claims: Claim[], batchSent: boolean) {
  const by = new Map<string, { insurer: string; count: number; amount: number }>()
  const add = (insurer: string, count: number, amount: number) => {
    const cur = by.get(insurer) ?? { insurer, count: 0, amount: 0 }
    by.set(insurer, { insurer, count: cur.count + count, amount: round2(cur.amount + amount) })
  }
  if (!batchSent) for (const r of OTHER_CLAIMS.ready) add(r.insurer, r.count, r.amount)
  const held = claims.filter((c) => heldBack(c, insurerOf(c.insurer)))
  const rows = claims.filter((c) => c.status === "ready" && !held.includes(c))
  for (const c of rows) add(c.insurer, 1, c.amount)
  const groups = [...by.values()].filter((g) => g.count > 0)
  return { groups, rows, held, count: groups.reduce((s, g) => s + g.count, 0), amount: round2(groups.reduce((s, g) => s + g.amount, 0)) }
}
