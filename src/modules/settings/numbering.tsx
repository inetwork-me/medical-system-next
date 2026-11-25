"use client"

import * as React from "react"

import { DOC_KEYS, FORMATS_DEFAULT, formatNumber, nextReset, pattern, resetCovered, type DatePart, type DocKey, type NumberFormat, type Reset } from "@/lib/numbering"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { canEditSection } from "./access"
import { SET_TODAY } from "./data"
import { SettingsFrame } from "./frame"
import { KvRows, Note, SetCard, useUserText } from "./parts"
import { saveFormat, savePrefs, useFormats, usePrefs, writeAudit, type Prefs } from "./store"

/** The next counter per document today (design: MRN-25103, V-2611-08420, INV-2611-0242 …; Billing's last invoice is 0241). */
const NEXT: Record<DocKey, number> = { mrn: 25103, visit: 8420, invoice: 242, credit: 13, rx: 389, lab: 143, request: 20, contract: 32 }

/** Is a document's saved format waiting for its start day? */
function useDocs() {
  const saved = useFormats()
  return DOC_KEYS.map((key) => {
    const s = saved[key]
    const pending = s && s.from > SET_TODAY ? s : undefined
    const current = s && !pending ? s.format : FORMATS_DEFAULT[key]
    return { key, current, pending, next: formatNumber(current, SET_TODAY, NEXT[key]) }
  })
}

const PREF_OPTIONS: { [K in keyof Prefs]: Prefs[K][] } = {
  date: ["dMonY", "dmy", "iso"],
  hijri: ["documents", "everywhere", "off"],
  time: ["24", "12"],
  week: ["sun", "sat", "mon"],
  digits: ["latin", "arabic"],
  currency: ["SAR"],
  language: ["ar", "en"],
  zone: ["Asia/Riyadh"],
}

/**
 * Settings · Numbering and formats: Numbering (document, format, next number, starts again, Edit — a list on mobile; tokens
 * note), then Dates, numbers and language (date format, Hijri next to dates, 24-hour time, week start, Latin digits, SAR,
 * default language, Riyadh time zone). Header: Save changes (the formats card); each numbering format saves from its dialog.
 */
