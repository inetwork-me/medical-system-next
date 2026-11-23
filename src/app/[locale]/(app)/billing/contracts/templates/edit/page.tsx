import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { setLocaleFrom } from "@/i18n/set-locale"

import { TemplateEditorPage } from "@/modules/billing/template-editor"
import { TabGuard } from "../../../tab"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("billing.templateEditor"))("mobileTitle") }
}

/** Billing · Template editor (`?id=staff-doctors&v=5`); part of the Contracts tab (off with it). */
export default async function BillingTemplateEditorPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return (
    <TabGuard tab="contracts">
      <Suspense>
        <TemplateEditorPage />
      </Suspense>
    </TabGuard>
  )
}
