"use client"

import * as React from "react"

import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { dayCounts } from "./counts"
import { useLabOrders } from "./store"

/**
 * Lab module frame (every module tab): tabs Worklist · 64, Samples · 12, Results · 9, Test catalog, Reports, with the
 * tab's actions at the end of the row. Mobile: the tabs (scrolling), then the actions as equal full-width buttons.
 */
export function LabFrame({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) {
  const c = dayCounts(useLabOrders())
  return (
    <PageContainer>
      <PageHeader mobileTabsFirst tabs={<ModuleTabsNav module="lab" counts={{ worklist: c.all, samples: c.collect, results: c.validate }} />} actions={actions} />
      {children}
    </PageContainer>
  )
}
