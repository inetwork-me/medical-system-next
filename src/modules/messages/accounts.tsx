"use client"

import * as React from "react"
import { useLocale } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isTabEnabled } from "@/lib/modules"
import { Icon } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { SMS_ACCOUNT } from "./data"
import { useAccessText } from "./access-text"
import { ConnectDialog, NewSharedDialog, PersonalDialog } from "./accounts-dialogs"
import { mailboxHref, templatesHref } from "./href"
import { BrandMark, ConnectionBadge, GrantChip, IconTile, MsgCard, Note, SwitchRow, type BrandKind } from "./parts"
import { levelIn, peopleIn, unreadIn } from "./rules"
import { mailProvider } from "./services/mail"
import { markSynced, setPolicies, useConnections, useMailboxes, useMe, useMemberships, usePersonalLinked, usePolicies, useThreads } from "./store"
import type { Policies, Provider } from "./types"

type Dialog = null | { kind: "connect"; provider?: Provider } | { kind: "personal" } | { kind: "newShared" }

/** Header actions on Mail accounts: New shared mailbox · Connect. */
export function AccountsActions({ open }: { open: (d: Dialog) => void }) {
  const { t } = useAccessText()
  return (
    <>
      <Button variant="outline" onClick={() => open({ kind: "newShared" })}>
        <Icon name="add" size={18} />
        {t("actions.newShared")}
      </Button>
      <Button onClick={() => open({ kind: "connect" })}>
        <Icon name="link-2" size={18} />
        {t("actions.connect")}
      </Button>
    </>
  )
}

/** Mail accounts (admin): Connections (full width), then Shared mailboxes beside Rules (stacked below xl). */
export function useAccountsScreen() {
  const [dialog, setDialog] = React.useState<Dialog>(null)
  const close = (o: boolean) => !o && setDialog(null)
  const dialogs = (
    <>
      {dialog?.kind === "connect" && <ConnectDialog initial={dialog.provider} onOpenChange={close} />}
      {dialog?.kind === "personal" && <PersonalDialog onOpenChange={close} />}
      {dialog?.kind === "newShared" && <NewSharedDialog onOpenChange={close} />}
    </>
  )
  return { open: setDialog, dialogs }
}

