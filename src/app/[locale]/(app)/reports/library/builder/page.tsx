import { Suspense } from "react"

import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"
import { BuilderPage } from "@/modules/reports/builder"
import { TabGuard } from "../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("reports.builder"))("newTitle") }
}

/** Reports · Report builder (inner page of Library; `?id=` edits a saved report). */
export default async function ReportsBuilderPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="library">
      <Suspense>
        <BuilderPage />
      </Suspense>
    </TabGuard>
  )
}
