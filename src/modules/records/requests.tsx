"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { RecordsRequest } from "./data"
import { requestCounts } from "./counts"
import { requestHref } from "./href"
import { patientOf } from "./lookup"
import { FromChip, Latin, RequestStatusBadge, useB, useShowMore } from "./parts"
import { recCan } from "./roles"
import { canRelease, dueIn, dueSoon, dueThisWeek, isOpenRequest, requestStatus } from "./rules"
import { useRecRole, useRequests } from "./store"

export type ReqFilter = "open" | "week" | "released" | "rejected"
const FILTERS: ReqFilter[] = ["open", "week", "released", "rejected"]
const FILTERS_COMPACT: ReqFilter[] = ["open", "week", "released"]
const PAGE = 6

/** "Open" lists the open requests first (by number), then the closed ones (newest first), as drawn. */
function byList(a: RecordsRequest, b: RecordsRequest) {
  const oa = isOpenRequest(a) ? 0 : 1
  const ob = isOpenRequest(b) ? 0 : 1
  if (oa !== ob) return oa - ob
  if (oa === 0) return a.no.localeCompare(b.no)
  return closedAt(b).localeCompare(closedAt(a))
}
const closedAt = (r: RecordsRequest) => r.release?.at ?? r.rejected?.at ?? r.steps.released?.at ?? r.receivedAt

function inFilter(r: RecordsRequest, f: ReqFilter) {
  if (f === "open") return true
  if (f === "week") return dueThisWeek(r)
  return requestStatus(r) === f
}

/** Due column: open → "In 3 days" / "Tomorrow" / "Today" / "2 days late"; closed → the day it was released / turned down. */
export function useDueText() {
  const t = useTranslations("records.requests.due")
  const dates = useDates()
  return (r: RecordsRequest) => {
    if (!isOpenRequest(r)) return dates.dayMonth(closedAt(r))
    const n = dueIn(r)
    return n < 0 ? t("late", { n: -n }) : n === 0 ? t("today") : n === 1 ? t("tomorrow") : t("in", { n })
  }
}

/**
 * Widget / Rec Requests. Wide: "Requests for records · Copies of files for patients, insurers, courts and hospitals",
 * search, filter (Open · Due this week · Released · Rejected), table Request · From · Patient · What and why · Due
 * (amber when close) · Status · Release (ready) / Open, "Showing 6 of 45 requests" + Show more. Compact: 3 filters,
 * rows that open the request.
 */
export function RequestsList({ onRelease }: { onRelease: (no: string) => void }) {
  const t = useTranslations("records.requests")
  const reqs = useRequests()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<ReqFilter>("open")
  const { extra, more } = useShowMore(`${filter}|${query.trim()}`)
  const c = requestCounts(reqs)
  const q = query.trim().toLowerCase()
  const raw = query.trim()
  const matches = (r: RecordsRequest) => {
    if (!q) return true
    const p = patientOf(r.patient)
    return [r.no, p.mrn, p.name.en, r.requester.en, r.summary.en].some((v) => v.toLowerCase().includes(q)) || [p.name.ar, r.requester.ar, r.summary.ar].some((v) => v.includes(raw))
  }
  const rows = reqs.filter((r) => inFilter(r, filter) && matches(r)).sort(byList)
  const shown = Math.min(PAGE + extra, rows.length)
  const count: Record<ReqFilter, number> = { open: c.open, week: c.week, released: c.released, rejected: c.rejected }
  const label = (f: ReqFilter) => t(`filter.${f}`, { n: count[f] })

  return (
    <section aria-labelledby="rec-reqs" className="@container/reqs flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/reqs:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-reqs" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <div className="flex flex-col gap-2 @4xl/reqs:flex-row @4xl/reqs:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/reqs:w-70"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/reqs:ms-auto @4xl/reqs:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: label(f) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "open"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/reqs:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: label(f) }))}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon="folder-open"
          title={t("empty")}
          description={t("emptyText")}
          className="py-12"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setFilter("open")
              }}
            >
              {t("clear")}
            </Button>
          }
        />
      ) : (
        <>
          <RequestsTable rows={rows.slice(0, shown)} onRelease={onRelease} />
          <RequestCards rows={rows.slice(0, shown)} />
          <footer className="hidden items-center gap-3 @4xl/reqs:flex">
            <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
              {t("showing", { shown, total: rows.length })}
            </span>
            {shown < rows.length && (
              <Button variant="outline" size="sm" onClick={() => more(rows.length - shown)}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {shown < rows.length && (
            <Button variant="outline" size="sm" className="w-full @4xl/reqs:hidden" onClick={() => more(rows.length - shown)}>
              {t("showMoreN", { n: rows.length - shown })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}

function RequestsTable({ rows, onRelease }: { rows: RecordsRequest[]; onRelease: (no: string) => void }) {
  const t = useTranslations("records.requests")
  const b = useB()
  const due = useDueText()
  const role = useRecRole()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/reqs:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[132px]" />
          <col className="w-[116px]" />
          <col className="w-[18%]" />
          <col />
          <col className="w-[116px]" />
          <col className="w-[168px]" />
          <col className="w-[100px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.request")}</th>
            <th className={th}>{t("col.from")}</th>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.what")}</th>
            <th className={th}>{t("col.due")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = patientOf(r.patient)
            const release = canRelease(r) && recCan(role, "release")
            return (
              <tr key={r.no} className="border-t">
                <td className={cn(td, "text-xs")}>
                  <Latin className="text-foreground">{r.no}</Latin>
                </td>
                <td className={td}>
                  <FromChip from={r.from} />
                </td>
                <td className={cn(td, "truncate text-foreground")}>{b(p.name)}</td>
                <td className={cn(td, "truncate text-muted-foreground")}>{b(r.summary)}</td>
                <td className={cn(td, "whitespace-nowrap", dueSoon(r) ? "text-warning-soft-foreground" : "text-foreground")}>{due(r)}</td>
                <td className={td}>
                  <RequestStatusBadge status={requestStatus(r)} />
                </td>
                <td className={cn(td, "text-end")}>
                  {release ? (
                    <Button size="sm" onClick={() => onRelease(r.no)}>
                      {t("release")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={requestHref(r.no)} aria-label={t("openLabel", { no: r.no })}>
                        {t("open")}
                      </Link>
                    </Button>
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

function RequestCards({ rows }: { rows: RecordsRequest[] }) {
  const t = useTranslations("records.requests")
  const tf = useTranslations("records.from")
  const b = useB()
  const due = useDueText()
  return (
    <ul className="flex flex-col @4xl/reqs:hidden">
      {rows.map((r) => {
        const p = patientOf(r.patient)
        const open = isOpenRequest(r)
        return (
          <li key={r.no} className="border-b last:border-b-0">
            <Link
              href={requestHref(r.no)}
              aria-label={t("openLabel", { no: r.no })}
              className="flex items-center gap-2.5 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center self-start rounded-lg bg-muted text-foreground">
                <Icon name="folder-open" size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm text-foreground">{b(p.name)}</span>
                <span className="text-xs text-muted-foreground">
                  {tf(r.from)} · {b(r.summary)} · <span className={cn(dueSoon(r) && "text-warning-soft-foreground")}>{open ? t("dueLine", { due: due(r).toLocaleLowerCase() }) : t("dueLine", { due: due(r) })}</span>
                </span>
                <RequestStatusBadge status={requestStatus(r)} />
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
