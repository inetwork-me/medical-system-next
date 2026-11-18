"use client"

import * as React from "react"

import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { useClinics } from "./store"

/**
 * Clinics module frame (every module tab): tabs Clinics · n, Services & prices, Rooms, Reports, with the tab's actions
 * at the end of the row (Header v2). Mobile: the tabs, then the actions as equal full-width buttons.
 */
export function ClinicsFrame({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) {
  const count = useClinics().length
  return (
    <PageContainer>
      <PageHeader mobileTabsFirst tabs={<ModuleTabsNav module="clinics" counts={{ list: count }} />} actions={actions} />
      {children}
    </PageContainer>
  )
}
