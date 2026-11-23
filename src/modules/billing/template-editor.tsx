"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { BILL_NOW, INSERTABLE, type ContractTemplate, type TemplateClause } from "./data"
import { AddClausesDialog, type AddedClause } from "./contract-dialogs"
import { Strip } from "./claim-dialogs"
import { CONTRACTS_HREF, templatesHref } from "./href"
import { canDraft } from "./roles"
import { useBillRole, useContracts } from "./store"
import { changesFrom, publishedVersion, publishTemplate, saveTemplateDraft, useTemplates, versionClauses, type TemplateChange } from "./templates-store"
import { useBillText } from "./text"

type Lang = "en" | "ar"

/* ------------------------------------------------------------------ clause list */

/**
 * Widget / Bill Template Clauses: "Clauses · Drag to reorder · 7 in this version", Add; each row: drag handle, number,
 * title, lock (locked clauses), "New" chip (added in this version); the selected one highlighted; the lock note.
 * Reorder by dragging, or with the arrow keys on a row's handle.
 */
export function TemplateClausesList({
  clauses,
  selected,
  onSelect,
  onMove,
  onAdd,
  readOnly,
  className,
}: {
  clauses: TemplateClause[]
  selected?: string
  onSelect: (key: string) => void
  onMove: (from: number, to: number) => void
  onAdd: () => void
  readOnly?: boolean
  className?: string
}) {
  const t = useTranslations("billing.templateEditor.list")
  const { b } = useBillText()
  const [dragging, setDragging] = React.useState<number | null>(null)
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5", className)}>
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("text", { n: clauses.length })}</p>
        </div>
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Icon name="add" size={16} />
            {t("add")}
          </Button>
        )}
      </header>
      <ol className="flex flex-col gap-1.5">
        {clauses.map((c, i) => {
          const on = c.key === selected
          return (
            <li
              key={c.key}
              draggable={!readOnly}
              onDragStart={(e) => {
                setDragging(i)
                e.dataTransfer.effectAllowed = "move"
              }}
              onDragOver={(e) => {
                if (dragging != null) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging != null && dragging !== i) onMove(dragging, i)
                setDragging(null)
              }}
              onDragEnd={() => setDragging(null)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-2 text-sm transition-colors",
                on ? "border-primary bg-accent" : "border-transparent hover:bg-muted/50",
                dragging === i && "opacity-50"
              )}
            >
              {!readOnly && (
                <button
                  type="button"
                  aria-label={t("move", { name: b(c.title) })}
                  className="inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" && i > 0) {
                      e.preventDefault()
                      onMove(i, i - 1)
                    }
                    if (e.key === "ArrowDown" && i < clauses.length - 1) {
                      e.preventDefault()
                      onMove(i, i + 1)
                    }
                  }}
                >
                  <Icon name="menu" size={16} />
                </button>
              )}
              <button type="button" onClick={() => onSelect(c.key)} className="flex min-w-0 flex-1 items-center gap-2 text-start outline-none" aria-current={on || undefined}>
                <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className={cn("min-w-0 flex-1 truncate", on ? "font-medium text-foreground" : "text-foreground")}>{b(c.title) || t("untitled")}</span>
                {c.isNew && (
                  <span className="shrink-0 rounded-full bg-info-soft px-2 py-0.5 text-[11px] text-info-soft-foreground">{t("new")}</span>
                )}
                {c.locked && <Icon name="lock" size={14} className="shrink-0 text-muted-foreground" aria-label={t("locked")} />}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <Icon name="lock" size={18} className="shrink-0" />
        <span>{t("note")}</span>
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ clause editor */

