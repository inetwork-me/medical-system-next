"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { usePageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { INSURERS } from "@/modules/billing/data"
import { CENTER, ME, MSG_NOW, ORG_DOMAIN, PARTNERS, SIGNATURES, STAFF, TEMPLATES } from "./data"
import { MessagesInner } from "./frame"
import { mailboxHref, partnerHref } from "./href"
import { AssignDialog, LinkDialog } from "./mail-dialogs"
import { FileRow, FromLine, LINK_ICON, ThreadChips, boxLabel, linkHref, patientLinkOf, useMailText } from "./mail-parts"
import { IconTile, KvRows, LogoTile, MsgCard, Note } from "./parts"
import { msgCan } from "./roles"
import { canOpenThread, canReply, levelIn, peopleIn } from "./rules"
import { archiveThread, logOpen, markRead, sendReply, useMailboxes, useMe, useMemberships, useMsgRole, usePolicies, useThread, useTemplates, useSignatures } from "./store"
import type { Attachment, MailMessage, Party, Thread } from "./types"

/**
 * Message (inner page of Inbox, `/messages/message?id=t-bupa-holter`): header Back · "Messages / Inbox" over the subject;
 * Link to a record · Assign. Subject card (count + who started it, chips), earlier messages one line each (open on
 * click), the latest message, the Reply card. Side: Linked to, Partner, Who can see this, Activity. Mobile: Back ·
 * "Message" · ⋯ (assign, link, archive, open partner); actions under the bar; the side cards after the reply.
 */
