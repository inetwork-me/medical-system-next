"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Bi } from "@/lib/mock/bi"
import { CENTER, CLAUSE_LIBRARY, PARTY_CANDIDATES, type ContractKind, type LibraryClause, type PartyCandidate } from "./data"
import { InitialsAvatar, InitialsTile, ltrRun } from "./parts"
import { useBillText } from "./text"

/* ------------------------------------------------------------------ shared */

/** "Specialist ophthalmologist · SCFHS 22R0041871" / "Reference lab · CR 1010234567 · Riyadh" / "CCHI licence 44 · Al Khobar". */
export function usePartyLine() {
  const t = useTranslations("billing.newContract")
  const { b } = useBillText()
  return (p: PartyCandidate, { short }: { short?: boolean } = {}) =>
    p.kind === "employee"
      ? t("employeeLine", { role: b(p.role), licence: ltrRun(p.licence?.no ?? "—") })
      : p.cchiLicence
        ? short
          ? t("insurerLineShort", { licence: ltrRun(p.cchiLicence), city: p.city ? b(p.city) : "" })
          : t("insurerLine", { role: b(p.role), licence: ltrRun(p.cchiLicence), city: p.city ? b(p.city) : "" })
        : t("companyLine", { role: b(p.role), cr: ltrRun(p.cr ?? "—"), city: p.city ? b(p.city) : "" })
}

/** The info note at the foot of the pickers (blue, with the info icon). */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
      <Icon name="info-circle" size={18} className="shrink-0" />
      <span>{children}</span>
    </p>
  )
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/* ------------------------------------------------------------------ Choose party */

/** Which candidates match: name (both languages), role, CR, CCHI licence, national ID or SCFHS no. */
export function matchParties(kind: ContractKind, query: string) {
  const q = norm(query)
  if (!q) return PARTY_CANDIDATES[kind]
  return PARTY_CANDIDATES[kind].filter((c) =>
    [c.name.en, c.name.ar, c.role.en, c.role.ar, c.cr, c.cchiLicence, c.nationalId, c.licence?.no].some((v) => v && norm(v).includes(q))
  )
}

/**
 * Choose party · Staff / Partner / Insurer (✕ on the selected party card, or the empty party field): search, radio
 * result cards (employee: avatar + job + SCFHS; partner: initials tile + CR; insurer: initials tile + CCHI licence) and
 * the hint. "Use this …" closes the dialog and swaps the party.
 */
