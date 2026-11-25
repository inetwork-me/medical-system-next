"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isModuleEnabled } from "@/lib/modules"
import { pdfDocument } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { Icon, type IconName } from "@/components/ds/icon"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { PATIENTS } from "@/modules/records/data"
import { visitHref } from "@/modules/records/href"
import { patientHref } from "@/modules/patients/href"
import { CENTER, ME, PARTNERS, STAFF } from "./data"
import { partnerHref } from "./href"
import { patientSex } from "./linkables"
import { LogoTile, MiniChip, Note, PersonAvatar, useMsgText } from "./parts"
import { logEvent, useMailboxes } from "./store"
import type { Attachment, Mailbox, RecordLink, Thread } from "./types"

/* ------------------------------------------------------------------ text */

/** Mail helpers: mailbox chip label, first names, the thread's patient. */
export function useMailText() {
  const x = useMsgText()
  const boxes = useMailboxes()
  const box = (id: string) => boxes.find((m) => m.id === id)
  return {
    ...x,
    box,
    /** "cardiology@" on chips (Latin, isolated in Arabic). */
    chip: (id: string) => x.l(box(id)?.short ?? id),
    staffName: (k: string) => (STAFF[k] ? x.b(STAFF[k].name) : k),
    firstName: (k: string) => {
      const n = STAFF[k] ? x.b(STAFF[k].name) : k
      return n.replace(/^(Dr\.|Nurse|د\.|الممرضة)\s+/, "").split(" ")[0]
    },
  }
}

export const patientLinkOf = (t: Pick<Thread, "links">) => t.links.find((l) => l.kind === "patient" && l.patient)
export const recordsPatient = (key?: string) => (key ? (PATIENTS as unknown as Record<string, { patientId?: string; name: { en: string; ar: string }; mrn: string; sex: "m" | "f" }>)[key] : undefined)

/** Where a linked record opens (patient page, Records visit) — only when its module is on. */
export function linkHref(l: RecordLink): string | undefined {
  if (l.kind === "patient") {
    const p = recordsPatient(l.patient)
    return p?.patientId && isModuleEnabled("patients") ? patientHref(p.patientId) : undefined
  }
  if (l.kind === "visit") return isModuleEnabled("records") ? visitHref(l.ref) : undefined
  return undefined
}

export const LINK_ICON: Record<RecordLink["kind"], IconName> = {
  patient: "profile-2user",
  visit: "calendar",
  invoice: "receipt-2",
  claim: "shield-tick",
  contract: "document-text",
  request: "document-text",
  preauth: "shield-tick",
  referral: "link-2",
}

/* ------------------------------------------------------------------ chips */

/** Short label for a link chip: patient "Fahad · MRN-17654", others their number. */
export function useLinkChip() {
  const { b, l } = useMsgText()
  return (x: RecordLink) => {
    if (x.kind === "patient") {
      const first = b(x.label).split(" ")[0]
      return b({ en: `${first} · ${x.ref}`, ar: `${first} · ${x.ref}` })
    }
    return l(x.ref.startsWith("draft:") ? x.label.en : x.ref)
  }
}

/**
 * Chips on a thread (inbox row, reading pane, subject card): mailbox · assigned (amber when you) · partner · links (blue).
 * The patient chip opens the patient page; the partner chip the Partner page.
 */
export function ThreadChips({
  t,
  assigned,
  partner,
  files,
  links = "all",
  plain,
}: {
  t: Thread
  assigned?: boolean
  partner?: boolean
  files?: boolean
  links?: "all" | "first"
  /** Inside a clickable row: chips are labels, not links. */
  plain?: boolean
}) {
  const { t: tr, chip, b, firstName } = useMailText()
  const linkChip = useLinkChip()
  const box = useMailText().box(t.mailbox)
  const p = partner && t.partner ? PARTNERS.find((x) => x.id === t.partner) : undefined
  // Chips carry the patient and reference numbers; visits only show on the Linked to card (as drawn).
  const refs = t.links.filter((x) => x.kind !== "visit")
  const shown = links === "first" ? refs.slice(0, 1) : refs
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <MiniChip icon={box?.kind === "linked" && box.provider === "google" ? "google" : "direct-inbox"}>{chip(t.mailbox)}</MiniChip>
      {assigned && t.assignee && (
        <MiniChip icon="user-tag" tone={t.assignee.to === ME ? "warning" : undefined}>
          {t.assignee.to === ME ? tr("chips.assignedYou") : tr("message.assignedTo", { name: firstName(t.assignee.to) })}
        </MiniChip>
      )}
      {p && (
        <Link href={partnerHref(p.id)} className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <MiniChip icon="buildings" tone="info">
            {tr("chips.partner", { name: b(p.name) })}
          </MiniChip>
        </Link>
      )}
      {shown.map((x) => {
        const href = plain ? undefined : linkHref(x)
        const c = (
          <MiniChip icon="link-2" tone="primary">
            {linkChip(x)}
          </MiniChip>
        )
        return href ? (
          <Link key={x.ref} href={href} className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {c}
          </Link>
        ) : (
          <React.Fragment key={x.ref}>{c}</React.Fragment>
        )
      })}
      {files && t.files > 0 && <MiniChip icon="paperclip-2">{tr("inbox.files", { n: t.files })}</MiniChip>}
    </div>
  )
}

