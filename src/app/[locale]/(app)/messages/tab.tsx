import { getTranslations } from "next-intl/server"

import { isTabEnabled } from "@/lib/modules"
import { ModuleUnavailable } from "@/components/shell/module-unavailable"
import type { MsgTab } from "@/modules/messages/roles"

const TITLE = { chat: "chat", patients: "patients", partners: "partners", templates: "templates", accounts: "accounts" } as const

/** Page title: the module ("Messages") for Inbox, the tab's title for the others. */
export async function messagesTitle(tab: MsgTab) {
  const t = await getTranslations("messages")
  return tab === "inbox" ? t("title") : t(`titles.${TITLE[tab]}`)
}

/**
 * Tab guard: a tab switched off for the branch ("messages.patients") shows "not available in this branch" on its deep links
 * and its inner pages; the other tabs keep working.
 */
export function TabGuard({ tab, children }: { tab: MsgTab; children: React.ReactNode }) {
  if (!isTabEnabled("messages", tab)) return <ModuleUnavailable id="messages" tab={tab} />
  return children
}
