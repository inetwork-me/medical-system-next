"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { PageTitle } from "@/components/shell/page-title"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { claimsHref } from "@/modules/billing/href"
import { PEOPLE } from "./data"
import { ExportDialog, type ExportContent } from "./export-dialog"
import { FiltersBar } from "./filters"
import { LIBRARY_HREF, builderHref } from "./href"
import { SHARE_ROLES, reportById, type ReportRow, type SavedReport } from "./library"
import { personOf, useLastRun, useScheduleText } from "./library-list"
import { MEASURES, toneOf } from "./measures"
import { useB, useChange, useNumbers, usePeriodText } from "./parts"
import { repCan } from "./roles"
import { ScheduleDialog } from "./schedule-dialog"
import { ShareDialog } from "./share-dialog"
import { useFilters, useRepRole, useReport, useScheduleOf, useShares } from "./store"

const ME = "mansour"

/** A row's value in the measure's unit. */
export function useValue() {
  const n = useNumbers()
  const t = useTranslations("reports.units")
  return (r: SavedReport, v: number) => {
    const u = MEASURES[r.measure].unit
    if (u === "percent") return n.percent(v)
    if (u === "minutes") return t("minutes", { n: v })
    if (u === "hours") return t("hours", { n: v.toFixed(1) })
    if (u === "sar") return n.money(v)
    if (u === "stars") return v.toFixed(1)
    return n.count(v)
  }
}

/** Where Open on a row goes: the module list, where the normal permissions apply. */
function drillHref(r: SavedReport, row: ReportRow): string | undefined {
  if (r.drill === "appointmentsNoShows" && isModuleEnabled("appointments")) return "/appointments/list?status=noShow"
  if (r.drill === "claims" && isModuleEnabled("billing") && isTabEnabled("billing", "claims")) return claimsHref({ q: row.label.en.split(" ")[0] })
  if (r.drill === "completion" && isModuleEnabled("records") && isTabEnabled("records", "completion")) return "/records/completion"
  return undefined
}

/** The row that moved the most in the wrong direction (or the most, when none got worse). */
function biggestChange(r: SavedReport) {
  const better = MEASURES[r.measure].better
  const worse = r.rows.filter((x) => (better === "down" ? x.now > x.before : x.now < x.before))
  const pool = worse.length ? worse : r.rows
  return [...pool].sort((a, c) => Math.abs(c.now - c.before) - Math.abs(a.now - a.before))[0]
}

/** Export content for a saved report: its rows, aggregates only. */
function useReportExport(r: SavedReport): ExportContent {
  const t = useTranslations("reports.viewer")
  const b = useB()
  const value = useValue()
  const p = usePeriodText()
  const f = useFilters(`report:${r.id}`)
  return {
    name: b(r.name),
    slug: r.id,
    scope: `report:${r.id}`,
    sections: [
      { title: b(r.name), kind: "chart", head: [t("col.group"), b(MEASURES[r.measure].name), p.monthBefore(f)], rows: r.rows.map((x) => [b(x.label), value(r, x.now), value(r, x.before)]) },
      {
        title: t("tableTitle", { group: t(`group.${r.groupBy}`) }),
        kind: "table",
        head: [t("col.group"), ...(r.rows[0]?.base !== undefined ? [t("col.booked"), t("col.count")] : []), b(MEASURES[r.measure].name), t("col.vs", { month: p.monthBefore(f) })],
        rows: r.rows.map((x) => [
          b(x.label),
          ...(x.base !== undefined ? [String(x.base), String(x.count ?? "")] : []),
          value(r, x.now),
          `${x.now - x.before >= 0 ? "+" : "−"}${Math.abs(x.now - x.before).toFixed(1)}`,
        ]),
      },
    ],
  }
}

/* ------------------------------------------------------------------ main column */

