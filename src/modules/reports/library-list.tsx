"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PEOPLE, REP_TODAY, daysBetween } from "./data"
import { reportHref } from "./href"
import type { SavedReport } from "./library"
import type { AreaId } from "./overview-data"
import { useB } from "./parts"
import { toggleFavourite, useFavourites, useLibrary, useSchedules } from "./store"

export type LibFilter = "all" | "favourites" | "mine" | "shared" | "scheduled"
const FILTERS: LibFilter[] = ["all", "favourites", "mine", "shared", "scheduled"]
const FILTERS_COMPACT: LibFilter[] = ["all", "favourites", "mine"]
const PAGE = 7
const ME = "mansour"

const AREA_CHIP: Record<AreaId, string> = {
  operations: "bg-accent text-primary",
  finance: "bg-success-soft text-success-soft-foreground",
  clinical: "bg-info-soft text-info-soft-foreground",
  doctors: "bg-warning-soft text-warning-soft-foreground",
}

export function AreaChip({ area }: { area: AreaId }) {
  const t = useTranslations("shell.tabs.reports")
  return <span className={cn("inline-flex h-[22px] w-fit items-center rounded-full px-2.5 text-xs whitespace-nowrap", AREA_CHIP[area])}>{t(area)}</span>
}

/** "Every Sunday" / "Every month" / "Every day" (a session schedule wins over the saved one). */
export function useScheduleText() {
  const t = useTranslations("reports.library.when")
  const locale = useLocale()
  const list = useSchedules()
  return (r: SavedReport) => {
    // The schedules list is the source; a paused one isn't sending, so the report shows no schedule.
    const listed = list.find((x) => x.target === r.id)
    if (listed?.status === "paused") return undefined
    const s = listed ?? r.schedule
    if (!s) return undefined
    const freq = "freq" in s ? s.freq : s.frequency
    if (freq === "daily") return t("daily")
    if (freq === "monthly") return t("monthly")
    if (freq === "quarterly") return t("quarterly")
    const wd = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 22 + s.day, 12)))
    return t("weekly", { day: wd })
  }
}

/** "Today 08:00" / "Yesterday" / "Yesterday 23:00" / "20 Nov" (the time only when it isn't the usual morning run). */
export function useLastRun() {
  const t = useTranslations("reports.library.when")
  const dates = useDates()
  return (iso: string) => {
    const d = daysBetween(iso.slice(0, 10), REP_TODAY)
    const time = iso.slice(11, 16)
    if (d === 0) return t("today", { time })
    if (d === 1) return time === "07:00" ? t("yesterday") : t("yesterdayAt", { time })
    return dates.dayMonth(iso)
  }
}

export const personOf = (id: string) => PEOPLE.find((p) => p.id === id)

/** Star a report: favourite-added, or item-removed when it comes off. */
export function useStar() {
  const t = useTranslations("reports.library")
  return (id: string) => {
    const on = toggleFavourite(id)
    if (on) toast.success(t("favToast"), { description: t("favToastText") })
    else toast.info(t("unfavToast"), { description: t("unfavToastText") })
  }
}

function Star({ id, name }: { id: string; name: string }) {
  const t = useTranslations("reports.library")
  const fav = useFavourites().includes(id)
  const star = useStar()
  return (
    <button
      type="button"
      onClick={() => star(id)}
      aria-pressed={fav}
      aria-label={t(fav ? "unstar" : "star", { name })}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Icon name="star-1" size={20} className={fav ? "text-warning" : "text-muted-foreground"} />
    </button>
  )
}

/**
 * Widget / Rep Library: "Report library · Saved reports you can open, schedule or share", search, filter (All · Favourites ·
 * Mine · Shared with me · Scheduled), table star · Report (name + one line) · Area chip · Owner · Last run · Schedule badge ·
 * Open, "Showing 7 of 42 reports" + Show more. Compact: 3 filters, rows "Operations · Nora Al-Fahad · Today 08:00".
 */
