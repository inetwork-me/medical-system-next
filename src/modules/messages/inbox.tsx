"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConnectDialog } from "./accounts-dialogs"
import { composeHref, threadHref } from "./href"
import { AssignDialog, LinkDialog } from "./mail-dialogs"
import { FileRow, FromLine, MailRow, PatientLock, ThreadChips, useMailText } from "./mail-parts"
import { MicrosoftMark } from "./parts"
import { inboxCounts, levelIn, viewThreads, type InboxView } from "./rules"
import { mailProvider } from "./services/mail"
import { archiveThread, markRead, markSynced, useMailboxes, useMe, useMemberships, useThreads } from "./store"
import type { Thread } from "./types"

type Filter = "all" | "unread" | "mine"
const PAGE = 6

/** Inbox state: the view (unified Inbox, a folder, one mailbox), filter, search, and what's open in the reading pane. */
function useInbox() {
  const me = useMe()
  const threads = useThreads()
  const boxes = useMailboxes()
  const members = useMemberships()
  const [view, setView] = React.useState<InboxView>("inbox")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [q, setQ] = React.useState("")
  const counts = inboxCounts(threads, me, boxes, members)
  const inView = viewThreads(threads, me, view, boxes, members)
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const list = inView
    .filter((t) => (filter === "unread" ? t.unread : filter === "mine" ? t.assignee?.to === me : true))
    .filter((t) => {
      if (!words.length) return true
      const hay = [
        t.subject.en,
        t.subject.ar,
        t.snippet.en,
        t.snippet.ar,
        t.sender.name.en,
        t.sender.name.ar,
        ...t.links.flatMap((l) => [l.ref, l.label.en, l.label.ar]),
        ...t.messages.flatMap((m) => [m.from.email, m.from.name.en, m.from.name.ar, ...m.to.map((x) => x.email)]),
      ]
        .join(" ")
        .toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  const viewUnread = view === "inbox" ? counts.unread : inView.filter((t) => t.unread).length
  return { me, boxes, members, view, setView, filter, setFilter, q, setQ, counts, list, viewUnread, inView }
}

/** Header actions on Inbox: Connect a mailbox · New message. */
export function InboxActions() {
  const { t } = useMailText()
  const [connect, setConnect] = React.useState(false)
  return (
    <>
      {/* Mobile: two long labels side by side — tighter padding keeps them inside the 16px gutters. */}
      <Button variant="outline" onClick={() => setConnect(true)} className="max-md:!px-3">
        <Icon name="link-2" size={18} />
        {t("actions.connectMailbox")}
      </Button>
      <Button asChild className="max-md:!px-3">
        <Link href={composeHref()}>
          <Icon name="add" size={18} />
          {t("actions.newMessage")}
        </Link>
      </Button>
      {connect && <ConnectDialog onOpenChange={setConnect} />}
    </>
  )
}

/**
 * Widget / Msg Mail. Desktop (xl): one card, 780 high, three panes that scroll on their own — mailboxes, the list, the
 * reading pane. Tablet / mobile: one card with the mailbox switcher, search, filter and the list (Show more), rows open
 * the Message page.
 */
export function InboxBody() {
  const s = useInbox()
  return (
    <>
      <div className="hidden xl:block">
        <Wide s={s} />
      </div>
      <div className="xl:hidden">
        <Compact s={s} />
      </div>
    </>
  )
}

type S = ReturnType<typeof useInbox>

/* ------------------------------------------------------------------ desktop */

function Wide({ s }: { s: S }) {
  const [open, setOpen] = React.useState<string | null>(null)
  const sel = s.list.find((t) => t.id === open) ?? s.list[0]
  const router = useRouter()
  const pick = (t: Thread) => {
    if (t.folder === "drafts") return router.push(composeHref({ draft: t.id }))
    setOpen(t.id)
    if (t.unread) markRead(t.id)
  }
  return (
    <div className="flex h-[780px] overflow-hidden rounded-[14px] border bg-card">
      <Folders s={s} />
      <div className="flex w-[372px] shrink-0 flex-col border-e">
        <ListHead s={s} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {s.list.length ? s.list.map((t) => <MailRow key={t.id} t={t} selected={sel?.id === t.id} onSelect={() => pick(t)} />) : <Empty />}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">{sel && sel.folder !== "drafts" ? <Reading t={sel} /> : <Pick />}</div>
    </div>
  )
}

function FolderItem({ icon, label, count, on, onClick, mark }: { icon?: IconName; label: React.ReactNode; count?: number; on: boolean; onClick: () => void; mark?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on || undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-start text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        on ? "bg-accent font-medium text-primary" : "text-foreground hover:bg-muted/60"
      )}
    >
      {mark ?? (icon && <Icon name={icon} size={18} className={on ? "text-primary" : "text-muted-foreground"} />)}
      <span className="min-w-0 flex-1">{label}</span>
      {!!count && <span className={cn("text-xs font-medium tabular-nums", on ? "text-primary" : "text-muted-foreground")}>{count}</span>}
    </button>
  )
}

