"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { pdfDocument } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { REC_NOW, type PatientKey } from "./data"
import { RecordsFrame } from "./frame"
import { VISITS_HREF, missingHref } from "./href"
import { patientOf } from "./lookup"
import { MissingMenu, returnLink, useExportMissing, useShortName } from "./missing"
import { AddIdDialog, AddNationalityDialog } from "./nationality-dialog"
import { InitialsAvatar, Latin, useB, useShowMore } from "./parts"
import { recCan } from "./roles"
import { ME } from "./session"
import { logAccess, logReceptionCall, useReceptionTasks, useRecRole, useSavedIds, type ReceptionTask } from "./store"
import { inPeriod, missingOf, missingRows, type MissingRow, type MissingRule } from "./visit-rules"
import { useVisitCtx } from "./visits"
import { CLINICS, RECEPTION_INFO, allVisits, mobileOf } from "./visits-data"

type Status = "toCall" | "nextVisit" | "noAnswer" | "done"
type Filter = "all" | Status
const FILTERS: Filter[] = ["all", "toCall", "nextVisit", "noAnswer", "done"]
const FILTERS_COMPACT: Filter[] = ["all", "toCall", "done"]
const TONE: Record<Status, StatusTone> = { toCall: "neutral", nextVisit: "info", noAnswer: "warning", done: "success" }
const PAGE_WIDE = 6
const PAGE_COMPACT = 6

type Line = { patient: PatientKey; status: Status; calls: number; missing: "nationality" | "both" | "id"; visits: number; doneBy?: string; doneAt?: string }

/** Each patient on the list: Done once what was missing is on file; No answer · n after calls; At next visit when booked; else To call. */
function useLines(task?: ReceptionTask): Line[] {
  const ctx = useVisitCtx()
  const saved = useSavedIds()
  return React.useMemo(() => {
    if (!task) return []
    const rule = task.rule as MissingRule
    const visits = allVisits().filter((v) => inPeriod(v, task.period, task.branch))
    return task.patients.map((k) => {
      const mine = visits.filter((v) => v.patient === k)
      const still = mine.some((v) => missingOf(v, ctx).includes(rule))
      const ids = ctx.ids(k)
      const missing: Line["missing"] = rule === "id" ? "id" : ids.idType && ids.idNumber ? "nationality" : "both"
      const calls = task.calls?.[k] ?? 0
      const next = RECEPTION_INFO[k]?.next
      const status: Status = !still ? "done" : calls ? "noAnswer" : next && next.date >= task.at.slice(0, 10) ? "nextVisit" : "toCall"
      return { patient: k, status, calls, missing, visits: mine.length, doneBy: saved[k]?.by, doneAt: saved[k]?.at }
    })
  }, [task, ctx, saved])
}

/**
 * Visits · Reception list (inner page of Visits): what Send list to reception made. "Reception list · missing patient
 * data · Sent by the records office 23 Nov 11:05 · finish by 9 Dec", progress ("1 of 21 patients done · 4 visits
 * filled"), filters All · To call · At next visit · No answer · Done, rows Patient · Missing · Mobile · Next visit ·
 * Status with the call icon (logs an unanswered call → `call-logged`) and Add (Add nationality / Add ID number). Done
 * rows are tinted green. Print list. Reception tasks live here only; there's no global inbox yet.
 */