export function LibraryList() {
  const t = useTranslations("reports.library")
  const tt = useTranslations("shell.tabs.reports")
  const b = useB()
  const favs = useFavourites()
  const LIBRARY = useLibrary()
  const sched = useScheduleText()
  const lastRun = useLastRun()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<LibFilter>("all")
  const [extra, setExtra] = React.useState(0)
  const [key, setKey] = React.useState("")
  const k = `${filter}|${query.trim()}`
  if (k !== key) {
    setKey(k)
    setExtra(0)
  }
  const inFilter = (r: SavedReport, f: LibFilter) =>
    f === "all" || (f === "favourites" ? favs.includes(r.id) : f === "mine" ? r.owner === ME : f === "shared" ? !!r.sharedWithMe : !!sched(r))
  const count = (f: LibFilter) => LIBRARY.filter((r) => inFilter(r, f)).length
  const q = query.trim().toLowerCase()
  const rows = LIBRARY.filter((r) => inFilter(r, filter) && (!q || r.name.en.toLowerCase().includes(q) || r.name.ar.includes(query.trim()) || r.desc.en.toLowerCase().includes(q)))
  const shown = Math.min(PAGE + extra, rows.length)
  const more = () => {
    const n = Math.min(20, rows.length - shown)
    setExtra((e) => e + 20)
    toast.info(t("moreToast", { n }), { description: t("moreToastText") })
  }
  const owner = (r: SavedReport) => personOf(r.owner)

  return (
    <section aria-labelledby="rep-lib" className="@container/lib flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/lib:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rep-lib" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>
      <div className="flex flex-col gap-2 @4xl/lib:flex-row @4xl/lib:items-center">
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} startIcon={<Icon name="search-normal-1" size={16} />} className="@4xl/lib:w-70" />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/lib:ms-auto @4xl/lib:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`, { n: count(f) }) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "all"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/lib:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: t(`filter.${f}`, { n: count(f) }) }))}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="document-text" title={t("empty")} description={t(filter === "favourites" ? "emptyFav" : "emptyText")} className="py-12" />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border @4xl/lib:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[52px]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[200px]" />
                <col className="w-[132px]" />
                <col className="w-[132px]" />
                <col className="w-[84px]" />
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  <th className="h-10 ps-4">
                    <span className="sr-only">{t("col.favourite")}</span>
                  </th>
                  {(["report", "area", "owner", "lastRun", "schedule"] as const).map((c) => (
                    <th key={c} className="h-10 px-2 text-start text-xs font-normal text-muted-foreground">
                      {t(`col.${c}`)}
                    </th>
                  ))}
                  <th className="h-10 pe-4">
                    <span className="sr-only">{t("col.action")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, shown).map((r) => {
                  const o = owner(r)
                  const s = sched(r)
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="py-2.5 ps-3">
                        <Star id={r.id} name={b(r.name)} />
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-foreground">{b(r.name)}</span>
                          <span className="truncate text-xs text-muted-foreground">{b(r.desc)}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <AreaChip area={r.area} />
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span aria-hidden dir="ltr" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
                            {o?.initials}
                          </span>
                          <span className="truncate text-foreground">{o ? b(o.name) : ""}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{lastRun(r.lastRun)}</td>
                      <td className="px-2 py-2.5">{s ? <StatusBadge tone="info">{s}</StatusBadge> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2.5 pe-4 text-end">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={reportHref(r.id)} aria-label={t("openLabel", { name: b(r.name) })}>
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
          <ul className="flex flex-col @4xl/lib:hidden">
            {rows.slice(0, shown).map((r) => {
              const o = owner(r)
              const s = sched(r)
              return (
                <li key={r.id} className="flex items-center gap-2 border-b py-3 last:border-b-0">
                  <Star id={r.id} name={b(r.name)} />
                  <Link href={reportHref(r.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm text-foreground">{b(r.name)}</span>
                      <span className="text-xs text-muted-foreground">
                        {tt(r.area)} · {o ? b(o.name) : ""} · {lastRun(r.lastRun)}
                      </span>
                      {s && <StatusBadge tone="info">{s}</StatusBadge>}
                    </span>
                    <Icon name="arrow-right-1" size={24} className="shrink-0 text-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
          <footer className="flex items-center gap-3">
            <span className="hidden flex-1 text-xs text-muted-foreground @4xl/lib:block" aria-live="polite">
              {t("showing", { shown, total: rows.length })}
            </span>
            {shown < rows.length && (
              <Button variant="outline" size="sm" className="w-full @4xl/lib:w-auto" onClick={more}>
                {t("showMore")}
              </Button>
            )}
          </footer>
        </>
      )}
    </section>
  )
}
