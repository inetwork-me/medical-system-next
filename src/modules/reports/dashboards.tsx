"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatCard } from "@/components/ds/stat-card"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { doctorHref } from "@/modules/doctors/href"
import { CLINICS, type ReportFilters } from "./data"
import { BarList, ColumnChart, InlineBar } from "./charts"
import {
  CLINIC_ROWS,
  CLIN_KPIS,
  DOCTOR_ROWS,
  DOC_KPIS,
  FIN_KPIS,
  LAB_GOAL_HOURS,
  LAB_TURNAROUND,
  OPS_KPIS,
  QUALITY,
  REJECTIONS,
  REVENUE_BY_MONTH,
  TOP_DIAGNOSES,
  VISITS_A_DAY,
  WHO_PAID,
  indicatorMet,
  lastWorkingDays,
} from "./dashboards-data"
import { reportHref } from "./href"
import { toneOf } from "./measures"
import { Latin, useB, useChange, useNumbers, usePeriodText } from "./parts"
import { useFilters } from "./store"

const KPI = "max-md:gap-3 max-md:p-4 [&>div:nth-child(2)]:whitespace-nowrap max-md:[&>div:nth-child(2)]:text-xl"
const TEXT_TONE: Record<"destructive" | "warning", string> = { destructive: "text-destructive", warning: "text-warning-soft-foreground" }

type Kpi = { icon: IconName; tile: "accent" | "success" | "warning" | "destructive" | "info"; label: string; value: string; badge: string; tone: StatusTone; caption: string }
function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 xl:gap-6">
      {items.map((k) => (
        <StatCard key={k.label} className={KPI} icon={k.icon} tile={k.tile} label={k.label} value={k.value} delta={<span dir="ltr">{k.badge}</span>} deltaTone={k.tone} caption={k.caption} />
      ))}
    </div>
  )
}

