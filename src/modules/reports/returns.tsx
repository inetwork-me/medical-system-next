"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Bi } from "@/lib/mock/bi"
import { PEOPLE, REP_NOW, REP_TODAY, addDays, daysBetween } from "./data"
import { RETURNS_HREF, returnHref } from "./href"
import { ltrRun, useB } from "./parts"
import { Kv, SideCard } from "./report-page"
import { AUTHORITY, FACILITY_CODE, RETURNS, type Check, type OfficialReturn, type ReturnStatus } from "./returns-data"
import { missingHref } from "@/modules/records/href"
import { inPeriod, missingCounts } from "@/modules/records/visit-rules"
import { useVisitCtx } from "@/modules/records/visits"
import { allVisits } from "@/modules/records/visits-data"
import type { RepRole } from "./roles"
import { addReturnNote, logReport, useRepRole, useReturnNotes, useSubmitted } from "./store"
import { Strip } from "./strip"
import { SubmitReturnDialog } from "./submit-dialog"

/* ------------------------------------------------------------------ state */

/** A return as this session sees it: submitted here → submitted, with the portal's reference. */
export type ReturnView = OfficialReturn & { state: ReturnStatus; checks: (Check & { count?: number })[]; warnings?: number }

/**
 * Visit-data checks count live from Medical records › Visits (period + branch of the return): adding a nationality
 * there updates the check, the warnings and the status without a reload; a check with nothing left drops out.
 */
export function useReturns(): ReturnView[] {
  const submitted = useSubmitted()
  const ctx = useVisitCtx()
  return React.useMemo(
    () =>
      RETURNS.map((r) => {
        const live = r.checks.some((c) => c.rule) && r.month && !submitted[r.id]
        const counts = live ? missingCounts(allVisits().filter((v) => inPeriod(v, r.month!, r.branch)), ctx) : null
        const checks = counts ? r.checks.flatMap((c) => (c.rule ? (counts[c.rule].visits ? [{ ...c, count: counts[c.rule].visits }] : []) : [c])) : r.checks
        const warnings = counts ? checks.length : undefined
        return submitted[r.id] ? { ...r, checks, state: "submitted" as const, submitted: submitted[r.id] } : { ...r, checks, warnings, state: r.status }
      }),
    [submitted, ctx]
  )
}

/** A check's line: live visit-data checks say how many visits are left ("37 visits have no nationality"). */
export function useCheckText() {
  const t = useTranslations("reports.ret.checks.rule")
  const b = useB()
  return (c: ReturnView["checks"][number]) => (c.rule && c.count !== undefined ? t(c.rule, { n: c.count }) : b(c.text))
}

/** Where a check's button goes: visit-data rules open Visits · missing data for the return's period and branch. */
export function checkHref(r: ReturnView, c: Check) {
  if (c.rule && r.month) return missingHref(c.rule, r.month, { branch: r.branch, from: r.id })
  return c.fix?.href ?? ""
}
const checkFixOn = (c: Check) => !!c.fix && isModuleEnabled(c.fix.module) && (!c.rule || isTabEnabled("records", "visits"))
/** The tab count: returns that need someone (ready to submit, or a draft with warnings). */
export const useOpenReturns = () => useReturns().filter((r) => r.state === "ready" || r.state === "draft").length

/** Who signs a return off: the authority's named role (MOH / HESN: the medical director; CCHI / ZATCA: finance). */
export const canSignOff = (role: RepRole, r: OfficialReturn) => role === "lead" || role === AUTHORITY[r.authority].signer

export const personName = (id: string) => PEOPLE.find((p) => p.id === id)

/** "Tomorrow" (red) / "Today" (red) / "10 Dec". */
function useDueText() {
  const t = useTranslations("reports.returns")
  const dates = useDates()
  return (r: ReturnView) => {
    if (r.state === "submitted") return { text: dates.dayMonth(r.due), urgent: false, soon: false }
    if (r.due === REP_TODAY) return { text: t("today"), urgent: true, soon: true }
    if (r.due === addDays(REP_TODAY, 1)) return { text: t("tomorrow"), urgent: true, soon: true }
    return { text: dates.dayMonth(r.due), urgent: false, soon: false }
  }
}

