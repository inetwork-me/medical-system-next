import { getLocale, getTranslations } from "next-intl/server"

import { IfModule } from "@/lib/modules"
import { bi } from "@/lib/mock/bi"
import { SESSION_USER } from "@/lib/mock/shell"
import { Icon } from "@/components/ds/icon"
import { SkeletonCard } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageContainer, PageHeader } from "@/components/shell/page"

export async function generateMetadata() {
  const t = await getTranslations("shell.nav")
  return { title: t("dashboard") }
}

/** Dashboard · Home — header now; widgets (KPIs, visits chart, needs attention, appointments, beds) in step 5. */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard")
  const locale = await getLocale()

  return (
    <PageContainer>
      <PageHeader
        title={t("title", { name: bi(SESSION_USER.shortName, locale) })}
        description={t("description")}
        actions={
          <>
            <Button variant="outline">
              <Icon name="export" size={20} />
              {t("export")}
            </Button>
            <IfModule id="appointments">
              <Button>
                <Icon name="add" />
                {t("newAppointment")}
              </Button>
            </IfModule>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </PageContainer>
  )
}
