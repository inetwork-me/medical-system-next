"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CENTER, ME, SIGNATURES, STAFF, TEMPLATES } from "./data"
import { ChannelChip, KvRows, MiniChip, MsgCard, Note, useMsgText } from "./parts"
import { msgCan } from "./roles"
import { levelIn } from "./rules"
import { clinicalContent, smsParts } from "./services/patient-gateway"
import { saveSignature, saveTemplate, useMailboxes, useMe, useMemberships, useMsgRole, useSignatures, useTemplates } from "./store"
import { TEMPLATE_FIELDS, type Audience, type Signature, type Template, type TemplateChannel } from "./types"

type Lang = "en" | "ar"
const fieldsIn = (t: Template) => TEMPLATE_FIELDS.filter((f) => t.text.en.includes(f) || t.text.ar.includes(f))

/* ------------------------------------------------------------------ screen */

type Dlg = null | { kind: "template"; id?: string } | { kind: "signature"; id: string }

export function useTemplatesScreen() {
  const [dlg, setDlg] = React.useState<Dlg>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const dialogs = (
    <>
      {dlg?.kind === "template" && <TemplateDialog id={dlg.id} onOpenChange={close} />}
      {dlg?.kind === "signature" && <SignatureDialog id={dlg.id} onOpenChange={close} />}
    </>
  )
  return { open: setDlg, dialogs }
}

/** Header actions: Edit signature · New template (templates are managed by admins). */
export function TemplatesActions({ open }: { open: (d: Dlg) => void }) {
  const { t } = useMsgText()
  const role = useMsgRole()
  return (
    <>
      <Button variant="outline" onClick={() => open({ kind: "signature", id: "sig-khaled" })}>
        <Icon name="pen-tool" size={18} />
        {t("actions.editSignature")}
      </Button>
      {msgCan(role, "templates") && (
        <Button onClick={() => open({ kind: "template" })}>
          <Icon name="add" size={18} />
          {t("actions.newTemplate")}
        </Button>
      )}
    </>
  )
}

/**
 * Templates (tab): desktop — Templates table and Signatures beside the preview of the selected template and the fields it
 * fills; below xl — Templates, the preview, the fields, then Signatures.
 */
