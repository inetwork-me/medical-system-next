"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { csvBlob, saveBlob } from "@/lib/export/files"
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
import { CHART_RED_HOURS, REC_NOW, REC_TODAY, USERS, addDays, daysBetween, hoursBetween, type PatientKey, type UserKey } from "./data"
import { RecordsFrame } from "./frame"
import { VISITS_HREF, receptionHref, visitHref } from "./href"
import { patientOf } from "./lookup"
import { AddIdDialog, AddNationalityDialog } from "./nationality-dialog"
import { reminders } from "./notify"
import { InitialsAvatar, Latin, useB, useShowMore, useWaitLabel } from "./parts"
import { recCan, type RecViewRole } from "./roles"
import { ME } from "./session"
import { addReceptionTask, logAccess, useNotes, useRecRole, useSavedIds } from "./store"
import { inPeriod, makeCtx, missingCounts, missingOf, missingRows, ruleFromParam, ruleParam, RULES, type MissingRow, type MissingRule, type VisitCtx } from "./visit-rules"
import { useIdText } from "./visit-page"
import { VISITS_BRANCH, VISITS_PERIOD, useVisitCtx } from "./visits"
import { CLINICS, NATIONALITIES, allVisits, type Visit } from "./visits-data"

const PAGE_WIDE = 7
const PAGE_COMPACT = 6
const RULE_ICON: Record<MissingRule, IconName> = { nationality: "global", id: "personalcard", diagnosis: "document-text" }

/* ------------------------------------------------------------------ shared with the Reception list */

/** The return a period's rule belongs to: the one the check came from, else the MOH monthly return of that month. */
export function returnFor(from: string | null | undefined, period: string) {
  return RETURNS.find((r) => r.id === from) ?? RETURNS.find((r) => r.authority === "MOH" && r.code === period.slice(2).replace("-", ""))
}
export const returnLink = (id?: string) => (id && isModuleEnabled("reports") && isTabEnabled("reports", "returns") ? returnHref(id) : undefined)

/** "Khaled" / "Nora": the short name of whoever saved it (the Fixed-today line, the reception list's Done). */
export function useShortName() {
  const b = useB()
  return (k: string) => {
    const u = (USERS as Record<string, { name: { en: string; ar: string } }>)[k]
    if (!u) return k
    const strip = (s: string) => s.replace(/^(Dr\.|د\.)\s*/, "").split(" ")[0]
    return b({ en: strip(u.name.en), ar: strip(u.name.ar) })
  }
}

/** "the records office" / "reception": who sent a reception list. */
export const senderOf = (role: RecViewRole) => (role === "reception" ? "reception" : "records")

let taskSeq = 0
/**
 * Send list to reception: a task with the patients and what's missing, finish by the day before the return is due.
 * → `list-sent` with View list (→ Reception list).
 */
export function useSendToReception() {
  const t = useTranslations("records.missingView")
  const router = useRouter()
  const role = useRecRole()
  return (rows: MissingRow[], q: { rule: MissingRule; period: string; branch: string; from?: string }) => {
    if (!rows.length) return
    const ret = returnFor(q.from, q.period)
    const id = `rt-${q.period}-${q.rule}-${++taskSeq}-${rows.length}`
    addReceptionTask({
      id,
      at: REC_NOW,
      by: ME,
      role: senderOf(role),
      rule: q.rule,
      period: q.period,
      branch: q.branch,
      due: ret ? addDays(ret.due, -1) : undefined,
      from: ret?.id,
      patients: rows.map((r) => r.patient),
    })
    toast.success(t("sentToast"), { description: t("sentToastText"), action: { label: t("viewList"), onClick: () => router.push(receptionHref(id)) } })
  }
}

let exportSeq = 0
/** Export the list (⋯): the patients and what's missing, as CSV; logged like every export. */
export function useExportMissing() {
  const t = useTranslations("records.missingView")
  const tv = useTranslations("records.visits")
  const b = useB()
  const idText = useIdText()
  return (rows: MissingRow[], rule: MissingRule, ctx: VisitCtx) => {
    const name = `missing-${ruleParam(rule)}-${REC_TODAY}.csv`
    saveBlob(
      csvBlob(
        [t("col.patient"), tv("col.mrn"), t("col.clinic"), t("col.count"), t("col.idOnFile"), t("col.missingWhat")],
        rows.map((r) => {
          const p = patientOf(r.patient)
          return [b(p.name), p.mrn, b(CLINICS[r.clinic]), String(r.visits.length), idText(ctx.ids(r.patient)), tv(`missing.${rule}`)]
        })
      ),
      name
    )
    logAccess({ id: `ax-missing-export-${++exportSeq}`, at: REC_NOW, user: ME, patient: "", action: "export", why: { en: `Missing data · ${rows.length} patients`, ar: `بيانات ناقصة · ${rows.length} مريض` }, flag: "normal" })
    toast.success(tv("exportToast"), { description: tv("exportToastText") })
  }
}

