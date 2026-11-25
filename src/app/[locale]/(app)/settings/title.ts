import { getTranslations } from "next-intl/server"

import type { InnerPage, SectionId } from "@/modules/settings/sections"

/** Document title: the section's page title ("Modules per branch", "Plan and subscription" …). */
export async function settingsTitle(id: SectionId | InnerPage) {
  const t = await getTranslations("settings")
  return t(`pageTitles.${id}`)
}