export function MessagePage() {
  const { t, b } = useMailText()
  const id = useSearchParams().get("id") ?? ""
  const th = useThread(id)
  const me = useMe()
  const boxes = useMailboxes()
  const members = useMemberships()
  const policies = usePolicies()
  const router = useRouter()
  const [dlg, setDlg] = React.useState<null | "assign" | "link">(null)
  const allowed = !!th && canOpenThread(th, me, boxes, members)
  const box = th ? boxes.find((m) => m.id === th.mailbox) : undefined

  usePageTitle({
    title: th && allowed ? b(th.subject) : t("titles.message"),
    back: "/messages",
    crumbs: [
      { label: t("title"), href: "/messages" },
      { label: t("inbox.title"), href: "/messages" },
    ],
  })

  // Opening marks it read; opening shared mail is logged when the rule is on.
  React.useEffect(() => {
    if (!th || !allowed) return
    if (th.unread) markRead(th.id)
    logOpen(th, box?.kind === "shared", policies.logSharedOpens)
  }, [th, allowed, box?.kind, policies.logSharedOpens])

  if (!th || !allowed)
    return (
      <MessagesInner tab="inbox">
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={th ? "lock" : "sms"}
            title={th ? t("message.noAccess") : t("message.notFound")}
            description={th ? t("message.noAccessText") : t("message.notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href="/messages">{t("message.backToInbox")}</Link>
              </Button>
            }
          />
        </div>
      </MessagesInner>
    )

  const archive = () => {
    archiveThread(th.id)
    toast.info(t("toasts.archived"), { description: t("toasts.archivedText") })
    router.push("/messages")
  }
  const partner = th.partner ? PARTNERS.find((p) => p.id === th.partner) : undefined

  return (
    <>
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/messages" aria-label={t("actions.back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("titles.message")}</h1>
        <ActionMenu
          title={b(th.subject)}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("actions.more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[
            [
              { key: "assign", icon: "user-tag", label: t("actions.assign"), onSelect: () => setDlg("assign") },
              { key: "link", icon: "link-2", label: t("actions.linkRecord"), onSelect: () => setDlg("link") },
              { key: "archive", icon: "archive", label: t("actions.archive"), onSelect: archive },
              partner && { key: "partner", icon: "buildings", label: t("actions.openPartner"), href: partnerHref(partner.id) },
            ],
          ]}
        />
      </div>
      <MessagesInner
        tab="inbox"
        actions={
          <>
            <Button variant="outline" onClick={() => setDlg("link")}>
              <Icon name="link-2" size={18} />
              {t("actions.linkRecord")}
            </Button>
            <Button onClick={() => setDlg("assign")}>
              <Icon name="user-tag" size={18} />
              {t("actions.assign")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <SubjectCard th={th} />
            {th.messages.slice(0, -1).map((m) => (
              <Earlier key={m.id} m={m} th={th} />
            ))}
            <Latest th={th} />
            <ReplyCard th={th} />
          </div>
          <div className="flex flex-col gap-4">
            <Linked th={th} onLink={() => setDlg("link")} />
            {partner && <PartnerCard id={partner.id} />}
            <WhoSees th={th} />
            <Activity th={th} />
          </div>
        </div>
      </MessagesInner>
      {dlg === "assign" && <AssignDialog thread={th} onOpenChange={(o) => !o && setDlg(null)} />}
      {dlg === "link" && <LinkDialog thread={th} onOpenChange={(o) => !o && setDlg(null)} />}
    </>
  )
}

/* ------------------------------------------------------------------ main column */

/** Short name for "who → who": you, the mailbox ("cardiology@"), the insurer's short name, or the person. */
function usePartyShort() {
  const { t, b } = useMailText()
  const boxes = useMailboxes()
  return (p: Party) => {
    if (p.staff === ME) return t("message.You")
    const mb = boxes.find((m) => m.address === p.email)
    if (mb) return mb.kind === "shared" ? b({ en: mb.short, ar: mb.name.ar }) : b(mb.name)
    if (p.staff && STAFF[p.staff]) return b(STAFF[p.staff].name)
    const partner = p.partner ? PARTNERS.find((x) => x.id === p.partner) : undefined
    const ins = partner?.billingInsurer ? INSURERS.find((i) => i.id === partner.billingInsurer) : undefined
    return ins ? b(ins.short) : partner ? b(partner.name) : b(p.name)
  }
}

function SubjectCard({ th }: { th: Thread }) {
  const { t, b, dates } = useMailText()
  const first = th.messages[0]
  const g = first?.from.staff === ME ? "you" : first?.from.staff && STAFF[first.from.staff]?.female ? "f" : "m"
  const who = first?.from.staff === ME ? t("message.you") : first ? b(first.from.name) : ""
  return (
    <section className="flex flex-col gap-3 rounded-[14px] border bg-card p-4 md:p-6">
      <h2 className="text-xl font-semibold text-foreground md:text-2xl">{b(th.subject)}</h2>
      {first && <p className="text-xs text-muted-foreground">{t("message.count", { n: th.messages.length, date: dates.dayMonth(first.at), who, g })}</p>}
      <ThreadChips t={th} assigned partner />
    </section>
  )
}

function Earlier({ m, th }: { m: MailMessage; th: Thread }) {
  const { t, b, dates } = useMailText()
  const short = usePartyShort()
  const [open, setOpen] = React.useState(false)
  const when = `${dates.dayMonth(m.at)} ${m.at.slice(11, 16)}`
  return (
    <section className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:px-6"
      >
        <Icon name="message-text" size={18} className="shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">{t("message.arrow", { a: short(m.from), b: m.to.map(short).join("، ") })}</span>
          <span className="text-xs text-muted-foreground">{b(m.summary)}</span>
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">{when}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-foreground md:px-6">
          {m.body.map((p, i) => (
            <p key={i}>{b(p)}</p>
          ))}
          {m.files?.map((f, i) => <FileRow key={i} file={f} thread={th} />)}
        </div>
      )}
    </section>
  )
}

function Latest({ th }: { th: Thread }) {
  const { b, stamp, t } = useMailText()
  const m = th.messages.at(-1)
  if (!m) return null
  return (
    <section className="flex flex-col gap-3.5 rounded-[14px] border bg-card p-4 md:p-6">
      <FromLine t={{ ...th, messages: [m] }} time={stamp(m.at)} />
      {m.encrypted && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="lock" size={14} />
          {t("message.encrypted")}
        </span>
      )}
      <div className="flex flex-col gap-3.5 text-sm text-foreground">
        {m.body.map((p, i) => (
          <p key={i}>{b(p)}</p>
        ))}
      </div>
      {m.files?.map((f, i) => <FileRow key={i} file={f} thread={th} />)}
    </section>
  )
}