/** Mobile ⋯ (bottom sheet) on the missing and reception pages. */
export function MissingMenu({ title, onSend, onExport, task, backToReturn }: { title: string; onSend?: () => void; onExport?: () => void; task?: string; backToReturn?: string }) {
  const t = useTranslations("records.missingView")
  const router = useRouter()
  return (
    <ActionMenu
      title={title}
      trigger={
        <Button variant="ghost" size="icon" aria-label={t("more")}>
          <Icon name="more" size={20} />
        </Button>
      }
      groups={[
        [
          ...(onSend ? [{ key: "send", icon: "send-2" as const, label: t("send"), onSelect: onSend }] : []),
          ...(task !== undefined ? [{ key: "list", icon: "clipboard-text" as const, label: t("openList"), onSelect: () => router.push(receptionHref(task || undefined)) }] : []),
          ...(onExport ? [{ key: "export", icon: "export" as const, label: t("export"), onSelect: onExport }] : []),
          ...(backToReturn ? [{ key: "ret", icon: "arrow-left" as const, label: t("backToMoh"), onSelect: () => router.push(backToReturn) }] : []),
        ],
      ]}
    />
  )
}

/** Read the view's query: rule (nationality · id · dx), period (2026-11), branch, the return it came from, a fix just saved. */
function useMissingQuery() {
  const params = useSearchParams()
  const rule: MissingRule = ruleFromParam(params.get("rule")) ?? "nationality"
  const period = /^\d{4}-\d{2}$/.test(params.get("period") ?? "") ? params.get("period")! : VISITS_PERIOD
  const branch = params.get("branch") || VISITS_BRANCH
  const from = params.get("from") ?? undefined
  const fixed = params.get("fixed") ?? undefined
  return { rule, period, branch, from, fixed, params }
}

/* ------------------------------------------------------------------ page */

/**
 * Visits · Missing nationality / ID number / diagnosis code (inner page of Visits; where a return's check lands). The
 * rule filter switches between the three (?rule=nationality|id|dx). Nationality and ID: rows per patient (they're
 * patient fields: one save fills every visit), Send list to reception. Diagnosis code: rows per visit (the doctor codes
 * it), Remind / Open, Remind all n doctors. After Add nationality saves, this page shows what was saved (After a fix).
 */