export function ReceptionPage() {
  const t = useTranslations("records.reception")
  const tm = useTranslations("records.missingView")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.records")
  const b = useB()
  const locale = useLocale()
  const dates = useDates()
  const role = useRecRole()
  const short = useShortName()
  const tasks = useReceptionTasks()
  const id = useSearchParams().get("task")
  const task = tasks.find((x) => x.id === id) ?? (id ? undefined : tasks[0])
  const lines = useLines(task)
  const ctx = useVisitCtx()
  const exportList = useExportMissing()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [adding, setAdding] = React.useState<PatientKey | null>(null)
  const { extra, more } = useShowMore(`${filter}|${query.trim()}`)
  const canFix = recCan(role, "patientIds")
  const crumbs = [
    { label: tn("records"), href: "/records" },
    { label: tt("visits"), href: VISITS_HREF },
  ]
  const count = (f: Filter) => (f === "all" ? lines.length : lines.filter((l) => l.status === f).length)
  const q = query.trim().toLowerCase()
  const raw = query.trim()
  const shown = lines.filter((l) => {
    if (filter !== "all" && l.status !== filter) return false
    if (!q) return true
    const p = patientOf(l.patient)
    return [p.mrn, p.name.en, mobileOf(l.patient, p.mobile)].some((x) => x.toLowerCase().includes(q)) || p.name.ar.includes(raw)
  })
  const wide = Math.min(PAGE_WIDE + extra, shown.length)
  const compact = Math.min(PAGE_COMPACT + extra, shown.length)
  const done = lines.filter((l) => l.status === "done")
  const filled = done.reduce((n, l) => n + l.visits, 0)
  const rule = (task?.rule ?? "nationality") as MissingRule
  const backToReturn = returnLink(task?.from)

  const print = async () => {
    if (!task) return
    const file = `reception-list-${task.period}.pdf`
    try {
      saveBlob(
        await pdfDocument(
          [
            { kind: "title", text: t(`title.${rule}`) },
            { kind: "meta", text: t("sent", { who: t(`sender.${(task.role ?? "records") as "records" | "reception"}`), date: dates.dayMonth(task.at), time: task.at.slice(11, 16), due: task.due ? dates.dayMonth(task.due) : "—" }) },
            {
              kind: "table",
              head: [t("col.patient"), t("col.missing"), t("col.mobile"), t("col.next"), t("col.status")],
              rows: lines.map((l) => {
                const p = patientOf(l.patient)
                const next = RECEPTION_INFO[l.patient]?.next
                return [`${b(p.name)} · ${p.mrn}`, t(`missing.${l.missing}`), mobileOf(l.patient, p.mobile), next ? `${dates.dayMonth(next.date)} · ${b(CLINICS[next.clinic])}` : t("noneBooked"), t(`status.${l.status}`, { n: l.calls })]
              }),
              weights: [3, 2, 2, 2, 2],
            },
          ],
          { dir: locale === "ar" ? "rtl" : "ltr", title: file }
        ),
        file
      )
      logAccess({ id: `ax-reception-print-${task.id}`, at: REC_NOW, user: ME, patient: "", action: "print", pages: 1, why: { en: "Reception list", ar: "قائمة الاستقبال" }, flag: "normal" })
      toast.success(t("pdfToast"), { description: t("pdfToastText") })
    } catch {
      toast.error(t("pdfFailed"), { description: t("pdfFailedText"), retry: () => void print() })
    }
  }
  const call = (k: PatientKey) => {
    if (!task) return
    logReceptionCall(task.id, k)
    toast.success(t("callToast"), { description: t("callToastText") })
  }
  const exportNow = () => {
    if (!task) return
    const rows: MissingRow[] = missingRows(
      allVisits().filter((v) => inPeriod(v, task.period, task.branch) && task.patients.includes(v.patient)),
      rule,
      ctx
    )
    exportList(rows, rule, ctx)
  }

  return (
    <>
      <PageTitle title={t("pageTitle")} crumbs={crumbs} back={VISITS_HREF} />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={VISITS_HREF} aria-label={tm("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("pageTitle")}</h1>
        {canFix && task && <MissingMenu title={t("pageTitle")} onExport={exportNow} backToReturn={backToReturn} />}
      </div>
      <RecordsFrame
        tab="visits"
        actions={
          canFix &&
          task && (
            <Button variant="outline" onClick={print}>
              <Icon name="printer" size={18} />
              {t("print")}
            </Button>
          )
        }
      >
        {!canFix ? (
          <div className="rounded-xl border bg-card">
            <EmptyState icon="lock" title={tm("noAccess")} description={tm("noAccessText")} className="py-16" />
          </div>
        ) : !task ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon="clipboard-text"
              title={t("empty")}
              description={t("emptyText")}
              className="py-16"
              actions={
                <Button variant="outline" asChild>
                  <Link href={missingHref("nationality", REC_NOW.slice(0, 7))}>{t("openMissing")}</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <section aria-labelledby="rec-reception" className="@container/rl flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/rl:p-5">
            <header className="flex flex-col gap-1">
              <h2 id="rec-reception" className="text-lg font-semibold text-foreground">
                {t(`title.${rule}`)}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("sent", { who: t(`sender.${(task.role ?? "records") as "records" | "reception"}`), date: dates.dayMonth(task.at), time: task.at.slice(11, 16), due: task.due ? dates.dayMonth(task.due) : "—" })}
              </p>
            </header>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <span className="flex-1 text-sm text-foreground">{t("progress", { done: done.length, total: lines.length })}</span>
                <span className="text-xs text-muted-foreground">{t("filled", { n: filled })}</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={lines.length}
                aria-valuenow={done.length}
                aria-label={t("progress", { done: done.length, total: lines.length })}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${lines.length ? (done.length / lines.length) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-lg bg-info-soft p-3 text-info-soft-foreground @4xl/rl:flex-row @4xl/rl:items-center">
              <span className="flex min-w-0 flex-1 items-start gap-2 text-xs">
                <Icon name="info-circle" size={18} className="shrink-0" />
                {t("info")}
              </span>
              <Button size="sm" variant="outline" className="bg-card text-foreground max-@4xl/rl:w-full" onClick={print}>
                {t("print")}
              </Button>
            </div>
            <div className="flex flex-col gap-2 @4xl/rl:flex-row @4xl/rl:items-center">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tm("search")}
                aria-label={tm("search")}
                startIcon={<Icon name="search-normal-1" size={16} />}
                className="@4xl/rl:w-70"
              />
              <Segmented
                size="sm"
                value={filter}
                onValueChange={setFilter}
                aria-label={t("filter.label")}
                className="hidden @4xl/rl:ms-auto @4xl/rl:flex *:h-6"
                options={FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`, { n: count(f) }) }))}
              />
              <Segmented
                size="sm"
                value={FILTERS_COMPACT.includes(filter) ? filter : "all"}
                onValueChange={setFilter}
                aria-label={t("filter.label")}
                className="*:h-6 *:flex-1 @4xl/rl:hidden"
                options={FILTERS_COMPACT.map((f) => ({ value: f, label: t(`filter.${f}`, { n: count(f) }) }))}
              />
            </div>
            {shown.length === 0 ? (
              <EmptyState icon="search-normal-1" title={tm("noResults")} description={tm("noResultsText")} className="py-12" />
            ) : (
              <>
                <ReceptionTable lines={shown.slice(0, wide)} short={short} onCall={call} onAdd={setAdding} />
                <ReceptionCards lines={shown.slice(0, compact)} onAdd={setAdding} />
                <footer className={cn("hidden items-center gap-3", shown.length > PAGE_WIDE && "@4xl/rl:flex")}>
                  <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
                    {tm("showing", { shown: wide, total: shown.length })}
                  </span>
                  {wide < shown.length && (
                    <Button variant="outline" size="sm" onClick={() => more(shown.length - wide)}>
                      {tm("showMore")}
                    </Button>
                  )}
                </footer>
                {compact < shown.length && (
                  <Button variant="outline" size="sm" className="w-full @4xl/rl:hidden" onClick={() => more(shown.length - compact)}>
                    {tm("showMoreN", { n: shown.length - compact })}
                  </Button>
                )}
              </>
            )}
          </section>
        )}
        {adding && task && rule !== "id" && (
          <AddNationalityDialog patient={adding} period={task.period} branch={task.branch} from={task.from} stay onOpenChange={(o) => !o && setAdding(null)} />
        )}
        {adding && task && rule === "id" && <AddIdDialog patient={adding} period={task.period} branch={task.branch} onOpenChange={(o) => !o && setAdding(null)} />}
      </RecordsFrame>
    </>
  )
}

function StatusCell({ l, short }: { l: Line; short: (k: string) => string }) {
  const t = useTranslations("records.reception")
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge tone={TONE[l.status]}>{t(`status.${l.status}`, { n: l.calls })}</StatusBadge>
      {l.status === "done" && l.doneBy && l.doneAt && <span className="text-xs text-muted-foreground">{t("doneBy", { who: short(l.doneBy), time: l.doneAt.slice(11, 16) })}</span>}
    </span>
  )
}

function ReceptionTable({ lines, short, onCall, onAdd }: { lines: Line[]; short: (k: string) => string; onCall: (k: PatientKey) => void; onAdd: (k: PatientKey) => void }) {
  const t = useTranslations("records.reception")
  const b = useB()
  const dates = useDates()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  const firstToCall = lines.find((l) => l.status === "toCall")?.patient
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/rl:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[15%]" />
          <col className="w-[13%]" />
          <col className="w-[15%]" />
          <col />
          <col className="w-[124px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.missing")}</th>
            <th className={th}>{t("col.mobile")}</th>
            <th className={th}>{t("col.next")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const p = patientOf(l.patient)
            const next = RECEPTION_INFO[l.patient]?.next
            const isDone = l.status === "done"
            return (
              <tr key={l.patient} className={cn("border-t", isDone && "bg-success-soft/60")}>
                <td className={td}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar initials={p.initials} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-foreground">{b(p.name)}</span>
                      <Latin className="text-xs text-muted-foreground">{p.mrn}</Latin>
                    </span>
                  </span>
                </td>
                <td className={cn(td, "text-foreground")}>{t(`missing.${l.missing}`)}</td>
                <td className={cn(td, "text-foreground")}>
                  <Latin>{mobileOf(l.patient, p.mobile)}</Latin>
                </td>
                <td className={cn(td, next ? "text-foreground" : "text-muted-foreground")}>{next ? `${dates.dayMonth(next.date)} · ${b(CLINICS[next.clinic])}` : t("noneBooked")}</td>
                <td className={td}>
                  <StatusCell l={l} short={short} />
                </td>
                <td className={cn(td, "text-end")}>
                  {!isDone && (
                    <span className="inline-flex gap-2">
                      <Button size="icon-sm" variant="outline" onClick={() => onCall(l.patient)} aria-label={t("callLabel", { name: b(p.name) })}>
                        <Icon name="call" size={20} />
                      </Button>
                      <Button size="sm" variant={l.patient === firstToCall ? "default" : "outline"} onClick={() => onAdd(l.patient)} aria-label={t("addLabel", { name: b(p.name) })}>
                        {t("add")}
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReceptionCards({ lines, onAdd }: { lines: Line[]; onAdd: (k: PatientKey) => void }) {
  const t = useTranslations("records.reception")
  const b = useB()
  return (
    <ul className="flex flex-col @4xl/rl:hidden">
      {lines.map((l) => {
        const p = patientOf(l.patient)
        return (
          <li key={l.patient} className="flex items-center gap-2.5 border-b py-3 last:border-b-0">
            <InitialsAvatar initials={p.initials} className="self-start" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span className="truncate text-sm text-foreground">{b(p.name)}</span>
              <span className="text-xs text-muted-foreground">
                {t(`missing.${l.missing}`)} · <Latin>{mobileOf(l.patient, p.mobile)}</Latin>
              </span>
              <StatusBadge tone={TONE[l.status]}>{t(`status.${l.status}`, { n: l.calls })}</StatusBadge>
            </div>
            {l.status !== "done" && (
              <Button size="sm" variant="outline" onClick={() => onAdd(l.patient)} aria-label={t("addLabel", { name: b(p.name) })}>
                {t("add")}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
