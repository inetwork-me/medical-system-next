import { Suspense } from "react"
import { setLocaleFrom } from "@/i18n/set-locale"

import { VisitsTab } from "@/modules/records/tabs"
import { TabGuard, recordsTitle } from "../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: await recordsTitle("visits") }
}

/** Medical records · Visits (`?filter=today|here|open|month`). */
export default async function RecordsVisitsPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="visits">
      <Suspense>
        <VisitsTab />
      </Suspense>
    </TabGuard>
  )
}
