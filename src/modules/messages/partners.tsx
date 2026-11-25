"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { INSURERS } from "@/modules/billing/data"
import { CONTACTS, ME, MSG_TODAY, PARTNER_TILES, PARTNERS } from "./data"
import { partnerHref } from "./href"
import { CountPill, LogoTile, MsgCard, Note, PartnerTypeChip, useMsgText } from "./parts"
import { addContact, useContacts, useThreads } from "./store"
import type { Contact, PartnerType } from "./types"

const PAGE = 6
type Filter = "all" | PartnerType

/** Agreements that end within the renewal window (Billing owns the dates): MedGulf (31 Dec 2026), Al Rajhi (31 Mar 2027). */
export function renewing() {
  const limit = "2027-03-31"
  const list = INSURERS.filter((i) => i.validTo && i.validTo >= MSG_TODAY && i.validTo <= limit)
  const last = list.map((i) => i.validTo!).sort().at(-1) ?? limit
  return { n: list.length, before: last }
}

/** Header action on Partners: Add contact. */
export function PartnersActions() {
  const { t } = useMsgText()
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="user-add" size={18} />
        {t("actions.addContact")}
      </Button>
      {open && <AddContactDialog onOpenChange={setOpen} />}
    </>
  )
}

/**
 * Widget / Msg Partners: tiles (partners, open conversations, waiting for them, agreements renewing), search (partner,
 * person or domain) and the type filter, then the table on desktop (partner, type, main contact, linked, last message +
 * open count, Open) or a list below; 6 at first, Show more for the rest.
 */
