"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/ds/states"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { invoiceCounts, claimCounts, contractCounts } from "./counts"
import { roleTabs } from "./roles"
import { useBatchSent, useBillRole, useClaims, useContracts, useInvoices } from "./store"

/** Tab counts (brief §2): unpaid invoices · claims to fix · contracts to sign. */
export function useTabCounts() {
  const inv = invoiceCounts(useInvoices())
  const cl = claimCounts(useClaims(), useBatchSent())
  const ct = contractCounts(useContracts())
  return { invoices: inv.unpaid, claims: cl.toFix, contracts: ct.toSign }
}

/**
 * Billing module frame (every module tab): tabs Overview · Invoices 9 · Claims 8 · Insurers · Contracts 4 with the
 * tab's actions at the end of the row (md–lg: under the tabs). Mobile: the tabs (scrolling, no counts), then the
 * actions as equal full-width buttons. Tabs the signed-in role can't open are hidden and show a "no access" state.
 */
export function BillingFrame({ tab, actions, children }: { tab: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  const t = useTranslations("billing.frame")
  const counts = useTabCounts()
  const role = useBillRole()
  const allowed = roleTabs(role)
  const ok = allowed.includes(tab)
  return (
    <PageContainer>
      <PageHeader mobileTabsFirst tabs={<ModuleTabsNav module="billing" only={allowed} counts={counts} />} actions={ok ? actions : undefined} />
      {ok ? (
        children
      ) : (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="lock" title={t("noAccess")} description={t("noAccessText")} className="py-16" />
        </div>
      )}
    </PageContainer>
  )
}