function Tile({ icon, label, value, sub, tone }: { icon: IconName; label: string; value: React.ReactNode; sub: string; tone?: "destructive" }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon name={icon} size={16} />
        {label}
      </span>
      <span className={cn("text-lg font-semibold tabular-nums", tone === "destructive" ? "text-destructive" : "text-foreground")}>{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}

/**
 * Widget / Rep Viewer: tiles (the measure now, missed visits, revenue missed), the Biggest change note (amber, with the
 * owner's explanation), bars per group with last period's value in grey (red over the threshold), and the table per
 * group with the change badge and Open (drill-down to the module list).
 */
export function ReportViewer({ report: r }: { report: SavedReport }) {
  const t = useTranslations("reports.viewer")
  const b = useB()
  const n = useNumbers()
  const value = useValue()
  const change = useChange()
  const p = usePeriodText()
  const f = useFilters(`report:${r.id}`)
  const m = MEASURES[r.measure]
  const month = p.monthBefore(f)
  const rows = r.rows.filter((x) => f.clinic === "all" || r.groupBy !== "clinic" || x.key === f.clinic)
  // The headline is the same measure over every row: weighted by what each row is out of (booked, claims), else a plain average.
  // Counts and money add up across the rows instead.
  const adds = m.unit === "count" || m.unit === "sar"
  const weight = (x: ReportRow) => x.base ?? 1
  const total = (pick: (x: ReportRow) => number) => (adds ? rows.reduce((s, x) => s + pick(x), 0) : rows.reduce((s, x) => s + pick(x) * weight(x), 0) / Math.max(1, rows.reduce((s, x) => s + weight(x), 0)))
  const totalNow = total((x) => x.now)
  const totalBefore = total((x) => x.before)
  const big = biggestChange(r)
  const max = Math.max(...rows.map((x) => Math.max(x.now, x.before))) * 1.05
  const up = big && big.now > big.before
  const hasBase = rows[0]?.base !== undefined
  const tiles: React.ReactNode[] = [
    <Tile
      key="m"
      icon="chart-2"
      label={b(m.name)}
      value={<bdi dir="ltr">{value(r, Math.round(totalNow * 10) / 10)}</bdi>}
      sub={t("inMonth", { value: value(r, Math.round(totalBefore * 10) / 10), month })}
    />,
  ]
  if (r.extra?.missed !== undefined) tiles.push(<Tile key="v" icon="people" label={t("missed")} value={n.count(r.extra.missed)} sub={t("ofBooked", { n: n.count(r.extra.booked ?? 0) })} />)
  if (r.extra?.revenueMissed !== undefined) tiles.push(<Tile key="r" icon="money-recive" label={t("revenueMissed")} value={n.money(r.extra.revenueMissed)} sub={t("estimated")} tone="destructive" />)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className={cn("grid gap-3", tiles.length === 3 ? "md:grid-cols-3" : tiles.length === 2 ? "md:grid-cols-2" : "")}>{tiles}</div>
      {big && (
        <div role="note" className="flex items-start gap-2 rounded-xl bg-warning-soft p-4 text-warning-soft-foreground">
          <Icon name="lamp-on" size={20} className="shrink-0" />
          <span className="flex flex-col gap-1">
            <span className="text-sm">
              {t(up ? "bigUp" : "bigDown", { group: b(big.label), from: value(r, big.before), to: value(r, big.now) })}
            </span>
            {r.cause && <span className="text-xs">{b(r.cause)}</span>}
          </span>
        </div>
      )}
      <section aria-labelledby="rv-chart" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <header className="flex flex-col gap-1">
          <h2 id="rv-chart" className="text-lg font-semibold text-foreground">
            {t("chartTitle", { measure: b(m.name), group: t(`group.${r.groupBy}`) })}
          </h2>
          <p className="text-xs text-muted-foreground">{t("chartText", { month })}</p>
        </header>
        <ul className="flex flex-col gap-4">
          {[...rows]
            .sort((a, c) => c.now - a.now)
            .map((x) => {
              const tone = toneOf(r.measure, x.now)
              return (
                <li key={x.key} className="flex flex-col gap-2">
                  <span className="flex items-baseline gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-foreground">{b(x.label)}</span>
                    <bdi dir="ltr" className="text-xs text-muted-foreground tabular-nums" aria-label={t("beforeLabel", { month, value: value(r, x.before) })}>
                      {value(r, x.before)}
                    </bdi>
                    <bdi dir="ltr" className={cn("tabular-nums", tone === "destructive" ? "text-destructive" : "text-foreground")}>
                      {value(r, x.now)}
                    </bdi>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className={cn("block h-full rounded-full", tone === "destructive" ? "bg-destructive" : "bg-primary")} style={{ width: `${(x.now / max) * 100}%` }} />
                  </span>
                </li>
              )
            })}
        </ul>
      </section>
      <section aria-labelledby="rv-table" className="@container/rv flex flex-col gap-4 rounded-xl border bg-card p-5">
        <header className="flex flex-col gap-1">
          <h2 id="rv-table" className="text-lg font-semibold text-foreground">
            {t("tableTitle", { group: t(`group.${r.groupBy}`) })}
          </h2>
          <p className="text-xs text-muted-foreground">{r.drill === "none" ? t("tableTextNoDrill") : t(`tableText.${r.drill}`)}</p>
        </header>
        <div className="hidden overflow-hidden rounded-lg border @2xl/rv:block">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="h-10 ps-4 text-start text-xs font-normal text-muted-foreground first-letter:uppercase">{t(`group.${r.groupBy}`)}</th>
                {hasBase && <th className="h-10 px-2 text-start text-xs font-normal text-muted-foreground">{t("col.booked")}</th>}
                {hasBase && <th className="h-10 px-2 text-start text-xs font-normal text-muted-foreground">{t("col.count")}</th>}
                <th className="h-10 px-2 text-start text-xs font-normal text-muted-foreground">{t("col.rate")}</th>
                <th className="h-10 px-2 text-start text-xs font-normal text-muted-foreground">{t("col.vs", { month })}</th>
                <th className="h-10 pe-4">
                  <span className="sr-only">{t("col.action")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const tone = toneOf(r.measure, x.now)
                const c = change(r.measure, x.now, x.before, m.unit === "percent" ? "points" : "abs")
                const href = drillHref(r, x)
                return (
                  <tr key={x.key} className="border-t">
                    <td className="py-3 ps-4 text-foreground">{b(x.label)}</td>
                    {hasBase && <td className="px-2 py-3 tabular-nums">{n.count(x.base ?? 0)}</td>}
                    {hasBase && <td className="px-2 py-3 tabular-nums">{n.count(x.count ?? 0)}</td>}
                    <td className={cn("px-2 py-3 tabular-nums", tone === "destructive" && "text-destructive")}>
                      <bdi dir="ltr">{value(r, x.now)}</bdi>
                    </td>
                    <td className="px-2 py-3">
                      <StatusBadge tone={c.tone}>
                        <span dir="ltr">{c.text}</span>
                      </StatusBadge>
                    </td>
                    <td className="py-3 pe-4 text-end">
                      {href && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={href} aria-label={t("openLabel", { group: b(x.label) })}>
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
        <ul className="flex flex-col @2xl/rv:hidden">
          {rows.map((x) => {
            const c = change(r.measure, x.now, x.before, m.unit === "percent" ? "points" : "abs")
            const href = drillHref(r, x)
            const body = (
              <>
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center self-start rounded-lg bg-muted text-foreground">
                  <Icon name={r.groupBy === "clinic" ? "hospital" : "chart-2"} size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm text-foreground">{b(x.label)}</span>
                  <span className="text-xs text-muted-foreground">
                    {hasBase ? t("lineBooked", { count: n.count(x.count ?? 0), base: n.count(x.base ?? 0), value: value(r, x.now) }) : value(r, x.now)}
                  </span>
                  <StatusBadge tone={c.tone}>
                    <span>{t("vsLine", { change: c.text, month })}</span>
                  </StatusBadge>
                </span>
              </>
            )
            return (
              <li key={x.key} className="border-b last:border-b-0">
                {href ? (
                  <Link href={href} className="flex items-center gap-3 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {body}
                    <Icon name="arrow-right-1" size={24} className="shrink-0 text-foreground" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ side */

export function SideCard({ id, title, text, end, children }: { id: string; title: string; text?: string; end?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={id} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          {text && <p className="text-xs text-muted-foreground">{text}</p>}
        </div>
        {end}
      </header>
      {children}
    </section>
  )
}

export function Kv({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-start gap-3 border-b py-3.5 last:border-b-0">
          <dt className="w-[130px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
          <dd className="min-w-0 flex-1 text-sm text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Widget / Rep Viewer Side: About (data source, owner, refreshed, the measure's rule), Sent by email (Edit), Shared with (Share). */
export function ReportSide({ report: r, onSchedule, onShare }: { report: SavedReport; onSchedule?: () => void; onShare?: () => void }) {
  const t = useTranslations("reports.viewer")
  const ts = useTranslations("reports.share")
  const b = useB()
  const sched = useScheduleText()
  const listed = useScheduleOf(r.id)
  const saved = listed?.status === "paused" ? undefined : listed
  const shares = useShares(r.id, r.shares)
  const m = MEASURES[r.measure]
  const owner = personOf(r.owner)
  const recipients = saved ? saved.recipients.map((x) => ({ key: x.email, name: x.name, role: x.role, email: x.email, initials: x.initials ?? PEOPLE.find((p) => p.id === x.personId)?.initials })) : (r.schedule?.recipients ?? []).map((id) => {
        const p = PEOPLE.find((x) => x.id === id)!
        return { key: id, name: p.name, role: p.role, email: p.email, initials: p.initials }
      })
  const s = saved ?? r.schedule
  const when = sched(r)
  const time = s ? s.time : ""
  const format = s ? (s.format === "pdf" ? "PDF" : "Excel") : ""
  const source = `${b({ en: { appointments: "Appointments", visits: "Visits", invoices: "Invoices", claims: "Insurance claims", lab: "Lab orders", prescriptions: "Prescriptions" }[r.source], ar: { appointments: "المواعيد", visits: "الزيارات", invoices: "الفواتير", claims: "مطالبات التأمين", lab: "طلبات المختبر", prescriptions: "الوصفات" }[r.source] })} · ${t(`all.${r.groupBy}`)}`
  return (
    <div className="flex flex-col gap-4">
      <SideCard id="rv-about" title={t("about")}>
        <Kv
          rows={[
            [t("data"), source],
            [t("owner"), owner ? b(owner.name) : ""],
            [t("refreshed"), b(r.refresh)],
            [b(m.ruleLabel), b(m.rule)],
          ]}
        />
      </SideCard>
      <SideCard
        id="rv-email"
        title={t("email")}
        text={when ? t("emailWhen", { when, time, format }) : t("notScheduled")}
        end={
          onSchedule && (
            <Button variant="ghost" size="sm" onClick={onSchedule}>
              <Icon name={when ? "edit-2" : "add"} size={18} />
              {when ? t("edit") : t("scheduleShort")}
            </Button>
          )
        }
      >
        {recipients.length > 0 && (
          <ul className="flex flex-col gap-3">
            {recipients.map((x) => (
              <li key={x.key} className="flex items-center gap-3">
                <span aria-hidden dir="ltr" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
                  {x.initials ?? <Icon name="sms" size={16} />}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-foreground">{x.name ? b(x.name) : <bdi dir="ltr">{x.email}</bdi>}</span>
                  {x.role && <span className="truncate text-xs text-muted-foreground">{b(x.role)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SideCard>
      <SideCard
        id="rv-shared"
        title={t("shared")}
        text={t("sharedText")}
        end={
          onShare && (
            <Button variant="ghost" size="sm" onClick={onShare}>
              <Icon name="share" size={18} />
              {t("share")}
            </Button>
          )
        }
      >
        {shares.length ? (
          <Kv
            rows={shares.map((e) => {
              const role = e.kind === "role" ? SHARE_ROLES.find((x) => x.id === e.id) : undefined
              const person = e.kind === "person" ? PEOPLE.find((x) => x.id === e.id) : undefined
              return [role ? b(role.name) : person ? b(person.name) : e.id, e.access === "edit" ? ts("canEditPlural") : ts("canViewPlural")]
            })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("notShared")}</p>
        )}
      </SideCard>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

/**
 * Report (`/reports/library/report?id=no-shows-by-clinic`): header Back · "Reports / Library" over the report's name;
 * Edit (→ builder; the owner, or anyone who may build their own copy) · Share · Export. Filters bar; the viewer beside
 * the side cards (stacked below 1056 px of content). Mobile: Back · "Report" · ⋯, the three actions above.
 */
export function ReportPage() {
  const t = useTranslations("reports.viewer")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.reports")
  const b = useB()
  const role = useRepRole()
  const id = useSearchParams().get("id") ?? ""
  const r = useReport(id)
  const listed = useScheduleOf(id)
  const [dlg, setDlg] = React.useState<"export" | "share" | "schedule" | null>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const content = useReportExport(r ?? reportById("no-shows-by-clinic")!)
  const lastRun = useLastRun()
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
                <Link href={LIBRARY_HREF}>{t("backToList")}</Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }
  const canShare = repCan(role, "share") && (r.owner === ME || role === "lead" || role === "director")
  const canEdit = repCan(role, "build")
  const actions = (
    <>
      {canEdit && (
        <Button variant="outline" asChild>
          <Link href={builderHref(r.id)}>
            <Icon name="edit-2" size={20} />
            {t("edit")}
          </Link>
        </Button>
      )}
      {canShare && (
        <Button variant="outline" onClick={() => setDlg("share")}>
          <Icon name="share" size={20} />
          {t("share")}
        </Button>
      )}
      {repCan(role, "export") && (
        <Button onClick={() => setDlg("export")}>
          <Icon name="export" size={20} />
          {t("export")}
        </Button>
      )}
    </>
  )
  return (
    <>
      <PageTitle
        title={b(r.name)}
        crumbs={[
          { label: tn("reports"), href: "/reports" },
          { label: tt("library"), href: LIBRARY_HREF },
        ]}
        back={LIBRARY_HREF}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={LIBRARY_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
        <ActionMenu
          title={b(r.name)}
          description={t("lastRun", { when: lastRun(r.lastRun) })}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[[repCan(role, "schedule") && { key: "schedule", icon: "calendar-2", label: t("scheduleIt"), onSelect: () => setDlg("schedule") }, { key: "print", icon: "printer", label: t("print"), onSelect: () => window.print() }]]}
        />
      </div>
      <PageContainer className="@container/rp">
        <PageHeader actions={actions} />
        <FiltersBar scope={`report:${r.id}`} />
        <div className="grid gap-4 @[66rem]/rp:grid-cols-[minmax(0,1fr)_360px] @[66rem]/rp:items-start @[66rem]/rp:gap-6">
          <ReportViewer report={r} />
          <ReportSide report={r} onSchedule={repCan(role, "schedule") ? () => setDlg("schedule") : undefined} onShare={canShare ? () => setDlg("share") : undefined} />
        </div>
      </PageContainer>
      {dlg === "export" && <ExportDialog content={content} onOpenChange={close} />}
      {dlg === "share" && <ShareDialog report={r} onOpenChange={close} />}
      {dlg === "schedule" && (
        <ScheduleDialog
          target={r.id}
          targetName={r.name}
          existing={
            listed ??
            (r.schedule
              ? {
                  id: `sch-${r.id}`,
                  target: r.id,
                  targetName: r.name,
                  frequency: r.schedule.freq,
                  day: r.schedule.day,
                  time: r.schedule.time,
                  recipients: r.schedule.recipients.map((p) => {
                    const x = PEOPLE.find((y) => y.id === p)!
                    return { personId: p, email: x.email, name: x.name, role: x.role }
                  }),
                  format: r.schedule.format,
                  skipUnchanged: false,
                  status: "active",
                }
              : undefined)
          }
          onOpenChange={close}
        />
      )}
    </>
  )
}

