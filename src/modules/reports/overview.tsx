"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isTabEnabled } from "@/lib/modules"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatCard } from "@/components/ds/stat-card"
import { StatusBadge } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { REP_TODAY, daysBetween } from "./data"
import { CLINICAL_HREF, DOCTORS_HREF, FINANCE_HREF, LIBRARY_HREF, OPERATIONS_HREF, SCHEDULES_HREF, reportHref, returnHref } from "./href"
import { MEASURES } from "./measures"
import { AREAS, FAVOURITES, NEXT_SEND, OVERVIEW, RETURNS_DUE, type AreaId, type Figure } from "./overview-data"
import { useB, useChange, useNumbers } from "./parts"
import { repTabs } from "./roles"
import { useFavourites, useRepRole, useLibrary, useSubmitted } from "./store"
import { useLastRun, useScheduleText } from "./library-list"

const KPI = "max-md:gap-3 max-md:p-4 [&>div:nth-child(2)]:whitespace-nowrap max-md:[&>div:nth-child(2)]:text-xl"
const AREA_HREF: Record<AreaId, string> = { operations: OPERATIONS_HREF, finance: FINANCE_HREF, clinical: CLINICAL_HREF, doctors: DOCTORS_HREF }

/** A figure's value in its unit ("8,412", "9.8%", "SAR 2.84M", "3.2 h", "14.2"). */
export function useFigure() {
  const n = useNumbers()
  const t = useTranslations("reports.units")
  return (f: Pick<Figure, "measure" | "now">, opts?: { unit?: boolean }) => {
    const u = MEASURES[f.measure].unit
    if (u === "percent") return `${Number.isInteger(f.now) ? f.now : f.now.toFixed(1)}%`
    if (u === "sar") return n.money(f.now, opts)
    if (u === "hours") return t("hours", { n: f.now.toFixed(1) })
    if (u === "minutes") return t("minutes", { n: f.now })
    return Number.isInteger(f.now) ? n.count(f.now) : f.now.toFixed(1)
  }
}

/** The area tabs this role and branch can open (a card or KPI for a hidden area isn't shown). */
function useAreaOn() {
  const allowed = repTabs(useRepRole())
  return (a: AreaId) => allowed.includes(a) && isTabEnabled("reports", a)
}

/** Overview KPIs: visits, revenue, no-show rate, claim rejections, each with its change vs last period. */
export function OverviewKpis() {
  const t = useTranslations("reports.overview.kpi")
  const n = useNumbers()
  const fig = useFigure()
  const change = useChange()
  const on = useAreaOn()
  const card = (f: Figure, label: string, icon: IconName, tile: "accent" | "success" | "warning" | "destructive", caption: string) => {
    const c = change(f.measure, f.now, f.before, f.kind)
    return (
      <StatCard className={KPI} icon={icon} tile={tile} label={label} value={fig(f, { unit: true })} delta={<span dir="ltr">{c.text}</span>} deltaTone={c.tone} caption={caption} />
    )
  }
  return (
    <div className="grid grid-cols-2 gap-4 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none xl:gap-6">
      {on("operations") && card(OVERVIEW.visits, t("visits"), "trend-up", "accent", t("visitsCaption"))}
      {on("finance") && card(OVERVIEW.revenue, t("revenue"), "money-recive", "success", t("revenueCaption", { n: OVERVIEW.collectedPct }))}
      {on("operations") && card(OVERVIEW.noShow, t("noShow"), "calendar-remove", "warning", t("noShowCaption", { n: n.count(OVERVIEW.missedVisits) }))}
      {on("finance") && card(OVERVIEW.claimRejections, t("claims"), "danger", "destructive", n.money(OVERVIEW.rejectedAmount))}
    </div>
  )
}

/** 10-day mini bars, today the dark one. */
function MiniBars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values)
  return (
    <div role="img" aria-label={label} className="flex h-10 items-end gap-1">
      {values.map((v, i) => (
        <span key={i} className={cn("flex-1 rounded-t-[3px]", i === values.length - 1 ? "bg-primary" : "bg-primary/25")} style={{ height: `${Math.max(14, (v / max) * 100)}%` }} />
      ))}
    </div>
  )
}

/**
 * Widget / Rep Areas: Operations, Finance, Clinical, Doctors — each with 2 headline figures + change badges (a bad
 * move shows amber here: something to watch, not an alarm) and a 10-day mini bar chart; the card opens its tab.
 */
export function AreaCards() {
  const t = useTranslations("reports.overview")
  const tt = useTranslations("shell.tabs.reports")
  const fig = useFigure()
  const change = useChange()
  const on = useAreaOn()
  const areas = AREAS.filter((a) => on(a.id))
  if (!areas.length) return null
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:gap-6">
      {areas.map((a) => (
        <Link
          key={a.id}
          href={AREA_HREF[a.id]}
          className="group flex flex-col gap-4 rounded-xl border bg-card p-5 outline-none transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
              <Icon name={a.icon} size={20} />
            </span>
            <span className="flex-1 text-lg font-semibold text-foreground">{tt(a.id)}</span>
            <Icon name="arrow-right-1" size={20} className="text-muted-foreground group-hover:text-foreground" />
          </span>
          <span className="grid grid-cols-2 gap-3">
            {a.figures.map((f) => {
              const c = change(f.measure, f.now, f.before, f.kind, { unit: f.unit, bad: "warning" })
              return (
                <span key={f.measure} className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-xs text-muted-foreground">{t(`figure.${f.measure}` as "figure.visits")}</span>
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <bdi dir="ltr" className="text-lg font-semibold whitespace-nowrap text-foreground tabular-nums">
                      {fig(f)}
                    </bdi>
                    <StatusBadge tone={c.tone}>
                      <span dir="ltr">{c.text}</span>
                    </StatusBadge>
                  </span>
                </span>
              )
            })}
          </span>
          <MiniBars values={a.days} label={t("bars", { area: tt(a.id) })} />
        </Link>
      ))}
    </div>
  )
}