export function NumberingPage() {
  const x = useUserText()
  const { t, l, dates } = x
  const docs = useDocs()
  const saved = usePrefs()
  const edit = canEditSection("numbering")
  const [prefs, setPrefs] = React.useState<Prefs>(saved)
  const [editing, setEditing] = React.useState<DocKey | null>(null)

  const save = () => {
    const changed = (Object.keys(prefs) as (keyof Prefs)[]).filter((k) => prefs[k] !== saved[k])
    savePrefs(prefs)
    if (changed.length) writeAudit({ what: { en: `Changed dates and formats: ${changed.map((k) => `${k} → ${prefs[k]}`).join(", ")}`, ar: `غيّر التواريخ والصيغ (${changed.length})` }, where: "numbering" })
    toast.success(t("toasts.saved"), { description: t("toasts.savedText") })
  }

  const reset = (r: Reset) => t(`numbering.reset.${r}`)
  const sample = (k: keyof Prefs, v: string) => {
    if (k === "date") return v === "dMonY" ? l(dates.short(SET_TODAY).replace(/^0/, "")) : v === "dmy" ? l("25/11/2026") : l("2026-11-25")
    return t(`numbering.prefs.${k}.${v}` as "numbering.prefs.time.24")
  }

  return (
    <SettingsFrame section="numbering" actions={edit ? <Button onClick={save}>{t("general.save")}</Button> : undefined}>
      <SetCard title={t("numbering.title")} sub={t("numbering.sub")}>
        <div className="hidden overflow-hidden rounded-lg border xl:block">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="w-[30%] px-4 py-3 text-start font-normal">{t("numbering.colDoc")}</th>
                <th className="w-[22%] px-3 py-3 text-start font-normal">{t("numbering.colFormat")}</th>
                <th className="w-[20%] px-3 py-3 text-start font-normal">{t("numbering.colNext")}</th>
                <th className="w-[16%] px-3 py-3 text-start font-normal">{t("numbering.colReset")}</th>
                <th className="px-4 py-3">
                  <span className="sr-only">{t("users.colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.key} className="border-t">
                  <td className="px-4 py-3 text-foreground">{t(`numbering.docs.${d.key}`)}</td>
                  <td className="px-3 py-3">
                    <span dir="ltr" className="text-xs text-primary">
                      {pattern(d.current)}
                    </span>
                    {d.pending && (
                      <span className="block text-xs text-warning-soft-foreground">
                        {t("numbering.pending", { pattern: l(pattern(d.pending.format)), date: l(dates.dayMonth(d.pending.from)) })}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground tabular-nums">{l(d.next)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{reset(d.current.reset)}</td>
                  <td className="px-4 py-3 text-end">
                    {edit && (
                      <Button variant="outline" size="sm" onClick={() => setEditing(d.key)}>
                        {t("branches.edit")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="flex flex-col divide-y xl:hidden">
          {docs.map((d) => (
            <li key={d.key}>
              <button
                type="button"
                disabled={!edit}
                onClick={() => setEditing(d.key)}
                className="flex w-full cursor-pointer items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <Icon name="hashtag" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{t(`numbering.docs.${d.key}`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("numbering.nextLine", { no: l(d.next), reset: reset(d.current.reset).toLowerCase() })}
                  </span>
                  {d.pending && (
                    <span className="text-xs text-warning-soft-foreground">
                      {t("numbering.pending", { pattern: l(pattern(d.pending.format)), date: l(dates.dayMonth(d.pending.from)) })}
                    </span>
                  )}
                </span>
                {edit && <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground" />}
              </button>
            </li>
          ))}
        </ul>
        <Note>{t("numbering.tokens")}</Note>
      </SetCard>

      <SetCard title={t("numbering.formats")}>
        <fieldset disabled={!edit} className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          {(Object.keys(PREF_OPTIONS) as (keyof Prefs)[]).map((k) => (
            <Field key={k} label={t(`numbering.prefs.${k}.label`)}>
              {(c) => (
                <Select value={prefs[k]} onValueChange={(v) => setPrefs((p) => ({ ...p, [k]: v }))} disabled={!edit}>
                  <SelectTrigger {...c} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PREF_OPTIONS[k].map((v) => (
                      <SelectItem key={v} value={v}>
                        {sample(k, v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          ))}
        </fieldset>
      </SetCard>
      {editing && <FormatDialog doc={editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </SettingsFrame>
  )
}

/**
 * Overlay · Invoice numbers (Edit on a format): prefix, date part, digits, starts again, live preview of the next number.
 * Amber note: old numbers stay (and ZATCA needs invoice numbers unique per branch). → `format-saved`.
 */
function FormatDialog({ doc, onOpenChange }: { doc: DocKey; onOpenChange: (o: boolean) => void }) {
  const x = useUserText()
  const { t, l, dates } = x
  const docs = useDocs()
  const d = docs.find((y) => y.key === doc)!
  const base = d.pending?.format ?? d.current
  const [prefix, setPrefix] = React.useState(base.prefix)
  const [date, setDate] = React.useState<DatePart>(base.date)
  const [digits, setDigits] = React.useState(String(base.digits))
  const [resetP, setResetP] = React.useState<Reset>(base.reset)
  const [tried, setTried] = React.useState(false)
  const f: NumberFormat = { prefix, date, digits: Number(digits), reset: resetP }
  const from = nextReset(resetP, SET_TODAY)
  const preview = from ? formatNumber(f, from, 1) : formatNumber(f, SET_TODAY, NEXT[doc])
  const name = t(`numbering.docs.${doc}`)
  const errors = {
    prefix: !/^[A-Z]{1,5}$/.test(prefix) ? t("numbering.errPrefix") : undefined,
    reset: !resetCovered(f) ? t("numbering.errReset") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  const save = () => {
    setTried(true)
    if (invalid) return
    const start = saveFormat(doc, f)
    writeAudit({ what: { en: `Changed ${name.toLowerCase()} numbers to ${pattern(f)}, starting again ${resetP} (from ${start})`, ar: `غيّر صيغة ${name} إلى ${pattern(f)}` }, where: "numbering" })
    toast.success(t("toasts.formatSaved"), { description: t("toasts.formatSavedText", { doc: name.toLowerCase(), no: l(preview) }) })
    onOpenChange(false)
  }

  const sel = <T extends string>(value: T, onChange: (v: T) => void, opts: [T, string][], c: object) => (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger {...c} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("numbering.dialogTitle", { doc: name })}
      description={t("numbering.dialogSub")}
      icon="hashtag"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("branches.save")}</Button>}
    >
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <KvRows boxed rows={[[t("numbering.colDoc"), name]]} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label={t("numbering.prefix")} required error={tried ? errors.prefix : undefined}>
          <Input dir="ltr" className="text-start uppercase" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={5} />
        </Field>
        <Field label={t("numbering.datePart")}>
          {(c) =>
            sel<DatePart>(date, setDate, [["none", t("numbering.dateNone")], ["YY", "YY"], ["YYMM", "YYMM"], ["YYMMDD", "YYMMDD"]], c)
          }
        </Field>
        <Field label={t("numbering.digits")}>{(c) => sel(digits, setDigits, ["3", "4", "5", "6"].map((v) => [v, v]), c)}</Field>
        <Field label={t("numbering.colReset")} error={tried ? errors.reset : undefined}>
          {(c) => sel<Reset>(resetP, setResetP, (["never", "daily", "monthly", "yearly"] as Reset[]).map((r) => [r, t(`numbering.reset.${r}`)]), c)}
        </Field>
      </div>
      <p className="rounded-[10px] bg-muted/70 px-3 py-2.5 text-xs text-foreground">
        {from ? t("numbering.preview", { no: l(preview), date: l(dates.dayMonth(from)) }) : t("numbering.previewNow", { no: l(preview) })}
      </p>
      <Note tone="warning">{doc === "invoice" || doc === "credit" ? t("numbering.zatcaNote", { doc: name.toLowerCase() }) : t("numbering.oldNote")}</Note>
    </ResponsiveDialog>
  )
}
