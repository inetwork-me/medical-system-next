"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { usePageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { INSURERS } from "@/modules/billing/data"
import { claimsHref, insurerHref } from "@/modules/billing/href"
import { CONTACTS, MSG_TODAY, PARTNERS, STAFF } from "./data"
import { MessagesInner } from "./frame"
import { composeHref, partnersHref, threadHref } from "./href"
import { patientLinkOf } from "./mail-parts"
import { KvRows, LogoTile, MiniChip, MsgCard, PersonAvatar, ThreadStatusBadge, useMsgText } from "./parts"
import { AddContactDialog } from "./partners"
import { canOpenThread } from "./rules"
import { useContacts, useMailboxes, useMe, useMemberships, useThreads } from "./store"
import type { Partner, Thread } from "./types"

/** Pre-auths this month (Billing doesn't track pre-auth requests yet; the design's Bupa figure). */
const PREAUTHS: Record<string, { n: number; waiting: number }> = { bupa: { n: 41, waiting: 2 } }
/** Team behind each shared mailbox ("Who sees Bupa mail"). */
const TEAM: Record<string, { en: string; ar: string }> = {
  claims: { en: "Claims", ar: "المطالبات" },
  billing: { en: "Billing", ar: "الفواتير" },
  cardiology: { en: "Cardiology", ar: "القلب" },
  referrals: { en: "Referrals", ar: "التحويلات" },
  "reception-olaya": { en: "Olaya reception", ar: "استقبال العليا" },
}

/**
 * Partner (inner page of Partners, `/messages/partners/partner?id=bupa`): header Back · "Messages / Partners" over the name;
 * Add contact · New message. Banner (logo, name, type · partner since · domain; agreement, overdue claims, conversations;
 * Insurer details → Billing). Conversations across Al Noor's mailboxes (All / Open / Pre-auth / Claims) — the ones you can't
 * open are locked, and their patient names hidden. Side: People at {partner}, Linked (from Billing), Who sees {partner} mail.
 */
