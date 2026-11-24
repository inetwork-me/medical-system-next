import { getTranslations } from "next-intl/server"

import { isTabEnabled } from "@/lib/modules"
import { ModuleUnavailable } from "@/components/shell/module-unavailable"

export type ReportsTab = "overview" | "operations" | "finance" | "clinical" | "doctors" | "library" | "schedules" | "returns"

/** Page title: the module ("Reports") for Overview, the tab name for the others. */
export async function reportsTitle(tab: ReportsTab) {
  if (tab === "overview") return (await getTranslations("reports"))("title")
  return (await getTranslations("shell.tabs.reports"))(tab)
}

/**
 * Tab guard: a tab switched off for the branch ("reports.returns") shows "not available in this branch" on its deep
 * links and its inner pages; the other tabs keep working.
 */
export function TabGuard({ tab, children }: { tab: ReportsTab; children: React.ReactNode }) {
  if (!isTabEnabled("reports", tab)) return <ModuleUnavailable id="reports" tab={tab} />
  return children
}
