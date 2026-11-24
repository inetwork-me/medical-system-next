"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon, type IconName } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { returnHref } from "@/modules/reports/href"
import { RETURNS } from "@/modules/reports/returns-data"
import { REC_NOW, REC_TODAY, daysBetween, type PatientKey } from "./data"
import { RecordsFrame } from "./frame"
import { VISITS_HREF, visitHref } from "./href"
import { patientOf } from "./lookup"
import { AddNationalityDialog } from "./nationality-dialog"
import { InitialsAvatar, Latin, useB, useShowMore } from "./parts"
import { recCan } from "./roles"
import { ME } from "./session"
import { addReceptionTask, useNotes, useRecRole } from "./store"
import { inPeriod, isRule, makeCtx, missingCounts, missingRows, RULES, type MissingRow, type MissingRule, type VisitCtx } from "./visit-rules"
import { useIdText } from "./visit-page"
import { VISITS_BRANCH, VISITS_PERIOD, useVisitCtx } from "./visits"
import { CLINICS, allVisits } from "./visits-data"

const PAGE_WIDE = 7
const PAGE_COMPACT = 6
const RULE_ICON: Record<MissingRule, IconName> = { nationality: "global", id: "personalcard", diagnosis: "document-text" }

/** The return a period's rule belongs to: the one the check came from, else the MOH monthly return of that month. */
function returnFor(from: string | null, period: string) {
  return RETURNS.find((r) => r.id === from) ?? RETURNS.find((r) => r.authority === "MOH" && r.code === period.slice(2).replace("-", ""))
}

/** Read the view's query: rule (nationality · id · diagnosis), period (2026-11), branch, and the return it came from. */
function useMissingQuery() {
  const params = useSearchParams()
  const rule: MissingRule = isRule(params.get("rule")) ? (params.get("rule") as MissingRule) : "nationality"
  const period = /^\d{4}-\d{2}$/.test(params.get("period") ?? "") ? params.get("period")! : VISITS_PERIOD
  const branch = params.get("branch") || VISITS_BRANCH
  const from = params.get("from")
  return { rule, period, branch, from, params }
}

let taskSeq = 0

/**
 * Visits · Missing nationality (inner page of Visits; where a return's check lands): header Back · "Medical records /
 * Visits" · "Visits without nationality"; the tabs with Send list to reception. Widget / Rec Missing Nationality:
 * "November 2026 · 38 visits from 21 patients", the info strip (nationality is on the patient's file: add it once and
 * all their visits are filled; the MOH return updates on its own) with Back to the return; tiles Visits missing it ·
 * Fixed today · Return due; filters No nationality · No ID number · No diagnosis code; rows per patient with Add
 * nationality. Reception and the records office can add nationality and ID.
 */
