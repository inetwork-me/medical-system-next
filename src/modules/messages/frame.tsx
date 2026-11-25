"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/ds/states"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { msgTabs, type MsgTab } from "./roles"
import { useMsgCounts, useMsgRole } from "./store"

/** Tab counts (design): Inbox · unread across your mailboxes, Chat · unread posts, Patient messages · replies. */
export function useTabCounts() {
  const c = useMsgCounts()
  return { inbox: c.inbox.unread || undefined, chat: c.chat || undefined, patients: c.patients.replies || undefined }
}

/**
 * Messages frame (every module tab): tabs Inbox 7 · Chat · Patient messages 3 · Partners · Templates · Mail accounts with the
 * tab's actions at the end of the row (md–lg: under the tabs). Mobile: the tabs (scrolling, no counts), then the actions as
 * equal full-width buttons. Tabs the role can't open are hidden and show "no access" on their deep links.
 */
export function MessagesFrame({ tab, actions, children }: { tab: MsgTab; actions?: React.ReactNode; children?: React.ReactNode }) {
  const allowed = msgTabs(useMsgRole())
  const ok = allowed.includes(tab)
  return (
    <PageContainer>
      <PageHeader mobileTabsFirst tabs={<ModuleTabsNav module="messages" only={allowed} counts={useTabCounts()} />} actions={ok ? actions : undefined} />
      {ok ? children : <NoAccess />}
    </PageContainer>
  )
}

/** Inner page frame (Message, New message, Conversation …): no tabs; the role check still applies. */
export function MessagesInner({ tab, actions, children }: { tab: MsgTab; actions?: React.ReactNode; children?: React.ReactNode }) {
  const ok = msgTabs(useMsgRole()).includes(tab)
  return (
    <PageContainer>
      {ok && actions && <PageHeader actions={actions} />}
      {ok ? children : <NoAccess />}
    </PageContainer>
  )
}

export function NoAccess() {
  const t = useTranslations("messages.frame")
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState icon="lock" title={t("noAccess")} description={t("noAccessText")} className="py-16" />
    </div>
  )
}

/** Placeholder body for the screens that land in a later build step. */
export function BuildingCard({ step }: { step: number }) {
  const t = useTranslations("messages.frame")
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState icon="message" title={t("building")} description={t("buildingText", { n: step })} className="py-16" />
    </div>
  )
}
