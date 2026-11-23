"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { csvBlob, saveBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { REC_NOW, REC_TODAY, USERS, type AccessEvent } from "./data"
import { accessCounts } from "./counts"
import { patientOf } from "./lookup"
import { FlagBadge, InitialsAvatar, useB, useDidLabel, useShowMore } from "./parts"
import { recCan } from "./roles"
import { ME } from "./session"
import { logAccess, useAccess, useRecRole } from "./store"

export type AccessFilter = "flagged" | "today" | "restricted" | "exports"
const FILTERS: AccessFilter[] = ["flagged", "today", "restricted", "exports"]
const FILTERS_COMPACT: AccessFilter[] = ["flagged", "today", "restricted"]
const PAGE = 5

/** Break the glass waiting for review first, then newest first (as drawn). */
function byList(a: AccessEvent, b: AccessEvent) {
  const pa = a.flag === "breakGlass" && !a.review ? 0 : 1
  const pb = b.flag === "breakGlass" && !b.review ? 0 : 1
  return pa - pb || b.at.localeCompare(a.at)
}
function inFilter(e: AccessEvent, f: AccessFilter) {
  if (f === "flagged") return true
  if (f === "today") return e.at.slice(0, 10) === REC_TODAY
  if (f === "restricted") return !!e.patient && !!patientOf(e.patient)?.restricted
  return e.action === "export"
}

/** "Turki Al-Saud · VIP", or the log itself for an export of the access log. */
function usePatientLabel() {
  const t = useTranslations("records.access")
  const tr = useTranslations("records.restriction")
  const b = useB()
  return (e: AccessEvent) => {
    if (!e.patient) return t("theLog")
    const p = patientOf(e.patient)
    return p.restricted === "vip" ? `${b(p.name)} · ${tr("vip")}` : b(p.name)
  }
}

let exportSeq = 0

/** Export: the rows in view as CSV; the export itself is logged → log-exported. */
export function useExportLog() {
  const t = useTranslations("records.access")
  const tf = useTranslations("records.status.flag")
  const b = useB()
  const did = useDidLabel()
  const who = usePatientLabel()
  const run = (rows: AccessEvent[]): void => {
    try {
      const name = `access-log-${REC_TODAY}.csv`
      saveBlob(
        csvBlob(
          [t("col.time"), t("col.who"), t("col.role"), t("col.patient"), t("col.mrn"), t("col.did"), t("col.why"), t("col.flag")],
          rows.map((e) => [e.at.replace("T", " "), b(USERS[e.user].name), b(USERS[e.user].role), who(e), e.patient ? patientOf(e.patient).mrn : "", did(e.action, e.pages), b(e.why), tf(e.flag)])
        ),
        name
      )
      logAccess({ id: `ax-export-${++exportSeq}`, at: REC_NOW, user: ME, patient: "", action: "export", why: { en: `Access log · ${rows.length} rows`, ar: `سجل الدخول · ${rows.length} صف` }, flag: "normal" })
      toast.success(t("exportToast"), { description: t("exportToastText") })
    } catch {
      toast.error(t("exportFailed"), { description: t("exportFailedText"), retry: () => run(rows) })
    }
  }
  return run
}

/**
 * Widget / Rec Access. Wide: "Access log · Every open, print and export · kept for 10 years", search, filter (Flagged ·
 * Today · Restricted files · Exports), table Time · Who (avatar + role) · Patient · Did · Why · Flag (Break the glass =
 * row tinted red, Unusual = amber, Normal) · Review on flagged rows. Read-only: nothing here edits or removes an
 * entry. Compact: rows; only flagged rows show Review.
 */
export function AccessList({ onReview, onRows }: { onReview: (id: string) => void; onRows?: (rows: AccessEvent[]) => void }) {
  const t = useTranslations("records.access")
  const events = useAccess()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<AccessFilter>("flagged")
  const { extra, more } = useShowMore(`${filter}|${query.trim()}`)
  const c = accessCounts(events)
  const q = query.trim().toLowerCase()
  const raw = query.trim()
  const matches = (e: AccessEvent) => {
    if (!q) return true
    const u = USERS[e.user]
    const p = e.patient ? patientOf(e.patient) : undefined
    return [u.name.en, p?.name.en ?? "", p?.mrn ?? ""].some((v) => v.toLowerCase().includes(q)) || [u.name.ar, p?.name.ar ?? ""].some((v) => v.includes(raw))
  }
  const rows = React.useMemo(() => events.filter((e) => inFilter(e, filter) && matches(e)).sort(byList), [events, filter, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = Math.min(PAGE + extra, rows.length)
  React.useEffect(() => onRows?.(rows), [rows, onRows])
  const label = (f: AccessFilter) => (f === "flagged" ? t("filter.flagged", { n: c.flagged }) : f === "today" ? t("filter.today", { n: c.today }) : t(`filter.${f}`))
  const total = filter === "flagged" || filter === "today" ? c.today : rows.length

  return (
    <section aria-labelledby="rec-access" className="@container/ax flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/ax:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-access" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <div className="flex flex-col gap-2 @4xl/ax:flex-row @4xl/ax:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/ax:w-70"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/ax:ms-auto @4xl/ax:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: label(f) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "flagged"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/ax:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: label(f) }))}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="shield-tick" title={t("empty")} description={t("emptyText")} className="py-12" />
      ) : (
        <>
          <AccessTable rows={rows.slice(0, shown)} onReview={onReview} />
          <AccessCards rows={rows.slice(0, shown)} onReview={onReview} />
          <footer className="flex items-center gap-3">
            <span className="hidden flex-1 text-xs text-muted-foreground @4xl/ax:block" aria-live="polite">
              {filter === "flagged" || filter === "today" ? t("showingToday", { shown, total }) : t("showing", { shown, total })}
            </span>
            {shown < rows.length && (
              <Button variant="outline" size="sm" className="w-full @4xl/ax:w-auto" onClick={() => more(rows.length - shown)}>
                {t("showMore")}
              </Button>
            )}
          </footer>
        </>
      )}
    </section>
  )
}

