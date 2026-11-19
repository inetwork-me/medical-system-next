import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { moduleById, type ModuleId } from "@/config/modules"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ds/states"
import { PageContainer } from "@/components/shell/page"

/**
 * DS sheet 08 (module pages): when a module is hidden for the branch, its deep links show a calm
 * "not available in this branch" state instead of a 404.
 */
export async function ModuleUnavailable({ id }: { id: ModuleId }) {
  const t = await getTranslations("shell")
  const m = moduleById(id)
  const name = t(`nav.${m.labelKey}` as "nav.lab")
  return (
    <PageContainer>
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={m.icon}
          title={t("unavailable.title", { module: name })}
          description={t("unavailable.description")}
          className="py-16"
          actions={
            <Button asChild variant="outline">
              <Link href="/dashboard">{t("unavailable.home")}</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  )
}
