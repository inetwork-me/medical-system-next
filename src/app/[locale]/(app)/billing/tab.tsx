import { getTranslations } from "next-intl/server"

import { isTabEnabled } from "@/lib/modules"
import { ModuleUnavailable } from "@/components/shell/module-unavailable"

export type BillingTab = "overview" | "invoices" | "claims" | "insurers" | "contracts"

/** Page title: the module ("Billing") for Overview, the tab name for the others. */
export async function billingTitle(tab: BillingTab) {
  if (tab === "overview") return (await getTranslations("billing"))("title")
  return (await getTranslations("shell.tabs.billing"))(tab)
}

/**
 * Tab guard: a tab switched off for the branch ("billing.claims" at a cash-only branch) shows
 * "not available in this branch" on its deep links and its inner pages; the other tabs keep working.
 */
export function TabGuard({ tab, children }: { tab: BillingTab; children: React.ReactNode }) {
  if (!isTabEnabled("billing", tab)) return <ModuleUnavailable id="billing" tab={tab} />
  return children
}