export function PartnerPage() {
  const { t, b } = useMsgText()
  const id = useSearchParams().get("id") ?? ""
  const p = PARTNERS.find((x) => x.id === id)
  const [dlg, setDlg] = React.useState(false)
  usePageTitle({
    title: p ? b(p.name) : t("titles.partner"),
    back: partnersHref(),
    crumbs: [
      { label: t("title"), href: "/messages" },
      { label: t("partners.title"), href: partnersHref() },
    ],
  })
  if (!p)
    return (
      <MessagesInner tab="partners">
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="buildings"
            title={t("partner.notFound")}
            description={t("partner.notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={partnersHref()}>{t("partner.back")}</Link>
              </Button>
            }
          />
        </div>
      </MessagesInner>
    )
  const ins = p.billingInsurer && isModuleEnabled("billing") ? INSURERS.find((i) => i.id === p.billingInsurer) : undefined
  const canCompose = isTabEnabled("messages", "inbox")
  return (
    <>
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={partnersHref()} aria-label={t("actions.back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{b(p.name)}</h1>
        <ActionMenu
          title={b(p.name)}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("actions.more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[
            [
              canCompose && { key: "new", icon: "sms", label: t("actions.newMessage"), href: composeHref({ partner: p.id }) },
              { key: "contact", icon: "user-add", label: t("actions.addContact"), onSelect: () => setDlg(true) },
              !!ins && { key: "ins", icon: "buildings", label: t("actions.insurerDetails"), href: insurerHref(ins.id) },
            ],
          ]}
        />
      </div>
      <MessagesInner
        tab="partners"
        actions={
          <>
            <Button variant="outline" onClick={() => setDlg(true)}>
              <Icon name="user-add" size={18} />
              {t("actions.addContact")}
            </Button>
            {canCompose && (
              <Button asChild>
                <Link href={composeHref({ partner: p.id })}>
                  <Icon name="add" size={18} />
                  {t("actions.newMessage")}
                </Link>
              </Button>
            )}
          </>
        }
      >
        <Banner p={p} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
          <Conversations p={p} />
          <div className="flex flex-col gap-4">
            <People p={p} onAdd={() => setDlg(true)} />
            <Linked p={p} />
            <WhoSees p={p} />
          </div>
        </div>
      </MessagesInner>
      {dlg && <AddContactDialog partner={p.id} onOpenChange={setDlg} />}
    </>
  )
}

function Banner({ p }: { p: Partner }) {
  const { t, b, l, dates } = useMsgText()
  const ins = p.billingInsurer ? INSURERS.find((i) => i.id === p.billingInsurer) : undefined
  const active = ins?.signed && ins.validTo && ins.validTo >= MSG_TODAY
  const ending = active && ins!.validTo! <= "2027-03-31"
  return (
    <section className="flex flex-col gap-4 rounded-[14px] border bg-card p-4 md:flex-row md:items-center md:px-6 md:py-5">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <LogoTile initials={p.initials} tone={p.tone} size={56} className="max-md:size-11!" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-semibold text-foreground md:text-2xl">{b(p.name)}</h2>
          <p className="text-xs text-muted-foreground">{t("partner.since", { type: t(`partnerType.${p.type}`), year: p.since, domain: l(p.domains[0]) })}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {active && (
          <MiniChip icon="tick-circle" tone={ending ? "warning" : "success"}>
            {ending ? t("partner.agreementEnds", { date: dates.dayMonth(ins!.validTo!) }) : t("partner.agreementActive")}
          </MiniChip>
        )}
        {!!ins?.stats.owedOverdueClaims && (
          <MiniChip icon="receipt-2" tone="warning">
            {t("partner.overdue", { n: ins.stats.owedOverdueClaims })}
          </MiniChip>
        )}
        {p.openCount > 0 && (
          <MiniChip icon="messages-2" tone="primary">
            {t("partner.convs", { n: p.openCount })}
          </MiniChip>
        )}
      </div>
      {ins && isModuleEnabled("billing") && (
        <Button variant="outline" asChild className="max-md:hidden">
          <Link href={insurerHref(ins.id)}>{t("actions.insurerDetails")}</Link>
        </Button>
      )}
    </section>
  )
}

type CFilter = "all" | "open" | "preauth" | "claims"

/** Every conversation with the partner across Al Noor's mailboxes; open only what your access allows. */
function Conversations({ p }: { p: Partner }) {
  const { t, b, l, when: w, stamp, isToday } = useMsgText()
  const when = (iso: string) => (isToday(iso) ? stamp(iso).toLowerCase() : w(iso))
  const me = useMe()
  const boxes = useMailboxes()
  const members = useMemberships()
  const all = useThreads()
    .filter((x) => x.partner === p.id && x.folder !== "drafts")
    .sort((a, x) => x.lastAt.localeCompare(a.lastAt))
  const [f, setF] = React.useState<CFilter>("all")
  const pick = (k: CFilter) => all.filter((x) => (k === "all" ? true : k === "open" ? x.status !== "closed" : x.topic === k))
  const list = pick(f)
  const [shown, setShown] = React.useState(5)
  const box = (id: string) => boxes.find((m) => m.id === id)
  const who = (x: Thread) => {
    const m = x.messages.at(-1)
    if (!m) return ""
    if (m.from.staff === me) return t("chat.you")
    if (m.from.staff && STAFF[m.from.staff]) return b(STAFF[m.from.staff].name)
    return b(m.from.name)
  }
  return (
    <MsgCard title={t("partner.conversations")} sub={t("partner.convSub", { n: all.length })}>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        <Segmented
          size="sm"
          className="w-max"
          value={f}
          onValueChange={(v) => {
            setF(v)
            setShown(5)
          }}
          options={(["all", "open", "preauth", "claims"] as CFilter[]).map((k) => ({ value: k, label: t(`partner.f.${k}`, { n: pick(k).length }) }))}
        />
      </div>
      {list.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">{t("partner.empty")}</p>}
      <ul className="flex flex-col">
        {list.slice(0, shown).map((x) => {
          const ok = canOpenThread(x, me, boxes, members)
          const mb = box(x.mailbox)
          const boxShort = mb ? l(mb.short) : x.mailbox
          // Subjects that name a patient stay hidden from people who can't open the email.
          const subject = !ok && patientLinkOf(x) ? `${b(x.subject).split(" · ")[0]} · ${t("partner.hidden")}` : b(x.subject)
          const body = (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground">
                <Icon name="sms" size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("truncate text-sm font-medium", ok ? "text-foreground" : "text-muted-foreground")}>{subject}</span>
                <span className="text-xs text-muted-foreground">{ok ? t("partner.lastFrom", { who: who(x), when: when(x.lastAt) }) : t("partner.locked", { box: boxShort })}</span>
                <span className="flex flex-wrap items-center gap-1.5 md:hidden">
                  <MiniChip icon="direct-inbox">{boxShort}</MiniChip>
                  <ThreadStatusBadge status={x.status} />
                </span>
              </span>
              <span className="hidden w-36 shrink-0 md:block">
                <MiniChip icon="direct-inbox">{boxShort}</MiniChip>
              </span>
              <span className="hidden w-32 shrink-0 md:block">
                <ThreadStatusBadge status={x.status} />
              </span>
              <Icon name={ok ? "arrow-right-1" : "lock"} size={ok ? 20 : 16} className={cn("shrink-0", ok ? "text-foreground rtl:-scale-x-100" : "text-muted-foreground")} />
            </>
          )
          const cls = "flex w-full items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          return (
            <li key={x.id} className="border-b last:border-b-0">
              {ok ? (
                <Link href={threadHref(x.id)} className={cls}>
                  {body}
                </Link>
              ) : (
                <button type="button" className={cls} onClick={() => toast.info(t("partner.lockedToast", { box: boxShort }), { description: t("partner.lockedToastText") })}>
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {list.length > shown && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            toast.info(t("toasts.moreLoaded", { n: Math.min(20, list.length - shown) }), { description: t("toasts.moreLoadedText") })
            setShown(shown + 20)
          }}
        >
          {t("actions.showMore")}
        </Button>
      )}
    </MsgCard>
  )
}

function People({ p, onAdd }: { p: Partner; onAdd: () => void }) {
  const { t, b, l } = useMsgText()
  const people = useContacts(CONTACTS).filter((c) => c.partner === p.id)
  const short = b(p.name).split(" ")[0]
  return (
    <MsgCard
      title={t("partner.people", { name: short })}
      sub={people.length ? t("partner.contactsN", { n: people.length }) : t("partner.noContacts")}
      action={
        <Button variant="ghost" onClick={onAdd}>
          <Icon name="user-add" size={18} />
          {t("actions.add")}
        </Button>
      }
    >
      {people.length > 0 && (
        <ul className="flex flex-col gap-3">
          {people.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5">
              <PersonAvatar initials={c.initials} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm text-foreground">{b(c.name)}</span>
                {(c.role.en || c.role.ar) && <span className="text-xs text-muted-foreground">{b(c.role)}</span>}
                <span className="truncate text-xs text-muted-foreground">{l(c.email)}</span>
              </span>
              {isTabEnabled("messages", "inbox") && (
                <Button variant="ghost" size="icon" asChild>
                  <Link href={composeHref({ to: c.email })} aria-label={t("partner.message", { name: b(c.name) })}>
                    <Icon name="sms" size={20} />
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </MsgCard>
  )
}

/** Linked: agreement and money owed come from Billing; non-insurers show their contract / referral line. */
function Linked({ p }: { p: Partner }) {
  const { t, b, l, dates } = useMsgText()
  const ins = p.billingInsurer ? INSURERS.find((i) => i.id === p.billingInsurer) : undefined
  const pre = PREAUTHS[p.id]
  const rows: [React.ReactNode, React.ReactNode, ("warning" | "success")?][] = ins
    ? [
        [t("partner.agreement"), ins.validTo ? t("partner.agreementVal", { no: l(ins.agreementNo), date: dates.short(ins.validTo) }) : l(ins.agreementNo)],
        [t("partner.openClaims"), t("partner.openClaimsVal", { amount: ins.stats.owed.toLocaleString("en-US"), n: ins.stats.owedOverdueClaims }), ins.stats.owedOverdueClaims ? "warning" : undefined],
        ...(pre ? ([[t("partner.preauths"), t("partner.preauthsVal", pre)]] as [React.ReactNode, React.ReactNode][]) : []),
      ]
    : [[t("partner.agreement"), b(p.linked)]]
  return (
    <MsgCard title={t("partner.linked")}>
      <KvRows rows={rows} />
      {ins && isModuleEnabled("billing") && isTabEnabled("billing", "claims") && (
        <Button variant="outline" className="w-full" asChild>
          <Link href={claimsHref({ q: ins.short.en })}>{t("actions.openClaims")}</Link>
        </Button>
      )}
    </MsgCard>
  )
}

function WhoSees({ p }: { p: Partner }) {
  const { t, b, l } = useMsgText()
  const boxes = useMailboxes()
  const ids = [...new Set(useThreads().filter((x) => x.partner === p.id && x.folder !== "drafts").map((x) => x.mailbox))]
  const shared = ids.map((id) => boxes.find((m) => m.id === id)).filter((m) => m && m.kind === "shared")
  const short = b(p.name).split(" ")[0]
  return (
    <MsgCard title={t("partner.who", { name: short })}>
      <KvRows
        rows={[
          [t("partner.mailboxes"), shared.length ? shared.map((m) => l(m!.short)).join(" · ") : t("partner.nothing")],
          [t("partner.teams"), shared.length ? shared.map((m) => b(TEAM[m!.id] ?? m!.name)).join(b({ en: ", ", ar: "، " })) : t("partner.nothing")],
        ]}
      />
    </MsgCard>
  )
}