function Card({ id, title, text, end, children, className }: { id: string; title: string; text?: React.ReactNode; end?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("@container/card flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5", className)}>
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

/** Charts row: the main chart that fills + the 380 breakdown card (stacked below xl). */
function ChartsRow({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start xl:gap-6">{main}{side}</div>
}

function FullReport({ id }: { id: string }) {
  const t = useTranslations("reports.dash")
  if (!isTabEnabled("reports", "library")) return null
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={reportHref(id)}>{t("fullReport")}</Link>
    </Button>
  )
}

const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
const td = "px-2 py-2.5 align-middle first:ps-4 last:pe-4"
const clinicOn = (f: ReportFilters, id: string) => f.clinic === "all" || f.clinic === id

function useWeekdays() {
  const locale = useLocale()
  return (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`))
}

/* ------------------------------------------------------------------ operations */

/** Widget / Rep Ops Charts + Rep Ops Table: visits a day, visits by clinic; clinics table with the thresholds. */
export function OperationsDashboard({ scope = "operations" }: { scope?: string }) {
  const t = useTranslations("reports.dash.ops")
  const b = useB()
  const n = useNumbers()
  const change = useChange()
  const p = usePeriodText()
  const f = useFilters(scope)
  const wd = useWeekdays()
  const clinic = (id: string) => b(CLINICS.find((c) => c.id === id)!.name)
  const rows = CLINIC_ROWS.filter((r) => clinicOn(f, r.clinic))
  const byVisits = [...rows].sort((a, c) => c.visits - a.visits).slice(0, 5)
  const vMax = Math.max(...byVisits.map((r) => r.visits))
  const visits = change("visits", OPS_KPIS.visits.now, OPS_KPIS.visits.before)
  const np = change("newPatients", OPS_KPIS.newPatients.now, OPS_KPIS.newPatients.before)
  const ns = change("noShowRate", OPS_KPIS.noShow.now, OPS_KPIS.noShow.before, "points")
  const worst = CLINIC_ROWS.find((r) => r.clinic === OPS_KPIS.noShow.worst)!
  const days = lastWorkingDays()
  return (
    <>
      <KpiRow
        items={[
          { icon: "trend-up", tile: "accent", label: t("kpi.visits"), value: n.count(OPS_KPIS.visits.now), badge: visits.text, tone: visits.tone, caption: p.compare(f) },
          { icon: "people", tile: "accent", label: t("kpi.newPatients"), value: n.count(OPS_KPIS.newPatients.now), badge: np.text, tone: np.tone, caption: t("kpi.ofVisits", { n: OPS_KPIS.newPatients.share }) },
          {
            icon: "timer-1",
            tile: "warning",
            label: t("kpi.wait"),
            value: t("min", { n: OPS_KPIS.avgWait.now }),
            badge: t("kpi.goal", { n: OPS_KPIS.avgWait.goal }),
            tone: OPS_KPIS.avgWait.now > OPS_KPIS.avgWait.goal ? "warning" : "success",
            caption: t("kpi.waitCaption"),
          },
          { icon: "calendar-remove", tile: "destructive", label: t("kpi.noShows"), value: n.percent(OPS_KPIS.noShow.now), badge: ns.text, tone: ns.tone, caption: t("kpi.worst", { clinic: clinic(worst.clinic), n: n.percent(worst.noShow) }) },
        ]}
      />
      <ChartsRow
        main={
          <Card id="ops-day" title={t("day")} text={t("dayText")}>
            <ColumnChart values={VISITS_A_DAY} labels={days.map(wd)} max={500} ticks={[0, 125, 250, 375, 500]} label={t("dayAlt", { list: VISITS_A_DAY.join(", ") })} />
          </Card>
        }
        side={
          <Card id="ops-clinic" title={t("byClinic")} text={p.range(f)}>
            <BarList label={t("byClinic")} rows={byVisits.map((r) => ({ key: r.clinic, label: clinic(r.clinic), value: n.count(r.visits), ratio: r.visits / vMax, color: r.color }))} />
          </Card>
        }
      />
      <Card id="ops-table" title={t("table")} text={t("tableText")} end={<FullReport id="no-shows-by-clinic" />}>
        {rows.length === 0 ? (
          <EmptyState icon="hospital" title={t("empty")} className="py-8" />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border @3xl/card:block">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <thead className="bg-muted">
                  <tr>
                    <th className={th}>{t("col.clinic")}</th>
                    <th className={th}>{t("col.visits")}</th>
                    <th className={th}>{t("col.noShows")}</th>
                    <th className={th}>{t("col.wait")}</th>
                    <th className={th}>{t("col.rooms")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const nsT = toneOf("noShowRate", r.noShow)
                    const wT = toneOf("avgWait", r.wait)
                    return (
                      <tr key={r.clinic} className="border-t">
                        <td className={cn(td, "text-foreground")}>{clinic(r.clinic)}</td>
                        <td className={cn(td, "tabular-nums")}>{n.count(r.visits)}</td>
                        <td className={cn(td, "tabular-nums", nsT && TEXT_TONE[nsT])}>
                          <Latin>{n.percent(r.noShow)}</Latin>
                        </td>
                        <td className={cn(td, wT && TEXT_TONE[wT])}>{t("min", { n: r.wait })}</td>
                        <td className={td}>
                          <span className="flex items-center gap-3">
                            <InlineBar ratio={r.rooms / 100} className="flex-1" />
                            <Latin className="w-9 text-end text-xs tabular-nums">{`${r.rooms}%`}</Latin>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col @3xl/card:hidden">
              {rows.map((r) => {
                const nsT = toneOf("noShowRate", r.noShow)
                const wT = toneOf("avgWait", r.wait)
                return (
                  <li key={r.clinic} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center self-start rounded-lg bg-muted text-foreground">
                      <Icon name="hospital" size={20} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm text-foreground">{clinic(r.clinic)}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("line.visits", { n: n.count(r.visits) })} · <span className={cn(nsT && TEXT_TONE[nsT])}>{t("line.noShows", { n: n.percent(r.noShow) })}</span> ·{" "}
                        <span className={cn(wT && TEXT_TONE[wT])}>{t("line.wait", { n: r.wait })}</span>
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ finance */

/** Widget / Rep Fin Charts + Rep Fin Table: revenue by month, who paid; why claims were rejected. */
export function FinanceDashboard({ scope = "finance" }: { scope?: string }) {
  const t = useTranslations("reports.dash.fin")
  const b = useB()
  const n = useNumbers()
  const locale = useLocale()
  const change = useChange()
  const p = usePeriodText()
  const f = useFilters(scope)
  const rev = change("revenue", FIN_KPIS.revenue.now, FIN_KPIS.revenue.before)
  const rej = change("claimRejections", FIN_KPIS.rejected.now, FIN_KPIS.rejected.before, "points")
  const month = (ym: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { month: locale === "ar" ? "long" : "short", timeZone: "UTC" }).format(new Date(`${ym}-15T12:00:00Z`))
  const sar = (v: number) => (locale === "ar" ? `${n.count(v)} ر.س` : `SAR ${n.count(v)}`)
  const maxShare = Math.max(...WHO_PAID.map((x) => x.share))
  return (
    <>
      <KpiRow
        items={[
          { icon: "money-recive", tile: "success", label: t("kpi.revenue"), value: n.money(FIN_KPIS.revenue.now, { unit: true }), badge: rev.text, tone: rev.tone, caption: p.compare(f) },
          { icon: "wallet-money", tile: "accent", label: t("kpi.collected"), value: n.money(FIN_KPIS.collected.amount, { unit: true }), badge: `${FIN_KPIS.collected.pct}%`, tone: "success", caption: t("kpi.ofBilled") },
          { icon: "receipt-2", tile: "accent", label: t("kpi.waiting"), value: n.money(FIN_KPIS.waiting.amount), badge: n.count(FIN_KPIS.waiting.claims), tone: "info", caption: t("kpi.answer", { n: FIN_KPIS.waiting.answerDays }) },
          { icon: "danger", tile: "destructive", label: t("kpi.rejected"), value: n.percent(FIN_KPIS.rejected.now), badge: rej.text, tone: rej.tone, caption: n.money(FIN_KPIS.rejected.amount) },
        ]}
      />
      <ChartsRow
        main={
          <Card id="fin-month" title={t("month")} text={t("monthText")}>
            <ColumnChart
              values={REVENUE_BY_MONTH.map((m) => m.value / 1_000_000)}
              labels={REVENUE_BY_MONTH.map((m) => month(m.month))}
              max={4}
              ticks={[0, 1, 2, 3, 4]}
              label={t("monthAlt", { list: REVENUE_BY_MONTH.map((m) => `${month(m.month)} ${(m.value / 1_000_000).toFixed(2)}`).join(", ") })}
            />
          </Card>
        }
        side={
          <Card id="fin-paid" title={t("paid")} text={p.range(f)}>
            <BarList label={t("paid")} rows={WHO_PAID.map((x) => ({ key: x.name.en, label: b(x.name), value: `${x.share}%`, ratio: x.share / maxShare, color: x.color }))} />
          </Card>
        }
      />
      <Card
        id="fin-rej"
        title={t("rejections")}
        text={t("rejectionsText", { n: n.count(FIN_KPIS.rejected.claims), amount: sar(FIN_KPIS.rejected.amount), pct: `${FIN_KPIS.rejected.now}%` })}
        end={<FullReport id="claim-rejections-by-insurer" />}
      >
        <div className="hidden overflow-hidden rounded-lg border @3xl/card:block">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="bg-muted">
              <tr>
                <th className={th}>{t("col.reason")}</th>
                <th className={th}>{t("col.claims")}</th>
                <th className={th}>{t("col.amount")}</th>
                <th className={th}>{t("col.share")}</th>
                <th className={th}>{t("col.mostFrom")}</th>
              </tr>
            </thead>
            <tbody>
              {REJECTIONS.map((r, i) => (
                <tr key={r.reason.en} className="border-t">
                  <td className={cn(td, "text-foreground")}>{b(r.reason)}</td>
                  <td className={cn(td, "tabular-nums")}>{r.claims}</td>
                  <td className={cn(td, "whitespace-nowrap tabular-nums")}>{sar(r.amount)}</td>
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <InlineBar ratio={r.share / 64} className="flex-1" color={i === 0 ? "var(--destructive)" : undefined} />
                      <Latin className="w-8 text-end text-xs tabular-nums">{`${r.share}%`}</Latin>
                    </span>
                  </td>
                  <td className={cn(td, "text-muted-foreground")}>{r.mostFrom ? b(r.mostFrom) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="flex flex-col @3xl/card:hidden">
          {REJECTIONS.map((r, i) => (
            <li key={r.reason.en} className="flex flex-col gap-1.5 border-b py-3 last:border-b-0">
              <span className="flex items-baseline gap-3 text-sm">
                <span className="min-w-0 flex-1 text-foreground">{b(r.reason)}</span>
                <Latin className="tabular-nums">{`${r.share}%`}</Latin>
              </span>
              <InlineBar ratio={r.share / 64} color={i === 0 ? "var(--destructive)" : undefined} />
              <span className="text-xs text-muted-foreground">
                {t("line", { n: r.claims, amount: sar(r.amount) })}
                {r.mostFrom && <> · {b(r.mostFrom)}</>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ clinical */

/** Widget / Rep Clin Charts + Rep Clin Table: top ICD-10 diagnoses, lab turnaround (over goal red); quality indicators. */
export function ClinicalDashboard() {
  const t = useTranslations("reports.dash.clin")
  const b = useB()
  const n = useNumbers()
  const change = useChange()
  const top = TOP_DIAGNOSES[0]
  const ret = change("returns30", CLIN_KPIS.returns30.now, CLIN_KPIS.returns30.before, "points")
  const dMax = Math.max(...TOP_DIAGNOSES.map((d) => d.count))
  const hMax = Math.max(...LAB_TURNAROUND.map((l) => l.hours))
  return (
    <>
      <KpiRow
        items={[
          { icon: "activity", tile: "accent", label: t("kpi.top"), value: top.code, badge: n.count(top.count), tone: "info", caption: b(top.short) },
          {
            icon: "glass",
            tile: "accent",
            label: t("kpi.lab"),
            value: t("hours", { n: CLIN_KPIS.labTurnaround.now.toFixed(1) }),
            badge: t("kpi.goalHours", { n: CLIN_KPIS.labTurnaround.goal }),
            tone: CLIN_KPIS.labTurnaround.now <= CLIN_KPIS.labTurnaround.goal ? "success" : "warning",
            caption: t("kpi.labCaption"),
          },
          { icon: "refresh", tile: "warning", label: t("kpi.returns"), value: n.percent(CLIN_KPIS.returns30.now), badge: ret.text, tone: ret.tone, caption: t("kpi.returnsCaption") },
          {
            icon: "health",
            tile: "success",
            label: t("kpi.rx"),
            value: n.count(CLIN_KPIS.prescriptions.count),
            badge: t("kpi.antibiotics", { n: CLIN_KPIS.prescriptions.antibioticsPct }),
            tone: CLIN_KPIS.prescriptions.antibioticsPct < CLIN_KPIS.prescriptions.goal ? "success" : "warning",
            caption: t("kpi.goalUnder", { n: CLIN_KPIS.prescriptions.goal }),
          },
        ]}
      />
      <ChartsRow
        main={
          <Card id="clin-dx" title={t("dx")} text={t("dxText")}>
            <BarList
              label={t("dx")}
              rows={TOP_DIAGNOSES.map((d) => ({
                key: d.code,
                label: (
                  <>
                    <Latin>{d.code}</Latin> · {b(d.name)}
                  </>
                ),
                value: n.count(d.count),
                ratio: (d.count / dMax) * 0.9,
              }))}
            />
          </Card>
        }
        side={
          <Card id="clin-lab" title={t("lab")} text={t("labText", { n: LAB_GOAL_HOURS })}>
            <BarList
              label={t("lab")}
              rows={LAB_TURNAROUND.map((l) => ({
                key: l.test.en,
                label: b(l.test),
                value: t("hours", { n: l.hours.toFixed(1) }),
                ratio: l.hours / (hMax * 1.08),
                color: l.hours > LAB_GOAL_HOURS ? "var(--destructive)" : "var(--chart-2)",
              }))}
            />
          </Card>
        }
      />
      <Card id="clin-quality" title={t("quality")} text={t("qualityText")}>
        <ul className="flex flex-col">
          {QUALITY.map((q) => {
            const met = indicatorMet(q)
            return (
              <li key={q.name.en} className="flex flex-col gap-2 border-b py-3 last:border-b-0 @3xl/card:flex-row @3xl/card:items-center @3xl/card:gap-4">
                <span className="min-w-0 flex-1 text-sm text-foreground">{b(q.name)}</span>
                <span className="flex items-center gap-3 @3xl/card:w-[380px] @3xl/card:shrink-0">
                  <InlineBar ratio={q.value / 100} color={met ? "var(--success)" : "var(--warning)"} className="flex-1" />
                  <Latin className="w-10 text-end text-sm tabular-nums">{`${q.value}%`}</Latin>
                  <StatusBadge tone={met ? "success" : "warning"} className="min-w-[112px] justify-center">
                    {q.under ? t("goalUnder", { n: q.goal }) : t("goal", { n: q.goal })}
                  </StatusBadge>
                </span>
              </li>
            )
          })}
        </ul>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ doctors */

/** Widget / Rep Doc Charts + Rep Doc Table: visits per doctor, patient rating; doctors table (opens the Doctors module). */
export function DoctorsDashboard({ scope = "doctors" }: { scope?: string }) {
  const t = useTranslations("reports.dash.doc")
  const b = useB()
  const n = useNumbers()
  const change = useChange()
  const p = usePeriodText()
  const f = useFilters(scope)
  const clinic = (id: string) => b(CLINICS.find((c) => c.id === id)!.name)
  const rows = DOCTOR_ROWS.filter((r) => clinicOn(f, r.clinic))
  const byVisits = [...rows].sort((a, c) => c.visits - a.visits).slice(0, 5)
  const byRating = [...rows].sort((a, c) => c.rating - a.rating).slice(0, 5)
  const vMax = Math.max(1, ...byVisits.map((r) => r.visits))
  const perDay = change("visitsPerDoctor", DOC_KPIS.perDay.now, DOC_KPIS.perDay.before, "abs")
  const linkOn = isModuleEnabled("doctors")
  const name = (r: (typeof DOCTOR_ROWS)[number]) =>
    r.doctorKey && linkOn ? (
      <Link href={doctorHref(r.doctorKey)} className="rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {b(r.name)}
      </Link>
    ) : (
      b(r.name)
    )
  const notesTone = (v: number) => (toneOf("notesOnTime", v) ? "warning" : "success")
  return (
    <>
      <KpiRow
        items={[
          { icon: "people", tile: "accent", label: t("kpi.working"), value: String(DOC_KPIS.working), badge: t("kpi.onLeave", { n: DOC_KPIS.onLeave }), tone: "info", caption: t("kpi.clinics", { n: DOC_KPIS.clinics }) },
          { icon: "trend-up", tile: "accent", label: t("kpi.perDay"), value: DOC_KPIS.perDay.now.toFixed(1), badge: perDay.text, tone: perDay.tone, caption: p.compare(f) },
          {
            icon: "edit-2",
            tile: "warning",
            label: t("kpi.notes"),
            value: `${DOC_KPIS.notesOnTime.now}%`,
            badge: t("kpi.goal", { n: DOC_KPIS.notesOnTime.goal }),
            tone: DOC_KPIS.notesOnTime.now >= DOC_KPIS.notesOnTime.goal ? "success" : "warning",
            caption: t("kpi.notesCaption"),
          },
          { icon: "star-1", tile: "success", label: t("kpi.rating"), value: DOC_KPIS.rating.now.toFixed(1), badge: t("kpi.of5"), tone: "success", caption: t("kpi.answers", { n: n.count(DOC_KPIS.rating.answers) }) },
        ]}
      />
      <ChartsRow
        main={
          <Card id="doc-visits" title={t("visits")} text={p.range(f)}>
            <BarList label={t("visits")} rows={byVisits.map((r) => ({ key: r.id, label: b(r.name), value: n.count(r.visits), ratio: (r.visits / vMax) * 0.9 }))} />
          </Card>
        }
        side={
          <Card id="doc-rating" title={t("rating")} text={t("ratingText")}>
            <BarList label={t("rating")} rows={byRating.map((r) => ({ key: r.id, label: b(r.name), value: r.rating.toFixed(1), ratio: r.rating / 5, color: "var(--warning)" }))} />
          </Card>
        }
      />
      <Card id="doc-table" title={t("table")} text={t("tableText")}>
        {rows.length === 0 ? (
          <EmptyState icon="people" title={t("empty")} className="py-8" />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border @3xl/card:block">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-muted">
                  <tr>
                    <th className={th}>{t("col.doctor")}</th>
                    <th className={th}>{t("col.clinic")}</th>
                    <th className={th}>{t("col.visits")}</th>
                    <th className={th}>{t("col.avg")}</th>
                    <th className={th}>{t("col.notes")}</th>
                    <th className={th}>{t("col.rating")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className={td}>
                        <span className="flex items-center gap-2.5">
                          <span aria-hidden dir="ltr" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
                            {r.initials}
                          </span>
                          <span className="truncate text-foreground">{name(r)}</span>
                        </span>
                      </td>
                      <td className={cn(td, "text-muted-foreground")}>{clinic(r.clinic)}</td>
                      <td className={cn(td, "tabular-nums")}>{r.visits}</td>
                      <td className={td}>{t("min", { n: r.avgVisit })}</td>
                      <td className={td}>
                        <StatusBadge tone={notesTone(r.notesOnTime)}>
                          <span dir="ltr">{`${r.notesOnTime}%`}</span>
                        </StatusBadge>
                      </td>
                      <td className={cn(td, "tabular-nums")}>{r.rating.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col @3xl/card:hidden">
              {rows.map((r) => (
                <li key={r.id} className="flex items-start gap-3 border-b py-3 last:border-b-0">
                  <span aria-hidden dir="ltr" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
                    {r.initials}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm text-foreground">{name(r)}</span>
                    <span className="text-xs text-muted-foreground">{t("line", { clinic: clinic(r.clinic), n: r.visits, rating: r.rating.toFixed(1) })}</span>
                    <StatusBadge tone={notesTone(r.notesOnTime)}>{t("notesBadge", { n: r.notesOnTime })}</StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  )
}