function useStatusText() {
  const t = useTranslations("reports.returns")
  const b = useB()
  const tw = useTranslations("reports.ret.checks.rule")
  const dates = useDates()
  return (r: ReturnView): { text: string; tone: StatusTone } => {
    if (r.state === "submitted") return { text: t("status.submitted", { date: dates.dayMonth(r.submitted!.at.slice(0, 10)) }), tone: "success" }
    const base = t(`status.${r.state}`)
    const detail = r.warnings !== undefined ? (r.warnings ? tw("detail", { n: r.warnings }) : "") : r.detail ? b(r.detail) : ""
    const text = detail ? t("withDetail", { status: base, detail }) : base
    return { text, tone: r.state === "collecting" ? "info" : "warning" }
  }
}

/** Download a return (or one from its history) as a PDF: aggregates only; every download is logged. */
export function useReturnDownload() {
  const t = useTranslations("reports.returns")
  const tr = useTranslations("reports.ret")
  const ts = useTranslations("reports.submit")
  const b = useB()
  const locale = useLocale()
  return async (r: ReturnView, past?: { period: Bi; ref: string }) => {
    const file = `${past ? past.ref : r.submitted?.ref ?? r.id}.pdf`
    const blocks: PdfBlock[] = [
      { kind: "title", text: past ? `${b(r.kind)} · ${b(past.period)}` : b(r.title) },
      { kind: "meta", text: b(r.scope) },
      {
        kind: "kv",
        rows: [
          [ts("return"), b(r.kind)],
          [ts("period"), past ? b(past.period) : b(r.periodLong)],
          [tr("side.through"), tr("side.throughValue", { portal: b(AUTHORITY[r.authority].portal), code: FACILITY_CODE })],
          ...(past || r.submitted ? ([[tr("side.submitted"), past ? past.ref : r.submitted!.ref]] as [string, string][]) : []),
        ],
      },
    ]
    if (!past) blocks.push({ kind: "table", head: [tr("goes.title"), ""], rows: r.sections.map((s) => [b(s.name), b(s.value)]) })
    blocks.push({ kind: "note", text: locale === "ar" ? "أرقام مجمّعة بس — بدون أسماء أو أرقام مرضى." : "Aggregates only — no patient names or IDs." })
    saveBlob(await pdfDocument(blocks, { dir: locale === "ar" ? "rtl" : "ltr", title: file }), file)
    logReport({ at: REP_NOW, kind: "export", what: r.id, detail: file })
    toast.success(t("downloaded"), { description: t("downloadedText") })
  }
}

/* ------------------------------------------------------------------ tab */

/**
 * Widget / Rep Official: "Official returns · Filled from the system · checked · signed off before they go". Table:
 * Return, To chip (MOH, HESN, CCHI, ZATCA), Period, Due (red when tomorrow, the row tinted), Status (Ready · 3 cases,
 * Draft · 2 warnings, Collecting, Submitted 28 Oct) and Submit / Open / Download. Compact: rows that open the return,
 * "HESN · Week 47 · due tomorrow" and the status.
 */