/** Reply card: from the mailbox to the sender, Use template, message, signature, attach, Send reply. */
function ReplyCard({ th }: { th: Thread }) {
  const templates = useTemplates(TEMPLATES)
  const signatures = useSignatures(SIGNATURES)
  const { t, b, l } = useMailText()
  const me = useMe()
  const boxes = useMailboxes()
  const members = useMemberships()
  const policies = usePolicies()
  const box = boxes.find((m) => m.id === th.mailbox)
  const last = th.messages.at(-1)
  const lastIn = [...th.messages].reverse().find((m) => m.from.staff !== me && !boxes.some((x) => x.address === m.from.email))
  const to = lastIn?.from ?? last?.to[0]
  const [text, setText] = React.useState(th.draft ? b(th.draft) : "")
  const [files, setFiles] = React.useState<Attachment[]>([])
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const sig = signatures.find((s) => s.id === box?.signature) ?? signatures.find((s) => s.id === "sig-khaled")!
  const sigLine = `${b(sig.title)} · ${b(CENTER)}`

  if (!box || !to) return null
  if (!canReply(th, me, boxes, members))
    return (
      <MsgCard title={t("message.reply")}>
        <Note icon="lock">{t("message.readOnly", { box: boxLabel(box, b, l) })}</Note>
      </MsgCard>
    )

  const toFirst = b(to.name).split(" ")[0]
  const partnerTemplates = templates.filter((x) => x.audience === "partners")
  const applyTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id)!
    const body = b(tpl.text).replaceAll("{first_name}", toFirst)
    setText((cur) => (cur.trim() ? `${cur.trim()}\n\n${body}` : body))
    toast.info(t("toasts.templateApplied"), { description: t("toasts.templateAppliedText") })
  }
  const attach = (list: FileList | null) => {
    if (!list?.length) return
    const added = [...list].map((f) => ({
      name: { en: f.name, ar: f.name },
      meta: { en: `${(f.name.split(".").pop() ?? "file").toUpperCase()} · ${Math.max(1, Math.round(f.size / 1024))} KB`, ar: `${(f.name.split(".").pop() ?? "file").toUpperCase()} · ${Math.max(1, Math.round(f.size / 1024))} KB` },
      kind: f.type.includes("pdf") ? ("pdf" as const) : f.type.startsWith("image") ? ("image" as const) : ("doc" as const),
    }))
    setFiles((x) => [...x, ...added])
    toast.info(t("toasts.fileAttached"), { description: added.map((f) => f.name.en).join(", ") })
  }
  const send = async () => {
    setTried(true)
    if (!text.trim() || busy) return
    setBusy(true)
    await new Promise((r) => setTimeout(r, 400))
    const outside = !to.email.endsWith(`@${ORG_DOMAIN}`)
    const encrypted = policies.encryptOutside && outside && !!patientLinkOf(th)
    const paras = text.trim().split(/\n{2,}/)
    const msg: MailMessage = {
      id: `${th.id}-r${th.messages.length + 1}`,
      from: { name: STAFF[me].name, org: box.kind === "shared" ? box.name : undefined, email: box.address, staff: me },
      to: [to],
      at: MSG_NOW,
      summary: { en: paras[0].slice(0, 90), ar: paras[0].slice(0, 90) },
      body: paras.map((p) => ({ en: p, ar: p })),
      files: files.length ? files : undefined,
      encrypted,
    }
    sendReply(th.id, msg, msg.summary)
    setBusy(false)
    setText("")
    setFiles([])
    setTried(false)
    const from = box.kind === "shared" ? b({ en: box.address, ar: box.name.ar }) : l(box.address)
    toast.success(t("toasts.replySent"), { description: encrypted ? t("toasts.replySentEnc", { from }) : t("toasts.replySentText", { from }) })
  }

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border bg-card p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{t("message.reply")}</h2>
          <p className="text-xs text-muted-foreground">{t("message.replyFrom", { from: l(box.address), to: b(to.name) })}</p>
        </div>
        <ActionMenu
          title={t("message.partnerTemplates")}
          trigger={
            <Button variant="ghost">
              <Icon name="document-text" size={18} />
              {t("message.useTemplate")}
            </Button>
          }
          groups={[partnerTemplates.map((x) => ({ key: x.id, icon: "document-text" as const, label: b(x.name), onSelect: () => applyTemplate(x.id) }))]}
        />
      </div>
      <Field label={t("message.message")} error={tried && !text.trim() ? t("message.errEmpty") : undefined}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("message.placeholder")} rows={4} />
      </Field>
      {files.map((f, i) => (
        <FileRow key={i} file={f} onRemove={() => setFiles((x) => x.filter((_, k) => k !== i))} />
      ))}
      <p className="text-xs text-muted-foreground">{t("message.signature", { sig: sigLine })}</p>
      <div className="flex items-center gap-2">
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => attach(e.target.files)} />
        <Button variant="ghost" size="icon" onClick={() => fileInput.current?.click()} aria-label={t("message.attach")}>
          <Icon name="paperclip-2" size={20} />
        </Button>
        <span className="flex-1" />
        <Button onClick={send} disabled={busy}>
          <Icon name="send-2" size={18} />
          {busy ? t("message.sending") : t("message.send")}
        </Button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ side */

