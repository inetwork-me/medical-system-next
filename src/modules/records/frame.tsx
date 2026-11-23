"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/ds/states"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { accessCounts, completionCounts, noteCounts, requestCounts } from "./counts"
import { recTabs } from "./roles"
import { ME } from "./session"
import { useAccess, useCompletion, useEncounters, useNotes, useRecRole, useRequests } from "./store"

/** Tab counts (brief): my notes to sign · open requests · charts not complete · flagged access. */
export function useTabCounts() {
  const notes = useNotes()
  const n = noteCounts(notes, ME)
  const r = requestCounts(useRequests())
  const c = completionCounts(useCompletion(), notes, useEncounters())
  const a = accessCounts(useAccess())
  return { notes: n.toSign || undefined, requests: r.open || undefined, completion: c.open || undefined, access: a.flagged || undefined }
}

/**
 * Medical records frame (every module tab): tabs Overview · Visit notes 4 · Documents · Requests 4 · Chart completion 6 ·
 * Access log 2 with the tab's actions at the end of the row (md–lg: under the tabs). Mobile: the tabs (scrolling, no
 * counts), then the actions as equal full-width buttons. Tabs the signed-in role can't open are hidden and show a
 * "no access" state.
 */
export function RecordsFrame({ tab, actions, children }: { tab: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  const t = useTranslations("records.frame")
  const counts = useTabCounts()
  const allowed = recTabs(useRecRole())
  const ok = allowed.includes(tab)
  return (
    <PageContainer>
      <PageHeader mobileTabsFirst tabs={<ModuleTabsNav module="records" only={allowed} counts={counts} />} actions={ok ? actions : undefined} />
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
