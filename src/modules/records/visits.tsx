"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { csvBlob, saveBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { REC_NOW, REC_TODAY } from "./data"
import { missingHref, visitHref } from "./href"
import { patientOf } from "./lookup"
import { InitialsAvatar, Latin, useB, useShowMore } from "./parts"
import { recCan, type RecViewRole } from "./roles"
import { ME } from "./session"
import { logAccess, useNotes, useRecRole, useSavedIds } from "./store"
import { inPeriod, isToday, makeCtx, missingCounts, missingOf, type MissingRule, type VisitCtx } from "./visit-rules"
import { CLINICS, CLINIC_IDS, DOCTOR_CLINIC, LEFT_AFTER_HOURS, PAYERS, allVisits, isStillHere, visitStatus, type ClinicId, type Visit, type VisitStatus } from "./visits-data"

/* ------------------------------------------------------------------ shared */

/** This month, as the Visits tab and the monthly returns count it. */
export const VISITS_PERIOD = REC_TODAY.slice(0, 7)
export const VISITS_BRANCH = "riyadh-main"

/** The rules' context with this session's saved nationalities / IDs and notes (counts refresh without a reload). */
export function useVisitCtx(): VisitCtx {
  const saved = useSavedIds()
  const notes = useNotes()
  return React.useMemo(() => makeCtx(saved, notes), [saved, notes])
}

/** The clinic a doctor is limited to (doctors see their own clinic's visits); null = every clinic. */
export function useClinicScope(role: RecViewRole): ClinicId | null {
  if (recCan(role, "allClinics") || role !== "doctor") return null
  return DOCTOR_CLINIC[ME] ?? null
}

const STATUS_TONE: Record<VisitStatus, StatusTone> = { waiting: "neutral", withDoctor: "info", checkedOut: "success", notCheckedOut: "warning" }

export function VisitStatusBadge({ status, className }: { status: VisitStatus; className?: string }) {
  const t = useTranslations("records.visits.status")
  return (
    <StatusBadge tone={STATUS_TONE[status]} className={className}>
      {t(status)}
    </StatusBadge>
  )
}

/** "09:18" today; "21 Nov · 09:18" on another day. */
export function useVisitTime() {
  const dates = useDates()
  return (v: Visit) => (isToday(v) ? v.checked_in_at.slice(11, 16) : `${dates.dayMonth(v.checked_in_at)} · ${v.checked_in_at.slice(11, 16)}`)
}

export type VisitsFilter = "today" | "here" | "open" | "month"
const FILTERS: VisitsFilter[] = ["today", "here", "open", "month"]
const FILTERS_COMPACT: VisitsFilter[] = ["today", "here", "open"]
const PAGE_WIDE = 7
const PAGE_COMPACT = 6
const isFilter = (x: string | null): x is VisitsFilter => !!x && (FILTERS as string[]).includes(x)

function inFilter(v: Visit, f: VisitsFilter) {
  if (f === "today") return isToday(v)
  if (f === "here") return isStillHere(v)
  if (f === "open") return visitStatus(v) === "notCheckedOut"
  return true
}

/** Newest check-in first. */
const byList = (a: Visit, b: Visit) => b.checked_in_at.localeCompare(a.checked_in_at)

/** Why a visit counts as not checked out: "Lab done 09:05 · over 2 h" / "Doctor done 10:05 · over 2 h" / "Open at the end of 21 Nov". */
export function useNotOutReason() {
  const t = useTranslations("records.visits.notOut")
  const dates = useDates()
  return (v: Visit) => {
    if (v.checked_in_at.slice(0, 10) < REC_TODAY || !v.seen_to) return t("endOfDay", { date: dates.dayMonth(v.checked_in_at) })
    return t(v.clinic === "lab" ? "lab" : "doctor", { time: v.seen_to.slice(11, 16), h: LEFT_AFTER_HOURS })
  }
}

/** The month's visits this role may see (doctors: their clinic). */
export function useScopedVisits() {
  const scope = useClinicScope(useRecRole())
  return React.useMemo(() => allVisits().filter((v) => inPeriod(v, VISITS_PERIOD) && (!scope || v.clinic === scope)), [scope])
}

/* ------------------------------------------------------------------ export */

