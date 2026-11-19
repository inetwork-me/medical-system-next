"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Field } from "@/components/ds/field"
import { DatePicker } from "@/components/ds/pickers"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CLINICS_TODAY, PAYERS, type Clinic, type Payer, type Service } from "./data"
import { SwitchCard } from "./parts"
import { updateClinic, useClinics } from "./store"
import { useClinicText } from "./text"

type Row = { clinic: Clinic; s: Service }
type PayerView = "all" | Payer

const patchService = (clinic: string, id: string, fn: (s: Service) => Service) =>
  updateClinic(clinic, (x) => ({ services: x.services.map((s) => (s.id === id ? fn(s) : s)) }))

/** Prices that apply today (a pending change applies from its date). */
const pricesNow = (s: Service) => (s.pending && s.pending.from <= CLINICS_TODAY ? s.pending.prices : s.prices)

/**
 * Widget / Clinic Prices (one clinic) and Widget / All Prices (every clinic, + Clinic column and clinic filter).
 * Wide (≥ 56rem): search · [clinic] · payer switch (All payers / Cash / Bupa / Tawuniya / MedGulf — one payer shows its
 * column only); table with Active switch and Edit price. Compact: search · [clinic] · payer switch without "All";
 * rows show the chosen payer's price with Bupa (or Cash) under it. Payer columns keep a fixed order.
 */
