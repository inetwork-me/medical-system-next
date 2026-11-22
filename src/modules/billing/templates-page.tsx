"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BILL_TODAY, STAFF, type ContractKind, type ContractTemplate, type TemplateVersion } from "./data"
import { CONTRACTS_HREF, newContractHref, templatesHref } from "./href"
import { KindChip } from "./parts"
import { canDraft } from "./roles"
import { currentUser } from "./session"
import { useBillRole } from "./store"
import { clausesOfVersion, createTemplate, duplicateTemplate, newVersion, publishedVersion, useTemplates } from "./templates-store"
import { useBillText } from "./text"

type Filter = "all" | ContractKind
const FILTERS: Filter[] = ["all", "staff", "partner", "insurer"]

/**
 * A library row is one version of a template: the published one, and a draft next to it when one exists
 * ("Provider agreement · CCHI · v2" Published + "… · v3" Draft).
 */
type Row = { t: ContractTemplate; v: TemplateVersion; key: string }
const rowsOf = (list: ContractTemplate[]): Row[] =>
  list.flatMap((t) =>
    t.versions
      .filter((v) => v.status === "published" || v.status === "draft")
      .sort((a, b) => a.version - b.version)
      .map((v) => ({ t, v, key: `${t.id}@${v.version}` }))
  )

/** "Edited 3 Nov · Nora Al-Fahad" — "Edited Today …" for today. */
function useEdited() {
  const t = useTranslations("billing.templates")
  const { b, date } = useBillText()
  return (v: TemplateVersion) => t("edited", { date: v.at === BILL_TODAY ? t("today") : date(v.at).replace(/\s\d{4}$/, ""), name: b(STAFF[v.by].name) })
}

/* ------------------------------------------------------------------ library */

/**
 * Widget / Bill Templates: "Templates" · "Every new contract starts from one · signed contracts keep their version";
 * search + filter (All · Staff · Partners · Insurers); table Template (icon + "name · v4" + "Edited date · person") ·
 * Type chip · Clauses · Used in · Status (Published / Draft). The selected row is tinted. Compact: a list with the type,
 * clauses and use count, the status and a chevron.
 */
