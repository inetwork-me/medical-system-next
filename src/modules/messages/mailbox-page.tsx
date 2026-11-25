"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { csvBlob, saveBlob } from "@/lib/export/files"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { usePageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { ME, SIGNATURES, STAFF } from "./data"
import { useAccessText } from "./access-text"
import { EditAccessDialog } from "./accounts-dialogs"
import { MessagesInner } from "./frame"
import { accountsHref } from "./href"
import { AccessBadge, KvRows, MsgCard, Note, PersonAvatar } from "./parts"
import { membersOf } from "./rules"
import { mailProvider } from "./services/mail"
import { logEvent, markSynced, useAuditLog, useMailboxes, useMemberships, useRoleRules } from "./store"
import type { Mailbox, Membership } from "./types"

const PROVIDER = { m365: "Microsoft 365", google: "Google Workspace", imap: "IMAP" } as const

/**
 * Mailbox access (inner page of Mail accounts, `/messages/accounts/mailbox?id=cardiology`): header Back · "Messages / Mail
 * accounts" over the address; Sync now · Add people. People with access (person · access badge · how they got it · until ·
 * Edit), the role rules box and the legend; side: Mailbox (address, provider, synced, signature, kept for · Sync now) and
 * Access changes (Export log). Mobile: Back · "Mailbox access" · ⋯ (sync, add people, export log); people as a list.
 */
