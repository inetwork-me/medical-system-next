"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { usePageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { BuildingCard, ReportsFrame } from "./frame"
import { FiltersBar } from "./filters"
import { AreaCards, ComingUp, Favourites, OverviewKpis } from "./overview"
import { ClinicalDashboard, DoctorsDashboard, FinanceDashboard, OperationsDashboard } from "./dashboards"
import { ExportDialog, useDashboardExport, useOverviewExport, type ExportContent } from "./export-dialog"
import { ScheduleDialog } from "./schedule-dialog"
import { LibraryList } from "./library-list"
import { SchedulesList } from "./schedules"
import { ReturnsList } from "./returns"
import { repCan } from "./roles"
import { useRepRole } from "./store"
import { builderHref } from "./href"

/*
 * Reports module tabs. Each tab is its frame (tabs + the header actions the design gives it) and its widgets.
 * Header actions: Overview — Export · New report; dashboards — Schedule · Export; Library — New report;
 * Schedules — New schedule.
 */

function ExportButton({ content, primary }: { content: ExportContent; primary?: boolean }) {
  const t = useTranslations("reports.actions")
  const [open, setOpen] = React.useState(false)
  if (!repCan(useRepRole(), "export")) return null
  return (
    <>
      <Button variant={primary ? "default" : "outline"} onClick={() => setOpen(true)}>
        <Icon name="export" size={18} />
        {t("export")}
      </Button>
      {open && <ExportDialog content={content} onOpenChange={setOpen} />}
    </>
  )
}

function NewReportButton() {
  const t = useTranslations("reports.actions")
  if (!repCan(useRepRole(), "build")) return null
  return (
    <Button asChild>
      <Link href={builderHref()}>
        <Icon name="add" size={18} />
        {t("newReport")}
      </Link>
    </Button>
  )
}

const AREA_NAME: Record<string, { en: string; ar: string }> = {
  operations: { en: "Operations dashboard", ar: "لوحة التشغيل" },
  finance: { en: "Finance dashboard", ar: "لوحة المالية" },
  clinical: { en: "Clinical dashboard", ar: "اللوحة السريرية" },
  doctors: { en: "Doctors dashboard", ar: "لوحة الأطباء" },
}

function ScheduleButton({ area }: { area: string }) {
  const t = useTranslations("reports.actions")
  const [open, setOpen] = React.useState(false)
  if (!repCan(useRepRole(), "schedule")) return null
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Icon name="calendar-2" size={18} />
        {t("schedule")}
      </Button>
      {open && <ScheduleDialog target={`dash:${area}`} targetName={AREA_NAME[area]} onOpenChange={setOpen} />}
    </>
  )
}

/** Overview (module home): header "Home / Reports"; Export · New report. */
export function OverviewTab() {
  const t = useTranslations("reports")
  const tn = useTranslations("shell.nav")
  const overviewExport = useOverviewExport()
  usePageTitle({ title: t("title"), mobileTitle: true, crumbs: [{ label: tn("home"), href: "/dashboard" }] })
  return (
    <ReportsFrame
      tab="overview"
      actions={
        <>
          <ExportButton content={overviewExport} />
          <NewReportButton />
        </>
      }
    >
      <OverviewKpis />
      {/* Desktop: areas beside Your favourites + Coming up; tablet / mobile: areas, then Coming up, then favourites. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
        <AreaCards />
        <div className="flex flex-col gap-4 xl:gap-6">
          <div className="order-2 xl:order-1">
            <Favourites />
          </div>
          <div className="order-1 xl:order-2">
            <ComingUp />
          </div>
        </div>
      </div>
    </ReportsFrame>
  )
}

/** A dashboard tab (Operations, Finance, Clinical, Doctors): header "Reports / {tab}"; Schedule · Export; filters bar,
 * KPIs, the charts row and the table. */
export function DashboardTab({ tab }: { tab: "operations" | "finance" | "clinical" | "doctors" }) {
  const content = useDashboardExport(tab)
  return (
    <ReportsFrame
      tab={tab}
      actions={
        <>
          <ScheduleButton area={tab} />
          <ExportButton content={content} primary />
        </>
      }
    >
      <FiltersBar scope={tab} />
      {tab === "operations" && <OperationsDashboard />}
      {tab === "finance" && <FinanceDashboard />}
      {tab === "clinical" && <ClinicalDashboard />}
      {tab === "doctors" && <DoctorsDashboard />}
    </ReportsFrame>
  )
}

/** Library: header "Reports" over "Report library" (as drawn); New report. */
export function LibraryTab() {
  const t = useTranslations("reports.library")
  const tn = useTranslations("shell.nav")
  usePageTitle({ title: t("title"), mobileTitle: true, crumbs: [{ label: tn("reports"), href: "/reports" }] })
  return (
    <ReportsFrame tab="library" actions={<NewReportButton />}>
      <LibraryList />
    </ReportsFrame>
  )
}

/** Schedules: header "Reports" over "Scheduled reports"; New schedule (the dialog asks which report). */
export function SchedulesTab() {
  const t = useTranslations("reports.actions")
  const ts = useTranslations("reports.schedules")
  const tn = useTranslations("shell.nav")
  const [open, setOpen] = React.useState(false)
  usePageTitle({ title: ts("title"), mobileTitle: true, crumbs: [{ label: tn("reports"), href: "/reports" }] })
  return (
    <ReportsFrame
      tab="schedules"
      actions={
        repCan(useRepRole(), "schedule") && (
          <Button onClick={() => setOpen(true)}>
            <Icon name="add" size={18} />
            {t("newSchedule")}
          </Button>
        )
      }
    >
      <SchedulesList />
      {open && <ScheduleDialog onOpenChange={setOpen} />}
    </ReportsFrame>
  )
}

/** Official returns: header "Reports" over "Official returns"; the list. */
export function ReturnsTab() {
  return (
    <ReportsFrame tab="returns">
      <ReturnsList />
    </ReportsFrame>
  )
}

/** Inner pages not built yet (Report, Report builder, Return): their tab's frame with the step that builds them. */
export function InnerPlaceholder({ tab, step }: { tab: string; step: number }) {
  return (
    <ReportsFrame tab={tab}>
      <BuildingCard step={step} />
    </ReportsFrame>
  )
}