export function TemplatesLibrary({ selected, onSelect }: { selected?: string; onSelect: (key: string) => void }) {
  const t = useTranslations("billing.templates")
  const tk = useTranslations("billing.kind")
  const { b } = useBillText()
  const edited = useEdited()
  const all = rowsOf(useTemplates())
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const q = query.trim().toLowerCase()
  const rows = all.filter((r) => (filter === "all" || r.t.kind === filter) && (!q || r.t.name.en.toLowerCase().includes(q) || r.t.name.ar.includes(query.trim())))
  const count = (f: Filter) => all.filter((r) => f === "all" || r.t.kind === f).length
  const name = (r: Row) => t("nameVersion", { name: b(r.t.name), v: r.v.version })
  const clauses = (r: Row) => clausesOfVersion(r.t, r.v.version).length
  const used = (r: Row) => (r.v.status === "published" ? r.t.usedIn : 0)
  const status = (r: Row) => (
    <StatusBadge tone={r.v.status === "published" ? "success" : "neutral"}>{t(`status.${r.v.status === "published" ? "published" : "draft"}`)}</StatusBadge>
  )

  return (
    <section aria-labelledby="bill-templates" className="@container/tl flex flex-col gap-4 rounded-xl border bg-card p-4 @2xl/tl:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="bill-templates" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("text")}</p>
      </header>
      <div className="flex flex-col gap-2 @2xl/tl:flex-row @2xl/tl:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@2xl/tl:w-55"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 max-@2xl/tl:w-full max-@2xl/tl:*:flex-1 @2xl/tl:ms-auto"
          options={FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`, { n: count(f) }) }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="note-2"
          title={t("empty")}
          description={t("emptyText")}
          className="py-12"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setFilter("all")
              }}
            >
              {t("clear")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border @2xl/tl:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col />
                <col className="w-[92px]" />
                <col className="w-[76px]" />
                <col className="w-[84px]" />
                <col className="w-[132px]" />
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  {(["template", "type", "clauses", "used", "status"] as const).map((c) => (
                    <th key={c} className="h-10 px-1.5 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4">
                      {t(`col.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const on = r.key === selected
                  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"
                  return (
                    <tr key={r.key} className={cn("cursor-pointer border-t hover:bg-muted/50", on && "bg-accent hover:bg-accent")} onClick={() => onSelect(r.key)}>
                      <td className={td}>
                        <button
                          type="button"
                          onClick={() => onSelect(r.key)}
                          aria-pressed={on}
                          aria-label={t("open", { name: name(r) })}
                          className="flex w-full min-w-0 items-center gap-2.5 rounded-sm text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          <span aria-hidden className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]", on ? "bg-card text-primary" : "bg-muted text-foreground")}>
                            <Icon name="document-text" size={18} />
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm text-foreground">{name(r)}</span>
                            <span className="truncate text-xs text-muted-foreground">{edited(r.v)}</span>
                          </span>
                        </button>
                      </td>
                      <td className={td}>
                        <KindChip kind={r.t.kind} />
                      </td>
                      <td className={cn(td, "tabular-nums")}>{clauses(r)}</td>
                      <td className={cn(td, "tabular-nums", !used(r) && "text-muted-foreground")}>{used(r)}</td>
                      <td className={td}>{status(r)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col @2xl/tl:hidden">
            {rows.map((r) => {
              const on = r.key === selected
              return (
                <li key={r.key} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelect(r.key)}
                    aria-pressed={on}
                    className={cn("flex w-full items-center gap-2.5 rounded-sm px-1 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", on && "bg-accent")}
                  >
                    <span aria-hidden className={cn("inline-flex size-8 shrink-0 items-center justify-center self-start rounded-[10px]", on ? "bg-card text-primary" : "bg-muted text-foreground")}>
                      <Icon name="document-text" size={18} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm text-foreground">{name(r)}</span>
                      <span className="text-xs text-muted-foreground">{t("compactLine", { type: tk(r.t.kind), clauses: clauses(r), used: used(r) })}</span>
                      <span>{status(r)}</span>
                    </span>
                    <Icon name="arrow-right-1" size={24} className="shrink-0 text-foreground" />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ preview */

function Card({ title, description, children }: { title?: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5">
      {title && (
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

function Fact({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5", !last && "border-b")}>
      <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-sm text-foreground">{children}</span>
    </div>
  )
}

/**
 * Widget / Bill Template Preview: name, "Staff · version 4 · published 3 Nov", Languages, Who signs, Used in; Use template
 * (New contract with that type, prefilled), New version (version-created), Duplicate (template-duplicated). Then the
 * clauses in paper order, the placeholders filled from the form, and the versions (current + archived).
 */
export function TemplatePreview({ rowKey }: { rowKey: string }) {
  const t = useTranslations("billing.templates.preview")
  const tt = useTranslations("billing.templates")
  const tk = useTranslations("billing.kind")
  const { b, date } = useBillText()
  const router = useRouter()
  const role = useBillRole()
  const list = useTemplates()
  const [id, ver] = rowKey.split("@")
  const tpl = list.find((x) => x.id === id)
  if (!tpl) return null
  const v = tpl.versions.find((x) => x.version === Number(ver)) ?? publishedVersion(tpl) ?? tpl.versions[0]
  const owns = canDraft(role, tpl.kind)
  const isPublished = v.status === "published"
  const clauses = clausesOfVersion(tpl, v.version)
  const me = currentUser()?.key ?? "nora"
  const dm = (iso: string) => date(iso).replace(/\s\d{4}$/, "")

  const makeVersion = () => {
    const r = newVersion(tpl.id, me)
    if (!r) return
    if (r.created) toast.success(tt("versionToast", { v: r.version }), { description: tt("versionToastText") })
    else toast.info(tt("versionExists", { v: r.version }), { description: tt("versionExistsText") })
    router.replace(templatesHref(`${tpl.id}@${r.version}`), { scroll: false })
  }
  const duplicate = () => {
    const d = duplicateTemplate(tpl.id, me, { en: "(copy)", ar: "(نسخة)" })
    if (!d) return
    toast.success(tt("duplicateToast"), { description: tt("duplicateToastText", { name: b(d.name) }) })
    router.replace(templatesHref(`${d.id}@1`), { scroll: false })
  }

  const statusLine = (x: TemplateVersion) =>
    x.status === "published"
      ? t("published", { date: dm(x.at), name: b(STAFF[x.by].name) })
      : x.status === "draft"
        ? t("started", { date: x.at === BILL_TODAY ? tt("today") : dm(x.at), name: b(STAFF[x.by].name) })
        : x.signedOn
          ? t("signedOn", { n: x.signedOn })
          : t("replaced", { date: date(x.at).replace(/^\d+\s/, "") })

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{b(tpl.name)}</h2>
          <p className="text-xs text-muted-foreground">
            {isPublished ? t("meta", { type: tk(tpl.kind), v: v.version, date: dm(v.at) }) : t("metaDraft", { type: tk(tpl.kind), v: v.version })}
          </p>
        </header>
        <div className="flex flex-col">
          <Fact label={t("languages")}>{t(`lang.${tpl.languages}`)}</Fact>
          <Fact label={t("whoSigns")}>{t(`first.${tpl.firstSigner === "center" ? "center" : tpl.kind}`)}</Fact>
          <Fact label={t("usedIn")} last>
            {t("usedValue", { n: isPublished ? tpl.usedIn : 0 })}
          </Fact>
        </div>
        {owns && (
          <div className="flex items-center gap-2">
            {isPublished && (
              <Button size="sm" asChild>
                <Link href={newContractHref(tpl.kind, tpl.id)}>
                  <Icon name="add" size={18} />
                  {t("use")}
                </Link>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={makeVersion}>
              <Icon name="edit-2" size={18} />
              {t("newVersion")}
            </Button>
            <Button size="icon-sm" variant="outline" onClick={duplicate} aria-label={t("duplicate", { name: b(tpl.name) })} className="ms-auto">
              <Icon name="copy" size={18} />
            </Button>
          </div>
        )}
      </section>

      <Card title={t("clauses")} description={t("clausesText")}>
        {clauses.length ? (
          <ol className="flex flex-col gap-3">
            {clauses.map((c, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                {b(c)}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noClauses")}</p>
        )}
      </Card>

      {tpl.placeholders.length > 0 && (
        <Card title={t("filled")} description={t("filledText")}>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {tpl.placeholders.map((p) => (
              <code key={p} className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                {p}
              </code>
            ))}
          </div>
        </Card>
      )}

      <Card title={t("versions")}>
        <ul className="flex flex-col">
          {[...tpl.versions]
            .sort((a, z) => z.version - a.version)
            .map((x, i, arr) => (
              <li key={x.version} className={cn("flex items-center gap-3 py-3", i < arr.length - 1 && "border-b")}>
                <span className="w-8 shrink-0 text-sm text-foreground" dir="ltr">
                  v{x.version}
                </span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">{statusLine(x)}</span>
                <StatusBadge tone={x.status === "published" ? "success" : "neutral"}>{t(x.status === "published" ? "current" : x.status === "draft" ? "draft" : "archived")}</StatusBadge>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ new template */

/**
 * Overlay · New template: name, Type (Staff / Partner / Insurer — the types the user owns), Start from (a copy of an
 * existing template or blank), "Arabic and English side by side", the draft note → template-created.
 */
export function NewTemplateDialog({ onOpenChange, onCreated }: { onOpenChange: (open: boolean) => void; onCreated?: (key: string) => void }) {
  const t = useTranslations("billing.templates.dialog")
  const tt = useTranslations("billing.templates")
  const tk = useTranslations("billing.kind")
  const { b } = useBillText()
  const role = useBillRole()
  const list = useTemplates()
  const kinds = (["staff", "partner", "insurer"] as ContractKind[]).filter((k) => canDraft(role, k))
  const [name, setName] = React.useState("")
  const [kind, setKind] = React.useState<ContractKind>(kinds[0] ?? "staff")
  const [from, setFrom] = React.useState("blank")
  const [bilingual, setBilingual] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const bothId = React.useId()
  const sources = list.filter((x) => x.kind === kind)

  const create = () => {
    setTried(true)
    if (!name.trim() || !kinds.length) return
    const tpl = createTemplate({ name, kind, from: from === "blank" ? undefined : from, bilingual }, currentUser()?.key ?? "nora")
    onOpenChange(false)
    toast.success(tt("createdToast"), { description: tt("createdToastText", { name: b(tpl.name) }) })
    onCreated?.(`${tpl.id}@1`)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="note-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={create}>{t("create")}</Button>}
    >
      <Field label={t("name")} required error={tried && !name.trim() ? t("nameError") : undefined}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label={t("type")} required>
        {(fp) => (
          <Segmented
            {...fp}
            value={kind}
            onValueChange={(k) => {
              setKind(k)
              setFrom("blank")
            }}
            aria-label={t("type")}
            className="w-full *:flex-1"
            options={kinds.map((k) => ({ value: k, label: tk(k) }))}
          />
        )}
      </Field>
      <Field label={t("from")}>
        {(fp) => (
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger {...fp} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blank">{t("blank")}</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {t("copyOf", { name: b(s.name) })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <label htmlFor={bothId} className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={bothId} checked={bilingual} onCheckedChange={(v) => setBilingual(v === true)} />
        {t("bilingual")}
      </label>
      <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
        <Icon name="info-circle" size={18} className="shrink-0" />
        {t("note")}
      </p>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ page */

/**
 * Templates (`/billing/contracts/templates[?id=staff-doctors@4]`): inner page of Contracts — header Back · "Billing /
 * Contracts" over "Templates"; action New template. Desktop: the library beside the preview (360); tablet and mobile:
 * stacked (selecting a row scrolls to its preview).
 */
export function TemplatesPage() {
  const t = useTranslations("billing.templates")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const router = useRouter()
  const role = useBillRole()
  const list = useTemplates()
  const params = useSearchParams()
  const rows = rowsOf(list)
  const asked = params.get("id")
  const selected = rows.find((r) => r.key === asked)?.key ?? rows[0]?.key
  const [creating, setCreating] = React.useState(false)
  const previewRef = React.useRef<HTMLDivElement>(null)
  const canCreate = (["staff", "partner", "insurer"] as ContractKind[]).some((k) => canDraft(role, k))

  const select = (key: string) => {
    router.replace(templatesHref(key), { scroll: false })
    if (window.matchMedia("(max-width: 1279px)").matches) requestAnimationFrame(() => previewRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }))
  }

  return (
    <>
      <PageTitle
        title={t("title")}
        crumbs={[
          { label: tn("billing"), href: "/billing" },
          { label: tt("contracts"), href: CONTRACTS_HREF },
        ]}
        back={CONTRACTS_HREF}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={CONTRACTS_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("title")}</h1>
        {canCreate && (
          <Button variant="ghost" size="icon" onClick={() => setCreating(true)} aria-label={t("newTemplate")}>
            <Icon name="add" size={24} />
          </Button>
        )}
      </div>
      <PageContainer>
        <PageHeader
          className="max-md:hidden"
          actions={
            canCreate ? (
              <Button onClick={() => setCreating(true)}>
                <Icon name="add" size={18} />
                {t("newTemplate")}
              </Button>
            ) : undefined
          }
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
          <TemplatesLibrary selected={selected} onSelect={select} />
          <div ref={previewRef} className="scroll-mt-20">
            {selected && <TemplatePreview rowKey={selected} />}
          </div>
        </div>
      </PageContainer>
      {creating && <NewTemplateDialog onOpenChange={setCreating} onCreated={(k) => router.replace(templatesHref(k), { scroll: false })} />}
    </>
  )
}
