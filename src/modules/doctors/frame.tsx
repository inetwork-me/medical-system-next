"use client"

import * as React from "react"

import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { dueCredentials } from "./data"
import { useDoctors, useLeaves } from "./store"

/**
 * Doctors module frame (every module tab): tabs Doctors · n, Credentials · n, Leave & cover · n, Reports, with the tab's
 * actions at the end of the row (Header v2). Mobile: the tabs (scrolling), then the actions as equal full-width buttons.
 */
export function DoctorsFrame({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) {
  const doctors = useDoctors().filter((d) => d.active)
  const due = doctors.reduce((s, d) => s + dueCredentials(d).length, 0)
  const pending = useLeaves().filter((l) => l.status === "pending").length
  return (
    <PageContainer>
      <PageHeader mobileTabsFirst tabs={<ModuleTabsNav module="doctors" counts={{ list: doctors.length, credentials: due, leave: pending }} />} actions={actions} />
      {children}
    </PageContainer>
  )
}
