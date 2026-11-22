"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { usePageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { readyBatch } from "./counts"
import { ClaimsList, ClaimsSummary } from "./claims"
import { FixClaimDialog, SubmitClaimsDialog } from "./claim-dialogs"
import { BillingFrame } from "./frame"
import { ContractsList } from "./contracts"
import { InsurersGrid } from "./insurers"
import { SignDialog } from "./sign-dialog"
import { InvoicesList } from "./invoices"
import { RecordPaymentDialog } from "./payment-dialog"
import { useSoon } from "./parts"
import { billCan } from "./roles"
import { useBatchSent, useBillRole, useClaims } from "./store"

/*
 * Billing module tabs. Each tab is its frame (tabs + the header actions the design gives it) and its widgets.
 * Header actions follow the role: Export (billing, finance, signatory), New contract (whoever drafts contracts),
 * Send claims (billing staff).
 */

function ExportButton() {
  const t = useTranslations("billing.actions")
  const soon = useSoon()
  if (!billCan(useBillRole(), "export")) return null
  return (
    <Button variant="outline" onClick={soon}>
      <Icon name="export" size={18} />
      {t("export")}
    </Button>
  )
}

function NewContractButton({ label = "newContract" }: { label?: "newContract" | "newAgreement" }) {
  const t = useTranslations("billing.actions")
  const soon = useSoon()
  const role = useBillRole()
  if (!(billCan(role, "draftStaff") || billCan(role, "draftPartner") || billCan(role, "draftInsurer"))) return null
  return (
    <Button onClick={soon}>
      <Icon name="add" size={18} />
      {t(label)}
    </Button>
  )
}

/** Overview (module home): header "Home / Billing and contracts"; Export · New contract. */
export function OverviewTab() {
  const t = useTranslations("billing")
  const tn = useTranslations("shell.nav")
  usePageTitle({ title: t("title"), mobileTitle: true, crumbs: [{ label: tn("home"), href: "/dashboard" }] })
  return (
    <BillingFrame
      tab="overview"
      actions={
        <>
          <ExportButton />
          <NewContractButton />
        </>
      }
    />
  )
}

/** Invoices: header "Billing / Invoices"; Export; the invoice list with Collect → Record payment. */
export function InvoicesTab() {
  const [collecting, setCollecting] = React.useState<string | null>(null)
  return (
    <BillingFrame tab="invoices" actions={<ExportButton />}>
      <InvoicesList onCollect={setCollecting} />
      {collecting && <RecordPaymentDialog invoiceNo={collecting} onOpenChange={(o) => !o && setCollecting(null)} />}
    </BillingFrame>
  )
}

/** Claims: header "Billing / Insurance claims"; Export · Send 12 claims; summary tiles + the claims list. */
export function ClaimsTab() {
  const t = useTranslations("billing")
  const tn = useTranslations("shell.nav")
  const role = useBillRole()
  const batch = readyBatch(useClaims(), useBatchSent())
  const [submitting, setSubmitting] = React.useState(false)
  const [fixing, setFixing] = React.useState<string | null>(null)
  usePageTitle({ title: t("claimsTitle"), mobileTitle: true, crumbs: [{ label: tn("billing"), href: "/billing" }] })
  return (
    <BillingFrame
      tab="claims"
      actions={
        <>
          <ExportButton />
          {billCan(role, "claims") && (
            <Button onClick={() => setSubmitting(true)} disabled={batch.count === 0}>
              <Icon name="send-2" size={18} />
              {t("actions.sendClaims", { n: batch.count })}
            </Button>
          )}
        </>
      }
    >
      <ClaimsSummary />
      <ClaimsList onFix={setFixing} />
      {submitting && <SubmitClaimsDialog onOpenChange={setSubmitting} />}
      {fixing && <FixClaimDialog claimNo={fixing} onOpenChange={(o) => !o && setFixing(null)} />}
    </BillingFrame>
  )
}

/** Insurers: header "Billing / Insurers"; New agreement; the insurer card grid. */
export function InsurersTab() {
  return (
    <BillingFrame tab="insurers" actions={<NewContractButton label="newAgreement" />}>
      <InsurersGrid />
    </BillingFrame>
  )
}

/** Contracts: header "Billing / Contracts"; Export · New contract; the contracts list (Sign → Nafath signing). */
export function ContractsTab() {
  const [signing, setSigning] = React.useState<string | null>(null)
  return (
    <BillingFrame
      tab="contracts"
      actions={
        <>
          <ExportButton />
          <NewContractButton />
        </>
      }
    >
      <ContractsList onSign={setSigning} />
      {signing && <SignDialog contractNo={signing} onOpenChange={(o) => !o && setSigning(null)} />}
    </BillingFrame>
  )
}