export function ChoosePartyDialog({
  kind,
  current,
  onOpenChange,
  onPick,
  initialQuery = "",
}: {
  kind: ContractKind
  current: string | null
  onOpenChange: (open: boolean) => void
  onPick: (id: string) => void
  initialQuery?: string
}) {
  const t = useTranslations("billing.newContract.choose")
  const tn = useTranslations("billing.newContract")
  const { b } = useBillText()
  const line = usePartyLine()
  const [query, setQuery] = React.useState(initialQuery)
  const results = matchParties(kind, query)
  const [picked, setPicked] = React.useState<string | null>(current ?? results[0]?.id ?? null)
  // The pick follows the search: when the ticked one drops out of the results, the first result takes its place.
  const value = picked && results.some((r) => r.id === picked) ? picked : (results[0]?.id ?? null)

  const use = () => {
    if (!value) return
    onPick(value)
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t(`title.${kind}`)}
      description={tn(`partySearch.${kind}`)}
      icon="user-search"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={use} disabled={!value}>
          {t(`use.${kind}`)}
        </Button>
      }
    >
      <Field label={t("search")}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          startIcon={<Icon name="search-normal-1" size={20} className="text-muted-foreground" />}
        />
      </Field>
      {results.length ? (
        <RadioGroupPrimitive.Root value={value ?? ""} onValueChange={setPicked} className="flex flex-col gap-2" aria-label={t(`title.${kind}`)}>
          {results.map((c) => (
            <RadioGroupPrimitive.Item
              key={c.id}
              value={c.id}
              className="group/radio flex items-center gap-3 rounded-[10px] border bg-card p-3 text-start transition-colors outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-accent"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]/radio:border-primary">
                <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
              </span>
              {c.kind === "company" ? <InitialsTile initials={c.initials} className="bg-muted group-data-[state=checked]/radio:bg-card" /> : <InitialsAvatar initials={c.initials} />}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">{b(c.name)}</span>
                <span className="text-xs text-muted-foreground">
                  <bdi>{line(c, { short: true })}</bdi>
                </span>
              </span>
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
      ) : (
        <p className="rounded-[10px] border border-dashed p-4 text-center text-sm text-muted-foreground">{tn("partyEmpty")}</p>
      )}
      <Note>{t(`hint.${kind}`)}</Note>
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ Add clauses */

/** A clause the form adds: from the library (key `lib-…`, both languages) or written by hand (`custom-…`). */
export type AddedClause = { key: string; title: Bi; text: Bi }

/**
 * Add clauses (Add clause on New contract and the template editor): From Clause library / Write my own. Library: search,
 * checklist with one-line summaries (clauses already in the template or the form show as such and can't be ticked),
 * "Add N clauses" (follows the ticks). Write my own: a title and the text, kept in the language typed.
 */
export function AddClausesDialog({
  have,
  onOpenChange,
  onAdd,
  initial,
}: {
  /** Keys already in the form or template (`lib-…` included). */
  have: string[]
  onOpenChange: (open: boolean) => void
  onAdd: (clauses: AddedClause[]) => void
  /** Dev stories: the drawn state. */
  initial?: { from?: "library" | "own"; ticked?: string[]; query?: string }
}) {
  const t = useTranslations("billing.newContract.addClauses")
  const { b } = useBillText()
  const [from, setFrom] = React.useState<"library" | "own">(initial?.from ?? "library")
  const [query, setQuery] = React.useState(initial?.query ?? "")
  const [ticked, setTicked] = React.useState<string[]>(initial?.ticked ?? [])
  const [title, setTitle] = React.useState("")
  const [text, setText] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const taken = (c: LibraryClause) => c.inTemplate || have.includes(`lib-${c.key}`)
  const q = norm(query)
  const list = CLAUSE_LIBRARY.filter((c) => !q || [c.title.en, c.title.ar, c.summary.en, c.summary.ar].some((v) => norm(v).includes(q)))
  const n = from === "library" ? ticked.length : 1

  const add = () => {
    if (from === "own") {
      setTried(true)
      if (!title.trim() || !text.trim()) return
      onAdd([{ key: `custom-${Date.now()}`, title: { en: title.trim(), ar: title.trim() }, text: { en: text.trim(), ar: text.trim() } }])
    } else {
      if (!ticked.length) return
      onAdd(CLAUSE_LIBRARY.filter((c) => ticked.includes(c.key)).map((c) => ({ key: `lib-${c.key}`, title: c.title, text: c.text })))
    }
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="add-square"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={add} disabled={from === "library" && !ticked.length}>
          {from === "library" ? t("add", { n }) : t("addOwn")}
        </Button>
      }
    >
      <Field label={t("from")}>
        {(fp) => (
          <Segmented
            {...fp}
            value={from}
            onValueChange={setFrom}
            aria-label={t("from")}
            className="w-full *:flex-1"
            options={[
              { value: "library", label: t("library") },
              { value: "own", label: t("own") },
            ]}
          />
        )}
      </Field>
      {from === "library" ? (
        <>
          <Field label={t("search")}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              startIcon={<Icon name="search-normal-1" size={20} className="text-muted-foreground" />}
            />
          </Field>
          <ul className="flex flex-col rounded-[10px] border px-3">
            {list.map((c) => {
              const off = taken(c)
              const id = `lib-${c.key}`
              return (
                <li key={c.key} className="flex flex-col gap-1 border-b py-3 last:border-b-0">
                  <label htmlFor={id} className={cn("flex items-center gap-2 text-sm text-foreground", off ? "cursor-default" : "cursor-pointer")}>
                    <Checkbox
                      id={id}
                      checked={ticked.includes(c.key)}
                      disabled={off}
                      onCheckedChange={(v) => setTicked((x) => (v === true ? [...x, c.key] : x.filter((k) => k !== c.key)))}
                    />
                    {b(c.title)}
                  </label>
                  <span className="text-xs text-muted-foreground">{off && !c.inTemplate ? t("inForm") : b(c.summary)}</span>
                </li>
              )
            })}
            {!list.length && <li className="py-4 text-center text-sm text-muted-foreground">{t("none")}</li>}
          </ul>
          <Note>{t("note")}</Note>
        </>
      ) : (
        <>
          <Field label={t("ownTitle")} required error={tried && !title.trim() ? t("ownTitleError") : undefined}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label={t("ownText")} required error={tried && !text.trim() ? t("ownTextError") : undefined}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
          </Field>
          <Note>{t("ownNote")}</Note>
        </>
      )}
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ Add a signer */

export type SignerDoes = "signs" | "approves" | "copy"
/** Someone added with Add a signer (beyond the party and the center's signatory). */
export type ExtraSigner = { id: string; name: string; role: string; mobile: string; side: "center" | "party"; does: SignerDoes }

const mobileOk = (s: string) => /^\+966\d{8,9}$/.test(s.replace(/\s/g, ""))

/** "1st" … / "الأول" … for the order list and the toast. */
export function useOrdinal() {
  const t = useTranslations("billing.newContract.signerDialog")
  return {
    short: (n: number) => t("ordinal", { n }),
    word: (n: number) => t("ordinalWord", { n }),
  }
}

/**
 * Add a signer (Add signer on New contract): name, role, mobile, signs for (us / the other side), what they do (Signs /
 * Approves only / Gets a copy) and the order ("3rd · after Faisal Al-Qahtani"; copies don't sign, so no order). Note
 * about the SMS link + Nafath. Confirm adds them at that place in the order.
 */
export function AddSignerDialog({
  order,
  partyName,
  onOpenChange,
  onAdd,
  initial,
}: {
  /** The names in the current signing order (to word "after …"). */
  order: string[]
  /** The other side's name for "Signs for" (none until a party is chosen). */
  partyName?: string
  onOpenChange: (open: boolean) => void
  onAdd: (s: ExtraSigner, at: number) => void
  initial?: Partial<ExtraSigner> & { at?: number }
}) {
  const t = useTranslations("billing.newContract.signerDialog")
  const { b } = useBillText()
  const ord = useOrdinal()
  const [s, setS] = React.useState<ExtraSigner>({ id: "", name: "", role: "", mobile: "", side: "center", does: "signs", ...initial })
  const [at, setAt] = React.useState(initial?.at ?? order.length)
  const [tried, setTried] = React.useState(false)
  const set = (p: Partial<ExtraSigner>) => setS((x) => ({ ...x, ...p }))
  const err = {
    name: !s.name.trim(),
    role: !s.role.trim(),
    mobile: !mobileOk(s.mobile),
  }
  const add = () => {
    setTried(true)
    if (err.name || err.role || err.mobile) return
    onAdd({ ...s, id: `x-${Date.now()}`, name: s.name.trim(), role: s.role.trim() }, s.does === "copy" ? order.length : at)
    onOpenChange(false)
  }
  const positions = Array.from({ length: order.length + 1 }, (_, i) => i)
  const orderLabel = (i: number) => (i === 0 ? t("orderFirst", { n: ord.short(1), name: order[0] ?? "" }) : t("orderAfter", { n: ord.short(i + 1), name: order[i - 1] }))

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="user-add"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={add}>{t("add")}</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <Field label={t("name")} required error={tried && err.name ? t("nameError") : undefined}>
          <Input value={s.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </Field>
        <Field label={t("role")} required error={tried && err.role ? t("roleError") : undefined}>
          <Input value={s.role} onChange={(e) => set({ role: e.target.value })} />
        </Field>
        <Field label={t("mobile")} required error={tried && err.mobile ? t("mobileError") : undefined}>
          <Input
            dir="ltr"
            inputMode="tel"
            value={s.mobile}
            onChange={(e) => set({ mobile: e.target.value })}
            placeholder="+966 5X XXX XXXX"
            startIcon={<Icon name="call" size={20} className="text-muted-foreground" />}
          />
        </Field>
        <Field label={t("signsFor")} required>
          {(fp) => (
            <Select value={s.side} onValueChange={(v) => set({ side: v as ExtraSigner["side"] })}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">{b(CENTER.name)}</SelectItem>
                <SelectItem value="party">{partyName ?? t("otherSide")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("does")} required>
        {(fp) => (
          <Segmented
            {...fp}
            value={s.does}
            onValueChange={(v) => set({ does: v })}
            aria-label={t("does")}
            className="w-full *:flex-1"
            options={(["signs", "approves", "copy"] as SignerDoes[]).map((d) => ({ value: d, label: t(`doesValue.${d}`) }))}
          />
        )}
      </Field>
      {s.does !== "copy" && (
        <Field label={t("order")}>
          {(fp) => (
            <Select value={String(at)} onValueChange={(v) => setAt(Number(v))}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {positions.map((i) => (
                  <SelectItem key={i} value={String(i)}>
                    {order.length ? orderLabel(i) : ord.short(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      <Note>{t(s.does === "copy" ? "noteCopy" : "note")}</Note>
    </ResponsiveDialog>
  )
}
