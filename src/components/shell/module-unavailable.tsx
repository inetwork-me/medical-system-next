import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { moduleById, type ModuleId } from "@/config/modules"
import { moduleHome } from "@/lib/modules"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ds/states"
import { PageContainer } from "@/components/shell/page"

/**
 * DS sheet 08 (module pages): when a module — or one of its tabs — is hidden for the branch, its deep links show a
 * calm "not available in this branch" state instead of a 404. A hidden tab links back to the module's home.
 */
export async function ModuleUnavailable({ id, tab }: { id: ModuleId; tab?: string }) {
  const t = await getTranslations("shell")
  const m = moduleById(id)
  const name = tab ? t(`tabs.${id}.${tab}` as "tabs.lab.samples") : t(`nav.${m.labelKey}` as "nav.lab")
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
              <Link href={tab ? moduleHome(m) : "/dashboard"}>{tab ? t("unavailable.module", { module: t(`nav.${m.labelKey}` as "nav.lab") }) : t("unavailable.home")}</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  )
}