export function PartnersBody() {
  const { t, b, l, when: w, stamp, isToday, dates } = useMsgText()
  // "Today 10:42" for today, else "22 Nov" / "Yesterday".
  const when = (iso: string) => (isToday(iso) ? stamp(iso) : w(iso))
  const threads = useThreads()
  const contacts = useContacts(CONTACTS)
  const [q, setQ] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [all, setAll] = React.useState(false)
  const count = (k: Filter) => (k === "all" ? PARTNERS.length : PARTNERS.filter((p) => p.type === k).length)
  const words = q.trim().toLowerCase()
  const list = PARTNERS.filter((p) => filter === "all" || p.type === filter)
    .filter((p) => {
      if (!words) return true
      const people = contacts.filter((c) => c.partner === p.id).flatMap((c) => [c.name.en, c.name.ar, c.email])
      return [p.name.en, p.name.ar, ...p.domains, p.mainContact.en, p.mainContact.ar, ...people].join(" ").toLowerCase().includes(words)
    })
    // Directory order (as drawn); the last message is the newest in any mailbox.
    .map((p) => ({ p, last: [p.lastAt, ...threads.filter((x) => x.partner === p.id && x.folder !== "drafts").map((x) => x.lastAt)].sort().at(-1)! }))
  const shown = all || words || filter !== "all" ? list : list.slice(0, PAGE)
  const mine = threads.filter((x) => x.partner && x.assignee?.to === ME && x.folder === "inbox").length
  const open = PARTNERS.reduce((n, p) => n + p.openCount, 0)
  const r = renewing()
  const more = () => {
    setAll(true)
    toast.info(t("toasts.moreLoaded", { n: list.length - PAGE }), { description: t("toasts.moreLoadedText") })
  }
  const filters: Filter[] = all ? ["all", "insurer", "hospital", "lab", "supplier", "government"] : ["all", "insurer", "hospital", "lab", "supplier"]

  const tiles = [
    { label: t("partners.tPartners"), value: PARTNERS.length, sub: t("partners.tInsurers", { n: count("insurer") }) },
    { label: t("partners.tOpen"), value: open, sub: t("partners.tMine", { n: mine }) },
    { label: t("partners.tWaiting"), value: PARTNER_TILES.waitingThem, sub: t("partners.tOldest", { n: PARTNER_TILES.oldestWaitingDays }), warn: true },
    { label: t("partners.tRenewing"), value: r.n, sub: t("partners.tBefore", { date: dates.dayMonth(r.before) }) },
  ]

  return (
    <MsgCard title={t("partners.title")} sub={t("partners.sub")}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="flex flex-col gap-1 rounded-[10px] bg-muted p-3">
            <span className="text-xs text-muted-foreground">{x.label}</span>
            <span className="text-lg font-semibold text-foreground tabular-nums">{x.value}</span>
            <span className={cn("text-xs", x.warn ? "text-warning-soft-foreground" : "text-muted-foreground")}>{x.sub}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative xl:w-72">
          <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("partners.search")} aria-label={t("partners.search")} className="ps-9" />
        </div>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] xl:mx-0 xl:px-0">
          <Segmented size="sm" className="w-max min-w-full" value={filter} onValueChange={setFilter} options={filters.map((k) => ({ value: k, label: t(`partners.f.${k}`, { n: count(k) }) }))} />
        </div>
      </div>
      {shown.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">{t("partners.empty")}</p>}
      {shown.length > 0 && (
        <div className="hidden overflow-hidden rounded-[10px] border xl:block">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-normal">{t("partners.colPartner")}</th>
                <th className="w-28 px-2 py-3 text-start font-normal">{t("partners.colType")}</th>
                <th className="w-52 px-2 py-3 text-start font-normal">{t("partners.colContact")}</th>
                <th className="w-48 px-2 py-3 text-start font-normal">{t("partners.colLinked")}</th>
                <th className="w-32 px-2 py-3 text-start font-normal">{t("partners.colLast")}</th>
                <th className="w-20 px-4 py-3">
                  <span className="sr-only">{t("partners.open")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ p, last }) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2.5">
                    <Link href={partnerHref(p.id)} className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      <LogoTile initials={p.initials} tone={p.tone} size={36} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-foreground">{b(p.name)}</span>
                        <span className="text-xs text-muted-foreground">{l(p.domains[0])}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">
                    <PartnerTypeChip type={p.type} />
                  </td>
                  <td className="px-2 py-2.5 text-foreground">{b(p.mainContact)}</td>
                  <td className="px-2 py-2.5 text-muted-foreground">{b(p.linked)}</td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {when(last)}
                      <CountPill n={p.openCount} />
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={partnerHref(p.id)}>{t("partners.open")}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="flex flex-col xl:hidden">
        {shown.map(({ p, last }) => (
          <li key={p.id} className="border-b last:border-b-0">
            <Link href={partnerHref(p.id)} className="flex items-center gap-3 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <LogoTile initials={p.initials} tone={p.tone} size={36} />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="text-sm font-medium text-foreground">{b(p.name)}</span>
                <span className="text-xs text-muted-foreground">{t("partners.line", { type: t(`partnerType.${p.type}`), when: when(last) })}</span>
                {p.openCount > 0 && (
                  <span className="inline-flex h-5 items-center gap-1.5 rounded-sm bg-info-soft px-2 text-xs font-medium text-info-soft-foreground">
                    <span className="size-1.5 rounded-full bg-info" />
                    {t("partners.openN", { n: p.openCount })}
                  </span>
                )}
              </span>
              <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground rtl:-scale-x-100" />
            </Link>
          </li>
        ))}
      </ul>
      {!all && !words && filter === "all" && list.length > PAGE && (
        <div className="flex items-center justify-between gap-3">
          <span className="hidden text-xs text-muted-foreground xl:inline">{t("partners.showing", { n: PAGE, total: list.length })}</span>
          <Button variant="outline" onClick={more} className="max-xl:w-full">
            <span className="xl:hidden">{t("partners.showMoreN", { n: list.length - PAGE })}</span>
            <span className="hidden xl:inline">{t("partners.showMore")}</span>
          </Button>
        </div>
      )}
    </MsgCard>
  )
}

/* ------------------------------------------------------------------ Add contact */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Overlay · Add a contact (Add contact): partner (when opened from the list), name, role, email, mobile, what they handle
 * (pre-auth / claims / contracts), "Suggest in every mailbox that writes to {partner}". → `contact-added`.
 */