function Linked({ th, onLink }: { th: Thread; onLink: () => void }) {
  const { t, b } = useMailText()
  // The number that found it: a reference (PA, CLM, INV, REF, REQ, CTR) rather than the patient it led to.
  const order = ["preauth", "claim", "invoice", "referral", "request", "contract", "visit", "patient"]
  const auto = th.links.filter((l) => l.auto).sort((a, x) => order.indexOf(a.kind) - order.indexOf(x.kind))[0]
  return (
    <MsgCard title={t("message.linked")} sub={th.links.length ? (auto ? t("message.linkedAuto", { what: t(`message.what.${auto.kind}`) }) : t("message.linkedHand")) : t("message.noLinks")}>
      {th.links.length > 0 && (
        <ul className="flex flex-col">
          {th.links.map((x) => {
            const href = linkHref(x)
            const row = (
              <>
                <IconTile icon={LINK_ICON[x.kind]} className="bg-accent text-primary" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{b(x.label)}</span>
                  <span className="text-xs text-muted-foreground">{b(x.sub)}</span>
                </span>
                {href && <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground rtl:-scale-x-100" />}
              </>
            )
            return (
              <li key={x.ref} className="border-b last:border-b-0">
                {href ? (
                  <Link href={href} className="flex items-center gap-2.5 py-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 py-2.5">{row}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Button variant="outline" className="w-full" onClick={onLink}>
        <Icon name="link-2" size={18} />
        {th.links.length ? t("message.linkAnother") : t("message.linkOne")}
      </Button>
    </MsgCard>
  )
}

function PartnerCard({ id }: { id: string }) {
  const { t, b } = useMailText()
  const p = PARTNERS.find((x) => x.id === id)!
  return (
    <MsgCard title={t("message.partner")}>
      <div className="flex items-center gap-2.5">
        <LogoTile initials={p.initials} tone={p.tone} size={40} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{b(p.name)}</span>
          <span className="text-xs text-muted-foreground">{t("message.partnerLine", { type: t(`partnerType.${p.type}`), n: p.openCount })}</span>
        </span>
      </div>
      <Button variant="outline" className="w-full" asChild>
        <Link href={partnerHref(p.id)}>{t("actions.openPartner")}</Link>
      </Button>
    </MsgCard>
  )
}

function WhoSees({ th }: { th: Thread }) {
  const { t, b, l } = useMailText()
  const me = useMe()
  const role = useMsgRole()
  const boxes = useMailboxes()
  const members = useMemberships()
  const box = boxes.find((m) => m.id === th.mailbox)!
  const level = levelIn(box, me, members)
  const shared = box.kind === "shared"
  return (
    <MsgCard title={t("message.who")}>
      <KvRows
        rows={[
          [t("message.mailbox"), shared ? t("message.boxShared", { box: b({ en: box.short, ar: l(box.address) }) }) : t("message.boxPersonal")],
          [t("message.people"), shared ? t("message.peopleN", { n: peopleIn(box, members) }) : t("message.onlyYou")],
          [t("message.patientData"), patientLinkOf(th) ? t("message.careTeam") : t("message.everyone"), patientLinkOf(th) ? "warning" : undefined],
          [t("message.yourAccess"), level ? t(`access.${level}`) : "–", "success"],
        ]}
      />
      {shared && msgCan(role, "admin") && (
        <Button variant="ghost" className={cn("w-fit")} asChild>
          <Link href={mailboxHref(box.id)}>{t("message.mailboxAccess")}</Link>
        </Button>
      )}
    </MsgCard>
  )
}

function Activity({ th }: { th: Thread }) {
  const { t, b, isToday, dates } = useMailText()
  const events = [...th.events].sort((a, x) => a.at.localeCompare(x.at))
  return (
    <MsgCard title={t("message.activity")}>
      {events.length ? (
        <ul className="flex flex-col gap-3">
          {events.map((e, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs">
              <span className="w-12 shrink-0 font-medium text-muted-foreground tabular-nums">{isToday(e.at) ? e.at.slice(11, 16) : dates.dayMonth(e.at)}</span>
              <span className="min-w-0 flex-1 text-foreground">{b(e.text)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("message.noActivity")}</p>
      )}
    </MsgCard>
  )
}