export function ReturnsList() {
  const t = useTranslations("reports.returns")
  const b = useB()
  const list = useReturns()
  const due = useDueText()
  const status = useStatusText()
  const role = useRepRole()
  const download = useReturnDownload()
  const [submit, setSubmit] = React.useState<ReturnView | null>(null)
  const dueLine = (r: ReturnView) => {
    const d = due(r)
    return r.state === "submitted" || !d.soon ? t("dueLine", { date: d.text }) : t("dueTomorrow")
  }

  const action = (r: ReturnView) => {
    const name = b(r.title)
    if (r.state === "ready" && canSignOff(role, r))
      return (
        <Button size="sm" onClick={() => setSubmit(r)} aria-label={t("submitLabel", { name })}>
          {t("submit")}
        </Button>
      )
    if (r.state === "submitted")
      return (
        <Button size="sm" variant="outline" onClick={() => download(r)} aria-label={t("downloadLabel", { name })}>
          {t("download")}
        </Button>
      )
    return (
      <Button size="sm" variant="outline" asChild>
        <Link href={returnHref(r.id)} aria-label={t("openLabel", { name })}>
          {t("open")}
        </Link>
      </Button>
    )
  }

  return (
    <section aria-labelledby="rep-ret" className="@container/rt flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/rt:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rep-ret" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("text")}</p>
      </header>
      <div className="hidden overflow-hidden rounded-lg border @4xl/rt:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col />
            <col className="w-[132px]" />
            <col className="w-[202px]" />
            <col className="w-[122px]" />
            <col className="w-[196px]" />
            <col className="w-[110px]" />
          </colgroup>
          <thead className="bg-muted">
            <tr>
              {(["return", "to", "period", "due", "status"] as const).map((c) => (
                <th key={c} className="h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4">
                  {t(`col.${c}`)}
                </th>
              ))}
              <th className="h-10 pe-4">
                <span className="sr-only">{t("col.action")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const d = due(r)
              const s = status(r)
              return (
                <tr key={r.id} className={cn("border-t", d.soon && "bg-warning-soft/50")}>
                  <td className="px-2 py-3 ps-4">
                    <Link href={returnHref(r.id)} className="rounded-sm text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {b(r.name)}
                    </Link>
                  </td>
                  <td className="px-2 py-3">
                    <span className="inline-flex h-[22px] items-center rounded-full bg-accent px-2.5 text-xs text-primary">{b(AUTHORITY[r.authority].name)}</span>
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{b(r.period)}</td>
                  <td className={cn("px-2 py-3", d.urgent ? "text-destructive" : "text-foreground")}>{d.text}</td>
                  <td className="px-2 py-3">
                    <StatusBadge tone={s.tone}>{s.text}</StatusBadge>
                  </td>
                  <td className="py-2 pe-4 text-end">{action(r)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col @4xl/rt:hidden">
        {list.map((r) => {
          const s = status(r)
          return (
            <li key={r.id} className="border-b last:border-b-0">
              <Link href={returnHref(r.id)} className="flex items-start gap-3 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon name="document-text" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm text-foreground">{b(r.name)}</span>
                  <span className="text-xs text-muted-foreground">{t("line", { to: b(AUTHORITY[r.authority].name), period: b(r.period), due: dueLine(r) })}</span>
                  <StatusBadge tone={s.tone} className="w-fit">
                    {s.text}
                  </StatusBadge>
                </span>
                <Icon name="arrow-right-1" size={24} className="mt-2 shrink-0 text-foreground rtl:rotate-180" />
              </Link>
            </li>
          )
        })}
      </ul>
      {submit && <SubmitReturnDialog r={submit} onOpenChange={(o) => !o && setSubmit(null)} />}
    </section>
  )
}

/* ------------------------------------------------------------------ return page */

type StepState = "done" | "current" | "todo"

/** Widget / Rep Return · Progress: Collected → Checked → Signed off → Submitted, "2 of 4 done · due 10 Dec". */
export function ReturnProgress({ r }: { r: ReturnView }) {
  const t = useTranslations("reports.ret.progress")
  const tr = useTranslations("reports.ret")
  const b = useB()
  const dates = useDates()
  const at = (iso: string) => `${dates.dayMonth(iso.slice(0, 10))} ${iso.slice(11, 16)}`
  const done = r.state === "submitted" ? 4 : r.state === "collecting" ? 0 : 2
  const signer = personName(r.signer)
  const steps: { key: string; label: string; sub: string }[] = [
    { key: "collected", label: t("collected"), sub: r.collected && r.state !== "collecting" ? at(r.collected) : t("collecting") },
    { key: "checked", label: t("checked"), sub: r.state === "collecting" ? t("notChecked") : t("warnings", { n: r.checks.length }) },
    {
      key: "signed",
      label: t("signed"),
      sub: r.state === "submitted" && signer ? `${b(signer.name)}` : capital(tr(`role.${AUTHORITY[r.authority].signer}`)),
    },
    { key: "submitted", label: t("submitted"), sub: r.state === "submitted" ? r.submitted!.ref : b(AUTHORITY[r.authority].portal) },
  ]
  const state = (i: number): StepState => (i < done ? "done" : i === done ? "current" : "todo")
  return (
    <section aria-labelledby="ret-progress" className="@container/pg flex flex-col gap-4 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-1">
        <h2 id="ret-progress" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("text", { done, date: dates.dayMonth(r.due) })}</p>
      </header>
      <ol className="grid gap-3 @xl/pg:grid-cols-4">
        {steps.map((s, i) => {
          const st = state(i)
          return (
            <li key={s.key} className="flex items-start gap-2.5" aria-current={st === "current" ? "step" : undefined}>
              {st === "done" ? (
                <Icon name="tick-circle" size={26} variant="bold" className="shrink-0 text-success" />
              ) : (
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                    st === "current" ? "border border-primary text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-foreground">{s.label}</span>
                <bdi className="truncate text-xs text-muted-foreground">{s.sub}</bdi>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
/** Codes and references never break at their hyphens. */
const nb = (s: string) => s.replace(/-/g, "‑")
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Widget / Rep Return · Checks: amber rows to fix (→ the module list) or explain (a note that goes with the return). */
export function ReturnChecks({ r }: { r: ReturnView }) {
  const t = useTranslations("reports.ret.checks")
  const b = useB()
  const checkText = useCheckText()
  const notes = useReturnNotes(r.id)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [text, setText] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const locked = r.state === "submitted"
  const open = (id: string) => {
    setEditing(id)
    setText(notes[id] ?? "")
    setTried(false)
  }
  const save = (id: string) => {
    if (!text.trim()) return setTried(true)
    addReturnNote(r.id, id, text.trim())
    setEditing(null)
    toast.success(t("noteToast"), { description: t("noteToastText") })
  }
  return (
    <section aria-labelledby="ret-checks" className="@container/ck flex flex-col gap-4 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-1">
        <h2 id="ret-checks" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("text")}</p>
      </header>
      {r.checks.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="tick-circle" size={18} className="text-success" />
          {t("none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {r.checks.map((c) => {
            const note = notes[c.id]
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-lg bg-warning-soft p-3 text-warning-soft-foreground">
                <div className="flex flex-col gap-2 @lg/ck:flex-row @lg/ck:items-center">
                  <span className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                    <Icon name="warning-2" size={18} className="mt-0.5 shrink-0" />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span>{checkText(c)}</span>
                      {note && editing !== c.id && <span className="text-xs text-foreground">{t("explained", { note })}</span>}
                    </span>
                  </span>
                  {!locked && editing !== c.id && (
                    <span className="flex shrink-0 flex-wrap gap-2 ps-6 @lg/ck:ps-0">
                      {checkFixOn(c) && (
                        <Button size="sm" variant="outline" className="bg-card" asChild>
                          <Link href={checkHref(r, c)}>{b(c.fix!.label)}</Link>
                        </Button>
                      )}
                      {c.explain && (
                        <Button size="sm" variant="outline" className="bg-card" onClick={() => open(c.id)}>
                          {note ? t("editNote") : t("addNote")}
                        </Button>
                      )}
                    </span>
                  )}
                </div>
                {editing === c.id && (
                  <div className="flex flex-col gap-2 ps-6">
                    <Field label={t("noteLabel", { check: checkText(c) })} error={tried && !text.trim() ? t("noteError") : undefined}>
                      {(fp) => <Textarea {...fp} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("notePlaceholder")} className="min-h-[72px] text-foreground" maxLength={400} autoFocus />}
                    </Field>
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => save(c.id)}>
                        {t("save")}
                      </Button>
                      <Button size="sm" variant="outline" className="bg-card" onClick={() => setEditing(null)}>
                        {t("cancel")}
                      </Button>
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Widget / Rep Return · What goes in: each line with its value, change vs last month and an ok / warning icon. */
export function ReturnSections({ r }: { r: ReturnView }) {
  const t = useTranslations("reports.ret.goes")
  const b = useB()
  return (
    <section aria-labelledby="ret-goes" className="@container/gs flex flex-col gap-4 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-1">
        <h2 id="ret-goes" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{b(r.scope)}</p>
      </header>
      {r.state === "collecting" && (
        <Strip tone="info" icon="info-circle">
          {t("collecting")}
        </Strip>
      )}
      <ul className="flex flex-col">
        {r.sections.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 border-b py-2.5 last:border-b-0">
            <Icon name={s.warn ? "warning-2" : "tick-circle"} size={20} className={cn("shrink-0", s.warn ? "text-warning" : "text-success")} />
            <span className="min-w-0 flex-1 text-sm text-foreground">{b(s.name)}</span>
            <bdi className="text-sm text-foreground tabular-nums">{b(s.value)}</bdi>
            {r.vs && s.change && <span className="hidden w-[88px] text-xs text-muted-foreground @lg/gs:block">{t("vs", { change: ltrRun(s.change), month: b(r.vs) })}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Widget / Rep Return Side: Return (due, prepared by, who signs off, sent through) and Past returns with download. */
export function ReturnSide({ r }: { r: ReturnView }) {
  const t = useTranslations("reports.ret")
  const b = useB()
  const dates = useDates()
  const download = useReturnDownload()
  const days = daysBetween(REP_TODAY, r.due)
  const prepared = personName(r.preparedBy)
  const signer = personName(r.signer)
  const rows: [string, React.ReactNode][] = [
    [t("side.due"), r.state === "submitted" ? dates.dayMonth(r.due) : days === 1 ? t("side.dueTomorrow", { date: dates.dayMonth(r.due) }) : t("side.dueIn", { date: dates.dayMonth(r.due), n: days })],
    [t("side.prepared"), prepared ? b(prepared.name) : ""],
    [t("side.signs"), signer ? t("side.signsValue", { name: b(signer.name), role: t(`role.${AUTHORITY[r.authority].signer}`) }) : ""],
    [t("side.through"), t("side.throughValue", { portal: b(AUTHORITY[r.authority].portal), code: nb(FACILITY_CODE) })],
  ]
  if (r.submitted) rows.push([t("side.submitted"), t("side.submittedValue", { date: dates.dayMonth(r.submitted.at.slice(0, 10)), ref: nb(r.submitted.ref) })])
  return (
    <div className="flex flex-col gap-4">
      <SideCard id="ret-side" title={t("side.title")} text={b(r.kind)}>
        <Kv rows={rows} />
      </SideCard>
      <SideCard id="ret-past" title={t("past.title")}>
        {r.past.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("past.none")}</p>
        ) : (
          <ul className="flex flex-col">
            {r.past.map((p) => (
              <li key={p.ref} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon name="document-text" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm text-foreground">{b(p.period)}</span>
                  <span className="text-xs text-muted-foreground">{t("past.line", { date: dates.dayMonth(p.submitted), ref: nb(p.ref) })}</span>
                </span>
                <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => download(r, p)} aria-label={t("past.download", { period: b(p.period) })}>
                  <Icon name="document-download" size={24} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SideCard>
    </div>
  )
}

/**
 * Return (`/reports/returns/return?id=moh-monthly-2611`): header Back · "Reports / Official returns" over the return's
 * title; Download · Sign off and submit (the named role only; a collecting return can't be signed yet). Progress,
 * Checks and What goes in beside the side cards; mobile: Back · "MOH return" · ⋯, the side cards first.
 */
export function ReturnPage() {
  const t = useTranslations("reports.ret")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.reports")
  const b = useB()
  const dates = useDates()
  const role = useRepRole()
  const id = useSearchParams().get("id") ?? ""
  const r = useReturns().find((x) => x.id === id)
  const download = useReturnDownload()
  const [open, setOpen] = React.useState(false)
  if (!r) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="document-text"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={RETURNS_HREF}>{t("backToList")}</Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }
  const signable = r.state === "ready" || r.state === "draft"
  const may = canSignOff(role, r)
  const actions = (
    <>
      <Button variant="outline" onClick={() => download(r)}>
        <Icon name="document-download" size={20} />
        {t("download")}
      </Button>
      {r.state !== "submitted" && (
        <Button onClick={() => setOpen(true)} disabled={!signable || !may}>
          <Icon name="send-2" size={20} />
          {t("signOff")}
        </Button>
      )}
    </>
  )
  return (
    <>
      <PageTitle
        title={b(r.title)}
        crumbs={[
          { label: tn("reports"), href: "/reports" },
          { label: tt("returns"), href: RETURNS_HREF },
        ]}
        back={RETURNS_HREF}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={RETURNS_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{b(r.short)}</h1>
        <ActionMenu
          title={b(r.title)}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[[{ key: "print", icon: "printer", label: t("print"), onSelect: () => window.print() }]]}
        />
      </div>
      <PageContainer className="@container/rr">
        <PageHeader actions={actions} />
        {r.state === "submitted" && r.submitted && (
          <Strip tone="success" icon="tick-circle">
            {t("done", { date: dates.dayMonth(r.submitted.at.slice(0, 10)), ref: nb(r.submitted.ref) })}
          </Strip>
        )}
        {signable && !may && (
          <Strip tone="info" icon="info-circle">
            {t("cantSign", { role: t(`role.${AUTHORITY[r.authority].signer}`) })}
          </Strip>
        )}
        {r.state === "collecting" && (
          <Strip tone="info" icon="info-circle">
            {t("collectingBlock")}
          </Strip>
        )}
        <div className="grid gap-4 @[66rem]/rr:grid-cols-[minmax(0,1fr)_360px] @[66rem]/rr:items-start @[66rem]/rr:gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <ReturnProgress r={r} />
            <ReturnChecks r={r} />
            <ReturnSections r={r} />
          </div>
          <div className="max-md:order-first">
            <ReturnSide r={r} />
          </div>
        </div>
      </PageContainer>
      {open && <SubmitReturnDialog r={r} onOpenChange={setOpen} />}
    </>
  )
}
