"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { usePageTitle } from "@/components/shell/page-title"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Bi } from "@/lib/mock/bi"
import { CONTACTS, MSG_NOW, ORG_DOMAIN, PARTNERS, PATIENT_FILES, SIGNATURES, STAFF, TEMPLATES } from "./data"
import { NoAccess } from "./frame"
import { threadHref } from "./href"
import { LinkDialog } from "./mail-dialogs"
import { FileRow, LINK_ICON, recordsPatient, useMailText } from "./mail-parts"
import { ChoiceCard, ChoiceGroup, IconTile, KvRows, MsgCard, Note } from "./parts"
import { msgTabs } from "./roles"
import { sendableBoxes } from "./rules"
import { dlpStub, type Finding } from "./services/dlp"
import { encryptionStub } from "./services/encryption"
import { saveDraft, sendNew, useContacts, useMailboxes, useMe, useMemberships, useMsgRole, usePolicies, useThreads, useTemplates, useSignatures } from "./store"
import type { Attachment, Contact, Mailbox, Party, RecordLink, Thread } from "./types"

/* ------------------------------------------------------------------ helpers */

const isOutside = (email: string) => !email.toLowerCase().endsWith(`@${ORG_DOMAIN}`)
/** Personal webmail (blocked for shared or patient-linked mail when the rule is on). */
const isPersonalWebmail = (email: string) => /@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud)\.[a-z.]+$/i.test(email)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const contactOf = (email: string) => CONTACTS.find((c) => c.email.toLowerCase() === email.toLowerCase())
const partnerOfEmail = (email: string) => {
  const c = contactOf(email)
  if (c) return PARTNERS.find((p) => p.id === c.partner)
  const domain = email.split("@")[1]?.toLowerCase()
  return PARTNERS.find((p) => p.domains.includes(domain ?? ""))
}
const femaleOf = (p?: Party) => (p?.staff ? !!STAFF[p.staff]?.female : !!(p && contactOf(p.email)?.female))
const shortName = (n: Bi): Bi => ({ en: n.en.replace(/^(Dr\.|Nurse)\s+/, "").split(" ")[0], ar: n.ar.replace(/^(د\.|الممرضة)\s+/, "").split(" ")[0] })

/** Everyone the To / Cc boxes suggest: staff with a mailbox, then partner contacts. */
function directory(contacts: Contact[]): (Party & { group: "staff" | "partners"; sub: Bi })[] {
  const staff = Object.values(STAFF)
    .filter((s) => s.email)
    .map((s) => ({ name: s.name, email: s.email!, staff: s.key, group: "staff" as const, sub: s.title }))
  const partners = contacts.filter((c) => c.suggest !== false).map((c) => {
    const p = PARTNERS.find((x) => x.id === c.partner)!
    return { name: c.name, email: c.email, org: p.name, partner: p.id, group: "partners" as const, sub: { en: `${p.name.en} · ${c.role.en}`, ar: `${p.name.ar} · ${c.role.ar}` } }
  })
  return [...staff, ...partners]
}

type Form = { from: string; signature: string; to: Party[]; cc: Party[]; subject: string; body: string; files: Attachment[]; links: RecordLink[]; encrypt: boolean }

/* ------------------------------------------------------------------ page */

/**
 * New message (inner page of Inbox, `/messages/new`; `?draft=` opens a draft, `?forward=` forwards an email, `?to=` /
 * `?partner=` start one to a contact, `?link=` links a record). Form: From (a mailbox you may send as) · Signature; To / Cc
 * (outside people amber with a globe); Subject; Message; files (from the patient's file or your computer); the amber lock
 * note and "Send encrypted" when patient data goes outside. Side: Link to a record, Templates, the copy note. Save draft ·
 * Send (patient data going outside opens Check before sending). Mobile: Back · "New message" · ⋯; fixed action bar.
 */