export function PriceList({ clinic }: { clinic?: Clinic }) {
  const t = useTranslations("clinics.prices")
  const { b, min } = useClinicText()
  const clinics = useClinics()
  const all = !clinic
  const [query, setQuery] = React.useState("")
  const [only, setOnly] = React.useState<string>("all")
  const [payer, setPayer] = React.useState<PayerView>("all")
  const [editing, setEditing] = React.useState<Row | null>(null)
  const [adding, setAdding] = React.useState(false)

  const q = query.trim().toLowerCase()
  const source: Row[] = (clinic ? [clinic] : clinics.filter((c) => only === "all" || c.key === only)).flatMap((c) => c.services.map((s) => ({ clinic: c, s })))
  const rows = source.filter(({ s }) => !q || s.code.toLowerCase().includes(q) || s.name.en.toLowerCase().includes(q) || s.name.ar.includes(query.trim()))
  const cols = payer === "all" ? PAYERS : [payer]
  const compactPayer: Payer = payer === "all" ? "cash" : payer
  const n = (v: number) => v.toLocaleString("en")
  const amount = (v: number) => t("amount", { n: n(v) })

  const toggle = (r: Row, v: boolean) => {
    patchService(r.clinic.key, r.s.id, (s) => ({ ...s, active: v }))
    const name = b(r.s.name)
    if (v) toast.success(t("activated"), { description: t("activeText", { name, clinic: b(r.clinic.name) }) })
    else toast.info(t("deactivated"), { description: t("deactivatedText", { name, clinic: b(r.clinic.name) }) })
  }

  const clinicSelect = all && (
    <Select value={only} onValueChange={setOnly}>
      <SelectTrigger className="w-full @4xl/pl:w-45" aria-label={t("clinicFilter")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("allClinics")}</SelectItem>
        {clinics.map((c) => (
          <SelectItem key={c.key} value={c.key}>
            {b(c.name)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <Widget
      title={all ? t("titleAll") : t("title")}
      description={t("text")}
      className="gap-4 p-4 md:p-5"
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setAdding(true)}>
          <Icon name="add" size={16} />
          {t("add")}
        </Button>
      }
    >
      <div className="@container/pl flex flex-col gap-4">
        <div className="flex flex-col gap-2 @4xl/pl:flex-row @4xl/pl:items-center">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            startIcon={<Icon name="search-normal-1" size={16} />}
            className="@4xl/pl:w-65"
          />
          {clinicSelect}
          <Segmented
            size="sm"
            className="hidden @4xl/pl:ms-auto @4xl/pl:flex"
            aria-label={t("payer")}
            value={payer}
            onValueChange={setPayer}
            options={[{ value: "all" as PayerView, label: t("allPayers") }, ...PAYERS.map((p) => ({ value: p as PayerView, label: t(`payers.${p}`) }))]}
          />
          <Segmented
            size="sm"
            className="w-full @4xl/pl:hidden"
            aria-label={t("payer")}
            value={compactPayer}
            onValueChange={setPayer}
            options={PAYERS.map((p) => ({ value: p, label: t(`payers.${p}`) }))}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="search-normal-1" title={t("empty")} description={t("emptyText")} className="py-10" />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border @4xl/pl:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr className="h-10">
                    <th scope="col" className="ps-4 text-start font-medium">{t("col.service")}</th>
                    {all && <th scope="col" className="w-33 px-2 text-start font-medium">{t("col.clinic")}</th>}
                    <th scope="col" className="w-20.5 px-2 text-start font-medium">{t("col.code")}</th>
                    <th scope="col" className="w-21 px-2 text-start font-medium">{t("col.time")}</th>
                    {cols.map((p) => (
                      <th key={p} scope="col" className={cn("px-2 text-start font-medium", p === "tawuniya" || p === "medgulf" ? "w-23" : "w-20.5")}>
                        {t(`payers.${p}`)}
                      </th>
                    ))}
                    <th scope="col" className="w-16 px-2 text-start font-medium">{t("col.active")}</th>
                    <th scope="col" className="w-14 pe-4">
                      <span className="sr-only">{t("col.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const p = pricesNow(r.s)
                    return (
                      <tr key={r.clinic.key + r.s.id} className={cn(!r.s.active && "text-muted-foreground")}>
                        <td className="py-3 ps-4">
                          <div className="flex flex-col items-start gap-1">
                            <span>{b(r.s.name)}</span>
                            {r.s.pending && r.s.pending.from > CLINICS_TODAY && <Pending s={r.s} />}
                          </div>
                        </td>
                        {all && <td className="truncate px-2 text-xs text-muted-foreground">{b(r.clinic.name)}</td>}
                        <td className="px-2 text-xs text-muted-foreground tabular-nums">{r.s.code}</td>
                        <td className="px-2 tabular-nums">{min(r.s.minutes)}</td>
                        {cols.map((k) => (
                          <td key={k} className="px-2 tabular-nums">
                            {n(p[k])}
                          </td>
                        ))}
                        <td className="px-2">
                          <Switch checked={r.s.active} onCheckedChange={(v) => toggle(r, v)} aria-label={t("activeToggle", { name: b(r.s.name) })} />
                        </td>
                        <td className="pe-4 text-end">
                          <Button variant="ghost" size="icon-sm" aria-label={t("edit")} onClick={() => setEditing(r)}>
                            <Icon name="edit-2" size={20} />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col divide-y @4xl/pl:hidden">
              {rows.map((r) => {
                const p = pricesNow(r.s)
                const second: Payer = compactPayer === "cash" ? "bupa" : "cash"
                return (
                  <li key={r.clinic.key + r.s.id} className={cn("flex items-center gap-2.5 py-3", !r.s.active && "opacity-60")}>
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                      <span className="text-sm font-medium">{b(r.s.name)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {r.s.code} · {min(r.s.minutes)}
                        {all && <> · {b(r.clinic.name)}</>}
                      </span>
                      {r.s.pending && r.s.pending.from > CLINICS_TODAY && <Pending s={r.s} />}
                    </div>
                    <div className="flex flex-col items-end text-end">
                      <span className="text-sm font-medium tabular-nums">{amount(p[compactPayer])}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{t("other", { payer: t(`payers.${second}`), n: n(p[second]) })}</span>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={t("edit")} onClick={() => setEditing(r)}>
                      <Icon name="edit-2" size={20} />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
      {editing && <EditPricesDialog row={editing} onOpenChange={(o) => !o && setEditing(null)} />}
      {adding && <AddServiceDialog clinic={clinic} defaultKey={only === "all" ? undefined : only} onOpenChange={setAdding} />}
    </Widget>
  )
}

function Pending({ s }: { s: Service }) {
  const t = useTranslations("clinics.prices")
  const { dates } = useClinicText()
  return <StatusBadge tone="info">{t("pending", { date: dates.short(s.pending!.from) })}</StatusBadge>
}

/** Export price list (module tab action): every clinic's services with all payer prices that apply today. */
export function useExportPrices() {
  const t = useTranslations("clinics.prices")
  const { b, min, locale } = useClinicText()
  const clinics = useClinics()
  return () => {
    const file = `price-list-${stamp()}.xlsx`
    const head = [t("col.service"), t("col.clinic"), t("col.code"), t("col.time"), ...PAYERS.map((p) => t(`payers.${p}`)), t("col.active")]
    const body = clinics.flatMap((c) =>
      c.services.map((s) => [b(s.name), b(c.name), s.code, min(s.minutes), ...PAYERS.map((p) => String(pricesNow(s)[p])), s.active ? "✓" : "—"])
    )
    saveBlob(xlsxBlob(head, body, { sheet: t("title"), rtl: locale === "ar" }), file)
    toast.success(t("exported"), { description: t("exportedText", { file }) })
  }
}

/* ================================================================== Edit prices */

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromIso = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
/** Price changes default to the 1st of next month (design: 01/12/2026). */
const NEXT_MONTH = (() => {
  const d = fromIso(CLINICS_TODAY)
  return isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 1))
})()

/** Overlay · Edit prices: service · Cash | Bupa · Tawuniya | MedGulf (SAR) · Applies from → toast "Prices saved". */
function EditPricesDialog({ row, onOpenChange }: { row: Row; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("clinics.editPrices")
  const tp = useTranslations("clinics.prices")
  const { b, dates } = useClinicText()
  const start = row.s.pending?.prices ?? row.s.prices
  const [vals, setVals] = React.useState<Record<Payer, string>>(() => Object.fromEntries(PAYERS.map((p) => [p, String(start[p])])) as Record<Payer, string>)
  const [from, setFrom] = React.useState<Date | undefined>(() => fromIso(row.s.pending?.from ?? NEXT_MONTH))
  const [tried, setTried] = React.useState(false)
  const bad = (p: Payer) => !/^\d+$/.test(vals[p].trim())
  const confirm = () => {
    setTried(true)
    if (PAYERS.some(bad) || !from) return
    const prices = Object.fromEntries(PAYERS.map((p) => [p, Number(vals[p])])) as Record<Payer, number>
    const iso = isoOf(from)
    const now = iso <= CLINICS_TODAY
    patchService(row.clinic.key, row.s.id, (s) => (now ? { ...s, prices, pending: undefined } : { ...s, pending: { prices, from: iso } }))
    onOpenChange(false)
    toast.success(t("toast"), { description: now ? t("toastNow") : t("toastText", { date: dates.short(iso) }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="edit-2"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={confirm}>{t("confirm")}</Button>}
    >
      <dl className="flex items-center gap-3 text-sm">
        <dt className="w-[37%] shrink-0 text-xs text-muted-foreground">{t("service")}</dt>
        <dd className="font-medium">
          {b(row.s.name)} · <span className="tabular-nums">{row.s.code}</span>
        </dd>
      </dl>
      <div className="grid gap-4 md:grid-cols-2 md:gap-3">
        {PAYERS.map((p) => (
          <Field key={p} label={t("field", { payer: tp(`payers.${p}`) })} error={tried && bad(p) ? t("invalid") : undefined}>
            <Input inputMode="numeric" dir="ltr" value={vals[p]} onChange={(e) => setVals((v) => ({ ...v, [p]: e.target.value.replace(/[^\d]/g, "") }))} />
          </Field>
        ))}
      </div>
      <Field label={t("from")}>{(a) => <DatePicker {...a} value={from} onChange={setFrom} placeholder="dd/mm/yyyy" />}</Field>
    </ResponsiveDialog>
  )
}

/* ================================================================== Add service */

const LENGTHS = [10, 15, 20, 30, 45, 60, 90]
/** Default insurer prices when they differ from cash (design ratios: Bupa ≈ 88%, Tawuniya ≈ 84%, MedGulf ≈ 89%). */
const RATIO: Record<Payer, number> = { cash: 1, bupa: 0.88, tawuniya: 0.84, medgulf: 0.89 }
const round5 = (n: number) => Math.round(n / 5) * 5

/** Overlay · Add service: [Clinic (all-clinics list)] · Service name* | Code · Length | Cash price · Same price for all insurers. */
function AddServiceDialog({ clinic, defaultKey, onOpenChange }: { clinic?: Clinic; defaultKey?: string; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("clinics.addService")
  const { b, min } = useClinicText()
  const clinics = useClinics()
  const fixed = !!clinic
  const [where, setWhere] = React.useState(clinic?.key ?? defaultKey ?? clinics[0]?.key ?? "")
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [length, setLength] = React.useState(15)
  const [cash, setCash] = React.useState("")
  const [same, setSame] = React.useState(false)
  const [tried, setTried] = React.useState(false)
  const nameErr = tried && !name.trim() ? t("nameRequired") : undefined
  const cashErr = tried && !/^\d+$/.test(cash) ? t("priceRequired") : undefined
  const confirm = () => {
    setTried(true)
    if (!name.trim() || !/^\d+$/.test(cash) || !where) return
    const c = Number(cash)
    const prices = Object.fromEntries(PAYERS.map((p) => [p, same ? c : round5(c * RATIO[p])])) as Record<Payer, number>
    const text = name.trim()
    const s: Service = { id: `${where}-${Date.now()}`, name: { en: text, ar: text }, code: code.trim().toUpperCase() || "—", minutes: length, prices, active: true }
    updateClinic(where, (x) => ({ services: [...x.services, s] }))
    onOpenChange(false)
    toast.success(t("toast"), { description: t("toastText") })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="add"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={confirm}>{t("confirm")}</Button>}
    >
      {!fixed && (
        <Field label={t("clinic")} required>
          {(p) => (
            <Select value={where} onValueChange={setWhere}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clinics.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {b(c.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      <div className="grid gap-4 md:grid-cols-2 md:gap-3">
        <Field label={t("name")} required error={nameErr}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePh")} />
        </Field>
        <Field label={t("code")}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("codePh")} dir="ltr" />
        </Field>
        <Field label={t("length")}>
          {(p) => (
            <Select value={String(length)} onValueChange={(v) => setLength(Number(v))}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENGTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {min(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("cash")} required error={cashErr}>
          <Input inputMode="numeric" dir="ltr" value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" />
        </Field>
      </div>
      <SwitchCard label={t("same")} hint={same ? undefined : t("sameHint", { discount: 12 })} checked={same} onCheckedChange={setSame} />
    </ResponsiveDialog>
  )
}
