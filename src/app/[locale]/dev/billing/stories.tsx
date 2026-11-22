"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CLAIMS, CONTRACTS, INSURERS, INVOICES, type ClaimStatus, type ContractKind, type ContractStatus, type DocStatus, type InsurerStatus, type InvoiceStatus, type ZatcaStatus } from "@/modules/billing/data"
import { formatMoney } from "@/modules/billing/money"
import { claimCounts, contractCounts, invoiceCounts } from "@/modules/billing/counts"
import { contractStatus, copayFor, docStatus, insurerStatus, invoiceStatus, daysLeft, maskId, signedCount, totals } from "@/modules/billing/rules"
import { BILL_ROLES, billCan, roleTabs, type BillAction } from "@/modules/billing/roles"
import { setBillRole, useBillRole } from "@/modules/billing/store"
import {
  ClaimStatusBadge,
  ContractStatusBadge,
  DocStatusBadge,
  InitialsAvatar,
  InitialsTile,
  InsurerStatusBadge,
  InvoiceStatusBadge,
  KindChip,
  Latin,
  SignatureDots,
  SignerBadge,
  ZatcaLine,
  useB,
} from "@/modules/billing/parts"

function Box({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5", className)}>
      <h2 className="font-mono text-xs text-muted-foreground" dir="ltr">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Check({ ok }: { ok: boolean }) {
  return <span className={cn("font-mono text-xs", ok ? "text-success" : "text-destructive")}>{ok ? "✓" : "✗"}</span>
}

/** The design's printed figures, to check the rules against. */
const DESIGN_INVOICES: Record<string, { total: number; patient: number; status: InvoiceStatus }> = {
  "INV-2611-0241": { total: 833.75, patient: 166.75, status: "part" },
  "INV-2611-0240": { total: 420, patient: 42, status: "paid" },
  "INV-2611-0239": { total: 310.5, patient: 310.5, status: "unpaid" },
  "INV-2611-0238": { total: 575, patient: 57.5, status: "paid" },
  "INV-2611-0237": { total: 240, patient: 240, status: "refunded" },
  "INV-2611-0236": { total: 1150, patient: 230, status: "paid" },
  "INV-2611-0235": { total: 690, patient: 69, status: "unpaid" },
  "INV-2611-0234": { total: 160, patient: 160, status: "paid" },
}

const ACTIONS: BillAction[] = ["viewMoney", "collect", "sendInvoice", "claims", "insurers", "upload", "draftStaff", "draftPartner", "draftInsurer", "sign", "allContracts", "export"]

export function BillingStories() {
  const b = useB()
  const role = useBillRole()

  const inv = invoiceCounts(INVOICES)
  const cl = claimCounts(CLAIMS, false)
  const ct = contractCounts(CONTRACTS)
  const counts: [string, number, number][] = [
    ["Invoices · All", inv.all, 214],
    ["Invoices · Unpaid (tab count)", inv.unpaid, 9],
    ["Invoices · Partly paid", inv.part, 4],
    ["Invoices · Paid", inv.paid, 199],
    ["Invoices · Refunded", inv.refunded, 2],
    ["Unpaid by patients (SAR)", inv.unpaidBalance, 6420],
    ["Claims · Ready", cl.ready, 12],
    ["Claims · Ready (SAR)", cl.readyAmount, 18420],
    ["Claims · In review", cl.review, 31],
    ["Claims · In review (SAR)", cl.reviewAmount, 46900],
    ["Claims · Rejected", cl.rejected, 7],
    ["Claims · To fix (tab count)", cl.toFix, 8],
    ["Claims · Paid (SAR)", cl.paidAmount, 212300],
    ["Contracts · All", ct.all, 64],
    ["Contracts · Staff", ct.staff, 38],
    ["Contracts · Partners", ct.partner, 17],
    ["Contracts · Insurers", ct.insurer, 9],
    ["Contracts · To sign (tab count)", ct.toSign, 4],
    ["Contracts · For you", ct.awaitingYou, 1],
    ["Contracts · Ending", ct.ending, 2],
    ["Contracts · To act on (KPI)", ct.toAct, 6],
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Box title="Money · formatMoney(n, locale, opts)">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-start font-normal">value</th>
              <th className="py-1 text-start font-normal">EN</th>
              <th className="py-1 text-start font-normal">AR</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                [833.75, {}],
                [1150, {}],
                [66.75, { whole: true }],
                [24860, { whole: true }],
                [920, { whole: true }],
                [0, { whole: true }],
              ] as const
            ).map(([n, o], i) => (
              <tr key={i} className="border-t">
                <td className="py-1.5 font-mono text-xs" dir="ltr">
                  {n} {o && "whole" in o ? "whole" : ""}
                </td>
                <td className="py-1.5">{formatMoney(n, "en", o)}</td>
                <td className="py-1.5" dir="rtl">
                  {formatMoney(n, "ar", o)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Box title="Status badges (current language)">
        <div className="flex flex-col gap-3 text-xs text-muted-foreground">
          <Row label="Invoice">
            {(["unpaid", "part", "paid", "refunded"] as InvoiceStatus[]).map((s) => (
              <InvoiceStatusBadge key={s} status={s} />
            ))}
          </Row>
          <Row label="ZATCA">
            {(["reported", "pending", "failed"] as ZatcaStatus[]).map((s) => (
              <ZatcaLine key={s} status={s} />
            ))}
          </Row>
          <Row label="Claim">
            {(["ready", "review", "approved", "part", "rejected", "needsPreauth"] as ClaimStatus[]).map((s) => (
              <ClaimStatusBadge key={s} status={s} />
            ))}
          </Row>
          <Row label="Insurer">
            {(["active", "ending", "awaitingSignature", "ended"] as InsurerStatus[]).map((s) => (
              <InsurerStatusBadge key={s} status={s} days={39} />
            ))}
          </Row>
          <Row label="Contract">
            {(["awaitingYou", "awaitingThem", "draft", "signed", "ending", "ended"] as ContractStatus[]).map((s) => (
              <ContractStatusBadge key={s} status={s} days={39} />
            ))}
          </Row>
          <Row label="Paper">
            {(["valid", "renew", "expired", "checking"] as DocStatus[]).map((s) => (
              <DocStatusBadge key={s} status={s} kind="agreement" validTo="2026-12-31" />
            ))}
            <DocStatusBadge status="valid" kind="networkLetter" />
          </Row>
          <Row label="Signer">
            <SignerBadge signer={{ status: "signed", female: true }} />
            <SignerBadge signer={{ status: "signed" }} />
            <SignerBadge signer={{ status: "waiting" }} yourTurn />
            <SignerBadge signer={{ status: "waiting" }} />
          </Row>
        </div>
      </Box>

      <Box title="Type chip · initials tile · avatar · signature dots">
        <div className="flex flex-wrap items-center gap-3">
          {(["staff", "partner", "insurer"] as ContractKind[]).map((k) => (
            <KindChip key={k} kind={k} />
          ))}
          {INSURERS.map((i) => (
            <InitialsTile key={i.id} initials={i.initials} />
          ))}
          <InitialsTile initials="BU" size={56} />
          <InitialsAvatar initials="AS" />
          <SignatureDots signed={0} total={2} />
          <SignatureDots signed={1} total={2} />
          <SignatureDots signed={2} total={2} />
        </div>
      </Box>

      <Box title="Role (demo) · permissions">
        <div className="flex flex-wrap gap-1.5">
          {BILL_ROLES.map((r) => (
            <Button key={r} size="sm" variant={r === role ? "default" : "outline"} onClick={() => setBillRole(r)}>
              {r}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs" dir="ltr">
          {ACTIONS.map((a) => (
            <span key={a} className={cn("rounded-sm px-1.5 py-0.5 font-mono", billCan(role, a) ? "bg-success-soft text-success-soft-foreground" : "bg-muted text-muted-foreground line-through")}>
              {a}
            </span>
          ))}
        </div>
        <p className="font-mono text-xs text-muted-foreground" dir="ltr">
          tabs: {roleTabs(role).join(" · ")}
        </p>
      </Box>

      <Box title="Invoice rules · totals() / invoiceStatus() vs the design">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-start font-normal">Invoice</th>
              <th className="py-1 text-start font-normal">Total</th>
              <th className="py-1 text-start font-normal">Patient pays</th>
              <th className="py-1 text-start font-normal">Balance</th>
              <th className="py-1 text-start font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((x) => {
              const t = totals(x)
              const d = DESIGN_INVOICES[x.no]
              const s = invoiceStatus(x)
              return (
                <tr key={x.no} className="border-t">
                  <td className="py-1.5">
                    <Latin>{x.no}</Latin>
                  </td>
                  <td className="py-1.5">
                    {formatMoney(t.total, "en")} <Check ok={!d || d.total === t.total} />
                  </td>
                  <td className="py-1.5">
                    {formatMoney(t.patientShare, "en")} <Check ok={!d || d.patient === t.patientShare} />
                  </td>
                  <td className="py-1.5">{formatMoney(t.balance, "en")}</td>
                  <td className="py-1.5">
                    <InvoiceStatusBadge status={s} /> <Check ok={!d || d.status === s} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          Co-pay rule on INV-2611-0241 (Bupa class B, 20% capped SAR 75): {formatMoney(copayFor(INSURERS[0], "B", 833.75), "en")} — the design prints SAR 166.75 (reported gap).
        </p>
      </Box>

      <Box title="Counts · rows + November aggregates vs the design">
        <table className="w-full text-sm">
          <tbody>
            {counts.map(([label, got, want]) => (
              <tr key={label} className="border-t first:border-t-0">
                <td className="py-1 text-xs text-muted-foreground">{label}</td>
                <td className="py-1 text-end font-mono text-xs" dir="ltr">
                  {got} / {want}
                </td>
                <td className="w-6 py-1 text-end">
                  <Check ok={got === want} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Box title="Derived statuses · insurers, papers, contracts" className="lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            {INSURERS.map((i) => (
              <div key={i.id} className="flex items-center gap-2 text-sm">
                <InitialsTile initials={i.initials} />
                <span className="flex-1">{b(i.name)}</span>
                <InsurerStatusBadge status={insurerStatus(i)} days={i.validTo ? daysLeft(i.validTo) : undefined} />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {INSURERS[0].documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{b(d.title)}</span>
                <DocStatusBadge status={docStatus(d)} kind={d.kind} validTo={d.validTo} />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {CONTRACTS.map((c) => (
              <div key={c.no} className="flex items-center gap-2 text-sm">
                <Latin className="w-24 shrink-0 text-xs">{c.no}</Latin>
                <span className="min-w-0 flex-1 truncate">{b(c.party.name)}</span>
                <SignatureDots signed={signedCount(c)} total={c.signers.length} />
                <ContractStatusBadge status={contractStatus(c)} days={daysLeft(c.end)} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Masked ID: <Latin>{maskId("1048213417")}</Latin>
            </p>
          </div>
        </div>
      </Box>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 font-mono" dir="ltr">
        {label}
      </span>
      {children}
    </div>
  )
}
