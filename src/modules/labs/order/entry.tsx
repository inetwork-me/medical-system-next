"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { MobileActionBar } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ANALYZER, LAB_NOW, TUBES, analyteOf, barcodeOf, timeOf, type LabOrder, type Panel } from "../data"
import { orderHref } from "../href"
import { deltaFor, flagFor, refText, saveDraft, submit } from "../machine"
import { FlagChip, Latin, ltrRun } from "../parts"
import { labCan } from "../roles"
import { applyStep, useLabRole } from "../store"
import { useLabText } from "../text"
import { OrderPage, useCurrentOrder } from "./frame"
import { OrderHeader } from "./header"
import { usePanelTitle } from "./results"
import { OrderSide } from "./side"

/** Panels the lab can type results for: on the analyzer, or a saved draft (sample collected). */
const enterable = (p: Panel) => p.state === "analyzer" || p.state === "draft"

/** "182" → 182, "" → null; anything that isn't a number stays as typed (shown invalid). */
const parse = (v: string): number | null | "bad" => {
  const s = v.trim().replace(",", ".")
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : "bad"
}

/**
 * Lab order page · Enter results (Pending → Enter results): the order header, then "Enter results · <panel>" —
 * tube + barcode + fasting, the analyzer strip ("3 of 4 values imported from Cobas c311 at 11:58"), one row per
 * analyte (value input; the missing one in Focus state on a warning-soft row; unit, reference, auto flag), the delta
 * check warning, a comment for the doctor — with the clinical details beside it. Actions Save draft · Submit for
 * validation (a fixed action bar on mobile). Import from analyzer is a stub: it reloads the analyzer's values.
 */
export function EnterResults() {
  const t = useTranslations("labs.entry")
  const role = useLabRole()
  const router = useRouter()
  const o = useCurrentOrder()
  const want = useSearchParams().get("test")
  const panel = o.panels.find((p) => p.test === want && enterable(p)) ?? o.panels.find(enterable)

  if (!panel) {
    return (
      <OrderPage>
        <OrderHeader order={o} />
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="glass"
            title={t("nothing")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={orderHref(o.no)}>{t("back")}</Link>
              </Button>
            }
          />
        </div>
      </OrderPage>
    )
  }
  return <EntryForm key={panel.test} order={o} panel={panel} canEdit={labCan(role, "enter")} canSubmit={labCan(role, "submit")} onDone={() => router.push(orderHref(o.no))} />
}

