"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { REC_TODAY, type RecDocument } from "./data"
import { documentCounts } from "./counts"
import { prescriptionHref, reportHref } from "./href"
import { patientOf } from "./lookup"
import { DocKindChip, DocStatusBadge, InitialsAvatar, Latin, useB, useShowMore, useWhen } from "./parts"
import { opensInPrescription } from "./rules"
import { useDocuments } from "./store"

export type DocFilter = "all" | "prescription" | "sickLeave" | "report" | "referral"
const FILTERS: DocFilter[] = ["all", "prescription", "sickLeave", "report", "referral"]
const FILTERS_COMPACT: DocFilter[] = ["all", "prescription", "sickLeave"]
const PAGE_WIDE = 7
const PAGE_COMPACT = 6

const inFilter = (d: RecDocument, f: DocFilter) => f === "all" || d.kind === f || (f === "report" && d.kind === "discharge")
const byNewest = (a: RecDocument, b: RecDocument) => b.at.localeCompare(a.at) || b.no.localeCompare(a.no)

/** Where a document opens: a draft prescription in New prescription, anything else on the document page. */
export const docHref = (d: RecDocument) => (opensInPrescription(d) && d.encounter ? prescriptionHref(d.encounter, d.no) : reportHref(d.no))

/**
 * Widget / Rec Documents. Wide: "Documents · Prescriptions, sick leaves, reports and referrals", search, filter (All ·
 * Prescriptions · Sick leaves · Reports · Referrals), table Document (no + date) · Type · Patient · Details · Status ·
 * Open, "Showing 7 of 48 documents" + Show more. Compact: 3 filters, rows that open the document, "Show 42 more".
 */
export function DocumentsList() {
  const t = useTranslations("records.docs")
  const docs = useDocuments()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<DocFilter>("all")
  const { extra, more } = useShowMore(`${filter}|${query.trim()}`)
  const c = documentCounts(docs)
  const q = query.trim().toLowerCase()
  const matches = (d: RecDocument) => {
    if (!q) return true
    const p = patientOf(d.patient)
    return [d.no, p.mrn, p.name.en].some((v) => v.toLowerCase().includes(q)) || p.name.ar.includes(query.trim())
  }
  const rows = docs.filter((d) => inFilter(d, filter) && matches(d)).sort(byNewest)
  const wide = Math.min(PAGE_WIDE + extra, rows.length)
  const compact = Math.min(PAGE_COMPACT + extra, rows.length)
  const label = (f: DocFilter) => t(`filter.${f}`, { n: c[f] })

  return (
    <section aria-labelledby="rec-docs" className="@container/docs flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/docs:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-docs" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <div className="flex flex-col gap-2 @4xl/docs:flex-row @4xl/docs:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/docs:w-70"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/docs:ms-auto @4xl/docs:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: label(f) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "all"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/docs:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: label(f) }))}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon="document-text"
          title={t("empty")}
          description={t("emptyText")}
          className="py-12"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setFilter("all")
              }}
            >
              {t("clear")}
            </Button>
          }
        />
      ) : (
        <>
          <DocsTable rows={rows.slice(0, wide)} />
          <DocCards rows={rows.slice(0, compact)} />
          <footer className="hidden items-center gap-3 @4xl/docs:flex">
            <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
              {t("showing", { shown: wide, total: rows.length })}
            </span>
            {wide < rows.length && (
              <Button variant="outline" size="sm" onClick={() => more(rows.length - wide)}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {compact < rows.length && (
            <Button variant="outline" size="sm" className="w-full @4xl/docs:hidden" onClick={() => more(rows.length - compact)}>
              {t("showMoreN", { n: rows.length - compact })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}

function DocsTable({ rows }: { rows: RecDocument[] }) {
  const t = useTranslations("records.docs")
  const b = useB()
  const when = useWhen()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  const date = (iso: string) => (iso.slice(0, 10) === REC_TODAY ? when(iso) : when(iso, { time: false }))
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/docs:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[140px]" />
          <col className="w-[144px]" />
          <col className="w-[26%]" />
          <col />
          <col className="w-[150px]" />
          <col className="w-[88px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.document")}</th>
            <th className={th}>{t("col.type")}</th>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.details")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const p = patientOf(d.patient)
            return (
              <tr key={d.no} className="border-t">
                <td className={td}>
                  <span className="flex flex-col gap-0.5 text-xs">
                    <Latin className="text-foreground">{d.no}</Latin>
                    <span className="text-muted-foreground">{date(d.at)}</span>
                  </span>
                </td>
                <td className={td}>
                  <DocKindChip kind={d.kind} />
                </td>
                <td className={td}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar initials={p.initials} />
                    <span className="truncate text-foreground">{b(p.name)}</span>
                  </span>
                </td>
                <td className={cn(td, "truncate text-muted-foreground")}>{b(d.details)}</td>
                <td className={td}>
                  <DocStatusBadge status={d.status} />
                </td>
                <td className={cn(td, "text-end")}>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={docHref(d)} aria-label={t("openLabel", { no: d.no })}>
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

function DocCards({ rows }: { rows: RecDocument[] }) {
  const t = useTranslations("records.docs")
  const tk = useTranslations("records.kind")
  const b = useB()
  const when = useWhen()
  const date = (iso: string) => (iso.slice(0, 10) === REC_TODAY ? when(iso) : when(iso, { time: false }))
  return (
    <ul className="flex flex-col @4xl/docs:hidden">
      {rows.map((d) => {
        const p = patientOf(d.patient)
        return (
          <li key={d.no} className="border-b last:border-b-0">
            <Link
              href={docHref(d)}
              aria-label={t("openLabel", { no: d.no })}
              className="flex items-center gap-2.5 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <InitialsAvatar initials={p.initials} className="self-start" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm text-foreground">{b(p.name)}</span>
                <span className="text-xs text-muted-foreground">
                  {tk(d.kind)} · <Latin>{d.no}</Latin> · {date(d.at)}
                </span>
                <DocStatusBadge status={d.status} />
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
