"use client"

import { useTranslations } from "next-intl"

import { usePageTitle } from "@/components/shell/page-title"
import { AccountsActions, AccountsBody, useAccountsScreen } from "./accounts"
import { ChatActions, ChatBody } from "./chat"
import { InboxActions, InboxBody } from "./inbox"
import { PatientActions, PatientsBody } from "./patient-msgs"
import { PartnersActions, PartnersBody } from "./partners"
import { TemplatesActions, TemplatesBody, useTemplatesScreen } from "./templates"
import { BuildingCard, MessagesFrame, MessagesInner } from "./frame"
import type { MsgTab } from "./roles"

/*
 * Messages module tabs and inner pages. Header titles follow the design: Inbox shows "Home / Messages"; the other tabs show
 * "Messages" over the tab's title; inner pages show "Messages / {tab}" with Back. Screens land in build steps 2–8 (brief §5).
 */

const STEP: Record<MsgTab, number> = { inbox: 3, chat: 5, patients: 6, partners: 7, templates: 8, accounts: 2 }

/** Inbox (module home): header "Home / Messages". */
export function InboxTab() {
  const t = useTranslations("messages")
  const tn = useTranslations("shell.nav")
  usePageTitle({ title: t("title"), mobileTitle: true, crumbs: [{ label: tn("home"), href: "/dashboard" }] })
  return (
    <MessagesFrame tab="inbox" actions={<InboxActions />}>
      <InboxBody />
    </MessagesFrame>
  )
}

const TITLE_KEY = { chat: "chat", patients: "patients", partners: "partners", templates: "templates", accounts: "accounts" } as const

/** Chat, Patient messages, Partners, Templates, Mail accounts: header "Messages" over the tab's title. */
export function MsgTabPage({ tab }: { tab: Exclude<MsgTab, "inbox"> }) {
  const t = useTranslations("messages")
  // Templates: "Templates and signatures" on desktop; the mobile app bar keeps the tab name ("Templates"), as drawn.
  usePageTitle({ title: t(`titles.${TITLE_KEY[tab]}`), mobileTitle: tab !== "templates", crumbs: [{ label: t("title"), href: "/messages" }] })
  if (tab === "accounts") return <AccountsTab />
  if (tab === "templates") return <TemplatesTab />
  if (tab === "partners")
    return (
      <MessagesFrame tab="partners" actions={<PartnersActions />}>
        <PartnersBody />
      </MessagesFrame>
    )
  if (tab === "patients")
    return (
      <MessagesFrame tab="patients" actions={<PatientActions />}>
        <PatientsBody />
      </MessagesFrame>
    )
  if (tab === "chat")
    return (
      <MessagesFrame tab="chat" actions={<ChatActions />}>
        <ChatBody />
      </MessagesFrame>
    )
  return (
    <MessagesFrame tab={tab}>
      <BuildingCard step={STEP[tab]} />
    </MessagesFrame>
  )
}

/** Templates and signatures: Edit signature · New template; templates, preview, fields, signatures (step 8). */
function TemplatesTab() {
  const { open, dialogs } = useTemplatesScreen()
  return (
    <MessagesFrame tab="templates" actions={<TemplatesActions open={open} />}>
      <TemplatesBody open={open} />
      {dialogs}
    </MessagesFrame>
  )
}

/** Mail accounts (admin): New shared mailbox · Connect; Connections, Shared mailboxes, Rules (step 2). */
function AccountsTab() {
  const { open, dialogs } = useAccountsScreen()
  return (
    <MessagesFrame tab="accounts" actions={<AccountsActions open={open} />}>
      <AccountsBody open={open} />
      {dialogs}
    </MessagesFrame>
  )
}

type Inner ="message" | "compose" | "conversation" | "patientThread" | "partner" | "mailbox"
const INNER: Record<Inner, { tab: MsgTab; back: string; step: number }> = {
  message: { tab: "inbox", back: "/messages", step: 3 },
  compose: { tab: "inbox", back: "/messages", step: 4 },
  conversation: { tab: "chat", back: "/messages/chat", step: 5 },
  patientThread: { tab: "patients", back: "/messages/patients", step: 6 },
  partner: { tab: "partners", back: "/messages/partners", step: 7 },
  mailbox: { tab: "accounts", back: "/messages/accounts", step: 2 },
}
const TAB_CRUMB: Record<MsgTab, "inbox" | "chat" | "patients" | "partners" | "templates" | "accounts"> = {
  inbox: "inbox",
  chat: "chat",
  patients: "patients",
  partners: "partners",
  templates: "templates",
  accounts: "accounts",
}

/** Inner page placeholder: header Back · "Messages / {tab}" over the page title. */
export function InnerPlaceholder({ page }: { page: Inner }) {
  const t = useTranslations("messages")
  const ts = useTranslations("shell.tabs.messages")
  const p = INNER[page]
  usePageTitle({
    title: t(`titles.${page}`),
    mobileTitle: true,
    back: p.back,
    crumbs: [
      { label: t("title"), href: "/messages" },
      { label: ts(TAB_CRUMB[p.tab]), href: p.back },
    ],
  })
  return (
    <MessagesInner tab={p.tab}>
      <BuildingCard step={p.step} />
    </MessagesInner>
  )
}