export function MissingPage() {
  const t = useTranslations("records.missingView")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.records")
  const role = useRecRole()
  const router = useRouter()
  const pathname = usePathname()
  const { rule, period, branch, from, params } = useMissingQuery()
  const ctx = useVisitCtx()
  const notes = useNotes()
  const visits = React.useMemo(() => allVisits().filter((v) => inPeriod(v, period, branch)), [period, branch])
  const rows = React.useMemo(() => missingRows(visits, rule, ctx), [visits, rule, ctx])
  const counts = React.useMemo(() => missingCounts(visits, ctx), [visits, ctx])
  const before = React.useMemo(() => missingCounts(visits, makeCtx({}, notes)), [visits, notes])
  const ret = returnFor(from, period)
  const canFix = recCan(role, "patientIds")
  const setRule = (r: MissingRule) => {
    const q = new URLSearchParams(params.toString())
    q.set("rule", r)
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }
  const send = () => {
    if (!rows.length) return
    addReceptionTask({ id: `rt-${REC_NOW}-${++taskSeq}`, at: REC_NOW, by: ME, rule, period, branch, patients: rows.map((r) => r.patient) })
    toast.success(t("sentToast"), { description: t("sentToastText") })
  }
  const crumbs = [
    { label: tn("records"), href: "/records" },
    { label: tt("visits"), href: VISITS_HREF },
  ]
  const backToReturn = ret && isModuleEnabled("reports") && isTabEnabled("reports", "returns") ? returnHref(ret.id) : undefined

  return (
    <>
      <PageTitle title={t(`title.${rule}`)} crumbs={crumbs} back={VISITS_HREF} />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={VISITS_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t(`short.${rule}`)}</h1>
        <ActionMenu
          title={t(`title.${rule}`)}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[
            [
              ...(backToReturn ? [{ key: "ret", icon: "arrow-left" as const, label: t("backToReturn"), onSelect: () => router.push(backToReturn) }] : []),
              { key: "list", icon: "arrow-left-1" as const, label: t("allVisits"), onSelect: () => router.push(VISITS_HREF) },
            ],
          ]}
        />
      </div>
      <RecordsFrame
        tab="visits"
        actions={
          canFix && (
            <Button variant="outline" onClick={send} disabled={!rows.length}>
              <Icon name="send-2" size={18} />
              {t("send")}
            </Button>
          )
        }
      >
        {!canFix ? (
          <div className="rounded-xl border bg-card">
            <EmptyState icon="lock" title={t("noAccess")} description={t("noAccessText")} className="py-16" />
          </div>
        ) : (
          <MissingList
            rule={rule}
            period={period}
            branch={branch}
            rows={rows}
            ctx={ctx}
            counts={counts}
            fixed={Math.max(0, before[rule].visits - counts[rule].visits)}
            fixedPatients={Math.max(0, before[rule].patients - counts[rule].patients)}
            due={ret?.due}
            backToReturn={backToReturn}
            onRule={setRule}
          />
        )}
      </RecordsFrame>
    </>
  )
}