export function MissingPage() {
  const t = useTranslations("records.missingView")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.records")
  const role = useRecRole()
  const router = useRouter()
  const pathname = usePathname()
  const { rule, period, branch, from, fixed, params } = useMissingQuery()
  const ctx = useVisitCtx()
  const notes = useNotes()
  const saved = useSavedIds()
  const send = useSendToReception()
  const exportList = useExportMissing()
  const visits = React.useMemo(() => allVisits().filter((v) => inPeriod(v, period, branch)), [period, branch])
  const rows = React.useMemo(() => missingRows(visits, rule, ctx), [visits, rule, ctx])
  const counts = React.useMemo(() => missingCounts(visits, ctx), [visits, ctx])
  const baseCtx = React.useMemo(() => makeCtx({}, notes), [notes])
  const before = React.useMemo(() => missingCounts(visits, baseCtx), [visits, baseCtx])
  const ret = returnFor(from, period)
  const backToReturn = returnLink(ret?.id)
  const canFix = recCan(role, "patientIds")
  const dxVisits = React.useMemo(() => (rule === "diagnosis" ? visits.filter((v) => missingOf(v, ctx).includes("diagnosis")).sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at)) : []), [rule, visits, ctx])
  const doctors = new Set(dxVisits.map((v) => v.doctor ?? v.doctorName.en)).size
  // The last fix for this rule: who saved which patient, when (Fixed today · "Rakesh Kumar · by Nora 11:02").
  const lastFix = React.useMemo(() => {
    const fixedNow = Object.entries(saved)
      .filter(([k]) => visits.some((v) => v.patient === k && missingOf(v, baseCtx).includes(rule) && !missingOf(v, ctx).includes(rule)))
      .sort((a, b) => b[1].at.localeCompare(a[1].at))
    return fixedNow[0] ? { patient: fixedNow[0][0], ...fixedNow[0][1] } : undefined
  }, [saved, visits, baseCtx, ctx, rule])
  const setRule = (r: MissingRule) => {
    const q = new URLSearchParams(params.toString())
    q.set("rule", ruleParam(r))
    q.delete("fixed")
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }
  const [reminding, setReminding] = React.useState(false)
  const remindAll = async () => {
    setReminding(true)
    const by = new Map<string, string[]>()
    for (const v of dxVisits) by.set(v.doctor ?? v.doctorName.en, [...(by.get(v.doctor ?? v.doctorName.en) ?? []), v.id])
    await Promise.all([...by.entries()].map(([doctorId, items]) => reminders.send({ doctorId, items })))
    setReminding(false)
    toast.success(t("remindToast"), { description: t("remindToastText") })
  }
  const crumbs = [
    { label: tn("records"), href: "/records" },
    { label: tt("visits"), href: VISITS_HREF },
  ]
  const sendNow = () => send(rows, { rule, period, branch, from: ret?.id })
  const header =
    rule === "diagnosis" ? (
      <Button variant="outline" onClick={remindAll} disabled={!dxVisits.length || reminding}>
        <Icon name="notification" size={18} />
        {t("remindAll", { n: doctors })}
      </Button>
    ) : (
      canFix && (
        <Button variant="outline" onClick={sendNow} disabled={!rows.length}>
          <Icon name="send-2" size={18} />
          {t("send")}
        </Button>
      )
    )

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
        {canFix && (
          <MissingMenu
            title={t(`title.${rule}`)}
            onSend={rule !== "diagnosis" && rows.length ? sendNow : undefined}
            task=""
            onExport={rows.length ? () => exportList(rows, rule, ctx) : undefined}
            backToReturn={backToReturn}
          />
        )}
      </div>
      <RecordsFrame tab="visits" actions={canFix ? header : undefined}>
        {!canFix ? (
          <div className="rounded-xl border bg-card">
            <EmptyState icon="lock" title={t("noAccess")} description={t("noAccessText")} className="py-16" />
          </div>
        ) : (
          <MissingList
            rule={rule}
            period={period}
            branch={branch}
            from={ret?.id}
            rows={rows}
            dxVisits={dxVisits}
            doctors={doctors}
            ctx={ctx}
            counts={counts}
            fixed={Math.max(0, before[rule].visits - counts[rule].visits)}
            lastFix={lastFix}
            justFixed={fixed && ctx.ids(fixed).nationality && rule === "nationality" ? fixed : undefined}
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
  from,
  rows,
  dxVisits,
  doctors,
  ctx,
  counts,
  fixed,
  lastFix,
  justFixed,
  due,
  backToReturn,
  onRule,
}: {
  rule: MissingRule
  period: string
  branch: string
  from?: string
  rows: MissingRow[]
  dxVisits: Visit[]
  doctors: number
  ctx: VisitCtx
  counts: ReturnType<typeof missingCounts>
  fixed: number
  lastFix?: { patient: PatientKey; at: string; by: string }
  justFixed?: PatientKey
  due?: string
  backToReturn?: string
  onRule: (r: MissingRule) => void
}) {
  const t = useTranslations("records.missingView")
  const b = useB()
  const dates = useDates()
  const short = useShortName()
  const saved = useSavedIds()
  const [query, setQuery] = React.useState("")
  const [adding, setAdding] = React.useState<PatientKey | null>(null)
  const { extra, more } = useShowMore(`${rule}|${query.trim()}`)
  const q = query.trim().toLowerCase()
  const raw = query.trim()
  const dx = rule === "diagnosis"
  const match = (k: PatientKey, extraText: string[] = []) => {
    if (!q) return true
    const p = patientOf(k)
    return [p.mrn, p.name.en, ...extraText].some((x) => x.toLowerCase().includes(q)) || p.name.ar.includes(raw)
  }
  const shownRows = rows.filter((r) => match(r.patient))
  const shownVisits = dxVisits.filter((v) => match(v.patient, [v.id, v.doctorName.en]) || v.doctorName.ar.includes(raw))
  const total = dx ? shownVisits.length : shownRows.length
  const wide = Math.min(PAGE_WIDE + extra, total)
  const compact = Math.min(PAGE_COMPACT + extra, total)
  const c = counts[rule]
  const monthLong = dates.monthLong(`${period}-01`)
  const month = dates.monthName(`${period}-01`)
  const dueIn = due ? daysBetween(REC_TODAY, due) : undefined
  const label = (r: MissingRule, sh?: boolean) => t(sh ? `filterShort.${r}` : `filter.${r}`, { n: counts[r].patients })
  const fixLine = lastFix ? t("fixedLine", { name: b(patientOf(lastFix.patient).name), who: short(lastFix.by), time: lastFix.at.slice(11, 16) }) : t("tile.nothing")
  const fixShort = lastFix ? b(patientOf(lastFix.patient).name) : ""

  // After a fix: "Saved for Rakesh Kumar · Indian · checked with Yakeen. His 4 November visits are filled…".
  let fixedStrip: React.ReactNode = null
  if (justFixed) {
    const p = patientOf(justFixed)
    const ids = ctx.ids(justFixed)
    const n = allVisits().filter((v) => v.patient === justFixed && inPeriod(v, period, branch)).length
    fixedStrip = t(`fixedStrip.${p.sex}`, {
      name: b(p.name),
      nationality: ids.nationality ? b(NATIONALITIES[ids.nationality] ?? { en: ids.nationality, ar: ids.nationality }) : "",
      how: saved[justFixed]?.yakeen ? t("yakeenChecked") : t("yakeenNot"),
      n,
      month,
      left: c.visits,
    })
  }

  return (
    <section aria-labelledby="rec-missing" className="@container/mis flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/mis:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-missing" className="text-lg font-semibold text-foreground">
          {t(`title.${rule}`)}
        </h2>
        <p className="text-xs text-muted-foreground">
          {dx ? t("subtitleDx", { month: monthLong, visits: dxVisits.length, doctors }) : t("subtitle", { month: monthLong, visits: c.visits, patients: c.patients })}
        </p>
      </header>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg p-3 @4xl/mis:flex-row @4xl/mis:items-center",
          fixedStrip ? "bg-success-soft text-success-soft-foreground" : "bg-info-soft text-info-soft-foreground"
        )}
        role={fixedStrip ? "status" : undefined}
      >
        <span className="flex min-w-0 flex-1 items-start gap-2 text-xs">
          <Icon name={fixedStrip ? "tick-circle" : "info-circle"} size={18} className="shrink-0" />
          {fixedStrip ?? t(`info.${rule}`)}
        </span>
        {backToReturn && (
          <Button size="sm" variant="outline" className="bg-card text-foreground max-@4xl/mis:w-full" asChild>
            <Link href={backToReturn}>{t("backToReturn")}</Link>
          </Button>
        )}
      </div>
      {!dx && (
        <>
          {/* Wide: three tiles; compact: label / value rows (as drawn). */}
          <div className="hidden grid-cols-3 gap-3 @4xl/mis:grid">
            <Tile icon={RULE_ICON[rule]} label={t("tile.missing")} value={String(c.visits)} valueClass={c.visits ? "text-warning" : "text-success"} sub={t("patients", { n: c.patients })} />
            <Tile icon="tick-circle" label={t("tile.fixed")} value={String(fixed)} valueClass={fixed ? "text-success" : undefined} sub={fixed ? fixLine : t("tile.nothing")} />
            {due && <Tile icon="calendar-2" label={t("tile.due")} value={dates.dayMonth(due)} sub={t("inDays", { n: dueIn ?? 0 })} />}
          </div>
          <dl className="flex flex-col @4xl/mis:hidden">
            <Row label={t("tile.missing")} value={t("missingLine", { visits: c.visits, patients: c.patients })} className={c.visits ? "text-warning-soft-foreground" : "text-success"} />
            {fixed > 0 && <Row label={t("tile.fixed")} value={t("fixedShort", { n: fixed, name: fixShort })} className="text-success" />}
            {due && <Row label={t("tile.due")} value={t("dueLine", { date: dates.dayMonth(due), n: dueIn ?? 0 })} />}
          </dl>
        </>
      )}
      <div className="flex flex-col gap-2 @4xl/mis:flex-row @4xl/mis:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dx ? t("searchDx") : t("search")}
          aria-label={dx ? t("searchDx") : t("search")}
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
      {total === 0 ? (
        <EmptyState
          icon={(dx ? dxVisits.length : rows.length) ? "search-normal-1" : "tick-circle"}
          title={(dx ? dxVisits.length : rows.length) ? t("noResults") : t(`allDone.${rule}`)}
          description={(dx ? dxVisits.length : rows.length) ? t("noResultsText") : t("allDoneText")}
          className="py-12"
          actions={
            q ? (
              <Button variant="outline" onClick={() => setQuery("")}>
                {t("clear")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {dx ? (
            <>
              <DxTable rows={shownVisits.slice(0, wide)} />
              <DxCards rows={shownVisits.slice(0, compact)} />
            </>
          ) : (
            <>
              <MissingTable rule={rule} rows={shownRows.slice(0, wide)} ctx={ctx} month={month} onAdd={setAdding} />
              <MissingCards rule={rule} rows={shownRows.slice(0, compact)} ctx={ctx} onAdd={setAdding} />
            </>
          )}
          <footer className={cn("hidden items-center gap-3", total > PAGE_WIDE && "@4xl/mis:flex")}>
            <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
              {t("showing", { shown: wide, total })}
            </span>
            {wide < total && (
              <Button variant="outline" size="sm" onClick={() => more(total - wide)}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {compact < total && (
            <Button variant="outline" size="sm" className="w-full @4xl/mis:hidden" onClick={() => more(total - compact)}>
              {t("showMoreN", { n: total - compact })}
            </Button>
          )}
        </>
      )}
      {adding && rule === "nationality" && (
        <AddNationalityDialog patient={adding} period={period} branch={branch} from={from} onOpenChange={(o) => !o && setAdding(null)} />
      )}
      {adding && rule === "id" && <AddIdDialog patient={adding} period={period} branch={branch} onOpenChange={(o) => !o && setAdding(null)} />}
    </section>
  )
}

function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start gap-3 border-b py-3 last:border-b-0">
      <dt className="w-[140px] shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm text-foreground", className)}>{value}</dd>
    </div>
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

/** "4 · last 23 Nov" / "1 · on 9 Nov" / "1 · today". */
function useVisitsText() {
  const t = useTranslations("records.missingView")
  const dates = useDates()
  return (r: MissingRow) => {
    const day = r.last.checked_in_at.slice(0, 10)
    if (r.visits.length === 1) return day === REC_TODAY ? t("onToday", { n: 1 }) : t("onDay", { n: 1, date: dates.dayMonth(day) })
    return t("lastDay", { n: r.visits.length, date: dates.dayMonth(day) })
  }
}

function MissingTable({ rule, rows, ctx, month, onAdd }: { rule: MissingRule; rows: MissingRow[]; ctx: VisitCtx; month: string; onAdd: (k: PatientKey) => void }) {
  const t = useTranslations("records.missingView")
  const b = useB()
  const idText = useIdText()
  const visitsText = useVisitsText()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  const idRule = rule === "id"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/mis:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className={idRule ? "w-[26%]" : "w-[22%]"} />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className={idRule ? "w-[14%]" : "w-[18%]"} />
          <col />
          <col className="w-[156px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.visits", { month })}</th>
            <th className={th}>{t("col.clinic")}</th>
            <th className={th}>{idRule ? t("col.nationality") : t("col.idOnFile")}</th>
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
                {idRule ? (
                  <td className={cn(td, "text-foreground")}>{ids.nationality ? b(NATIONALITIES[ids.nationality] ?? { en: ids.nationality, ar: ids.nationality }) : "—"}</td>
                ) : (
                  <td className={cn(td, none ? "text-warning-soft-foreground" : "text-muted-foreground")}>{idText(ids)}</td>
                )}
                <td className={td}>
                  <StatusBadge tone="warning">{idRule ? t("missingId") : t("missing")}</StatusBadge>
                </td>
                <td className={cn(td, "text-end")}>
                  <Button size="sm" variant={i === 0 ? "default" : "outline"} onClick={() => onAdd(r.patient)} aria-label={t(`addLabel.${idRule ? "id" : "nationality"}`, { name: b(p.name) })}>
                    {t(`addAction.${idRule ? "id" : "nationality"}`)}
                  </Button>
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
        const ids = ctx.ids(r.patient)
        const second = rule === "id" ? (ids.nationality ? b(NATIONALITIES[ids.nationality] ?? { en: ids.nationality, ar: ids.nationality }) : "") : idText(ids)
        return (
          <li key={r.patient} className="flex items-center gap-2.5 border-b py-3 last:border-b-0">
            <InitialsAvatar initials={p.initials} className="self-start" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm text-foreground">{b(p.name)}</span>
              <span className="text-xs text-muted-foreground">{t("cardLine", { n: r.visits.length, clinic: b(CLINICS[r.clinic]), id: second })}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => onAdd(r.patient)} aria-label={t(`addLabel.${rule === "id" ? "id" : "nationality"}`, { name: b(p.name) })}>
              {t("add")}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ diagnosis code: rows per visit */