function useTime() {
  const dates = useDates()
  const tw = useTranslations("records.when")
  return (iso: string, short?: boolean) => (iso.slice(0, 10) === REC_TODAY ? iso.slice(11, 16) : short ? tw("yesterday") : dates.dayMonth(iso))
}

function ReviewCell({ e, onReview }: { e: AccessEvent; onReview: (id: string) => void }) {
  const t = useTranslations("records.access")
  const role = useRecRole()
  if (e.flag === "normal") return null
  if (e.review) return <span className="text-xs text-muted-foreground">{t(`reviewed.${e.review.outcome}`)}</span>
  if (!recCan(role, "reviewAccess")) return null
  return (
    <Button size="sm" variant="outline" onClick={() => onReview(e.id)}>
      {t("review")}
    </Button>
  )
}

function AccessTable({ rows, onReview }: { rows: AccessEvent[]; onReview: (id: string) => void }) {
  const t = useTranslations("records.access")
  const b = useB()
  const did = useDidLabel()
  const time = useTime()
  const pl = usePatientLabel()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/ax:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[84px]" />
          <col className="w-[18%]" />
          <col className="w-[16%]" />
          <col className="w-[13%]" />
          <col />
          <col className="w-[140px]" />
          <col className="w-[104px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            {(["time", "who", "patient", "did", "why", "flag"] as const).map((k) => (
              <th key={k} className={th}>
                {t(`col.${k}`)}
              </th>
            ))}
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const u = USERS[e.user]
            return (
              <tr key={e.id} className={cn("border-t", e.flag === "breakGlass" && !e.review && "bg-destructive-soft/60")}>
                <td className={cn(td, "tabular-nums", e.at.slice(0, 10) === REC_TODAY ? "text-xs" : "text-sm")}>{time(e.at)}</td>
                <td className={td}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar initials={u.initials} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm text-foreground">{b(u.name)}</span>
                      <span className="truncate text-xs text-muted-foreground">{b(u.role)}</span>
                    </span>
                  </span>
                </td>
                <td className={cn(td, "text-foreground")}>{pl(e)}</td>
                <td className={cn(td, "text-foreground")}>{e.patient ? did(e.action, e.pages) : t("exportedLog")}</td>
                <td className={cn(td, "truncate text-muted-foreground")} title={b(e.why)}>
                  {b(e.why)}
                </td>
                <td className={td}>
                  <FlagBadge flag={e.flag} className={e.flag === "breakGlass" && !e.review ? "bg-transparent px-0.5" : undefined} />
                </td>
                <td className={cn(td, "text-end")}>
                  <ReviewCell e={e} onReview={onReview} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <span className="sr-only">{t("readOnly")}</span>
    </div>
  )
}

/** Compact: who, "02:14 · Break the glass · Turki Al-Saud · VIP"; ordinary rows have no action, flagged ones show Review. */
function AccessCards({ rows, onReview }: { rows: AccessEvent[]; onReview: (id: string) => void }) {
  const t = useTranslations("records.access")
  const b = useB()
  const did = useDidLabel()
  const time = useTime()
  const pl = usePatientLabel()
  return (
    <ul className="flex flex-col @4xl/ax:hidden">
      {rows.map((e) => {
        const u = USERS[e.user]
        return (
          <li key={e.id} className="flex items-center gap-2.5 border-b py-3 last:border-b-0">
            <InitialsAvatar initials={u.initials} className="self-start" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm text-foreground">{b(u.name)}</span>
              <span className="text-xs text-muted-foreground">
                {time(e.at, true)} · {e.patient ? did(e.action, e.pages) : t("exportedLog")} · {pl(e)}
              </span>
              {e.flag !== "normal" && <FlagBadge flag={e.flag} />}
            </div>
            <span className="self-start">
              <ReviewCell e={e} onReview={onReview} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
