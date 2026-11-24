"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/ds/states"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { useOpenReturns } from "./returns"
import { repTabs } from "./roles"
import { useLibrary, useRepRole, useSchedules } from "./store"

/** Tab counts (design): saved reports · schedules · official returns still to submit. */
export function useTabCounts() {
  const library = useLibrary()
  const schedules = useSchedules()
  const returns = useOpenReturns()
  return { library: library.length || undefined, schedules: schedules.length || undefined, returns: returns || undefined }
}

/**
 * Reports frame (every module tab): tabs Overview · Operations · Finance · Clinical · Doctors · Library 42 · Schedules 6 ·
 * Official returns 2 with the tab's actions at the end of the row (md–lg: under the tabs). Mobile: the tabs (scrolling,
 * no counts), then the actions as equal full-width buttons. Tabs the role can't open are hidden and show "no access".
 */
export function ReportsFrame({ tab, actions, children }: { tab: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  const t = useTranslations("reports.frame")
  const allowed = repTabs(useRepRole())
  const ok = allowed.includes(tab)
  return (
    <PageContainer>
      <PageHeader mobileTabsFirst tabs={<ModuleTabsNav module="reports" only={allowed} counts={useTabCounts()} />} actions={ok ? actions : undefined} />
      {ok ? (
        children
      ) : (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="lock" title={t("noAccess")} description={t("noAccessText")} className="py-16" />
        </div>
      )}
    </PageContainer>
  )
}

/** Placeholder body for the screens that land in a later build step. */
export function BuildingCard({ step }: { step: number }) {
  const t = useTranslations("reports.frame")
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState icon="chart-2" title={t("building")} description={t("buildingText", { n: step })} className="py-16" />
    </div>
  )
}