function EntryForm({ order: o, panel, canEdit, canSubmit, onDone }: { order: LabOrder; panel: Panel; canEdit: boolean; canSubmit: boolean; onDone: () => void }) {
  const t = useTranslations("labs.entry")
  const { b } = useLabText()
  const dates = useDates()
  const title = usePanelTitle()(panel)
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(panel.results.map((r) => [r.analyte, r.value === null ? "" : String(r.value)]))
  )
  const [importedAt, setImportedAt] = React.useState(panel.importedAt)
  const [comment, setComment] = React.useState(panel.comment ?? "")
  const [tried, setTried] = React.useState(false)
  const refs = React.useRef<Record<string, HTMLInputElement | null>>({})

  const parsed = Object.fromEntries(panel.results.map((r) => [r.analyte, parse(values[r.analyte] ?? "")]))
  const numbers = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, v === "bad" ? null : v])) as Record<string, number | null>
  const missing = panel.results.filter((r) => parsed[r.analyte] === null || parsed[r.analyte] === "bad")
  const imported = panel.results.filter((r) => r.instrument && r.value !== null && !r.manual).length
  const total = panel.results.length
  const tube = o.tubes.find((x) => x.tests.includes(panel.test) && x.state !== "rejected")
  const firstMissing = missing[0]?.analyte

  // The missing value starts in Focus state (design), so the tech can type it straight away.
  React.useEffect(() => {
    if (firstMissing) refs.current[firstMissing]?.focus()
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deltas = panel.results
    .map((r) => ({ r, pct: numbers[r.analyte] === null ? null : deltaFor({ ...r, value: numbers[r.analyte] }) }))
    .filter((x): x is { r: (typeof panel.results)[number]; pct: number } => x.pct !== null)
  const criticalNow = panel.results.filter((r) => flagFor(r.analyte, numbers[r.analyte], o.patient) === "C")

  const importValues = () => {
    setValues((v) => ({ ...v, ...Object.fromEntries(panel.results.filter((r) => r.instrument && r.value !== null).map((r) => [r.analyte, String(r.value)])) }))
    setImportedAt(LAB_NOW)
    toast.success(t("importedToast"), { description: t("importedToastText", { analyzer: ANALYZER, n: imported, total }) })
  }
  const draft = () => {
    const step = applyStep(o.no, (x) => saveDraft(x, panel.test, numbers, comment.trim() || undefined))
    if (!step.ok) return
    toast.success(t("drafted"), { description: t("draftedText") })
  }
  const send = () => {
    setTried(true)
    if (missing.length) {
      refs.current[missing[0].analyte]?.focus()
      return
    }
    const step = applyStep(o.no, (x) => submit(x, panel.test, numbers, comment.trim() || undefined, "ali", LAB_NOW))
    if (!step.ok) return
    toast.success(t("submitted", { panel: title }), { description: t("submittedText") })
    onDone()
  }

  const strip =
    importedAt && imported
      ? t(imported === total ? "importedAll" : total - imported === 1 ? "imported" : "importedMany", { n: imported, total, analyzer: ANALYZER, time: timeOf(importedAt) })
      : t("notImported")

  const actions = (
    <>
      <Button variant="outline" onClick={draft} disabled={!canEdit}>
        {t("saveDraft")}
      </Button>
      <Button onClick={send} disabled={!canSubmit}>
        <Icon name="tick-circle" size={24} />
        {t("submit")}
      </Button>
    </>
  )

  const input = (analyte: string, className?: string) => {
    const bad = parsed[analyte] === "bad" || (tried && parsed[analyte] === null)
    return (
      <Input
        ref={(el) => {
          refs.current[analyte] = el
        }}
        inputMode="decimal"
        dir="ltr"
        value={values[analyte] ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, [analyte]: e.target.value.replace(/[^\d.,-]/g, "") }))}
        placeholder={t("placeholder")}
        aria-label={b(analyteOf(analyte)!.name)}
        aria-invalid={bad || undefined}
        disabled={!canEdit}
        className={cn("tabular-nums rtl:text-right", className)}
      />
    )
  }

  return (
    <OrderPage actions={<div className="hidden gap-2 md:flex">{actions}</div>} className="max-md:pb-24">
      <OrderHeader order={o} />
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="@container/en flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 @2xl/en:p-5">
          <header className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-lg font-semibold text-foreground">{t("title", { panel: title })}</h2>
              {tube && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  <bdi>
                    {o.fasting && o.fastingHours
                      ? t("text", { tube: capFirst(b(TUBES[tube.type].the)), barcode: ltrRun(barcodeOf(o, tube.no)), h: o.fastingHours })
                      : t("textNoFast", { tube: capFirst(b(TUBES[tube.type].the)), barcode: ltrRun(barcodeOf(o, tube.no)) })}
                  </bdi>
                </p>
              )}
            </div>
            {canEdit && imported > 0 && (
              <Button variant="ghost" size="sm" onClick={importValues}>
                <Icon name="import" size={24} />
                {t("import")}
              </Button>
            )}
          </header>

          <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs font-medium text-info-soft-foreground">
            <Icon name="info-circle" size={18} className="shrink-0" />
            <bdi>{strip}</bdi>
          </p>

          {total === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAnalytes")}</p>
          ) : (
            <>
              {/* Wide: table */}
              <div className="hidden overflow-hidden rounded-lg border @2xl/en:block">
                <table className="w-full table-fixed border-collapse text-sm">
                  <colgroup>
                    <col />
                    <col className="w-[164px]" />
                    <col className="w-[92px]" />
                    <col className="w-[102px]" />
                    <col className="w-[102px]" />
                  </colgroup>
                  <thead className="bg-muted">
                    <tr>
                      {(["test", "result", "unit", "ref", "flag"] as const).map((k) => (
                        <th key={k} className="h-10 px-1.5 text-start text-xs font-medium text-muted-foreground first:ps-4 last:pe-4">
                          {t(`col.${k}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {panel.results.map((r) => {
                      const v = numbers[r.analyte]
                      const empty = parsed[r.analyte] === null
                      const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"
                      return (
                        <tr key={r.analyte} className={cn("border-t", empty && "bg-warning-soft")}>
                          <td className={cn(td, "font-medium")}>{b(analyteOf(r.analyte)!.name)}</td>
                          <td className={td}>{input(r.analyte)}</td>
                          <td className={cn(td, "text-xs text-muted-foreground")}>
                            <Latin>{r.unit}</Latin>
                          </td>
                          <td className={cn(td, "text-xs text-muted-foreground")}>
                            <Latin>{refText(r)}</Latin>
                          </td>
                          <td className={td}>{empty ? <span className="text-xs text-muted-foreground">—</span> : <FlagChip flag={flagFor(r.analyte, v, o.patient)} />}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Compact: stacked rows */}
              <ul className="flex flex-col overflow-hidden rounded-lg border @2xl/en:hidden">
                {panel.results.map((r) => {
                  const v = numbers[r.analyte]
                  const empty = parsed[r.analyte] === null
                  return (
                    <li key={r.analyte} className={cn("flex flex-col gap-2 border-b px-4 py-2.5 last:border-b-0", empty && "bg-warning-soft")}>
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium">{b(analyteOf(r.analyte)!.name)}</span>
                        <span className="text-xs text-muted-foreground">
                          <bdi>{t("ref", { ref: ltrRun(refText(r)) })}</bdi>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {input(r.analyte, "flex-1")}
                        <span className="text-xs text-muted-foreground">
                          <Latin>{r.unit}</Latin>
                        </span>
                        {empty ? <span className="text-xs text-muted-foreground">—</span> : <FlagChip flag={flagFor(r.analyte, v, o.patient)} />}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {tried && missing.length > 0 && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive-soft p-3 text-xs font-medium text-destructive-soft-foreground">
              <Icon name="danger" size={18} className="shrink-0" />
              {t("missing", { n: missing.length })}
            </p>
          )}
          {criticalNow.map((r) => (
            <p key={r.analyte} role="alert" className="flex items-start gap-2 rounded-lg bg-destructive-soft p-3 text-xs font-medium text-destructive-soft-foreground">
              <Icon name="danger" size={18} className="shrink-0" />
              <bdi>{t("critical", { analyte: b(analyteOf(r.analyte)!.name), value: ltrRun(`${values[r.analyte]} ${r.unit}`) })}</bdi>
            </p>
          ))}
          {deltas.map(({ r, pct }) => (
            <p key={r.analyte} role="status" className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs font-medium text-warning-soft-foreground">
              <Icon name="warning-2" size={18} className="shrink-0" />
              <bdi>
                {r.previous?.date
                  ? t("delta", { analyte: b(analyteOf(r.analyte)!.name), dir: pct > 0 ? "up" : "down", pct: Math.abs(pct), date: dates.dayMonth(r.previous.date) })
                  : t("deltaNoDate", { analyte: b(analyteOf(r.analyte)!.name), dir: pct > 0 ? "up" : "down", pct: Math.abs(pct) })}
              </bdi>
            </p>
          ))}

          <Field label={t("comment")}>{(p) => <Textarea {...p} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} disabled={!canEdit} />}</Field>
        </section>
        <OrderSide order={o} />
      </div>
      <MobileActionBar>{actions}</MobileActionBar>
    </OrderPage>
  )
}

const capFirst = (s: string) => (/^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s)