/** Mailboxes pane: New message; Your mailbox (Inbox, Flagged, Sent, Drafts); Shared with you; Linked by you; Connect. */
function Folders({ s }: { s: S }) {
  const { t, b, l } = useMailText()
  const [connect, setConnect] = React.useState(false)
  const mine = s.boxes.find((m) => m.kind === "personal" && m.owner === s.me)
  const shared = s.boxes.filter((m) => m.kind === "shared" && levelIn(m, s.me, s.members))
  const linked = s.boxes.filter((m) => m.kind === "linked" && m.owner === s.me)
  const go = (v: InboxView) => () => s.setView(v)
  const boxName = (id: string) => {
    const m = s.boxes.find((x) => x.id === id)!
    const level = levelIn(m, s.me, s.members)
    return m.kind === "shared" ? t("inbox.boxLevel", { box: b({ en: m.short, ar: m.name.ar }), level: t(`level.${level ?? "read"}`) }) : b(m.name)
  }
  return (
    <div className="flex w-[232px] shrink-0 flex-col gap-4 overflow-y-auto border-e p-4">
      <Button asChild className="w-full">
        <Link href={composeHref()}>
          <Icon name="add" size={18} />
          {t("actions.newMessage")}
        </Link>
      </Button>
      {mine && (
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1.5 px-1 pb-1 text-xs font-medium text-muted-foreground">
            <MicrosoftMark size={16} />
            {t("inbox.yourMailbox")}
          </p>
          <p className="truncate px-1 pb-1 text-xs text-muted-foreground">{l(mine.address)}</p>
          <FolderItem icon="direct-inbox" label={t("inbox.folder.inbox")} count={s.counts.unread} on={s.view === "inbox"} onClick={go("inbox")} />
          <FolderItem icon="flag" label={t("inbox.folder.flagged")} count={s.counts.flagged} on={s.view === "flagged"} onClick={go("flagged")} />
          <FolderItem icon="send-2" label={t("inbox.folder.sent")} on={s.view === "sent"} onClick={go("sent")} />
          <FolderItem icon="edit-2" label={t("inbox.folder.drafts")} count={s.counts.drafts} on={s.view === "drafts"} onClick={go("drafts")} />
        </div>
      )}
      {shared.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1.5 px-1 pb-1 text-xs font-medium text-muted-foreground">
            <Icon name="profile-2user" size={14} />
            {t("inbox.sharedWithYou")}
          </p>
          {shared.map((m) => (
            <FolderItem key={m.id} icon="profile-2user" label={boxName(m.id)} count={s.counts.byBox[m.id]} on={s.view === `box:${m.id}`} onClick={go(`box:${m.id}`)} />
          ))}
        </div>
      )}
      {linked.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-1.5 px-1 pb-1 text-xs font-medium text-muted-foreground">
            <Icon name="google" size={14} />
            {t("inbox.linkedByYou")}
          </p>
          {linked.map((m) => (
            <FolderItem key={m.id} icon="google" label={b(m.name)} count={s.counts.byBox[m.id]} on={s.view === `box:${m.id}`} onClick={go(`box:${m.id}`)} />
          ))}
        </div>
      )}
      <span className="flex-1" />
      <button
        type="button"
        onClick={() => setConnect(true)}
        className="flex items-center gap-2 rounded-[10px] border border-dashed border-input bg-muted p-2.5 text-start text-xs font-medium text-foreground outline-none hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon name="link-2" size={18} className="text-primary" />
        {t("inbox.connect")}
      </button>
      {connect && <ConnectDialog initialScope="personal" onOpenChange={setConnect} />}
    </div>
  )
}

