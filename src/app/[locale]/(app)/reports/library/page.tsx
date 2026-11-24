import { setLocaleFrom } from "@/i18n/set-locale"

import { LibraryTab } from "@/modules/reports/tabs"
import { TabGuard, reportsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await reportsTitle("library") }
}

/** Reports · Library. */
export default async function ReportsLibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="library">
      <LibraryTab />
    </TabGuard>
  )
}
