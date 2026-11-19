import { setLocaleFrom } from "@/i18n/set-locale"
import { getTranslations } from "next-intl/server"

import { EmptyState } from "@/components/ds/states"
import { PageContainer } from "@/components/shell/page"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  return { title: (await getTranslations("shell.nav"))("lab") }
}

/** Lab · Worklist — built in step 2 (data model and helpers come first: modules/labs, /dev/lab). */
export default async function LabPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  const t = await getTranslations("shell")
  return (
    <PageContainer>
      <div className="rounded-xl border bg-card">
        <EmptyState icon="glass" title={t("placeholder.title", { module: t("nav.lab") })} className="py-16" />
      </div>
    </PageContainer>
  )
}