export function ComposePage() {
  const templates = useTemplates(TEMPLATES)
  const signatures = useSignatures(SIGNATURES)
  const { t, b, l } = useMailText()
  const params = useSearchParams()
  const router = useRouter()
  const me = useMe()
  const role = useMsgRole()
  const boxes = useMailboxes()
  const members = useMemberships()
  const threads = useThreads()
  const policies = usePolicies()
  const sendable = sendableBoxes(me, boxes, members)
  const personal = sendable.find((m) => m.kind === "personal")

  const [form, setForm] = React.useState<Form>(() => initial(params, threads, sendable, personal, b, t))
  const [draftId, setDraftId] = React.useState(params.get("draft") ?? "")
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [dlg, setDlg] = React.useState<null | "link" | "check">(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const templatesRef = React.useRef<HTMLDivElement>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const box = boxes.find((m) => m.id === form.from)
  const forwardSource = params.get("forward")
  const patients = form.links.filter((x) => x.kind === "patient" && x.patient).map((x) => x.patient!)
  const recipients = [...form.to, ...form.cc]
  const scan = dlpStub.scan({
    recipients: recipients.map((r) => r.email),
    subject: form.subject,
    body: form.body,
    files: form.files.map((f) => ({ name: f.name.en, patient: f.patient })),
    patients,
    orgDomain: ORG_DOMAIN,
  })
  const firstOutside = recipients.find((r) => isOutside(r.email))
  const outsideName = firstOutside ? b(shortName(firstOutside.name)) : ""
  const outsideMobile = firstOutside ? contactOf(firstOutside.email)?.mobile : undefined
  const g = femaleOf(firstOutside) ? "f" : "m"
  const enforce = policies.encryptOutside && scan.needsCheck

  // Blocked: shared or patient-linked mail to a personal webmail address (rule "Block forwarding to personal mailboxes").
  const sensitive = box?.kind === "shared" || patients.length > 0 || !!forwardSource
  const personalHit = policies.blockPersonalForward && sensitive ? recipients.find((r) => isPersonalWebmail(r.email)) : undefined
  const errors = {
    to: !form.to.length ? t("compose.errors.to") : personalHit ? t("compose.errors.personal", { email: personalHit.email }) : undefined,
    subject: !form.subject.trim() ? t("compose.errors.subject") : undefined,
    body: !form.body.trim() ? t("compose.errors.body") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  usePageTitle({
    title: t("compose.title"),
    back: "/messages",
    crumbs: [
      { label: t("title"), href: "/messages" },
      { label: t("inbox.title"), href: "/messages" },
    ],
  })

  if (!msgTabs(role).includes("inbox") || !box)
    return (
      <PageContainer>
        <NoAccess />
      </PageContainer>
    )

  // In sentences: "cardiology@" / "صندوق القلب", "your mailbox" / "بريدك", or the linked mailbox's name.
  const boxName = box.kind === "shared" ? b({ en: box.short, ar: box.name.ar }) : box.kind === "personal" ? b({ en: "your mailbox", ar: "بريدك" }) : b(box.name)
  const patientName = patients[0] ? b(shortName(recordsPatient(patients[0])!.name)) : ""
  const fileOptions = patients.flatMap((k) => (PATIENT_FILES[k] ?? []).map((f) => ({ ...f, patient: k })))

  /* ---------------------------------------------------------------- actions */

  const removeFile = (i: number) => {
    set(
      "files",
      form.files.filter((_, k) => k !== i)
    )
    toast.info(t("toasts.itemRemoved"), { description: t("toasts.itemRemovedText") })
  }
  const removeLink = (ref: string) => {
    set(
      "links",
      form.links.filter((x) => x.ref !== ref)
    )
    toast.info(t("toasts.itemRemoved"), { description: t("toasts.itemRemovedText") })
  }
  const attachPatientFile = (f: (typeof fileOptions)[number]) => {
    if (form.files.some((x) => x.name.en === f.name.en)) return
    set("files", [...form.files, { name: f.name, meta: f.meta, kind: "pdf", patient: f.patient }])
    toast.info(t("toasts.fileAttached"), { description: b(f.name) })
  }
  const attachLocal = (list: FileList | null) => {
    if (!list?.length) return
    const added: Attachment[] = [...list].map((f) => {
      const ext = (f.name.split(".").pop() ?? "file").toUpperCase()
      const meta = `${ext} · ${Math.max(1, Math.round(f.size / 1024))} KB`
      return { name: { en: f.name, ar: f.name }, meta: { en: meta, ar: meta }, kind: f.type.includes("pdf") ? "pdf" : f.type.startsWith("image") ? "image" : "doc" }
    })
    set("files", [...form.files, ...added])
    toast.info(t("toasts.fileAttached"), { description: added.map((f) => f.name.en).join(", ") })
  }
  const applyTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id)!
    const first = form.to[0] ? b(shortName(form.to[0].name)) : ""
    const text = b(tpl.text).replaceAll("{first_name}", first)
    set("body", form.body.trim() ? `${form.body.trim()}\n\n${text}` : text)
    if (!form.subject.trim()) set("subject", b(tpl.name))
    toast.info(t("toasts.templateApplied"), { description: t("toasts.templateAppliedText") })
  }

  const asThread = (folder: Thread["folder"], extra: Partial<Thread> = {}): Thread => {
    const first = form.to[0]
    const partner = first ? partnerOfEmail(first.email) : undefined
    const snippet = form.body.trim().split("\n")[0].slice(0, 90)
    return {
      id: draftId || `n-${threads.length + 1}`,
      mailbox: box.id,
      folder,
      subject: { en: form.subject.trim() || "(no subject)", ar: form.subject.trim() || "(بدون موضوع)" },
      sender: partner ? { name: partner.name, initials: partner.initials, tone: partner.tone } : { name: first?.name ?? { en: "", ar: "" }, initials: (first?.staff && STAFF[first.staff]?.initials) || "?", person: true },
      snippet: { en: snippet, ar: snippet },
      partner: partner?.id,
      unread: false,
      links: form.links,
      status: "waitingThem",
      messages: [],
      lastAt: MSG_NOW,
      files: form.files.length,
      events: [],
      ...extra,
    }
  }

  const save = () => {
    const th = asThread("drafts", {
      compose: {
        to: form.to,
        cc: form.cc,
        body: { en: form.body, ar: form.body },
        signature: form.signature || undefined,
        encrypt: form.encrypt,
        files: form.files,
      },
    })
    saveDraft(th)
    setDraftId(th.id)
    toast.info(t("toasts.draftSaved"), { description: t("toasts.draftSavedText", { box: boxName }) })
  }

  const send = () => {
    setTried(true)
    if (invalid || busy) return
    if (enforce) return setDlg("check")
    void deliver("plain")
  }

  const deliver = async (mode: "plain" | "enc" | "redact" | "asIs", reason?: string, ref?: string) => {
    setBusy(true)
    const arabic = /[؀-ۿ]/.test(form.body)
    const sig = signatures.find((s) => s.id === form.signature)
    const footer = signatures.find((s) => s.kind === "branch")!
    const body = mode === "redact" && ref ? dlpStub.redact(form.body, ref, scan.patients) : form.body
    const subject = mode === "redact" && ref ? dlpStub.redact(form.subject, ref, scan.patients) : form.subject
    const paras = [
      ...body.trim().split(/\n{2,}/),
      ...(sig ? [(arabic ? sig.lines.ar : sig.lines.en).join("\n")] : []),
      ...(scan.outside.length ? [(arabic ? footer.lines.ar : footer.lines.en).join(" ")] : []),
    ]
    let encryptedTo: string | undefined
    if (mode === "enc" && firstOutside) encryptedTo = (await encryptionStub.encrypt({ recipient: firstOutside.email, mobile: outsideMobile })).codeTo
    const files = mode === "redact" ? form.files.filter((f) => !f.patient) : form.files
    const th = asThread("sent", {
      subject: { en: subject.trim(), ar: subject.trim() },
      files: files.length,
      messages: [
        {
          id: `${draftId || "n"}-m1`,
          from: { name: STAFF[me].name, org: box.kind === "shared" ? box.name : undefined, email: box.address, staff: me },
          to: form.to,
          cc: form.cc.length ? form.cc : undefined,
          at: MSG_NOW,
          summary: { en: subject.trim(), ar: subject.trim() },
          body: paras.map((p) => ({ en: p, ar: p })),
          files: files.length ? files : undefined,
          encrypted: mode === "enc",
        },
      ],
      events: [
        {
          at: MSG_NOW,
          text:
            mode === "enc"
              ? { en: `You sent it encrypted · code to ${encryptedTo}`, ar: `أرسلتها مشفّرة · الرمز راح لـ${encryptedTo}` }
              : mode === "redact"
                ? { en: `You sent it without patient details · ${ref} instead`, ar: `أرسلتها بدون بيانات المريض · ${ref} بدالها` }
                : mode === "asIs"
                  ? { en: "You sent it as it is · the privacy officer was told", ar: "أرسلتها مثل ما هي · ووصل تنبيه لمسؤول الخصوصية" }
                  : { en: "You sent it", ar: "أرسلتها" },
        },
      ],
    })
    sendNew(th, mode === "asIs" ? { reason: reason ?? "" } : undefined)
    setBusy(false)
    setDlg(null)
    if (mode === "enc")
      toast.success(t("toasts.sentEnc"), { description: patientName ? t("toasts.sentEncText", { box: boxName, name: patientName }) : t("toasts.sentBoxText", { box: boxName }) })
    else if (mode === "redact") toast.success(t("toasts.sentRedacted"), { description: t("toasts.sentRedactedText", { ref: ref ?? "", box: boxName }) })
    else if (mode === "asIs") toast.warning(t("toasts.sentAsIs"), { description: t("toasts.sentAsIsText") })
    else toast.success(t("toasts.sent"), { description: t("toasts.sentBoxText", { box: boxName }) })
    router.push(threadHref(th.id))
  }

  /* ---------------------------------------------------------------- view */

  const attachMenu = (trigger: React.ReactElement) => (
    <ActionMenu
      title={t("compose.attach")}
      trigger={trigger}
      groups={[
        fileOptions.map((f) => ({ key: f.name.en, icon: "document-text" as const, label: `${b(f.name)} · ${b(shortName(recordsPatient(f.patient)!.name))}`, onSelect: () => attachPatientFile(f) })),
        [{ key: "computer", icon: "paperclip-2" as const, label: t("compose.fromComputer"), onSelect: () => fileInput.current?.click() }],
      ]}
    />
  )

  const foundText = listJoin(
    scan.found.map((f: Finding) => t(`compose.found.${f}`)),
    (a, x) => t("compose.and", { a, b: x })
  )

  return (
    <>
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/messages" aria-label={t("actions.back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("compose.title")}</h1>
        <ActionMenu
          title={t("compose.title")}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("actions.more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[
            [
              { key: "link", icon: "link-2", label: t("actions.linkRecord"), onSelect: () => setDlg("link") },
              { key: "template", icon: "document-text", label: t("message.useTemplate"), onSelect: () => templatesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }) },
              { key: "attach", icon: "paperclip-2", label: t("compose.attach"), onSelect: () => fileInput.current?.click() },
            ],
          ]}
        />
      </div>
      <PageContainer className="max-md:pb-28">
        <PageHeader
          actions={
            <div className="hidden gap-2 md:flex">
              <Button variant="outline" onClick={save} disabled={busy}>
                {t("compose.save")}
              </Button>
              <Button onClick={send} disabled={busy}>
                <Icon name="send-2" size={18} />
                {busy ? t("compose.sending") : t("compose.send")}
              </Button>
            </div>
          }
        />
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => attachLocal(e.target.files)} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-6">
          <MsgCard title={t("compose.title")} sub={t("compose.sub", { provider: box.provider === "google" ? "Gmail" : box.provider === "imap" ? "IMAP" : "Microsoft 365" })} className="md:p-6">
            {tried && invalid && <Note tone="destructive">{t("compose.errors.strip")}</Note>}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("compose.from")} required helper={box.kind === "shared" ? t("compose.fromHelper") : undefined}>
                {(c) => (
                  <Select
                    value={form.from}
                    onValueChange={(v) => {
                      const nb = boxes.find((m) => m.id === v)
                      setForm((f) => ({ ...f, from: v, signature: nb?.signature ?? "sig-khaled" }))
                    }}
                  >
                    <SelectTrigger {...c} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sendable.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {fromLabel(m, t, b, l)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field label={t("compose.signature")} className="max-md:hidden">
                {(c) => (
                  <Select value={form.signature || "none"} onValueChange={(v) => set("signature", v === "none" ? "" : v)}>
                    <SelectTrigger {...c} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {signatures.filter((s) => s.kind !== "branch" && (s.kind === "user" ? s.owner === me : s.owner === box.id)).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.kind === "user" ? b(STAFF[me].name) : b(s.title)}
                        </SelectItem>
                      ))}
                      <SelectItem value="none">{t("compose.sigNone")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>
            <Recipients label={t("compose.to")} placeholder={t("compose.toPh")} value={form.to} onChange={(v) => set("to", v)} error={tried ? errors.to : undefined} />
            <Recipients label={t("compose.cc")} placeholder={t("compose.ccPh")} value={form.cc} onChange={(v) => set("cc", v)} />
            <Field label={t("compose.subject")} required error={tried ? errors.subject : undefined}>
              <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>
            <Field label={t("compose.message")} error={tried ? errors.body : undefined}>
              <Textarea value={form.body} onChange={(e) => set("body", e.target.value)} rows={4} />
            </Field>
            {form.files.map((f, i) => (
              <FileRow key={i} file={f} onRemove={() => removeFile(i)} />
            ))}
            <div>
              {attachMenu(
                <Button variant="ghost" className="-ms-2">
                  <Icon name="paperclip-2" size={18} />
                  {t("compose.attach")}
                </Button>
              )}
            </div>
            {scan.needsCheck && (
              <Note tone="warning" icon="lock">
                {enforce && form.encrypt ? t("compose.lock", { found: foundText }) : t("compose.lockOff", { found: foundText })}
              </Note>
            )}
            {scan.needsCheck && policies.encryptOutside && (
              <CheckRow
                label={outsideMobile ? t("compose.encrypt", { name: outsideName, g }) : t("compose.encryptEmail", { name: outsideName, g })}
                checked={form.encrypt}
                onChange={(v) => set("encrypt", v)}
              />
            )}
          </MsgCard>
          <div className="flex flex-col gap-4">
            <MsgCard title={t("compose.linkTitle")} sub={t("compose.linkSub")}>
              {form.links.map((x) => (
                <div key={x.ref} className="flex items-center gap-2.5">
                  <IconTile icon={LINK_ICON[x.kind]} className="bg-accent text-primary" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{b(x.label)}</span>
                    <span className="text-xs text-muted-foreground">{b(x.sub)}</span>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => removeLink(x.ref)} aria-label={t("message.remove")}>
                    <Icon name="trash" size={20} />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setDlg("link")}>
                <Icon name="link-2" size={18} />
                {t("compose.linkOne")}
              </Button>
            </MsgCard>
            <div ref={templatesRef}>
              <MsgCard title={t("compose.templates")} sub={t("compose.templatesSub")}>
                <ul className="flex flex-col">
                  {templates.filter((x) => x.audience === "partners").map((x) => (
                    <li key={x.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => applyTemplate(x.id)}
                        className="flex w-full items-center gap-2.5 py-2.5 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <Icon name="document-text" size={18} className="shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 text-sm text-foreground">{b(x.name)}</span>
                        <span className="text-xs font-medium text-primary">{t("compose.use")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </MsgCard>
            </div>
            <Note>{patientName ? t("compose.copy", { box: boxName, name: patientName }) : t("compose.copyBox", { box: boxName })}</Note>
          </div>
        </div>
      </PageContainer>
      <MobileActionBar>
        <Button variant="outline" onClick={save} disabled={busy}>
          {t("compose.save")}
        </Button>
        <Button onClick={send} disabled={busy}>
          <Icon name="send-2" size={18} />
          {t("compose.send")}
        </Button>
      </MobileActionBar>
      {dlg === "link" && (
        <LinkDialog
          links={form.links}
          onPick={(link) => set("links", [...form.links.filter((x) => x.ref !== link.ref), link])}
          onOpenChange={(o) => !o && setDlg(null)}
        />
      )}
      {dlg === "check" && (
        <CheckDialog
          domain={scan.outside[0] ?? ""}
          found={foundText}
          files={form.files}
          links={form.links}
          name={outsideName}
          g={g}
          bySms={!!outsideMobile}
          initial={form.encrypt ? "enc" : "asIs"}
          busy={busy}
          onSend={(mode, reason, ref) => void deliver(mode, reason, ref)}
          onOpenChange={(o) => !o && setDlg(null)}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ initial form */

function initial(
  params: URLSearchParams,
  threads: Thread[],
  sendable: Mailbox[],
  personal: Mailbox | undefined,
  b: (v: Bi) => string,
  t: ReturnType<typeof useMailText>["t"]
): Form {
  const can = (id?: string) => (id && sendable.some((m) => m.id === id) ? id : (personal?.id ?? sendable[0]?.id ?? ""))
  const sigOf = (id: string) => sendable.find((m) => m.id === id)?.signature ?? "sig-khaled"
  const draft = threads.find((x) => x.id === params.get("draft") && x.folder === "drafts")
  if (draft?.compose) {
    const from = can(draft.mailbox)
    return {
      from,
      signature: draft.compose.signature ?? sigOf(from),
      to: draft.compose.to,
      cc: draft.compose.cc,
      subject: b(draft.subject),
      body: b(draft.compose.body),
      files: draft.compose.files,
      links: draft.links,
      encrypt: draft.compose.encrypt,
    }
  }
  const fw = threads.find((x) => x.id === params.get("forward"))
  if (fw) {
    const from = can(fw.mailbox)
    const m = fw.messages.at(-1)
    const quoted = m ? [t("compose.fwLine"), t("compose.fwFrom", { from: `${b(m.from.name)} <${m.from.email}>`, date: m.at.slice(0, 10) }), ...m.body.map(b)].join("\n") : ""
    return { from, signature: sigOf(from), to: [], cc: [], subject: t("compose.fw", { subject: b(fw.subject) }), body: `\n\n${quoted}`, files: m?.files ?? [], links: fw.links, encrypt: true }
  }
  const from = can(undefined)
  const toEmail = params.get("to")
  const partner = PARTNERS.find((p) => p.id === params.get("partner"))
  const contact = toEmail ? contactOf(toEmail) : partner ? CONTACTS.find((c) => c.partner === partner.id) : undefined
  const to: Party[] = contact ? [{ name: contact.name, email: contact.email, org: PARTNERS.find((p) => p.id === contact.partner)?.name, partner: contact.partner }] : toEmail ? [{ name: { en: toEmail, ar: toEmail }, email: toEmail }] : []
  return { from, signature: sigOf(from), to, cc: [], subject: "", body: "", files: [], links: [], encrypt: true }
}

function fromLabel(m: Mailbox, t: ReturnType<typeof useMailText>["t"], b: (v: Bi) => string, l: (s: string) => string) {
  if (m.kind === "shared") return t("compose.boxShared", { box: l(m.address) })
  if (m.kind === "personal") return t("compose.boxYours", { box: l(m.address) })
  return b(m.name)
}

function listJoin(items: string[], and: (a: string, b: string) => string) {
  if (items.length <= 1) return items[0] ?? ""
  return and(items.slice(0, -1).join(", "), items.at(-1)!)
}

function CheckRow({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
        {label}
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ To / Cc */

/** Recipient chips + type-ahead (staff, partner contacts) + any email on Enter. Outside people: amber chip with a globe. */
function Recipients({ label, placeholder, value, onChange, error }: { label: string; placeholder: string; value: Party[]; onChange: (v: Party[]) => void; error?: string }) {
  const { t, b, l } = useMailText()
  const [q, setQ] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  const contacts = useContacts(CONTACTS)
  const all = React.useMemo(() => directory(contacts), [contacts])
  const taken = new Set(value.map((v) => v.email.toLowerCase()))
  const words = q.trim().toLowerCase()
  const hits = words
    ? all.filter((p) => !taken.has(p.email.toLowerCase()) && [p.name.en, p.name.ar, p.email, p.sub.en, p.sub.ar].join(" ").toLowerCase().includes(words)).slice(0, 6)
    : []
  const typed = EMAIL.test(q.trim()) && !taken.has(q.trim().toLowerCase()) ? q.trim() : ""
  const add = (p: Party) => {
    onChange([...value, p])
    setQ("")
  }
  // "Nurse Amal" (staff, as named), "Sara Al-Ghamdi · Bupa" (partner contact), or the address.
  const chip = (p: Party) => (p.staff ? b(p.name) : p.org ? `${b(p.name)} · ${b(shortName(p.org))}` : l(b(p.name)))
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <div
          className={cn(
            "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 focus-within:ring-[3px] focus-within:ring-ring/50",
            error ? "border-destructive" : "border-input"
          )}
        >
          {value.map((p) => {
            const out = isOutside(p.email)
            return (
              <span
                key={p.email}
                className={cn("inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium", out ? "bg-warning-soft text-warning-soft-foreground" : "bg-accent text-primary")}
                title={out ? `${t("compose.outside")} · ${p.email}` : p.email}
              >
                {out && <Icon name="global" size={12} />}
                <bdi>{chip(p)}</bdi>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x.email !== p.email))}
                  aria-label={t("compose.removeRecipient", { name: b(p.name) })}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon name="close-circle" size={14} />
                </button>
              </span>
            )
          })}
          <input
            id={id}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === ",") && (hits[0] || typed)) {
                e.preventDefault()
                if (hits[0]) add(hits[0])
                else add({ name: { en: typed, ar: typed }, email: typed })
              }
              if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1))
            }}
            placeholder={placeholder}
            aria-invalid={!!error || undefined}
            className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {open && (hits.length > 0 || typed) && (
          <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
            {hits.map((p) => (
              <li key={p.email}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(p)}
                  className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-start hover:bg-muted"
                >
                  <span className="text-sm text-foreground">{b(p.name)}</span>
                  <span className="text-xs text-muted-foreground">
                    {b(p.sub)} · {l(p.email)}
                  </span>
                </button>
              </li>
            ))}
            {typed && !hits.length && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add({ name: { en: typed, ar: typed }, email: typed })}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-sm hover:bg-muted"
                >
                  <Icon name="add" size={16} />
                  {t("compose.addEmail", { email: typed })}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ Check before sending */

/**
 * Overlay · Check before sending (Send on New message when patient data goes outside): amber summary (to an outside
 * domain, what was found, the attachment), then Send encrypted (recommended · code by SMS), Remove patient details (the
 * linked claim / approval number goes in instead), Send it as it is (needs a reason; the privacy officer is told).
 * → `message-sent`.
 */
function CheckDialog({
  domain,
  found,
  files,
  links,
  name,
  g,
  bySms,
  initial,
  busy,
  onSend,
  onOpenChange,
}: {
  domain: string
  found: string
  files: Attachment[]
  links: RecordLink[]
  name: string
  g: "f" | "m"
  bySms: boolean
  initial: "enc" | "asIs"
  busy: boolean
  onSend: (mode: "enc" | "redact" | "asIs", reason?: string, ref?: string) => void
  onOpenChange: (open: boolean) => void
}) {
  const { t, b, l } = useMailText()
  const [mode, setMode] = React.useState<"enc" | "redact" | "asIs">(initial)
  const [reason, setReason] = React.useState("")
  const [tried, setTried] = React.useState(false)
  // The reference that replaces patient details: a linked claim, else the approval, else the invoice.
  const refLink = ["claim", "preauth", "invoice"].map((k) => links.find((x) => x.kind === k && !x.ref.startsWith("draft:"))).find(Boolean)
  const ref = refLink?.ref
  const go = () => {
    setTried(true)
    if (mode === "asIs" && !reason.trim()) return
    if (mode === "redact" && !ref) return
    onSend(mode, reason.trim(), ref)
  }
  const label = mode === "enc" ? t("check.sendEnc") : mode === "redact" ? t("check.sendRedacted") : t("check.sendAsIs")
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("check.title")}
      description={t("check.sub")}
      icon="lock"
      tone="warning"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={go} disabled={busy} variant={mode === "asIs" ? "destructive" : "default"}>
          {busy ? t("compose.sending") : label}
        </Button>
      }
    >
      <KvRows
        boxed
        rows={[
          [t("check.to"), t("check.toVal", { domain }), "warning"],
          [t("check.found"), found],
          [t("check.attached"), files.length ? files.map((f) => b(f.name)).join("، ") : t("check.none")],
        ]}
      />
      <ChoiceGroup value={mode} onValueChange={(v) => setMode(v as "enc" | "redact" | "asIs")} aria-label={t("check.title")}>
        <ChoiceCard
          value="enc"
          lead={<IconTile icon="lock" className="bg-muted group-data-[state=checked]/choice:bg-card" />}
          title={t("check.enc")}
          sub={bySms ? t("check.encSub", { name, g }) : t("check.encSubEmail", { name, g })}
        />
        <ChoiceCard
          value="redact"
          disabled={!ref}
          lead={<IconTile icon="edit-2" className="bg-muted group-data-[state=checked]/choice:bg-card" />}
          title={t("check.redact")}
          sub={ref ? t("check.redactSub", { ref: l(ref) }) : t("check.redactNone")}
        />
        <ChoiceCard value="asIs" lead={<IconTile icon="danger" className="bg-muted group-data-[state=checked]/choice:bg-card" />} title={t("check.asIs")} sub={t("check.asIsSub")} />
      </ChoiceGroup>
      {mode === "asIs" && (
        <Field label={t("check.reason")} required error={tried && !reason.trim() ? t("check.errReason") : undefined}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("check.reasonPh")} rows={3} />
        </Field>
      )}
    </ResponsiveDialog>
  )
}
