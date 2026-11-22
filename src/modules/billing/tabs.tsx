"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { usePageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { claimCounts } from "./counts"
import { BillingFrame } from "./frame"
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

/** Invoices: header "Billing / Invoices"; Export. */
export function InvoicesTab() {
  return <BillingFrame tab="invoices" actions={<ExportButton />} />
}

/** Claims: header "Billing / Insurance claims"; Export · Send 12 claims. */
export function ClaimsTab() {
  const t = useTranslations("billing")
  const tn = useTranslations("shell.nav")
  const role = useBillRole()
  const ready = claimCounts(useClaims(), useBatchSent()).ready
  const soon = useSoon()
  usePageTitle({ title: t("claimsTitle"), mobileTitle: true, crumbs: [{ label: tn("billing"), href: "/billing" }] })
  return (
    <BillingFrame
      tab="claims"
      actions={
        <>
          <ExportButton />
          {billCan(role, "claims") && (
            <Button onClick={soon} disabled={ready === 0}>
              <Icon name="send-2" size={18} />
              {t("actions.sendClaims", { n: ready })}
            </Button>
          )}
        </>
      }
    />
  )
}

/** Insurers: header "Billing / Insurers"; New agreement. */
export function InsurersTab() {
  return <BillingFrame tab="insurers" actions={<NewContractButton label="newAgreement" />} />
}

/** Contracts: header "Billing / Contracts"; Export · New contract. */
export function ContractsTab() {
  return (
    <BillingFrame
      tab="contracts"
      actions={
        <>
          <ExportButton />
          <NewContractButton />
        </>
      }
    />
  )
}