export function MailboxPage() {
  const { t, l } = useAccessText()
  const id = useSearchParams().get("id") ?? ""
  const box = useMailboxes().find((m) => m.id === id && m.kind === "shared")
  const [edit, setEdit] = React.useState<null | { staff?: string }>(null)
  const [syncing, setSyncing] = React.useState(false)
  const log = useAuditLog().filter((e) => e.mailbox === id)

  usePageTitle({
    title: box ? l(box.address) : t("mailbox.notFound"),
    back: accountsHref(),
    crumbs: [
      { label: t("title"), href: "/messages" },
      { label: t("titles.accounts"), href: accountsHref() },
    ],
  })

  if (!box)
    return (
      <MessagesInner tab="accounts">
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="direct-inbox"
            title={t("mailbox.notFound")}
            description={t("mailbox.notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={accountsHref()}>{t("mailbox.backToAccounts")}</Link>
              </Button>
            }
          />
        </div>
      </MessagesInner>
    )

  const sync = async () => {
    setSyncing(true)
    await mailProvider(box.provider).syncNow(box.id)
    markSynced(box.connection, box.id)
    setSyncing(false)
    toast.info(t("toasts.syncStarted"), { description: t("toasts.syncStartedText") })
  }
  const exportLog = () => {
    const rows = log.map((e) => [e.at.replace("T", " "), STAFF[e.actor]?.name.en ?? e.actor, e.text.en])
    saveBlob(csvBlob(["Date", "Who", "Change"], rows), `${box.address}-access-log.csv`)
    logEvent({ kind: "exported", actor: ME, mailbox: box.id, text: { en: "You exported the access log", ar: "صدّرت سجل الصلاحيات" } })
    toast.info(t("toasts.logExported"), { description: t("toasts.logExportedText") })
  }

  return (
    <>
      <MobileBar title={t("titles.mailbox")} address={box.address} onSync={sync} onAdd={() => setEdit({})} onExport={exportLog} />
      <MessagesInner
        tab="accounts"
        actions={
          <>
            <Button variant="outline" onClick={sync} disabled={syncing}>
              <Icon name="refresh" size={18} />
              {t("actions.syncNow")}
            </Button>
            <Button onClick={() => setEdit({})}>
              <Icon name="user-add" size={18} />
              {t("actions.addPeople")}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <Members box={box} onEdit={(staff) => setEdit({ staff })} onAdd={() => setEdit({})} />
          <div className="flex flex-col gap-4 xl:gap-6">
            <MailboxCard box={box} onSync={sync} syncing={syncing} />
            <Changes log={log} keep={box.keepYears} onExport={exportLog} />
          </div>
        </div>
      </MessagesInner>
      {edit && <EditAccessDialog mailbox={box} staff={edit.staff} onOpenChange={(o) => !o && setEdit(null)} />}
    </>
  )
}

function MobileBar({ title, address, onSync, onAdd, onExport }: { title: string; address: string; onSync: () => void; onAdd: () => void; onExport: () => void }) {
  const { t, l } = useAccessText()
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href={accountsHref()} aria-label={t("actions.back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      <ActionMenu
        title={l(address)}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("actions.more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          [
            { key: "sync", icon: "refresh", label: t("actions.syncNow"), onSelect: onSync },
            { key: "add", icon: "user-add", label: t("actions.addPeople"), onSelect: onAdd },
            { key: "export", icon: "export", label: t("actions.exportLog"), onSelect: onExport },
          ],
        ]}
      />
    </div>
  )
}

/** Widget / Msg Members: people with access, role rules, the level legend. */
function Members({ box, onEdit, onAdd }: { box: Mailbox; onEdit: (staff: string) => void; onAdd: () => void }) {
  const { t, b, l, how, until } = useAccessText()
  const memberships = useMemberships()
  const rules = useRoleRules().filter((r) => r.mailbox === box.id)
  const order = { manage: 0, sendAs: 1, reply: 2, read: 3 }
  const rows: Membership[] = membersOf(box.id, memberships).sort((a, b2) => order[a.level] - order[b2.level])
  const short = b({ en: box.short, ar: box.name.ar })
  return (
    <MsgCard
      title={t("mailbox.people")}
      sub={t("mailbox.peopleSub", { address: box.address, n: rows.length })}
      action={
        <Button variant="ghost" onClick={onAdd}>
          <Icon name="user-add" size={18} />
          {t("actions.addPeople")}
        </Button>
      }
    >
      <div className="hidden overflow-hidden rounded-[10px] border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-normal">{t("mailbox.colPerson")}</th>
              <th className="w-28 px-2 py-3 text-start font-normal">{t("mailbox.colAccess")}</th>
              <th className="w-44 px-2 py-3 text-start font-normal">{t("mailbox.colHow")}</th>
              <th className="w-20 px-2 py-3 text-start font-normal">{t("mailbox.colUntil")}</th>
              <th className="w-20 px-4 py-3">
                <span className="sr-only">{t("actions.edit")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const s = STAFF[m.staff]
              return (
                <tr key={m.staff} className="border-t">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PersonAvatar initials={s.initials} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-foreground">{b(s.name)}</span>
                        <span className="text-xs text-muted-foreground">{b(s.title)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <AccessBadge level={m.level} />
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{how(m, rules)}</td>
                  <td className={cn("px-2 py-3", m.until ? "text-warning-soft-foreground" : "text-muted-foreground")}>{m.until ? until(m.until) : "—"}</td>
                  <td className="px-4 py-3 text-end">
                    <Button variant="outline" size="sm" onClick={() => onEdit(m.staff)}>
                      {t("actions.edit")}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col md:hidden">
        {rows.map((m) => {
          const s = STAFF[m.staff]
          return (
            <li key={m.staff} className="border-b last:border-b-0">
              <button type="button" onClick={() => onEdit(m.staff)} className="flex w-full items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <PersonAvatar initials={s.initials} className="self-start" />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="text-sm font-medium text-foreground">{b(s.name)}</span>
                  <span className="text-xs text-muted-foreground">
                    {how(m, rules)}
                    {m.until && <span className="text-warning-soft-foreground"> · {until(m.until)}</span>}
                  </span>
                  <AccessBadge level={m.level} />
                </span>
                <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground rtl:-scale-x-100" />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col gap-2 rounded-[10px] bg-muted p-3.5">
        <p className="text-xs font-medium text-foreground">{rules.length ? t("mailbox.roleRules") : t("mailbox.noRules")}</p>
        {rules.map((r) => (
          <p key={r.id} className="text-xs text-muted-foreground">
            {r.limit ? t("mailbox.ruleLimit", { who: b(r.who), level: t(`access.${r.level}`), limit: b(r.limit) }) : t("mailbox.ruleLine", { who: b(r.who), level: t(`access.${r.level}`) })}
          </p>
        ))}
      </div>
      <Note>{t("mailbox.legend", { short: l(short) })}</Note>
    </MsgCard>
  )
}

/** Widget / Msg Mailbox Side · Mailbox: address, provider, synced (green), signature, kept for; Sync now. */
function MailboxCard({ box, onSync, syncing }: { box: Mailbox; onSync: () => void; syncing: boolean }) {
  const { t, b, l, ago } = useAccessText()
  const sig = SIGNATURES.find((s) => s.id === box.signature)
  return (
    <MsgCard title={t("mailbox.card")}>
      <KvRows
        rows={[
          [t("mailbox.address"), l(box.address)],
          [t("mailbox.provider"), t("mailbox.providerShared", { provider: PROVIDER[box.provider] })],
          [t("mailbox.synced"), ago(box.lastSync), "success"],
          [t("mailbox.signature"), sig ? b(sig.title) : t("mailbox.noSignature")],
          [t("mailbox.keptFor"), t("mailbox.years", { n: box.keepYears })],
        ]}
      />
      <Button variant="outline" className="w-full" onClick={onSync} disabled={syncing}>
        <Icon name="refresh" size={18} />
        {t("actions.syncNow")}
      </Button>
    </MsgCard>
  )
}

/** Widget / Msg Mailbox Side · Access changes: date + what changed (kept for the retention period); Export log. */
function Changes({ log, keep, onExport }: { log: ReturnType<typeof useAuditLog>; keep: number; onExport: () => void }) {
  const { t, b, dayMonth } = useAccessText()
  return (
    <MsgCard title={t("mailbox.changes")} sub={t("mailbox.changesSub", { n: keep })}>
      {log.length ? (
        <ul className="flex flex-col gap-3">
          {log.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 text-xs">
              <span className="w-[72px] shrink-0 font-medium text-muted-foreground">{dayMonth(e.at)}</span>
              <span className="min-w-0 flex-1 text-foreground">{b(e.text)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("mailbox.noChanges")}</p>
      )}
      <Button variant="outline" className="w-full" onClick={onExport}>
        <Icon name="export" size={18} />
        {t("actions.exportLog")}
      </Button>
    </MsgCard>
  )
}