/** Lock note on patient-linked mail ("Only his care team and Claims can open it"). */
export function PatientLock({ t }: { t: Thread }) {
  const { t: tr } = useMsgText()
  const p = patientLinkOf(t)
  if (!p) return null
  return <Note icon="lock">{tr("inbox.lock", { sex: patientSex(p.patient) })}</Note>
}

/* ------------------------------------------------------------------ rows */

/** Sender mark: organisation logo tile or a person's avatar. */
export function SenderMark({ t, size = 32 }: { t: Thread; size?: 32 | 36 | 40 }) {
  return t.sender.person ? <PersonAvatar initials={t.sender.initials} size={size >= 40 ? "default" : "sm"} /> : <LogoTile initials={t.sender.initials} tone={t.sender.tone ?? "muted"} size={size} />
}

/**
 * Inbox row: sender logo / avatar, sender + time (blue + dot when unread), subject (12 Medium), snippet, chips (mailbox,
 * first link, files). Selected = accent tint.
 */
export function MailRow({ t, selected, href, onSelect, flush }: { t: Thread; selected?: boolean; href?: string; onSelect?: () => void; flush?: boolean }) {
  const { b, when, t: tr } = useMailText()
  const body = (
    <>
      <SenderMark t={t} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{t.folder === "drafts" ? tr("inbox.folder.drafts") : b(t.sender.name)}</span>
          <span className={cn("shrink-0 text-xs", t.unread ? "text-primary" : "text-muted-foreground")}>{when(t.lastAt)}</span>
          {t.unread && <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />}
          {t.flagged && <Icon name="flag" size={14} className="shrink-0 text-warning" aria-label={tr("inbox.folder.flagged")} />}
        </span>
        <span className="truncate text-xs font-medium text-foreground">{b(t.subject)}</span>
        <span className="truncate text-xs text-muted-foreground">{t.folder === "drafts" ? tr("inbox.draftHint") : b(t.snippet)}</span>
        <ThreadChips t={t} links="first" files plain />
      </span>
    </>
  )
  const cls = cn(
    "flex w-full items-start gap-2.5 border-b py-3 text-start outline-none last:border-b-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
    flush ? "px-0" : "px-4",
    selected ? "bg-accent" : "hover:bg-muted/50"
  )
  if (href)
    return (
      <Link href={href} className={cls} aria-current={selected || undefined}>
        {body}
      </Link>
    )
  return (
    <button type="button" onClick={onSelect} className={cls} aria-current={selected || undefined}>
      {body}
    </button>
  )
}

/* ------------------------------------------------------------------ files */

/** Attachment row: icon tile, name + "PDF · 1 page", download (a real PDF copy; the download is logged). */
export function FileRow({ file, thread, onRemove }: { file: Attachment; thread?: Thread; onRemove?: () => void }) {
  const { b, t, locale } = useMsgText()
  const download = async () => {
    const blob = await pdfDocument(
      [
        { kind: "brand", title: b(CENTER), subtitle: thread ? b(thread.subject) : undefined },
        { kind: "title", text: b(file.name) },
        { kind: "meta", text: b(file.meta) },
        { kind: "note", text: t("message.attached") },
      ],
      { dir: locale === "ar" ? "rtl" : "ltr", title: file.name.en }
    )
    saveBlob(blob, `${file.name.en.replace(/[^\w.-]+/g, "-")}.pdf`)
    logEvent({ kind: "opened", actor: ME, mailbox: thread?.mailbox, thread: thread?.id, text: { en: `You downloaded ${file.name.en}`, ar: `حمّلت ${file.name.ar}` } })
    toast.info(t("toasts.pdf"), { description: t("toasts.pdfText") })
  }
  return (
    <div className="flex items-center gap-3 rounded-[10px] border px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon name="document-text" size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{b(file.name)}</span>
        <span className="text-xs text-muted-foreground">{b(file.meta)}</span>
      </span>
      {onRemove ? (
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label={t("message.remove")}>
          <Icon name="trash" size={20} />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={download} aria-label={t("actions.download")}>
          <Icon name="document-download" size={22} />
        </Button>
      )}
    </div>
  )
}

/** "Sara Al-Ghamdi · Bupa Arabia" + email (or "from → to") + time at the end. */
export function FromLine({ t, size = 40, time, route }: { t: Thread; size?: 36 | 40; time?: string; route?: string }) {
  const { b, l } = useMsgText()
  const m = t.messages.at(-1)
  if (!m) return null
  // Our own messages show the person who sent them; mail from outside shows the thread's sender mark.
  const staff = m.from.staff ? STAFF[m.from.staff] : undefined
  return (
    <div className="flex items-center gap-2.5">
      {staff ? <PersonAvatar initials={staff.initials} size={size >= 40 ? "default" : "sm"} /> : <SenderMark t={t} size={size} />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">
          {b(m.from.name)}
          {m.from.org && <> · {b(m.from.org)}</>}
        </span>
        <span className="truncate text-xs text-muted-foreground">{route ?? l(m.from.email)}</span>
      </span>
      {time && <span className="shrink-0 text-xs text-muted-foreground">{time}</span>}
    </div>
  )
}

/** Mailbox address for "From {mailbox}" lines (the Arabic UI uses the mailbox's Arabic name for shared ones). */
export const boxLabel = (box: Mailbox | undefined, b: (v: { en: string; ar: string }) => string, l: (s: string) => string) =>
  !box ? "" : box.kind === "shared" ? b({ en: box.address, ar: box.name.ar }) : l(box.address)