export function AccountsBody({ open }: { open: (d: Dialog) => void }) {
  return (
    <>
      <Connections open={open} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <SharedBoxes onNew={() => open({ kind: "newShared" })} />
        <Rules />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ connections */

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function ConnCard({
  brand,
  title,
  status,
  lines,
  button,
}: {
  brand: BrandKind
  title: React.ReactNode
  status: React.ComponentProps<typeof ConnectionBadge>["status"]
  lines: React.ReactNode[]
  button: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <BrandMark kind={brand} />
        <span className="flex-1" />
        <ConnectionBadge status={status} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="flex flex-col gap-1.5">
        {lines.map((x, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {x}
          </p>
        ))}
      </div>
      <div className="mt-auto">{button}</div>
    </div>
  )
}

/**
 * Widget / Msg Connections: Microsoft 365 (connected · domain · mailboxes · last sync · Sync now), Google Workspace (not
 * connected · Connect), Personal mailboxes (allowed roles · linked count · Rules), SMS and WhatsApp (sender · approved
 * WhatsApp templates · Templates). Four in a row on desktop, one per row below.
 */
function Connections({ open }: { open: (d: Dialog) => void }) {
  const { t, l, ago, roleList } = useAccessText()
  const conns = useConnections()
  const policies = usePolicies()
  const linked = usePersonalLinked()
  const [syncing, setSyncing] = React.useState(false)
  const m365 = conns.find((c) => c.id === "c-m365")!
  const google = conns.find((c) => c.id === "c-google")!
  const personal = conns.find((c) => c.id === "c-personal")!

  const sync = async (id: string, provider: Provider) => {
    setSyncing(true)
    await mailProvider(provider).syncNow(id)
    markSynced(id)
    setSyncing(false)
    toast.info(t("toasts.syncStarted"), { description: t("toasts.syncStartedText") })
  }

  const orgCard = (c: typeof m365, brand: Provider, title: string) =>
    c.status === "connected" ? (
      <ConnCard
        brand={brand}
        title={l(title)}
        status="connected"
        lines={[t("accounts.wholeOrg", { domain: c.domain ?? "" }), t("accounts.mailboxesSynced", { n: c.mailboxes, ago: ago(c.lastSync) })]}
        button={
          <Button variant="outline" size="sm" className="w-full" disabled={syncing} onClick={() => sync(c.id, brand)}>
            {t("actions.syncNow")}
          </Button>
        }
      />
    ) : (
      <ConnCard
        brand={brand}
        title={l(title)}
        status="notConnected"
        lines={[t("accounts.googleFor"), t("accounts.adminSignIn")]}
        button={
          <Button size="sm" className="w-full" onClick={() => open({ kind: "connect", provider: brand })}>
            {t("actions.connect")}
          </Button>
        }
      />
    )

  return (
    <MsgCard title={t("accounts.connections")} sub={t("accounts.connectionsSub")}>
      <div className="grid gap-3 xl:grid-cols-4">
        {orgCard(m365, "m365", t("accounts.m365"))}
        {orgCard(google, "google", t("accounts.google"))}
        <ConnCard
          brand="people"
          title={t("accounts.personal")}
          status={policies.allowPersonal ? "allowed" : "notConnected"}
          lines={[policies.allowPersonal ? capFirst(roleList(policies.personalRoles, true)) : t("accounts.personalOff"), t("accounts.personalLinked", { n: personal.mailboxes + linked })]}
          button={
            <Button variant="outline" size="sm" className="w-full" onClick={() => open({ kind: "personal" })}>
              {t("actions.rules")}
            </Button>
          }
        />
        <ConnCard
          brand="whatsapp"
          title={t("accounts.smsWa")}
          status={SMS_ACCOUNT.status}
          lines={[t("accounts.sender", { name: SMS_ACCOUNT.sender }), t("accounts.approvedTemplates", { n: SMS_ACCOUNT.approvedTemplates })]}
          button={
            isTabEnabled("messages", "templates") ? (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={templatesHref()}>{t("actions.templates")}</Link>
              </Button>
            ) : null
          }
        />
      </div>
    </MsgCard>
  )
}

/* ------------------------------------------------------------------ shared mailboxes */

/**
 * Widget / Msg Shared Boxes: md+ a table (mailbox + purpose · people · unread · access chip · Manage); mobile a list (icon
 * tile · address · "purpose · N people" · chevron). Unread at 10+ turns amber (claims@ · 12). Head action: + New.
 */
function SharedBoxes({ onNew }: { onNew: () => void }) {
  const { t, b, l } = useAccessText()
  const me = useMe()
  const boxes = useMailboxes().filter((m) => m.kind === "shared")
  const members = useMemberships()
  const threads = useThreads()
  const rows = boxes.map((m) => ({ m, people: peopleIn(m, members), unread: unreadIn(m, threads), managed: levelIn(m, me, members) === "manage" }))
  return (
    <MsgCard
      title={t("accounts.shared")}
      sub={t("accounts.sharedSub")}
      action={
        <Button variant="ghost" onClick={onNew}>
          <Icon name="add" size={18} />
          {t("actions.new")}
        </Button>
      }
    >
      <div className="hidden overflow-hidden rounded-[10px] border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start font-normal">{t("accounts.colMailbox")}</th>
              <th className="w-20 px-2 py-3 text-start font-normal">{t("accounts.colPeople")}</th>
              <th className="w-20 px-2 py-3 text-start font-normal">{t("accounts.colUnread")}</th>
              <th className="w-44 px-2 py-3 text-start font-normal">{t("accounts.colAccess")}</th>
              <th className="w-24 px-4 py-3">
                <span className="sr-only">{t("actions.manage")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, people, unread, managed }) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="break-all text-foreground">{l(m.address)}</span>
                    <span className="text-xs text-muted-foreground">{b(m.purpose ?? m.name)}</span>
                  </div>
                </td>
                <td className="px-2 py-3 tabular-nums">{people}</td>
                <td className={cn("px-2 py-3 tabular-nums", unread >= 10 && "text-warning-soft-foreground")}>{unread}</td>
                <td className="px-2 py-3">
                  <GrantChip grant={m.grant ?? "role"} managed={managed} />
                </td>
                <td className="px-4 py-3 text-end">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={mailboxHref(m.id)}>{t("actions.manage")}</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col md:hidden">
        {rows.map(({ m, people }) => (
          <li key={m.id} className="border-b last:border-b-0">
            <Link href={mailboxHref(m.id)} className="flex items-center gap-3 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <IconTile icon="direct-inbox" size={36} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">{l(m.address)}</span>
                <span className="text-xs text-muted-foreground">{t("accounts.peopleLine", { purpose: b(m.purpose ?? m.name), n: people })}</span>
              </span>
              <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground rtl:-scale-x-100" />
            </Link>
          </li>
        ))}
      </ul>
    </MsgCard>
  )
}

/* ------------------------------------------------------------------ rules */

type RuleKey = "encryptOutside" | "blockPersonalForward" | "chatCareTeamOnly" | "logSharedOpens" | "allowPersonal" | "keepYears"
const RULES: RuleKey[] = ["encryptOutside", "blockPersonalForward", "chatCareTeamOnly", "logSharedOpens", "allowPersonal", "keepYears"]
/** Rule names for the access log (kept in both languages, like every logged event). */
const RULE_NAME: Record<RuleKey, { en: string; ar: string }> = {
  encryptOutside: { en: "Encrypt outside mail with patient data", ar: "شفّر البريد الخارجي اللي فيه بيانات مرضى" },
  blockPersonalForward: { en: "Block forwarding to personal mailboxes", ar: "امنع التحويل للصناديق الشخصية" },
  chatCareTeamOnly: { en: "Patients in chat: care team only", ar: "المرضى في المحادثات: للفريق المعالج بس" },
  logSharedOpens: { en: "Log every open of shared mail", ar: "سجّل كل فتح للبريد المشترك" },
  allowPersonal: { en: "Let staff link a personal Gmail or Outlook", ar: "اسمح للموظفين يربطون Gmail أو Outlook شخصي" },
  keepYears: { en: "Keep mail and chat for 10 years", ar: "احتفظ بالبريد والمحادثات 10 سنين" },
}

/** Widget / Msg Policies: six switches (each saves and is logged) and the "stored in Saudi Arabia" note. */
function Rules() {
  const { t, roleList } = useAccessText()
  const p = usePolicies()
  const lab = (k: RuleKey) => (k === "keepYears" ? t("accounts.rule.keep", { n: 10 }) : t(`accounts.rule.${k}`))
  const forRoles = useForRoles(roleList(p.personalRoles, true))
  const toggle = (k: RuleKey, on: boolean) => {
    const patch: Partial<Policies> = k === "keepYears" ? { keepYears: on ? 10 : 0 } : { [k]: on }
    const n = RULE_NAME[k]
    setPolicies(patch, on ? { en: `Rule turned on: ${n.en}`, ar: `تفعّلت القاعدة: ${n.ar}` } : { en: `Rule turned off: ${n.en}`, ar: `توقفت القاعدة: ${n.ar}` })
    toast.success(t("toasts.ruleSaved"), { description: on ? t("toasts.ruleOn", { rule: lab(k) }) : t("toasts.ruleOff", { rule: lab(k) }) })
  }
  return (
    <MsgCard title={t("accounts.rules")} sub={t("accounts.rulesSub")}>
      <div className="flex flex-col gap-4">
        {RULES.map((k) => (
          <SwitchRow
            key={k}
            label={lab(k)}
            hint={k === "allowPersonal" ? (p.personalRoles.length ? t("accounts.rule.allowPersonalHint", { roles: forRoles }) : undefined) : k === "keepYears" ? t("accounts.rule.keepLocked") : undefined}
            checked={k === "keepYears" ? p.keepYears > 0 : !!p[k]}
            // Retention is the medical records rule (10 years): set by law, so it can't be switched off here.
            disabled={k === "keepYears"}
            onChange={(v) => toggle(k, v)}
          />
        ))}
      </div>
      <Note icon="shield-tick">{t("accounts.stored")}</Note>
    </MsgCard>
  )
}

/** "doctors and management" → EN "Doctors and management"; AR "للأطباء والإدارة" (لـ + ال → لل). */
function useForRoles(lowerList: string) {
  const locale = useLocale()
  if (!lowerList) return ""
  if (locale !== "ar") return lowerList.charAt(0).toUpperCase() + lowerList.slice(1)
  return lowerList.startsWith("ال") ? `لل${lowerList.slice(2)}` : `لـ${lowerList}`
}