let exportSeq = 0
/** Export (Visits header): the visits in the current filter as CSV; every export is logged. → `visits-exported`. */
export function useExportVisits() {
  const t = useTranslations("records.visits")
  const ty = useTranslations("records.visits.type")
  const ts = useTranslations("records.visits.status")
  const b = useB()
  const run = (rows: Visit[]): void => {
    try {
      const name = `visits-${REC_TODAY}.csv`
      saveBlob(
        csvBlob(
          [t("col.visit"), t("col.checkedIn"), t("col.patient"), t("col.mrn"), t("col.clinic"), t("col.doctor"), t("col.type"), t("col.payer"), t("col.status")],
          rows.map((v) => {
            const p = patientOf(v.patient)
            return [v.id, v.checked_in_at.replace("T", " "), b(p.name), p.mrn, b(CLINICS[v.clinic]), b(v.doctorName), ty(v.type), b(PAYERS[v.payer]), ts(visitStatus(v))]
          })
        ),
        name
      )
      logAccess({
        id: `ax-visits-export-${++exportSeq}`,
        at: REC_NOW,
        user: ME,
        patient: "",
        action: "export",
        why: { en: `Visits · ${rows.length} rows`, ar: `الزيارات · ${rows.length} صف` },
        flag: "normal",
      })
      toast.success(t("exportToast"), { description: t("exportToastText") })
    } catch {
      toast.error(t("exportFailed"), { description: t("exportFailedText"), retry: () => run(rows) })
    }
  }
  return run
}

/* ------------------------------------------------------------------ list */

/**
 * Widget / Rec Visits. Wide: "Visits · Every visit at the center, from check-in to check-out", the missing-data strip
 * (Fix now → Visits · Missing nationality), search (patient, MRN, visit no.), filters Today · Still here · Not
 * checked out · This month · All clinics, table Visit (no. + check-in) · Patient · Clinic and doctor · Type · Payer ·
 * Status (+ what's missing) · Open; "Not checked out" rows tinted amber; "Showing 7 of 142 today" + Show more.
 * Compact: Today · Here · Open, rows with the status and missing-data badges, "Show 136 more".
 */