function SwitchRow({ label, hint, checked, onCheckedChange, disabled }: { label: string; hint: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-3 rounded-[10px] border p-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

/**
 * Widget / Bill Clause Editor: the draft status strip; the selected clause — title and text in English and Arabic side by
 * side (English box LTR, Arabic box RTL; stacked on compact), "Insert a blank" chips (into the box you were typing in,
 * at the cursor), "Locked in every contract", "Show changes to the other side", Remove; then "Changes from v4".
 */
export function ClauseEditor({
  tpl,
  version,
  clause,
  index,
  changes,
  baseVersion,
  status,
  onChange,
  onRemove,
  errors,
  readOnly,
}: {
  tpl: ContractTemplate
  version: number
  clause?: TemplateClause
  index: number
  changes: TemplateChange[]
  baseVersion?: number
  status: string
  onChange: (c: TemplateClause) => void
  onRemove: () => void
  errors?: { en?: boolean; ar?: boolean }
  readOnly?: boolean
}) {
  const t = useTranslations("billing.templateEditor")
  const { b, ar } = useBillText()
  const boxes = React.useRef<Record<Lang, HTMLTextAreaElement | null>>({ en: null, ar: null })
  const last = React.useRef<{ lang: Lang; at: number }>({ lang: ar ? "ar" : "en", at: -1 })
  const order: Lang[] = ar ? ["ar", "en"] : ["en", "ar"]
  const change = clause ? changes.find((x) => x.n === index + 1 && x.kind !== "removed") : undefined

  const remember = (lang: Lang) => (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    last.current = { lang, at: e.currentTarget.selectionStart ?? e.currentTarget.value.length }
  }
  const insert = (ph: string) => {
    if (!clause) return
    const { lang, at } = last.current
    const text = clause.text[lang]
    const pos = at < 0 || at > text.length ? text.length : at
    const pad = pos > 0 && !/\s$/.test(text.slice(0, pos)) ? " " : ""
    const next = `${text.slice(0, pos)}${pad}${ph}${text.slice(pos)}`
    onChange({ ...clause, text: { ...clause.text, [lang]: next } })
    const cursor = pos + pad.length + ph.length
    last.current = { lang, at: cursor }
    requestAnimationFrame(() => {
      const el = boxes.current[lang]
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Strip tone="info" icon="edit-2">
        {status}
      </Strip>

      {clause ? (
        <section className="@container/ce flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
          <header className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">{t("clause.title", { n: index + 1, name: b(clause.title) || t("list.untitled") })}</h2>
              <p className="text-xs text-muted-foreground">
                {change ? t(change.kind === "added" ? "clause.added" : "clause.edited") : baseVersion ? t("clause.same", { v: baseVersion }) : t("clause.draft")}
              </p>
            </div>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={onRemove}>
                <Icon name="trash" size={18} />
                {t("clause.remove")}
              </Button>
            )}
          </header>
          <div className="grid gap-4 @xl/ce:grid-cols-2 @xl/ce:gap-3">
            {order.map((lang) => (
              <Field key={lang} label={t(`clause.titleIn.${lang}`)} required error={errors?.[lang] ? t("clause.titleError") : undefined}>
                <Input
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  lang={lang}
                  value={clause.title[lang]}
                  disabled={readOnly}
                  onChange={(e) => onChange({ ...clause, title: { ...clause.title, [lang]: e.target.value } })}
                />
              </Field>
            ))}
          </div>
          <div className="grid gap-4 @xl/ce:grid-cols-2 @xl/ce:gap-3">
            {order.map((lang) => (
              <Field key={lang} label={t(`clause.textIn.${lang}`)}>
                <Textarea
                  ref={(el) => {
                    boxes.current[lang] = el
                  }}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  lang={lang}
                  rows={4}
                  value={clause.text[lang]}
                  disabled={readOnly}
                  onChange={(e) => onChange({ ...clause, text: { ...clause.text, [lang]: e.target.value } })}
                  onSelect={remember(lang)}
                  onKeyUp={remember(lang)}
                  onClick={remember(lang)}
                  onFocus={remember(lang)}
                />
              </Field>
            ))}
          </div>
          {!readOnly && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">{t("clause.insert")}</span>
              <div className="flex flex-wrap gap-2" dir="ltr">
                {INSERTABLE[tpl.kind].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    // Keep the cursor in the text box: insert without stealing focus first.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insert(ph)}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Icon name="add" size={12} />
                    {ph}
                  </button>
                ))}
              </div>
            </div>
          )}
          <SwitchRow
            label={t("clause.locked")}
            hint={t("clause.lockedText")}
            checked={clause.locked}
            disabled={readOnly}
            onCheckedChange={(v) => onChange({ ...clause, locked: v })}
          />
          <SwitchRow
            label={t("clause.showChanges")}
            hint={t("clause.showChangesText", { v: baseVersion ?? version - 1 })}
            checked={!!clause.showChanges}
            disabled={readOnly}
            onCheckedChange={(v) => onChange({ ...clause, showChanges: v })}
          />
        </section>
      ) : (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="note-2" title={t("empty")} description={t("emptyText")} className="py-12" />
        </div>
      )}

      {baseVersion != null && (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">{t("changes.title", { v: baseVersion })}</h2>
          </header>
          {changes.length ? (
            <ul className="flex flex-col gap-3">
              {changes.map((c, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                  <StatusBadge tone={c.kind === "added" ? "success" : c.kind === "removed" ? "destructive" : "info"} className="shrink-0">
                    {t(`changes.${c.kind}`)}
                  </StatusBadge>
                  <span className="min-w-0 flex-1">{t("changes.line", { n: c.n, name: b(c.title) })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("changes.none")}</p>
          )}
        </section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ publish */

/**
 * Overlay · Publish version 5?: what changed, new contracts use it from now, signed on v4 stay as they are, drafts on
 * v4 (we'll ask to update them), "Email HR and the clinic managers", the archive note. Publish → `template-published`.
 */
export function PublishTemplateDialog({
  tpl,
  version,
  changes,
  onOpenChange,
  onPublish,
}: {
  tpl: ContractTemplate
  version: number
  changes: TemplateChange[]
  onOpenChange: (open: boolean) => void
  onPublish: (email: boolean) => void
}) {
  const t = useTranslations("billing.templateEditor.publish")
  const { b } = useBillText()
  const contracts = useContracts()
  const [email, setEmail] = React.useState(true)
  const emailId = React.useId()
  const current = publishedVersion(tpl)
  const count = (k: TemplateChange["kind"]) => changes.filter((c) => c.kind === k).length
  const drafts = current ? contracts.filter((c) => c.template === tpl.id && c.templateVersion === current.version && !c.sent).length : 0
  const rows: [string, string][] = [
    [t("changes"), changes.length ? t("changesValue", { edited: count("edited"), added: count("added"), removed: count("removed") }) : t("noChanges")],
    [t("newContracts"), t("newContractsValue", { v: version })],
    ...(current
      ? ([
          [t("signedOn", { v: current.version }), t("signedValue", { n: tpl.usedIn })],
          [t("draftsOn", { v: current.version }), drafts ? t("draftsValue", { n: drafts }) : t("draftsNone")],
        ] as [string, string][])
      : []),
  ]
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title", { v: version })}
      description={b(tpl.name)}
      icon="send-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={() => onPublish(email)}>{t("publish")}</Button>}
    >
      <div className="rounded-lg border px-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
            <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{k}</span>
            <span className="min-w-0 flex-1 text-sm text-foreground">{v}</span>
          </div>
        ))}
      </div>
      <label htmlFor={emailId} className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={emailId} checked={email} onCheckedChange={(v) => setEmail(v === true)} />
        {t("email")}
      </label>
      {current && (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          <span>{t("archived", { v: current.version })}</span>
        </p>
      )}
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ page */

/** "saved 2 min ago" from the draft's save time (this session). */
function useSavedText() {
  const t = useTranslations("billing.templateEditor.status")
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return (savedAt?: string) => {
    if (!savedAt) return t("notSaved")
    const min = Math.floor((now - new Date(savedAt).getTime()) / 60_000)
    return min < 1 ? t("savedNow") : t("savedAgo", { n: min })
  }
}

/**
 * Template editor (New version in the template preview): header "Employment · doctors · draft v5" with Save draft and
 * Publish (mobile: fixed action bar); the clause list (300) beside the clause editor; tablet and mobile stacked.
 * A published or archived version opens read-only. HR owns Staff templates; the finance manager Partner and Insurer.
 */
export function TemplateEditorPage() {
  const t = useTranslations("billing.templateEditor")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const tc = useTranslations("billing.newContract")
  const { b } = useBillText()
  const router = useRouter()
  const role = useBillRole()
  const params = useSearchParams()
  const list = useTemplates()
  const tpl = list.find((x) => x.id === params.get("id"))
  const version = Number(params.get("v"))
  const v = tpl?.versions.find((x) => x.version === version)
  const stored = React.useMemo(() => (tpl && v ? versionClauses(tpl, v.version) : []), [tpl, v])
  const [clauses, setClauses] = React.useState<TemplateClause[] | null>(null)
  const [selected, setSelected] = React.useState<string | undefined>(undefined)
  const [adding, setAdding] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [tried, setTried] = React.useState(false)
  const savedText = useSavedText()
  const cur = clauses ?? stored
  const sel = cur.find((c) => c.key === selected) ?? cur[0]

  if (!tpl || !v) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="note-2"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={templatesHref()}>
                  <Icon name="arrow-left" size={16} />
                  {t("backToList")}
                </Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }

  const readOnly = v.status !== "draft" || !canDraft(role, tpl.kind)
  const baseVersion = v.basedOn
  const base = baseVersion != null ? versionClauses(tpl, baseVersion) : []
  const changes = baseVersion != null ? changesFrom(base, cur) : []
  const dirty = clauses != null
  const missing = (c: TemplateClause) => ({ en: !c.title.en.trim(), ar: !c.title.ar.trim() })
  const invalid = cur.some((c) => missing(c).en || missing(c).ar)
  const index = sel ? cur.indexOf(sel) : -1
  const nowIso = () => new Date().toISOString()

  const edit = (next: TemplateClause[]) => setClauses(next)
  const update = (c: TemplateClause) => edit(cur.map((x) => (x.key === c.key ? c : x)))
  const move = (from: number, to: number) => {
    const next = [...cur]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    edit(next)
  }
  const remove = () => {
    if (!sel) return
    const next = cur.filter((c) => c.key !== sel.key)
    edit(next)
    setSelected(next[Math.max(0, index - 1)]?.key)
    toast.info(tc("removedToast"), { description: tc("removedToastText") })
  }
  const add = (added: AddedClause[]) => {
    const fresh = added.filter((a) => !cur.some((c) => c.key === a.key)).map((a) => ({ key: a.key, title: a.title, text: a.text, locked: false, isNew: true }))
    edit([...cur, ...fresh])
    if (fresh[0]) setSelected(fresh[0].key)
    toast.success(tc("clausesAddedToast", { n: fresh.length }), { description: tc("clausesAddedText") })
  }
  const firstMissing = () => {
    const bad = cur.find((c) => missing(c).en || missing(c).ar)
    if (bad) setSelected(bad.key)
  }
  const saveDraft = () => {
    setTried(true)
    if (invalid) return firstMissing()
    saveTemplateDraft(tpl.id, v.version, cur, nowIso())
    setClauses(null)
    toast.success(t("savedToast"), { description: baseVersion ? t("savedToastText", { v: baseVersion }) : t("savedToastTextNew") })
  }
  const askPublish = () => {
    setTried(true)
    if (invalid) return firstMissing()
    setPublishing(true)
  }
  const publish = () => {
    // The demo's clock (BILL_NOW) dates the published version, like every other record in Billing.
    publishTemplate(tpl.id, v.version, cur, BILL_NOW)
    setClauses(null)
    setPublishing(false)
    toast.success(t("publishedToast", { v: v.version }), { description: t("publishedToastText") })
    router.push(templatesHref(`${tpl.id}@${v.version}`))
  }

  const status = readOnly
    ? t(v.status === "draft" ? "status.readOnlyDraft" : "status.readOnly", { v: v.version, name: b(tpl.name) })
    : baseVersion != null
      ? t("status.draft", { v: v.version, name: b(tpl.name), base: baseVersion, saved: dirty ? t("status.unsaved") : savedText(v.savedAt) })
      : t("status.draftNew", { v: v.version, name: b(tpl.name), saved: dirty ? t("status.unsaved") : savedText(v.savedAt) })

  const actions = readOnly ? null : (
    <>
      <Button variant="outline" onClick={saveDraft} className="max-md:flex-1">
        {t("save")}
      </Button>
      <Button onClick={askPublish} className="max-md:flex-1">
        <Icon name="send-2" size={18} />
        {t("publishBtn")}
      </Button>
    </>
  )

  return (
    <>
      <PageTitle
        title={t(v.status === "draft" ? "titleDraft" : "titleVersion", { name: b(tpl.name), v: v.version })}
        crumbs={[
          { label: tn("billing"), href: "/billing" },
          { label: tt("contracts"), href: CONTRACTS_HREF },
        ]}
        back={templatesHref(`${tpl.id}@${v.version}`)}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={templatesHref(`${tpl.id}@${v.version}`)} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
      </div>
      <PageContainer className={cn(!readOnly && "pb-24 md:pb-8")}>
        {actions && <PageHeader className="max-md:hidden" actions={actions} />}
        {tried && invalid && (
          <Strip tone="destructive" icon="warning-2">
            {t("error")}
          </Strip>
        )}
        <div className="grid gap-4 md:gap-6 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
          <TemplateClausesList clauses={cur} selected={sel?.key} onSelect={setSelected} onMove={move} onAdd={() => setAdding(true)} readOnly={readOnly} className="xl:sticky xl:top-20" />
          <ClauseEditor
            tpl={tpl}
            version={v.version}
            clause={sel}
            index={index}
            changes={changes}
            baseVersion={baseVersion}
            status={status}
            onChange={update}
            onRemove={remove}
            errors={tried && sel ? missing(sel) : undefined}
            readOnly={readOnly}
          />
        </div>
      </PageContainer>
      {actions && <MobileActionBar>{actions}</MobileActionBar>}
      {adding && <AddClausesDialog have={cur.map((c) => c.key)} onOpenChange={setAdding} onAdd={add} />}
      {publishing && <PublishTemplateDialog tpl={tpl} version={v.version} changes={changes} onOpenChange={setPublishing} onPublish={publish} />}
    </>
  )
}