/** Waiting since the visit: amber, red over 48 h ("19 h", "3 days"). */
function DxWaiting({ v }: { v: Visit }) {
  const wait = useWaitLabel()
  const at = v.seen_from ?? v.checked_in_at
  const hours = hoursBetween(at)
  return <StatusBadge tone={hours > CHART_RED_HOURS ? "destructive" : "warning"}>{wait(hours, at)}</StatusBadge>
}

function useRemind() {
  const t = useTranslations("records.missingView")
  return async (v: Visit) => {
    await reminders.send({ doctorId: (v.doctor as UserKey | undefined) ?? v.doctorName.en, items: [v.id] })
    toast.success(t("remindToast"), { description: t("remindToastText") })
  }
}

function DxTable({ rows }: { rows: Visit[] }) {
  const t = useTranslations("records.missingView")
  const tv = useTranslations("records.visits")
  const b = useB()
  const dates = useDates()
  const remind = useRemind()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/mis:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[140px]" />
          <col className="w-[34%]" />
          <col className="w-[20%]" />
          <col />
          <col className="w-[176px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{tv("col.visit")}</th>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{tv("col.clinicDoctor")}</th>
            <th className={th}>{t("col.waiting")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const p = patientOf(v.patient)
            return (
              <tr key={v.id} className="border-t">
                <td className={cn(td, "text-xs")}>
                  <span className="flex flex-col gap-0.5">
                    <Latin className="text-foreground">{v.id}</Latin>
                    <span className="text-muted-foreground">{dates.dayMonth(v.checked_in_at)}</span>
                  </span>
                </td>
                <td className={td}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar initials={p.initials} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-foreground">{b(p.name)}</span>
                      <Latin className="text-xs text-muted-foreground">{p.mrn}</Latin>
                    </span>
                  </span>
                </td>
                <td className={td}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-foreground">{b(CLINICS[v.clinic])}</span>
                    <span className="truncate text-xs text-muted-foreground">{b(v.doctorName)}</span>
                  </span>
                </td>
                <td className={td}>
                  <DxWaiting v={v} />
                </td>
                <td className={cn(td, "text-end")}>
                  <span className="inline-flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => remind(v)} aria-label={t("remindLabel", { name: b(v.doctorName) })}>
                      {t("remind")}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={visitHref(v.id)} aria-label={tv("openLabel", { no: v.id, name: b(p.name) })}>
                        {tv("open")}
                      </Link>
                    </Button>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DxCards({ rows }: { rows: Visit[] }) {
  const t = useTranslations("records.missingView")
  const tv = useTranslations("records.visits")
  const b = useB()
  const dates = useDates()
  const remind = useRemind()
  return (
    <ul className="flex flex-col @4xl/mis:hidden">
      {rows.map((v) => {
        const p = patientOf(v.patient)
        return (
          <li key={v.id} className="flex items-center gap-2.5 border-b py-3 last:border-b-0">
            <InitialsAvatar initials={p.initials} className="self-start" />
            <Link href={visitHref(v.id)} aria-label={tv("openLabel", { no: v.id, name: b(p.name) })} className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <span className="truncate text-sm text-foreground">{b(p.name)}</span>
              <span className="text-xs text-muted-foreground">
                {dates.dayMonth(v.checked_in_at)} · {b(v.doctorName)}
              </span>
              <DxWaiting v={v} />
            </Link>
            <Button size="sm" variant="outline" onClick={() => remind(v)} aria-label={t("remindLabel", { name: b(v.doctorName) })}>
              {t("remind")}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