export function VisitsList({ onRows }: { onRows?: (rows: Visit[]) => void }) {
  const t = useTranslations("records.visits")
  const b = useB()
  const role = useRecRole()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const scope = useClinicScope(role)
  const ctx = useVisitCtx()
  const month = useScopedVisits()
  const [query, setQuery] = React.useState("")
  const asked = params.get("filter")
  const filter: VisitsFilter = isFilter(asked) ? asked : "today"
  const setFilter = (f: VisitsFilter) => router.replace(f === "today" ? pathname : `${pathname}?filter=${f}`, { scroll: false })
  const [clinic, setClinic] = React.useState<ClinicId | "all">("all")
  const { extra, more } = useShowMore(`${filter}|${clinic}|${query.trim()}`)

  const inClinic = React.useMemo(() => (clinic === "all" ? month : month.filter((v) => v.clinic === clinic)), [month, clinic])
  const counts = React.useMemo(() => {
    const c: Record<VisitsFilter, number> = { today: 0, here: 0, open: 0, month: inClinic.length }
    for (const v of inClinic) {
      if (isToday(v)) c.today++
      if (isStillHere(v)) c.here++
      if (visitStatus(v) === "notCheckedOut") c.open++
    }
    return c
  }, [inClinic])
  const q = query.trim().toLowerCase()
  const raw = query.trim()
  const rows = React.useMemo(() => {
    const matches = (v: Visit) => {
      if (!q) return true
      const p = patientOf(v.patient)
      return [v.id, p.mrn, p.name.en].some((x) => x.toLowerCase().includes(q)) || p.name.ar.includes(raw)
    }
    return inClinic.filter((v) => inFilter(v, filter) && matches(v)).sort(byList)
  }, [inClinic, filter, q, raw])
  React.useEffect(() => onRows?.(rows), [rows, onRows])

  const nationality = React.useMemo(() => missingCounts(month, ctx).nationality.visits, [month, ctx])
  const canFix = recCan(role, "patientIds")
  const wide = Math.min(PAGE_WIDE + extra, rows.length)
  const compact = Math.min(PAGE_COMPACT + extra, rows.length)
  const label = (f: VisitsFilter, short?: boolean) => (short && f !== "month" ? t(`filterShort.${f}`, { n: counts[f] }) : t(`filter.${f}`, { n: counts[f] }))
  const clear = () => {
    setQuery("")
    setClinic("all")
    setFilter("today")
  }

  return (
    <section aria-labelledby="rec-visits" className="@container/vis flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/vis:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-visits" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      {canFix && nationality > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg bg-warning-soft p-3 text-warning-soft-foreground @4xl/vis:flex-row @4xl/vis:items-center">
          <span className="flex min-w-0 flex-1 items-start gap-2 text-xs">
            <Icon name="warning-2" size={18} className="shrink-0" />
            {t("fixStrip", { n: nationality })}
          </span>
          <Button size="sm" variant="outline" className="bg-card text-foreground max-@4xl/vis:w-full" asChild>
            <Link href={missingHref("nationality", VISITS_PERIOD, { branch: VISITS_BRANCH })}>{t("fixNow")}</Link>
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 @4xl/vis:flex-row @4xl/vis:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/vis:w-70"
        />
        <div className="hidden items-center gap-0.5 rounded-md bg-muted p-[3px] @4xl/vis:ms-auto @4xl/vis:flex">
          <Segmented
            size="sm"
            value={filter}
            onValueChange={setFilter}
            aria-label={t("filter.label")}
            className="bg-transparent p-0 *:h-6"
            options={FILTERS.map((f) => ({ value: f, label: label(f) }))}
          />
          <Select value={scope ?? clinic} onValueChange={(v) => setClinic(v as ClinicId | "all")} disabled={!!scope}>
            <SelectTrigger size="sm" aria-label={t("clinic")} className="h-6 border-0 bg-transparent px-2.5 text-xs text-muted-foreground shadow-none hover:text-foreground data-[state=open]:bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">{t("allClinics")}</SelectItem>
              {CLINIC_IDS.map((c) => (
                <SelectItem key={c} value={c}>
                  {b(CLINICS[c])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "today"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/vis:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: label(f, true) }))}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon="calendar-2"
          title={t("empty")}
          description={t("emptyText")}
          className="py-12"
          actions={
            <Button variant="outline" onClick={clear}>
              {t("clear")}
            </Button>
          }
        />
      ) : (
        <>
          <VisitsTable rows={rows.slice(0, wide)} ctx={ctx} />
          <VisitCards rows={rows.slice(0, compact)} ctx={ctx} />
          <footer className="hidden items-center gap-3 @4xl/vis:flex">
            <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
              {t(`showing.${filter}`, { shown: wide, total: rows.length })}
            </span>
            {wide < rows.length && (
              <Button variant="outline" size="sm" onClick={() => more(rows.length - wide)}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {compact < rows.length && (
            <Button variant="outline" size="sm" className="w-full @4xl/vis:hidden" onClick={() => more(rows.length - compact)}>
              {t("showMoreN", { n: rows.length - compact })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}

function useMissingText() {
  const t = useTranslations("records.visits.missing")
  return (m: MissingRule) => t(m)
}

function VisitsTable({ rows, ctx }: { rows: Visit[]; ctx: VisitCtx }) {
  const t = useTranslations("records.visits")
  const reason = useNotOutReason()
  const ty = useTranslations("records.visits.type")
  const b = useB()
  const time = useVisitTime()
  const missing = useMissingText()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/vis:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[140px]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
          <col className="w-[122px]" />
          <col className="w-[132px]" />
          <col className="w-[160px]" />
          <col className="w-[84px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.visit")}</th>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.clinicDoctor")}</th>
            <th className={th}>{t("col.type")}</th>
            <th className={th}>{t("col.payer")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const p = patientOf(v.patient)
            const status = visitStatus(v)
            const miss = missingOf(v, ctx)[0]
            return (
              <tr key={v.id} className={cn("border-t", status === "notCheckedOut" && "bg-warning-soft/60")}>
                <td className={cn(td, "text-xs")}>
                  <span className="flex flex-col gap-0.5">
                    <Latin className="text-foreground">{v.id}</Latin>
                    <span className="text-muted-foreground">{time(v)}</span>
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
                <td className={cn(td, "text-muted-foreground")}>{ty(v.type)}</td>
                <td className={cn(td, "truncate text-foreground")}>{b(PAYERS[v.payer])}</td>
                <td className={td}>
                  <span className="flex flex-col items-start gap-1">
                    <VisitStatusBadge status={status} />
                    {status === "notCheckedOut" ? (
                      <span className="text-xs text-muted-foreground">{reason(v)}</span>
                    ) : (
                      miss && <span className="text-xs text-warning-soft-foreground">{missing(miss)}</span>
                    )}
                  </span>
                </td>
                <td className={cn(td, "text-end")}>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={visitHref(v.id)} aria-label={t("openLabel", { no: v.id, name: b(p.name) })}>
                      {t("open")}
                    </Link>
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

function VisitCards({ rows, ctx }: { rows: Visit[]; ctx: VisitCtx }) {
  const t = useTranslations("records.visits")
  const ty = useTranslations("records.visits.type")
  const b = useB()
  const time = useVisitTime()
  const missing = useMissingText()
  return (
    <ul className="flex flex-col @4xl/vis:hidden">
      {rows.map((v) => {
        const p = patientOf(v.patient)
        const status = visitStatus(v)
        const miss = missingOf(v, ctx)[0]
        return (
          <li key={v.id} className="border-b last:border-b-0">
            <Link
              href={visitHref(v.id)}
              aria-label={t("openLabel", { no: v.id, name: b(p.name) })}
              className="flex items-center gap-2.5 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <InitialsAvatar initials={p.initials} className="self-start" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm text-foreground">{b(p.name)}</span>
                <span className="text-xs text-muted-foreground">{t("cardLine", { time: time(v), clinic: b(CLINICS[v.clinic]), type: ty(v.type) })}</span>
                <span className="flex flex-wrap gap-1.5">
                  <VisitStatusBadge status={status} />
                  {miss && <StatusBadge tone="warning">{missing(miss)}</StatusBadge>}
                </span>
              </div>
              <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center text-foreground">
                <Icon name="arrow-right-1" size={24} />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