function viewTitle(s: S, t: ReturnType<typeof useMailText>["t"], b: ReturnType<typeof useMailText>["b"]) {
  if (s.view === "inbox") return { title: t("inbox.title"), sub: t("inbox.sub", { n: s.counts.unread }) }
  if (s.view === "flagged" || s.view === "sent" || s.view === "drafts") return { title: t(`inbox.folder.${s.view}`), sub: t("inbox.subFolder", { n: s.inView.length }) }
  const m = s.boxes.find((x) => `box:${x.id}` === s.view)
  const name = m ? (m.kind === "shared" ? b({ en: m.short, ar: m.name.ar }) : b(m.name)) : ""
  return { title: name, sub: t("inbox.subBox", { box: m ? b({ en: m.address, ar: m.name.ar }) : "", n: s.viewUnread }) }
}

function Filters({ s, small }: { s: S; small?: boolean }) {
  const { t } = useMailText()
  return (
    <Segmented
      size={small ? "sm" : "default"}
      aria-label={t("inbox.filter")}
      className="w-full"
      value={s.filter}
      onValueChange={s.setFilter}
      options={[
        { value: "all", label: t("inbox.all") },
        { value: "unread", label: t("inbox.unread", { n: s.counts.unread }) },
        { value: "mine", label: t("inbox.mine", { n: s.counts.mine }) },
      ]}
    />
  )
}

function SearchBox({ s, short }: { s: S; short?: boolean }) {
  const { t } = useMailText()
  return (
    <div className="relative">
      <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={s.q} onChange={(e) => s.setQ(e.target.value)} placeholder={short ? t("inbox.searchShort") : t("inbox.search")} aria-label={t("inbox.search")} className="ps-9" />
    </div>
  )
}

function ListHead({ s }: { s: S }) {
  const { t, b } = useMailText()
  const [syncing, setSyncing] = React.useState(false)
  const h = viewTitle(s, t, b)
  const sync = async () => {
    setSyncing(true)
    await mailProvider("m365").syncNow("all")
    markSynced("c-m365")
    setSyncing(false)
    toast.info(t("toasts.syncStarted"), { description: t("toasts.syncStartedText") })
  }
  return (
    <div className="flex flex-col gap-2.5 border-b px-4 pt-4 pb-3">
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-foreground">{h.title}</h2>
          <p className="text-xs text-muted-foreground">{h.sub}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={sync} disabled={syncing} aria-label={t("actions.syncNow")}>
          <Icon name="refresh" size={20} className={cn(syncing && "animate-spin")} />
        </Button>
      </div>
      <SearchBox s={s} />
      <Filters s={s} small />
    </div>
  )
}

function Empty() {
  const { t } = useMailText()
  return <EmptyState icon="direct-inbox" title={t("inbox.empty")} description={t("inbox.emptyText")} className="py-12" />
}
function Pick() {
  const { t } = useMailText()
  return <EmptyState icon="sms" title={t("inbox.pick")} description={t("inbox.pickText")} className="h-full justify-center" />
}