export function TemplatesBody({ open }: { open: (d: Dlg) => void }) {
  const templates = useTemplates(TEMPLATES)
  const [sel, setSel] = React.useState(templates[0].id)
  const current = templates.find((x) => x.id === sel) ?? templates[0]
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <TemplatesCard templates={templates} sel={current.id} onSelect={setSel} open={open} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:gap-6">
        <Preview t={current} />
        <Fields t={current} />
      </div>
      <div className="min-w-0 xl:col-start-1 xl:row-start-2">
        <Signatures open={open} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ templates */

function TemplatesCard({ templates, sel, onSelect, open }: { templates: Template[]; sel: string; onSelect: (id: string) => void; open: (d: Dlg) => void }) {
  const { t, b } = useMsgText()
  const role = useMsgRole()
  const can = msgCan(role, "templates")
  const [q, setQ] = React.useState("")
  const [f, setF] = React.useState<"all" | Audience>("all")
  const count = (k: "all" | Audience) => (k === "all" ? templates.length : templates.filter((x) => x.audience === k).length)
  const words = q.trim().toLowerCase()
  const order: Audience[] = ["patients", "partners", "staff"]
  // Grouped Patients · Partners · Staff (as drawn), newest additions last in each group.
  const list = templates
    .filter((x) => (f === "all" || x.audience === f) && (!words || [x.name.en, x.name.ar, x.text.en, x.text.ar].join(" ").toLowerCase().includes(words)))
    .map((x, i) => ({ x, i }))
    .sort((a, b2) => order.indexOf(a.x.audience) - order.indexOf(b2.x.audience) || a.i - b2.i)
    .map(({ x }) => x)
  const chLabel = (c: TemplateChannel) => t(`channel.${c}`)
  return (
    <MsgCard title={t("tpl.title")} sub={t("tpl.sub")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-56">
          <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tpl.search")} aria-label={t("tpl.search")} className="ps-9" />
        </div>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
          <Segmented size="sm" className="w-max min-w-full" value={f} onValueChange={setF} options={(["all", "patients", "partners", "staff"] as const).map((k) => ({ value: k, label: t(`tpl.f.${k}`, { n: count(k) }) }))} />
        </div>
      </div>
      {list.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">{t("tpl.empty")}</p>}
      {list.length > 0 && (
        <div className="hidden overflow-hidden rounded-[10px] border md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-normal">{t("tpl.colTemplate")}</th>
                <th className="w-48 px-2 py-3 text-start font-normal">{t("tpl.colChannels")}</th>
                <th className="w-28 px-2 py-3 text-start font-normal">{t("tpl.colFor")}</th>
                <th className="w-16 px-2 py-3 text-start font-normal">{t("tpl.colUsed")}</th>
                <th className="w-20 px-4 py-3">
                  <span className="sr-only">{t("tpl.edit")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className={cn("cursor-pointer border-t", x.id === sel ? "bg-accent" : "hover:bg-muted/40")} onClick={() => onSelect(x.id)} aria-selected={x.id === sel}>
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => onSelect(x.id)} className="flex flex-col items-start text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      <span className="text-foreground">{b(x.name)}</span>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {t("tpl.langs")}
                      </span>
                    </button>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="flex flex-wrap items-center gap-1">
                      {x.channels.map((c) => (
                        <ChannelChip key={c} channel={c} />
                      ))}
                      {x.whatsapp?.state === "pending" && <MiniChip tone="warning">{t("tpl.pending")}</MiniChip>}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground">{t(`tpl.audience.${x.audience}`)}</td>
                  <td className="px-2 py-2.5 tabular-nums">{x.used.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2.5 text-end">
                    {can && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          open({ kind: "template", id: x.id })
                        }}
                      >
                        {t("tpl.edit")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="flex flex-col md:hidden">
        {list.map((x) => (
          <li key={x.id} className="border-b last:border-b-0">
            <button
              type="button"
              onClick={() => (can ? open({ kind: "template", id: x.id }) : onSelect(x.id))}
              className="flex w-full items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground">
                <Icon name="document-text" size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">{b(x.name)}</span>
                <span className="text-xs text-muted-foreground">{t("tpl.listLine", { channels: x.channels.map(chLabel).join(" · "), n: x.used.toLocaleString("en-US") })}</span>
              </span>
              <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground rtl:-scale-x-100" />
            </button>
          </li>
        ))}
      </ul>
    </MsgCard>
  )
}

/** Widget / Msg Template Preview: language switch, the phone bubble with its {fields}, length · when sent · where replies go. */
function Preview({ t: x }: { t: Template }) {
  const { t, b, locale, dates } = useMsgText()
  const [lang, setLang] = React.useState<Lang>(locale === "ar" ? "ar" : "en")
  const text = lang === "ar" ? x.text.ar : x.text.en
  const msgLike = x.channels.includes("sms") || x.channels.includes("whatsapp")
  const sub = x.whatsapp?.state === "approved" && x.channels.includes("whatsapp")
    ? t("preview.approved", { date: dates.dayMonth(x.whatsapp.on!) })
    : x.whatsapp?.state === "pending"
      ? t("preview.pending")
      : x.channels.includes("sms")
        ? t("preview.smsOnly")
        : x.channels.includes("email")
          ? t("preview.email")
          : t("preview.chat")
  const replies = x.replies ? b(x.replies) : t(x.audience === "patients" ? "preview.repliesPatients" : x.audience === "partners" ? "preview.repliesPartners" : "preview.repliesStaff")
  return (
    <MsgCard title={b(x.name)} sub={sub}>
      <Segmented
        size="sm"
        className="w-full"
        value={lang}
        onValueChange={setLang}
        options={[
          { value: "en", label: t("preview.english") },
          { value: "ar", label: t("preview.arabic") },
        ]}
      />
      <div className="rounded-[14px] bg-muted p-3.5">
        <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex flex-col gap-1.5 rounded-xl border bg-card px-3 py-2.5">
          <p className="text-sm whitespace-pre-wrap text-foreground">{text}</p>
          {x.audience !== "staff" && <p className="text-xs text-muted-foreground">{lang === "ar" ? CENTER.ar : CENTER.en}</p>}
        </div>
      </div>
      <KvRows
        rows={[
          [t("preview.length"), msgLike ? t("pm.length", smsParts(text)) : t("preview.words", { n: text.split(/\s+/).filter(Boolean).length })],
          [t("preview.sent"), x.auto ? b(x.auto) : t("preview.sentManual")],
          [t("preview.replies"), replies],
        ]}
      />
    </MsgCard>
  )
}

function Fields({ t: x }: { t: Template }) {
  const { t, l } = useMsgText()
  const fields = fieldsIn(x)
  return (
    <MsgCard title={t("preview.fields")}>
      {fields.length ? (
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f) => (
            <MiniChip key={f} tone="primary">
              {l(f)}
            </MiniChip>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("preview.noFields")}</p>
      )}
      {x.audience === "patients" && (
        <Note tone="warning" icon="lock">
          {t("preview.rule")}
        </Note>
      )}
    </MsgCard>
  )
}

/* ------------------------------------------------------------------ signatures */

/** Widget / Msg Signatures: yours, the shared mailboxes you manage, the branch footer (locked, set by IT). */
function Signatures({ open }: { open: (d: Dlg) => void }) {
  const { t, b, l, locale } = useMsgText()
  const me = useMe()
  const boxes = useMailboxes()
  const members = useMemberships()
  const sigs = useSignatures(SIGNATURES).filter((s) => {
    if (s.kind === "user") return s.owner === me
    if (s.kind === "mailbox") return !!boxes.find((m) => m.id === s.owner && levelIn(m, me, members))
    return true
  })
  return (
    <MsgCard title={t("sig.title")} sub={t("sig.sub")}>
      <div className="flex flex-col gap-4">
        {sigs.map((s) => {
          const box = s.kind === "mailbox" ? boxes.find((m) => m.id === s.owner) : undefined
          const canEdit = s.kind === "user" || (box && levelIn(box, me, members) === "manage")
          const lines = locale === "ar" ? s.lines.ar : s.lines.en
          return (
            <div key={s.id} className="flex flex-col gap-2.5 rounded-[10px] border p-3.5">
              <div className="flex items-start gap-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{s.kind === "user" ? t("sig.yours") : b(s.title)}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.kind === "user" ? l(STAFF[me].email ?? "") : box ? (canEdit ? t("sig.manage", { box: box.address }) : l(box.address)) : b(s.sub)}
                  </span>
                </div>
                {s.locked ? (
                  <MiniChip icon="lock">{t("sig.locked")}</MiniChip>
                ) : (
                  canEdit && (
                    <Button variant="outline" size="sm" onClick={() => open({ kind: "signature", id: s.id })}>
                      {t("sig.edit")}
                    </Button>
                  )
                )}
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg bg-muted p-3">
                {lines.map((line, i) => (
                  <p key={i} className={cn("text-xs", i === 0 && !s.locked ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </MsgCard>
  )
}

/* ------------------------------------------------------------------ New template */

const AUD_CHANNELS: Record<Audience, TemplateChannel[]> = { patients: ["sms", "whatsapp", "email"], partners: ["email"], staff: ["chat"] }

/**
 * Overlay · New template (New template / Edit on a row): editing English / Arabic, name, for, channels (WhatsApp needs
 * Meta's approval), text with {fields}, the no-results rule for patients. Both languages are required; only the five
 * fields are allowed; a WhatsApp text that changes goes back to Meta. → `template-saved`.
 */
function TemplateDialog({ id, onOpenChange }: { id?: string; onOpenChange: (open: boolean) => void }) {
  const { t, locale, l } = useMsgText()
  const templates = useTemplates(TEMPLATES)
  const cur = id ? templates.find((x) => x.id === id) : undefined
  const [lang, setLang] = React.useState<Lang>(locale === "ar" ? "ar" : "en")
  const [name, setName] = React.useState(cur?.name ?? { en: "", ar: "" })
  const [aud, setAud] = React.useState<Audience>(cur?.audience ?? "patients")
  const [channels, setChannels] = React.useState<TemplateChannel[]>(cur?.channels ?? ["sms"])
  const [text, setText] = React.useState(cur?.text ?? { en: "", ar: "" })
  const [tried, setTried] = React.useState(false)
  const langName = (k: Lang) => (k === "en" ? t("tplDlg.english") : t("tplDlg.arabic"))
  const fieldList = TEMPLATE_FIELDS.join(" ")
  const check = (k: Lang) => {
    const bad = (text[k].match(/\{[^}]*\}/g) ?? []).find((f) => !TEMPLATE_FIELDS.includes(f as never))
    return {
      name: !name[k].trim() ? t("tplDlg.errName", { lang: langName(k) }) : undefined,
      text: !text[k].trim()
        ? t("tplDlg.errText", { lang: langName(k) })
        : aud === "patients" && clinicalContent(text[k])
          ? t("tplDlg.errClinical")
          : bad
            ? t("tplDlg.errField", { field: bad, list: l(fieldList) })
            : undefined,
    }
  }
  const errs = { en: check("en"), ar: check("ar") }
  const chErr = !channels.length ? t("tplDlg.errChannels") : undefined
  const invalid = !!chErr || Object.values(errs.en).some(Boolean) || Object.values(errs.ar).some(Boolean)
  const allowed = AUD_CHANNELS[aud]

  const save = () => {
    setTried(true)
    if (invalid) {
      // Show the language that still has a problem.
      if (Object.values(errs[lang]).every((x) => !x)) setLang(lang === "en" ? "ar" : "en")
      return
    }
    const wa = channels.includes("whatsapp")
    const sameWa = cur?.whatsapp?.state === "approved" && cur.text.en === text.en && cur.text.ar === text.ar
    const next: Template = {
      ...(cur ?? { id: `tpl-${templates.length + 1}`, used: 0 }),
      name: { en: name.en.trim(), ar: name.ar.trim() },
      audience: aud,
      channels,
      text: { en: text.en.trim(), ar: text.ar.trim() },
      whatsapp: wa ? (sameWa ? cur!.whatsapp : { state: "pending" }) : undefined,
    } as Template
    saveTemplate(next)
    toast.success(t("toasts.templateSaved"), { description: wa && !sameWa ? t("toasts.templateSavedWa") : t("toasts.templateSavedReady") })
    onOpenChange(false)
  }

  const e = tried ? errs[lang] : { name: undefined, text: undefined }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={cur ? t("tplDlg.edit") : t("tplDlg.new")}
      description={t("tplDlg.sub")}
      icon="document-text"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("tplDlg.save")}</Button>}
    >
      {tried && invalid && <Note tone="destructive">{t("tplDlg.strip")}</Note>}
      <Field label={t("tplDlg.editing")}>
        {(c) => (
          <Segmented
            {...c}
            value={lang}
            onValueChange={setLang}
            options={[
              { value: "en", label: t("tplDlg.english") },
              { value: "ar", label: t("tplDlg.arabic") },
            ]}
          />
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("tplDlg.name")} required error={e.name}>
          <Input dir={lang === "ar" ? "rtl" : "ltr"} value={name[lang]} onChange={(ev) => setName({ ...name, [lang]: ev.target.value })} />
        </Field>
        <Field label={t("tplDlg.for")}>
          {(c) => (
            <Select
              value={aud}
              onValueChange={(v) => {
                const a = v as Audience
                setAud(a)
                setChannels((cs) => {
                  const keep = cs.filter((x) => AUD_CHANNELS[a].includes(x))
                  return keep.length ? keep : [AUD_CHANNELS[a][0]]
                })
              }}
            >
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["patients", "partners", "staff"] as Audience[]).map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(`tpl.audience.${a}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col rounded-[10px] border px-3 py-1.5">
          {allowed.map((c) => {
            const idc = `tpl-ch-${c}`
            return (
              <div key={c} className="flex items-center gap-2 py-1">
                <Checkbox id={idc} checked={channels.includes(c)} onCheckedChange={(v) => setChannels((cs) => (v === true ? [...cs, c] : cs.filter((x) => x !== c)))} />
                <label htmlFor={idc} className="cursor-pointer text-sm text-foreground">
                  {c === "whatsapp" ? (cur?.whatsapp ? t("tplDlg.waEdit") : t("tplDlg.wa")) : t(`tplDlg.${c}`)}
                </label>
              </div>
            )
          })}
        </div>
        {tried && chErr && <p className="text-xs text-destructive">{chErr}</p>}
      </div>
      <Field label={t("tplDlg.text")} required error={e.text} helper={t("tplDlg.fieldsHint", { list: l(fieldList) })}>
        <Textarea dir={lang === "ar" ? "rtl" : "ltr"} value={text[lang]} onChange={(ev) => setText({ ...text, [lang]: ev.target.value })} rows={3} />
      </Field>
      {aud === "patients" && (
        <Note tone="warning" icon="lock">
          {t("tplDlg.rule")}
        </Note>
      )}
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ Your signature */

/** Overlay · Your signature (Edit signature / Edit on a signature): editing English / Arabic, the text, logo, use on replies. */
function SignatureDialog({ id, onOpenChange }: { id: string; onOpenChange: (open: boolean) => void }) {
  const { t, b, l, locale } = useMsgText()
  const s = useSignatures(SIGNATURES).find((x) => x.id === id) as Signature
  const [lang, setLang] = React.useState<Lang>(locale === "ar" ? "ar" : "en")
  const [lines, setLines] = React.useState({ en: s.lines.en.join("\n"), ar: s.lines.ar.join("\n") })
  const [logo, setLogo] = React.useState(!!s.logo)
  const [replies, setReplies] = React.useState(s.onReplies !== false)
  const [tried, setTried] = React.useState(false)
  const err = (k: Lang) => (!lines[k].trim() ? t("sigDlg.err", { lang: k === "en" ? t("tplDlg.english") : t("tplDlg.arabic") }) : undefined)
  const invalid = !!err("en") || !!err("ar")
  const save = () => {
    setTried(true)
    if (invalid) {
      if (!err(lang)) setLang(lang === "en" ? "ar" : "en")
      return
    }
    const split = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean)
    saveSignature(id, { lines: { en: split(lines.en), ar: split(lines.ar) }, logo, onReplies: replies })
    toast.success(t("toasts.signatureSaved"), { description: replies ? t("toasts.signatureSavedText") : t("toasts.signatureSavedNew") })
    onOpenChange(false)
  }
  const isMine = s.kind === "user"
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={isMine ? t("sigDlg.title") : b(s.title)}
      description={isMine ? l(STAFF[ME].email ?? "") : b(s.sub)}
      icon="pen-tool"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("actions.save")}</Button>}
    >
      {tried && invalid && <Note tone="destructive">{t("sigDlg.strip")}</Note>}
      <Field label={t("sigDlg.editing")}>
        {(c) => (
          <Segmented
            {...c}
            value={lang}
            onValueChange={setLang}
            options={[
              { value: "en", label: t("tplDlg.english") },
              { value: "ar", label: t("tplDlg.arabic") },
            ]}
          />
        )}
      </Field>
      <Field label={t("sigDlg.signature")} error={tried ? err(lang) : undefined}>
        <Textarea dir={lang === "ar" ? "rtl" : "ltr"} value={lines[lang]} onChange={(e) => setLines({ ...lines, [lang]: e.target.value })} rows={3} />
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox id="sig-logo" checked={logo} onCheckedChange={(v) => setLogo(v === true)} />
        <label htmlFor="sig-logo" className="cursor-pointer text-sm text-foreground">
          {t("sigDlg.logo")}
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="sig-replies" checked={replies} onCheckedChange={(v) => setReplies(v === true)} />
        <label htmlFor="sig-replies" className="cursor-pointer text-sm text-foreground">
          {t("sigDlg.replies")}
        </label>
      </div>
      <Note>{t("sigDlg.note")}</Note>
    </ResponsiveDialog>
  )
}
