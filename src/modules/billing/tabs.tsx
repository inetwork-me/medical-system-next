"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { usePageTitle } from "@/components/shell/page-title"
import { Link } from "@/i18n/navigation"
import { isTabEnabled } from "@/lib/modules"
import { Button } from "@/components/ui/button"
import { NEW_INVOICE_HREF, newContractHref } from "./href"
import { readyBatch } from "./counts"
import { ClaimsList, ClaimsSummary } from "./claims"
import { FixClaimDialog, SubmitClaimsDialog } from "./claim-dialogs"
import { BillingFrame } from "./frame"
import { ContractsList } from "./contracts"
import { InsurersGrid } from "./insurers"
import { MoneyIn, NeedsAttention, OverviewKpis } from "./overview"
import { SignDialog } from "./sign-dialog"
import { ApproveRefundDialog } from "./refund-approval"
import { InvoicesList } from "./invoices"
import { RecordPaymentDialog } from "./payment-dialog"
import { ExportDialog, type ExportWhat } from "./export-dialog"
import { billCan } from "./roles"
import { useBatchSent, useBillRole, useClaims } from "./store"

/*
 * Billing module tabs. Each tab is its frame (tabs + the header actions the design gives it) and its widgets.
 * Header actions follow the role: Export (billing, finance, signatory), New contract (whoever drafts contracts),
 * Send claims (billing staff).
 */

/** Export (Overview, Invoices, Claims, Contracts): the dialog opens on the current tab's data. */
function ExportButton({ what }: { what: ExportWhat }) {
  const t = useTranslations("billing.actions")
  const [open, setOpen] = React.useState(false)
  if (!billCan(useBillRole(), "export")) return null
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon name="export" size={18} />
        {t("export")}
      </Button>
      {open && <ExportDialog initial={what} onOpenChange={setOpen} />}
    </>
  )
}

/** New invoice (by hand): billing staff and the finance manager. */
function NewInvoiceButton() {
  const t = useTranslations("billing.actions")
  if (!billCan(useBillRole(), "newInvoice")) return null
  return (
    <Button asChild>
      <Link href={NEW_INVOICE_HREF}>
        <Icon name="add" size={18} />
        {t("newInvoice")}
      </Link>
    </Button>
  )
}

function NewContractButton({ label = "newContract" }: { label?: "newContract" | "newAgreement" }) {
  const t = useTranslations("billing.actions")
  const role = useBillRole()
  // New agreement → Insurer; New contract → Partner, or the first type this role drafts (HR: Staff).
  const kind =
    label === "newAgreement"
      ? billCan(role, "draftInsurer") && "insurer"
      : billCan(role, "draftPartner")
        ? "partner"
        : billCan(role, "draftStaff")
          ? "staff"
          : billCan(role, "draftInsurer") && "insurer"
  if (!kind) return null
  if (!isTabEnabled("billing", "contracts")) return null
  return (
    <Button asChild>
      <Link href={newContractHref(kind)}>
        <Icon name="add" size={18} />
        {t(label)}
      </Link>
    </Button>
  )
}

/** Overview (module home): header "Home / Billing and contracts"; Export · New contract. */
export function OverviewTab() {
  const t = useTranslations("billing")
  const tn = useTranslations("shell.nav")
  usePageTitle({ title: t("title"), mobileTitle: true, crumbs: [{ label: tn("home"), href: "/dashboard" }] })
  const [fixing, setFixing] = React.useState<string | null>(null)
  const [signing, setSigning] = React.useState<string | null>(null)
  const [reviewing, setReviewing] = React.useState<string | null>(null)
  return (
    <BillingFrame
      tab="overview"
      actions={
        <>
          <ExportButton what="summary" />
          <NewContractButton />
        </>
      }
    >
      <OverviewKpis />
      {/* Desktop: Money in beside Needs attention; tablet / mobile: Needs attention first (as drawn). */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
        <div className="order-2 xl:order-1">
          <MoneyIn />
        </div>
        <div className="order-1 xl:order-2">
          <NeedsAttention onFix={setFixing} onSign={setSigning} onReview={setReviewing} />
        </div>
      </div>
      {fixing && <FixClaimDialog claimNo={fixing} onOpenChange={(o) => !o && setFixing(null)} />}
      {signing && <SignDialog contractNo={signing} onOpenChange={(o) => !o && setSigning(null)} />}
      {reviewing && <ApproveRefundDialog cnNo={reviewing} onOpenChange={(o) => !o && setReviewing(null)} />}
    </BillingFrame>
  )
}

/** Invoices: header "Billing / Invoices"; Export; the invoice list with Collect → Record payment. */
export function InvoicesTab() {
  const [collecting, setCollecting] = React.useState<string | null>(null)
  return (
    <BillingFrame
      tab="invoices"
      actions={
        <>
          <ExportButton what="invoices" />
          <NewInvoiceButton />
        </>
      }
    >
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
          <ExportButton what="claims" />
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
          <ExportButton what="contracts" />
          <NewContractButton />
        </>
      }
    >
      <ContractsList onSign={setSigning} />
      {signing && <SignDialog contractNo={signing} onOpenChange={(o) => !o && setSigning(null)} />}
    </BillingFrame>
  )
}
