import { setLocaleFrom } from "@/i18n/set-locale"
import { getLocale, getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { bi } from "@/lib/mock/bi"
import { SESSION_USER } from "@/lib/mock/shell"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { DashboardExport } from "@/modules/dashboard/export"
import { AppointmentsWidget, AttentionWidget, BedsWidget, KpiRow, VisitsWidget } from "@/modules/dashboard/widgets"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  const t = await getTranslations("shell.nav")
  return { title: t("dashboard") }
}

/**
 * Dashboard · Home (Dashboard page, 1440 / 768 / 390). One grid, re-ordered per size:
 *  · xl   visits (2/3) + needs attention (1/3), then appointments (2/3) + beds (1/3)
 *  · md–lg visits, appointments (full width), then needs attention + beds side by side
 *  · mobile visits (6 months), needs attention, appointments (list), beds
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  const t = await getTranslations("dashboard")
  const locale = await getLocale()

  return (
    <PageContainer>
      {/* Dashboard only: the greeting sits in the page, beside Export / New appointment — the top bar stays empty. */}
      <PageTitle title="" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-foreground">{t("title", { name: bi(SESSION_USER.shortName, locale) })}</h1>
        <div className="flex gap-2 *:data-[slot=button]:h-10 *:data-[slot=button]:flex-1 *:data-[slot=button]:px-6 md:*:data-[slot=button]:h-9 md:*:data-[slot=button]:flex-none md:*:data-[slot=button]:px-4">
          <DashboardExport />
          <IfModule id="appointments">
            <Button asChild>
              <Link href="/appointments/new">
                <Icon name="add" />
                {t("newAppointment")}
              </Link>
            </Button>
          </IfModule>
        </div>
      </div>
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