export function AddContactDialog({ partner: fixed, onOpenChange }: { partner?: string; onOpenChange: (open: boolean) => void }) {
  const { t, b, l } = useMsgText()
  const contacts = useContacts(CONTACTS)
  const [partner, setPartner] = React.useState(fixed ?? "")
  const [name, setName] = React.useState("")
  const [role, setRole] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [mobile, setMobile] = React.useState("")
  const [topic, setTopic] = React.useState<"preauth" | "claims" | "contracts">("claims")
  const [suggest, setSuggest] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const p = PARTNERS.find((x) => x.id === partner)
  const mail = email.trim().toLowerCase()
  const errors = {
    partner: !p ? t("contact.errPartner") : undefined,
    name: !name.trim() ? t("contact.errName") : undefined,
    email: !mail ? t("contact.errEmail") : !EMAIL.test(mail) ? t("contact.errEmailFormat") : contacts.some((c) => c.email.toLowerCase() === mail) ? t("contact.errTaken", { email: mail }) : undefined,
    mobile: mobile.trim() && !/^05\d{8}$/.test(mobile.replace(/\s+/g, "")) ? t("contact.errMobile") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const otherDomain = p && EMAIL.test(mail) && !p.domains.includes(mail.split("@")[1])
  const save = () => {
    setTried(true)
    if (invalid || !p) return
    const words = name.trim().split(/\s+/)
    const c: Contact = {
      id: `ct-${p.id}-${contacts.length + 1}`,
      partner: p.id,
      initials: (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase(),
      name: { en: name.trim(), ar: name.trim() },
      role: { en: role.trim(), ar: role.trim() },
      email: mail,
      mobile: mobile.trim() ? mobile.replace(/\s+/g, "") : undefined,
      topics: [topic],
      suggest,
    }
    addContact(c)
    toast.success(t("toasts.contactAdded"), { description: t("toasts.contactAddedText", { name: name.trim(), topic: t(`contact.${topic}`).toLowerCase() }) })
    onOpenChange(false)
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("contact.title")}
      description={p ? b(p.name) : undefined}
      icon="user-add"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("actions.add")}</Button>}
    >
      {tried && invalid && <Note tone="destructive">{t("contact.strip")}</Note>}
      {!fixed && (
        <Field label={t("contact.partner")} required error={tried ? errors.partner : undefined}>
          {(c) => (
            <Select value={partner} onValueChange={setPartner}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue placeholder={t("contact.pickPartner")} />
              </SelectTrigger>
              <SelectContent>
                {PARTNERS.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {b(x.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("contact.name")} required error={tried ? errors.name : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("contact.role")}>
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </Field>
        <Field label={t("contact.email")} required error={tried ? errors.email : undefined} helper={otherDomain ? t("contact.otherDomain", { domain: l(p?.domains[0] ?? "") }) : undefined}>
          <div className="relative">
            <Icon name="sms" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ps-9" />
          </div>
        </Field>
        <Field label={t("contact.mobile")} error={tried ? errors.mobile : undefined}>
          <div className="relative">
            <Icon name="call" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input dir="ltr" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05XXXXXXXX" className="ps-9" />
          </div>
        </Field>
      </div>
      <Field label={t("contact.handles")}>
        {(c) => (
          <Segmented
            {...c}
            value={topic}
            onValueChange={setTopic}
            options={[
              { value: "preauth", label: t("contact.preauth") },
              { value: "claims", label: t("contact.claims") },
              { value: "contracts", label: t("contact.contracts") },
            ]}
          />
        )}
      </Field>
      <div className="flex items-start gap-2">
        <Checkbox id="contact-suggest" checked={suggest} onCheckedChange={(v) => setSuggest(v === true)} className="mt-0.5" />
        <label htmlFor="contact-suggest" className="cursor-pointer text-sm text-foreground">
          {t("contact.suggest", { name: p ? b(p.name) : "…" })}
        </label>
      </div>
    </ResponsiveDialog>
  )
}
