import { getTranslations } from "next-intl/server"

import { isTabEnabled } from "@/lib/modules"
import { ModuleUnavailable } from "@/components/shell/module-unavailable"

export type RecordsTab = "overview" | "visits" | "notes" | "documents" | "requests" | "completion" | "access"

/** Page title: the module ("Medical records") for Overview, the tab's page title for the others. */
export async function recordsTitle(tab: RecordsTab) {
  const t = await getTranslations("records")
  if (tab === "overview") return t("title")
  if (tab === "requests") return t("requestsTitle")
  if (tab === "access") return t("accessTitle")
  return (await getTranslations("shell.tabs.records"))(tab)
}

/**
 * Tab guard: a tab switched off for the branch ("records.access") shows "not available in this branch" on its deep
 * links and its inner pages; the other tabs keep working.
 */
export function TabGuard({ tab, children }: { tab: RecordsTab; children: React.ReactNode }) {
  if (!isTabEnabled("records", tab)) return <ModuleUnavailable id="records" tab={tab} />
  return children
}