function MissingList({
  rule,
  period,
  branch,
  rows,
  ctx,
  counts,
  fixed,
  fixedPatients,
  due,
  backToReturn,
  onRule,
}: {
  rule: MissingRule
  period: string
  branch: string
  rows: MissingRow[]
  ctx: VisitCtx
  counts: ReturnType<typeof missingCounts>
  fixed: number
  fixedPatients: number
  due?: string
  backToReturn?: string
  onRule: (r: MissingRule) => void
}) {
  const t = useTranslations("records.missingView")
  const b = useB()
  const dates = useDates()
  const [query, setQuery] = React.useState("")
  const [adding, setAdding] = React.useState<PatientKey | null>(null)
  const { extra, more } = useShowMore(`${rule}|${query.trim()}`)
  const q = query.trim().toLowerCase()
  const raw = query.trim()
  const shownRows = rows.filter((r) => {
    if (!q) return true
    const p = patientOf(r.patient)
    return [p.mrn, p.name.en].some((x) => x.toLowerCase().includes(q)) || p.name.ar.includes(raw)
  })
  const wide = Math.min(PAGE_WIDE + extra, shownRows.length)
  const compact = Math.min(PAGE_COMPACT + extra, shownRows.length)
  const c = counts[rule]
  const monthLong = dates.monthLong(`${period}-01`)
  const dueIn = due ? daysBetween(REC_TODAY, due) : undefined
  const label = (r: MissingRule, short?: boolean) => t(short ? `filterShort.${r}` : `filter.${r}`, { n: counts[r].patients })

  return (
    <section aria-labelledby="rec-missing" className="@container/mis flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/mis:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-missing" className="text-lg font-semibold text-foreground">
          {t(`title.${rule}`)}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle", { month: monthLong, visits: c.visits, patients: c.patients })}</p>
      </header>
      <div className="flex flex-col gap-3 rounded-lg bg-info-soft p-3 text-info-soft-foreground @4xl/mis:flex-row @4xl/mis:items-center">
        <span className="flex min-w-0 flex-1 items-start gap-2 text-xs">
          <Icon name="info-circle" size={18} className="shrink-0" />
          {t(`info.${rule}`)}
        </span>
        {backToReturn && (
          <Button size="sm" variant="outline" className="bg-card text-foreground max-@4xl/mis:w-full" asChild>
            <Link href={backToReturn}>{t("backToReturn")}</Link>
          </Button>
        )}
      </div>
      {/* Wide: three tiles; compact: two label / value rows (as drawn). */}
      <div className="hidden grid-cols-3 gap-3 @4xl/mis:grid">
        <Tile icon={RULE_ICON[rule]} label={t("tile.missing")} value={String(c.visits)} valueClass={c.visits ? "text-warning" : "text-success"} sub={t("patients", { n: c.patients })} />
        <Tile icon="tick-circle" label={t("tile.fixed")} value={String(fixed)} sub={fixed ? t("patients", { n: fixedPatients }) : t("tile.nothing")} />
        {due && <Tile icon="calendar-2" label={t("tile.due")} value={dates.dayMonth(due)} sub={t("inDays", { n: dueIn ?? 0 })} />}
      </div>
      <dl className="flex flex-col @4xl/mis:hidden">
        <div className="flex items-start gap-3 border-b py-3">
          <dt className="w-[140px] shrink-0 text-xs text-muted-foreground">{t("tile.missing")}</dt>
          <dd className={cn("text-sm", c.visits ? "text-warning-soft-foreground" : "text-success")}>{t("missingLine", { visits: c.visits, patients: c.patients })}</dd>
        </div>
        {due && (
          <div className="flex items-start gap-3 py-3">
            <dt className="w-[140px] shrink-0 text-xs text-muted-foreground">{t("tile.due")}</dt>
            <dd className="text-sm text-foreground">{t("dueLine", { date: dates.dayMonth(due), n: dueIn ?? 0 })}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-col gap-2 @4xl/mis:flex-row @4xl/mis:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/mis:w-70"
        />
        <Segmented
          size="sm"
          value={rule}
          onValueChange={onRule}
          aria-label={t("filter.label")}
          className="hidden @4xl/mis:ms-auto @4xl/mis:flex *:h-6"
          options={RULES.map((r) => ({ value: r, label: label(r) }))}
        />
        <Segmented
          size="sm"
          value={rule}
          onValueChange={onRule}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/mis:hidden"
          options={RULES.map((r) => ({ value: r, label: label(r, true) }))}
        />
      </div>
      {shownRows.length === 0 ? (
        <EmptyState
          icon={rows.length ? "search-normal-1" : "tick-circle"}
          title={rows.length ? t("noResults") : t(`allDone.${rule}`)}
          description={rows.length ? t("noResultsText") : t("allDoneText")}
          className="py-12"
          actions={
            rows.length ? (
              <Button variant="outline" onClick={() => setQuery("")}>
                {t("clear")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <MissingTable rule={rule} rows={shownRows.slice(0, wide)} ctx={ctx} month={dates.monthName(`${period}-01`)} onAdd={setAdding} />
          <MissingCards rule={rule} rows={shownRows.slice(0, compact)} ctx={ctx} onAdd={setAdding} />
          <footer className="hidden items-center gap-3 @4xl/mis:flex">
            <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
              {t("showing", { shown: wide, total: shownRows.length })}
            </span>
            {wide < shownRows.length && (
              <Button variant="outline" size="sm" onClick={() => more(shownRows.length - wide)}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {compact < shownRows.length && (
            <Button variant="outline" size="sm" className="w-full @4xl/mis:hidden" onClick={() => more(shownRows.length - compact)}>
              {t("showMoreN", { n: shownRows.length - compact })}
            </Button>
          )}
        </>
      )}
      {adding && <AddNationalityDialog patient={adding} rule={rule} period={period} branch={branch} onOpenChange={(o) => !o && setAdding(null)} />}
    </section>
  )
}

function Tile({ icon, label, value, sub, valueClass }: { icon: IconName; label: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon name={icon} size={18} />
        {label}
      </span>
      <span className={cn("text-2xl font-semibold text-foreground", valueClass)}>{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}

/** "4 · last 23 Nov" / "1 · on 9 Nov". */
function useVisitsText() {
  const t = useTranslations("records.missingView")
  const dates = useDates()
  return (r: MissingRow) => (r.visits.length === 1 ? t("onDay", { n: 1, date: dates.dayMonth(r.last.checked_in_at) }) : t("lastDay", { n: r.visits.length, date: dates.dayMonth(r.last.checked_in_at) }))
}

/** The row's action: Add nationality / Add ID number, or Open visit for a missing diagnosis code (the doctor codes it). */
function RowAction({ rule, row, primary, compact, onAdd }: { rule: MissingRule; row: MissingRow; primary?: boolean; compact?: boolean; onAdd: (k: PatientKey) => void }) {
  const t = useTranslations("records.missingView")
  const b = useB()
  const name = b(patientOf(row.patient).name)
  if (rule === "diagnosis")
    return (
      <Button size="sm" variant="outline" asChild>
        <Link href={visitHref(row.last.id)} aria-label={t("openVisitLabel", { name })}>
          {t("openVisit")}
        </Link>
      </Button>
    )
  return (
    <Button size="sm" variant={primary ? "default" : "outline"} onClick={() => onAdd(row.patient)} aria-label={t(`addLabel.${rule}`, { name })}>
      {compact ? t("add") : t(`addAction.${rule}`)}
    </Button>
  )
}

function MissingTable({ rule, rows, ctx, month, onAdd }: { rule: MissingRule; rows: MissingRow[]; ctx: VisitCtx; month: string; onAdd: (k: PatientKey) => void }) {
  const t = useTranslations("records.missingView")
  const b = useB()
  const idText = useIdText()
  const visitsText = useVisitsText()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/mis:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
          <col />
          <col className="w-[156px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.visits", { month })}</th>
            <th className={th}>{t("col.clinic")}</th>
            <th className={th}>{t("col.idOnFile")}</th>
            <th className={th}>{t(`col.${rule}`)}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = patientOf(r.patient)
            const ids = ctx.ids(r.patient)
            const none = !ids.idType || !ids.idNumber
            return (
              <tr key={r.patient} className="border-t">
                <td className={td}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar initials={p.initials} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-foreground">{b(p.name)}</span>
                      <Latin className="text-xs text-muted-foreground">{p.mrn}</Latin>
                    </span>
                  </span>
                </td>
                <td className={cn(td, "text-foreground")}>{visitsText(r)}</td>
                <td className={cn(td, "truncate text-muted-foreground")}>{b(CLINICS[r.clinic])}</td>
                <td className={cn(td, none ? "text-warning-soft-foreground" : "text-muted-foreground")}>{idText(ids)}</td>
                <td className={td}>
                  <StatusBadge tone="warning">{t("missing")}</StatusBadge>
                </td>
                <td className={cn(td, "text-end")}>
                  <RowAction rule={rule} row={r} primary={i === 0} onAdd={onAdd} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MissingCards({ rule, rows, ctx, onAdd }: { rule: MissingRule; rows: MissingRow[]; ctx: VisitCtx; onAdd: (k: PatientKey) => void }) {
  const t = useTranslations("records.missingView")
  const b = useB()
  const idText = useIdText()
  return (
    <ul className="flex flex-col @4xl/mis:hidden">
      {rows.map((r) => {
        const p = patientOf(r.patient)
        return (
          <li key={r.patient} className="flex items-center gap-2.5 border-b py-3 last:border-b-0">
            <InitialsAvatar initials={p.initials} className="self-start" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm text-foreground">{b(p.name)}</span>
              <span className="text-xs text-muted-foreground">{t("cardLine", { n: r.visits.length, clinic: b(CLINICS[r.clinic]), id: idText(ctx.ids(r.patient)) })}</span>
            </div>
            <RowAction rule={rule} row={r} compact onAdd={onAdd} />
          </li>
        )
      })}
    </ul>
  )
}