/** Reading pane: Reply · Forward · Assign, link + archive icons; subject, from → to, time; chips; lock note; body; files; reply box. */
function Reading({ t: th }: { t: Thread }) {
  const { t, b, l, when } = useMailText()
  const router = useRouter()
  const [dlg, setDlg] = React.useState<null | "assign" | "link">(null)
  const m = th.messages.at(-1)
  const archive = () => {
    archiveThread(th.id)
    toast.info(t("toasts.archived"), { description: t("toasts.archivedText") })
  }
  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={threadHref(th.id)}>{t("actions.reply")}</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={composeHref({ forward: th.id })}>
            <Icon name="forward" size={18} />
            {t("actions.forward")}
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDlg("assign")}>
          <Icon name="user-tag" size={18} />
          {t("actions.assign")}
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" size="icon" onClick={() => setDlg("link")} aria-label={t("actions.linkRecord")}>
          <Icon name="link-2" size={20} />
        </Button>
        <Button variant="ghost" size="icon" onClick={archive} aria-label={t("actions.archive")}>
          <Icon name="archive" size={20} />
        </Button>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{b(th.subject)}</h3>
      {m && <FromLine t={th} size={36} route={l(`${m.from.email} → ${m.to.map((x) => x.email).join(", ")}`)} time={when(m.at)} />}
      <ThreadChips t={th} assigned />
      <PatientLock t={th} />
      {m && (
        <div className="flex flex-col gap-4 text-sm text-foreground">
          {m.body.map((p, i) => (
            <p key={i}>{b(p)}</p>
          ))}
        </div>
      )}
      {m?.files?.map((f, i) => <FileRow key={i} file={f} thread={th} />)}
      <span className="flex-1" />
      <button
        type="button"
        onClick={() => router.push(threadHref(th.id))}
        className="flex items-center gap-2 rounded-[10px] border border-input p-2 ps-3 text-start outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon name="paperclip-2" size={20} className="text-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{t("inbox.replyTo", { name: m ? b(m.from.name).split(" ")[0] : "" })}</span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
          <Icon name="send-2" size={18} />
          {t("actions.reply")}
        </span>
      </button>
      {dlg === "assign" && <AssignDialog thread={th} onOpenChange={(o) => !o && setDlg(null)} />}
      {dlg === "link" && <LinkDialog thread={th} onOpenChange={(o) => !o && setDlg(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ tablet / mobile */

function Compact({ s }: { s: S }) {
  const { t, b } = useMailText()
  const [shown, setShown] = React.useState(PAGE)
  const h = viewTitle(s, t, b)
  const mine = s.boxes.find((m) => m.kind === "personal" && m.owner === s.me)
  const shared = s.boxes.filter((m) => m.kind === "shared" && levelIn(m, s.me, s.members))
  const linked = s.boxes.filter((m) => m.kind === "linked" && m.owner === s.me)
  const more = () => {
    const n = Math.min(s.list.length - shown, 20)
    setShown(shown + n)
    toast.info(t("toasts.moreLoaded", { n }), { description: t("toasts.moreLoadedText") })
  }
  return (
    <section className="flex flex-col gap-4 rounded-[14px] border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{h.title}</h2>
          <p className="text-xs text-muted-foreground">{h.sub}</p>
        </div>
        <Button variant="outline" size="icon" asChild>
          <Link href={composeHref()} aria-label={t("actions.newMessage")}>
            <Icon name="add" size={20} />
          </Link>
        </Button>
      </div>
      <Select
        value={s.view}
        onValueChange={(v) => {
          s.setView(v as InboxView)
          setShown(PAGE)
        }}
      >
        <SelectTrigger className="w-full" aria-label={t("inbox.mailboxes")}>
          <span className="flex items-center gap-2">
            <Icon name="direct-inbox" size={18} className="text-muted-foreground" />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="inbox">{t("inbox.allMailboxes", { n: s.counts.mailboxes })}</SelectItem>
          {mine && (
            <SelectGroup>
              <SelectLabel>{t("inbox.yourMailbox")}</SelectLabel>
              <SelectItem value="flagged">{t("inbox.folder.flagged")}</SelectItem>
              <SelectItem value="sent">{t("inbox.folder.sent")}</SelectItem>
              <SelectItem value="drafts">{t("inbox.folder.drafts")}</SelectItem>
              <SelectItem value={`box:${mine.id}`}>{b(mine.name)}</SelectItem>
            </SelectGroup>
          )}
          {shared.length > 0 && (
            <SelectGroup>
              <SelectLabel>{t("inbox.sharedWithYou")}</SelectLabel>
              {shared.map((m) => (
                <SelectItem key={m.id} value={`box:${m.id}`}>
                  {b({ en: m.short, ar: m.name.ar })}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {linked.length > 0 && (
            <SelectGroup>
              <SelectLabel>{t("inbox.linkedByYou")}</SelectLabel>
              {linked.map((m) => (
                <SelectItem key={m.id} value={`box:${m.id}`}>
                  {b(m.name)}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      <SearchBox s={s} short />
      <Filters s={s} small />
      <div className="flex flex-col">
        {s.list.length ? s.list.slice(0, shown).map((th) => <MailRow key={th.id} t={th} flush href={th.folder === "drafts" ? composeHref({ draft: th.id }) : threadHref(th.id)} />) : <Empty />}
      </div>
      {s.list.length > shown && (
        <Button variant="outline" className="w-full" onClick={more}>
          {t("actions.showMore")}
        </Button>
      )}
    </section>
  )
}
