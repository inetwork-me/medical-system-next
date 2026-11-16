import { getTranslations } from "next-intl/server"

import { EmptyState } from "@/components/ds/states"
import { PageContainer } from "@/components/shell/page"

/** Placeholder until this Patients screen is built (next slices of the Patients module). */
export default async function Page() {
  const t = await getTranslations("shell")
  return (
    <PageContainer>
      <div className="rounded-xl border bg-card">
        <EmptyState icon="profile-2user" title={t("placeholder.title", { module: t("nav.patients") })} description={t("placeholder.description")} className="py-16" />
      </div>
    </PageContainer>
  )
}