function SideCard({ id, title, text, end, children }: { id: string; title: string; text: string; end?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={id} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{text}</p>
        </div>
        {end}
      </header>
      {children}
    </section>
  )
}

function Row({ href, lead, title, sub }: { href: string; lead: React.ReactNode; title: React.ReactNode; sub: React.ReactNode }) {
  return (
    <li className="border-b last:border-b-0">
      <Link href={href} className="flex items-center gap-3 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {lead}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
        </span>
        <Icon name="arrow-right-1" size={24} className="shrink-0 text-foreground" />
      </Link>
    </li>
  )
}

/** Widget / Rep Favourites: the starred reports (→ report page), Library link. */
export function Favourites() {
  const t = useTranslations("reports.overview")
  const tt = useTranslations("shell.tabs.reports")
  const b = useB()
  const ids = useFavourites()
  const library = useLibrary()
  const sched = useScheduleText()
  const lastRun = useLastRun()
  const t2 = useTranslations("reports.library.when")
  // The design's four keep their drawn line; anything starred later shows its schedule, else when it last ran.
  const rows = ids
    .map((id) => {
      const fav = FAVOURITES.find((f) => f.id === id)
      if (fav) return fav
      const r = library.find((x) => x.id === id)
      return r && { id: r.id, name: r.name, area: r.area, when: { en: sched(r) ?? t2("ran", { when: lastRun(r.lastRun) }), ar: sched(r) ?? t2("ran", { when: lastRun(r.lastRun) }) } }
    })
    .filter((x): x is (typeof FAVOURITES)[number] => !!x)
  const lib = isTabEnabled("reports", "library")
  return (
    <SideCard
      id="rep-fav"
      title={t("favTitle")}
      text={t("favText")}
      end={
        lib && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={LIBRARY_HREF}>{tt("library")}</Link>
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon="star-1" title={t("favEmpty")} description={t("favEmptyText")} className="py-8" />
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <Row
              key={r.id}
              href={lib ? reportHref(r.id) : LIBRARY_HREF}
              lead={<Icon name="star-1" size={20} className="shrink-0 text-warning" />}
              title={b(r.name)}
              sub={`${tt(r.area)} · ${b(r.when)}`}
            />
          ))}
        </ul>
      )}
    </SideCard>
  )
}

/** Widget / Rep Deadlines (Coming up): official returns by due date (→ Return) and the next scheduled send (→ Schedules). */
export function ComingUp() {
  const t = useTranslations("reports.overview")
  const b = useB()
  const dates = useDates()
  const locale = useLocale()
  const role = useRepRole()
  const returns = isTabEnabled("reports", "returns") && repTabs(role).includes("returns")
  const schedules = isTabEnabled("reports", "schedules")
  const tile = { destructive: "bg-destructive-soft text-destructive-soft-foreground", warning: "bg-warning-soft text-warning-soft-foreground", info: "bg-info-soft text-info-soft-foreground", muted: "bg-muted text-foreground" }
  const lead = (icon: IconName, tone: keyof typeof tile) => (
    <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg", tile[tone])}>
      <Icon name={icon} size={20} />
    </span>
  )
  const send = NEXT_SEND.at
  const weekday = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${send.slice(0, 10)}T12:00:00Z`))
  const submitted = useSubmitted()
  return (
    <SideCard id="rep-coming" title={t("comingTitle")} text={t("comingText")}>
      <ul className="flex flex-col">
        {returns &&
          RETURNS_DUE.filter((r) => !submitted[r.id]).map((r) => {
            const d = daysBetween(REP_TODAY, r.due)
            const due = d <= 1 ? (d <= 0 ? t("dueToday") : t("dueTomorrow")) : t("dueOn", { date: dates.dayMonth(r.due) })
            const tone = d <= 1 ? "destructive" : r.warnings ? "warning" : "info"
            const icon: IconName = d <= 1 ? "danger" : r.warnings ? "timer-1" : "calendar-2"
            return (
              <Row
                key={r.id}
                href={returnHref(r.id)}
                lead={lead(icon, tone)}
                title={b(r.name)}
                sub={[b(r.period), due, r.warnings ? t("warnings", { n: r.warnings }) : ""].filter(Boolean).join(" · ")}
              />
            )
          })}
        {schedules && (
          <Row
            href={SCHEDULES_HREF}
            lead={lead("send-2", "muted")}
            title={t("nextSend")}
            sub={t("nextSendText", { day: weekday, time: send.slice(11, 16), reports: NEXT_SEND.reports, people: NEXT_SEND.people })}
          />
        )}
      </ul>
    </SideCard>
  )
}
