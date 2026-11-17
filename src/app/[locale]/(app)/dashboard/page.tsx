import { getLocale, getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { bi } from "@/lib/mock/bi"
import { SESSION_USER } from "@/lib/mock/shell"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { DashboardExport } from "@/modules/dashboard/export"
import { AppointmentsWidget, AttentionWidget, BedsWidget, KpiRow, VisitsWidget } from "@/modules/dashboard/widgets"

export async function generateMetadata() {
  const t = await getTranslations("shell.nav")
  return { title: t("dashboard") }
}

/**
 * Dashboard · Home (Dashboard page, 1440 / 768 / 390). One grid, re-ordered per size:
 *  · xl   visits (2/3) + needs attention (1/3), then appointments (2/3) + beds (1/3)
 *  · md–lg visits, appointments (full width), then needs attention + beds side by side
 *  · mobile visits (6 months), needs attention, appointments (list), beds
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard")
  const locale = await getLocale()

  return (
    <PageContainer>
      <PageTitle title={t("title", { name: bi(SESSION_USER.shortName, locale) })} />
      <PageHeader
        actions={
          <>
            <DashboardExport />
            <IfModule id="appointments">
              <Button asChild>
                <Link href="/appointments">
                  <Icon name="add" />
                  {t("newAppointment")}
                </Link>
              </Button>
            </IfModule>
          </>
        }
      />
      <KpiRow />
      <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        <VisitsWidget className="order-1 md:col-span-2" />
        <AttentionWidget className="order-2 md:order-3 xl:order-2" />
        <AppointmentsWidget className="order-3 md:order-2 md:col-span-2 xl:order-3" />
        <BedsWidget className="order-4" />
      </div>
    </PageContainer>
  )
}
