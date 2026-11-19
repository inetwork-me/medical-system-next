"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isModuleEnabled } from "@/lib/modules"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { StatCard } from "@/components/ds/stat-card"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsMobile } from "@/hooks/use-media-query"
import { patientHref } from "@/modules/patients/href"
import { LAB_NOW, LAB_TODAY, WORKLIST_TRENDS, minsBetween, testOf, timeOf, type LabOrder } from "./data"
import { CollectDialog } from "./collect-dialog"
import { dayCounts, inFilter, type WorklistFilter } from "./counts"
import { LabFrame } from "./frame"
import { NEW_ORDER_HREF, orderHref } from "./href"
import { statusOf, tubesToCollect, uncalledCriticals } from "./machine"
import { LabChip, LabStatusBadge, Latin, PriorityChip, useSoon } from "./parts"
import { labCan } from "./roles"
import { useLabOrders, useLabRole } from "./store"
import { useLabText } from "./text"

/** First page: 8 rows on desktop (table), 6 cards on tablet / mobile. */
const PAGE_WIDE = 8
const PAGE_COMPACT = 6
const FILTERS: WorklistFilter[] = ["all", "collect", "lab", "validate", "ready"]
/** The compact filter keeps the three the design shows. */
const FILTERS_COMPACT: WorklistFilter[] = ["all", "collect", "validate"]
const PRINTER = "Lab-2"

/** Newest order first (the design's row order). */
const byNo = (a: LabOrder, z: LabOrder) => z.no.localeCompare(a.no)

/**
 * Lab · Worklist (module home): 4 KPIs (Orders today, To collect, In lab, Critical values), then "Today's orders":
 * search, status filter, the orders table (wide) or cards (compact: tablet and mobile), "Showing n of N" and Show
 * more. Row actions follow the status: Collect / Recollect open Collect sample; Enter results, Review and View open
 * the order. A row with an uncalled critical value is tinted and flagged until the call is logged.
 */
export function Worklist() {
  const { t, b, ar } = useWorklistText()
  const dates = useDates()
  const role = useLabRole()
  const orders = useLabOrders()
  const [collecting, setCollecting] = React.useState<string | null>(null)
  const { tr, tDoctor, lineOf } = useRowText()

  const c = dayCounts(orders)
  const waiting = orders.filter((o) => inFilter(o, "collect")).map((o) => minsBetween(o.queuedAt ?? o.createdAt))
  const criticals = orders.flatMap(uncalledCriticals).sort((a, z) => a.deadline.localeCompare(z.deadline))

  const exportList = () => {
    const file = `lab-worklist-${stamp()}.xlsx`
    const head = (["order", "patient", "tests", "doctor", "priority", "status"] as const).map((k) => t(`col.${k}`))
    const body = [...orders].sort(byNo).map((o) => [
      o.no,
      `${b(o.patient.name)} · ${o.patient.mrn}`,
      o.tests.map((k) => b(testOf(k)?.name ?? { en: k, ar: k })).join(", "),
      tDoctor(o),
      tr(`priority.${o.priority}`),
      `${tr(`status.${statusOf(o)}`)} · ${lineOf(o)}`,
    ])
    saveBlob(xlsxBlob(head, body, { sheet: t("title"), rtl: ar }), file)
    toast.success(t("exported"), { description: t("exportedText", { file }) })
  }

  return (
    <LabFrame
      actions={
        <>
          <Button variant="outline" onClick={exportList}>
            <Icon name="export" size={24} />
            {t("export")}
          </Button>
          {labCan(role, "order") && (
            <Button asChild>
              <Link href={NEW_ORDER_HREF}>
                <Icon name="add" size={24} />
                {t("newOrder")}
              </Link>
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          icon="glass"
          tile="accent"
          label={t("kpi.orders")}
          value={c.all}
          delta={`+${WORKLIST_TRENDS.vsLastWeekPct}%`}
          deltaTone="info"
          caption={t("kpi.vsLast", { day: dates.weekdayShort(LAB_TODAY) })}
          className="max-md:p-4"
        />
        <StatCard
          icon="drop"
          tile="warning"
          label={t("kpi.collect")}
          value={c.collect}
          delta={c.collectStat ? t("kpi.stat", { n: c.collectStat }) : undefined}
          deltaTone="warning"
          caption={waiting.length ? t("kpi.longest", { n: Math.max(...waiting) }) : undefined}
          className="max-md:p-4"
        />
        <StatCard
          icon="timer-1"
          tile="info"
          label={t("kpi.inLab")}
          value={c.lab}
          delta={t("kpi.avg", { n: WORKLIST_TRENDS.avgInLabMin })}
          deltaTone="info"
          caption={t("kpi.avgCaption")}
          className="max-md:p-4"
        />
        <StatCard
          icon="danger"
          tile="destructive"
          label={t("kpi.critical")}
          value={criticals.length}
          delta={criticals.length ? t("kpi.notCalled") : t("kpi.allCalled")}
          deltaTone={criticals.length ? "destructive" : "success"}
          caption={criticals.length ? <bdi>{t("kpi.callBy", { time: timeOf(criticals[0].deadline) })}</bdi> : undefined}
          className="max-md:p-4"
        />
      </div>

      <TodaysOrders onCollect={setCollecting} />

      {collecting && <CollectDialog orderNo={collecting} onOpenChange={(o) => !o && setCollecting(null)} />}
    </LabFrame>
  )
}

/**
 * Widget / Lab Worklist ("Today's orders"): search, status filter, the orders table (wide) or cards (compact), then
 * "Showing n of N" + Show more. Wide from a 896px container (desktop), compact below (tablet, mobile).
 */
export function TodaysOrders({ onCollect }: { onCollect: (no: string) => void }) {
  const t = useTranslations("labs.worklist")
  const tl = useTranslations("labs.labels")
  const dates = useDates()
  const role = useLabRole()
  const soon = useSoon()
  const mobile = useIsMobile()
  const orders = useLabOrders()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<WorklistFilter>("all")
  const c = dayCounts(orders)
  const q = query.trim().toLowerCase()
  const matches = (o: LabOrder) =>
    !q || [o.no, o.patient.mrn, o.patient.name.en].some((v) => v.toLowerCase().includes(q)) || o.patient.name.ar.includes(query.trim())
  const rows = orders.filter((o) => matches(o) && inFilter(o, filter)).sort(byNo)
  // Without a search the totals include the rest of the day; a search only looks through the loaded orders.
  const total = q ? rows.length : c[filter]
  // Print labels: one per tube still to collect (pre-printed for the collection queue).
  const printLabels = () => {
    const n = orders.filter((o) => inFilter(o, "collect")).reduce((s, o) => s + tubesToCollect(o).length, 0)
    toast.success(tl("toast"), { description: tl("toastText", { n, printer: PRINTER }) })
  }
  return (
    <section aria-labelledby="lab-today" className="@container/wl flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/wl:p-5">
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="lab-today" className="text-lg font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("subtitle", { date: `${dates.weekdayShort(LAB_TODAY)} ${dates.dayMonth(LAB_TODAY)}` })}</p>
        </div>
        {labCan(role, "print") && (
          <Button variant="ghost" size="sm" onClick={printLabels}>
            <Icon name="printer" size={24} />
            {t("printLabels")}
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-2 @4xl/wl:flex-row @4xl/wl:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/wl:w-75"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/wl:ms-auto @4xl/wl:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`, { n: c[f] }) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "all"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 @4xl/wl:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: t(`filter.${f}`, { n: c[f] }) }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="glass"
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
          <OrdersTable rows={rows.slice(0, PAGE_WIDE)} onCollect={onCollect} />
          <OrderCards rows={rows.slice(0, PAGE_COMPACT)} />
          <footer className="hidden items-center gap-3 @4xl/wl:flex">
            <span className="flex-1 text-xs text-muted-foreground">{t("showing", { shown: Math.min(PAGE_WIDE, rows.length), total })}</span>
            {total > PAGE_WIDE && (
              <Button variant="outline" size="sm" onClick={soon}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {total > PAGE_COMPACT && (
            <Button variant="outline" className="w-full @4xl/wl:hidden" onClick={soon} size={mobile ? "default" : "sm"}>
              {t("showMoreMobile", { n: total - Math.min(PAGE_COMPACT, rows.length) })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}

function useWorklistText() {
  const x = useLabText()
  return { ...x, t: useTranslations("labs.worklist") }
}

/** Row helpers: the status line ("Resulted 10:52", "Waiting 19 min"…), the doctor's name. */
function useRowText() {
  const { t: tl0, b, doctorName } = useLabText()
  const t = useTranslations("labs.worklist")
  const tl = useTranslations("labs.labels")
  const tr = (k: string) => tl0(k as "priority.stat")
  const lineOf = (o: LabOrder) => {
    const s = statusOf(o)
    const panels = o.panels
    if (s === "validate") {
      const at = panels.filter((p) => p.state === "validate" && p.resultedAt).map((p) => p.resultedAt!).sort().at(-1)
      return at ? t("line.validate", { time: timeOf(at) }) : ""
    }
    if (s === "lab") {
      const due = panels.filter((p) => p.state !== "released" && p.dueAt).map((p) => p.dueAt!).sort()[0]
      return due ? t("line.lab", { time: timeOf(due) }) : ""
    }
    if (s === "collect") return t("line.collect", { n: minsBetween(o.queuedAt ?? o.createdAt, LAB_NOW), sex: o.patient.sex })
    if (s === "rejected") {
      const rej = o.tubes.flatMap((x) => x.rejections ?? []).sort((a, z) => a.at.localeCompare(z.at)).at(-1)
      return rej ? t("line.rejected", { reason: tr(`reject.${rej.reason}`), time: timeOf(rej.at) }) : ""
    }
    const at = panels.map((p) => p.releasedAt).filter(Boolean).sort().at(-1)
    return at ? t("line.ready", { time: timeOf(at) }) : ""
  }
  return { t, b, tr, tl, lineOf, tDoctor: (o: LabOrder) => doctorName(o.doctorId) }
}

/* ------------------------------------------------------------------ shared cells */

function PatientWho({ o, sub }: { o: LabOrder; sub: React.ReactNode }) {
  const { b } = useLabText()
  const linked = o.patient.patientId && isModuleEnabled("patients")
  const name = <span className="truncate text-sm font-medium text-foreground">{b(o.patient.name)}</span>
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm">
        <AvatarFallback>{o.patient.initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        {linked ? (
          <Link href={patientHref(o.patient.patientId!)} className="truncate rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {name}
          </Link>
        ) : (
          name
        )}
        <span className="truncate text-xs text-muted-foreground tabular-nums">{sub}</span>
      </div>
    </div>
  )
}

/** Test chips: the first `n` tests, then "+rest". */
function TestChips({ o, n }: { o: LabOrder; n: number }) {
  const { b } = useLabText()
  const more = o.tests.length - n
  return (
    <div className="flex flex-wrap items-center gap-1">
      {o.tests.slice(0, n).map((k) => (
        <LabChip key={k} className="h-6">
          {b(testOf(k)?.name ?? { en: k, ar: k })}
        </LabChip>
      ))}
      {more > 0 && (
        <LabChip className="h-6">
          <Latin>{`+${more}`}</Latin>
        </LabChip>
      )}
    </div>
  )
}

/** The row's action, by status and the user's lab role. */
function RowAction({ o, onCollect }: { o: LabOrder; onCollect: (no: string) => void }) {
  const t = useTranslations("labs.worklist")
  const role = useLabRole()
  const s = statusOf(o)
  const primary = s === "collect" || s === "validate"
  const variant = primary ? "default" : "outline"
  if (s === "collect" || s === "rejected") {
    if (!labCan(role, "collect")) return null
    return (
      <Button size="sm" variant={variant} onClick={() => onCollect(o.no)}>
        {t(`action.${s}`)}
      </Button>
    )
  }
  if (s === "lab" && !labCan(role, "enter")) return null
  return (
    <Button size="sm" variant={variant} asChild>
      <Link href={orderHref(o.no, s === "lab" ? "entry" : "results")}>{t(`action.${s}`)}</Link>
    </Button>
  )
}

function CriticalMark({ size }: { size: 16 | 18 }) {
  const t = useTranslations("labs.worklist")
  return <Icon name="danger" size={size} className="text-destructive" label={t("critical")} />
}

/* ------------------------------------------------------------------ wide: table */

function OrdersTable({ rows, onCollect }: { rows: LabOrder[]; onCollect: (no: string) => void }) {
  const { t, lineOf, tDoctor } = useRowText()
  const { age, ar } = useLabText()
  const th = "h-10 px-1.5 text-start text-xs font-medium text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/wl:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[118px]" />
          <col />
          <col className="w-[228px]" />
          <col className="w-[144px]" />
          <col className="w-[84px]" />
          <col className="w-[148px]" />
          <col className="w-[136px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.order")}</th>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.tests")}</th>
            <th className={th}>{t("col.doctor")}</th>
            <th className={th}>{t("col.priority")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const critical = uncalledCriticals(o).length > 0
            const sub = ar ? (
              <>
                {age(o.patient)} · <Latin>{o.patient.mrn}</Latin>
              </>
            ) : (
              `${o.patient.mrn} · ${age(o.patient)}`
            )
            return (
              <tr key={o.no} className={cn("border-t", critical && "bg-destructive-soft")}>
                <td className={td}>
                  <span dir="ltr" className="inline-flex items-center gap-1.5 text-xs text-foreground tabular-nums">
                    {critical && <CriticalMark size={16} />}
                    {o.no}
                  </span>
                </td>
                <td className={td}>
                  <PatientWho o={o} sub={sub} />
                </td>
                <td className={td}>
                  <TestChips o={o} n={2} />
                </td>
                <td className={cn(td, "truncate text-muted-foreground")}>{tDoctor(o)}</td>
                <td className={td}>
                  <PriorityChip priority={o.priority} />
                </td>
                <td className={td}>
                  <div className="flex flex-col items-start gap-0.5">
                    <LabStatusBadge status={statusOf(o)} />
                    <span className="text-xs text-muted-foreground tabular-nums">{lineOf(o)}</span>
                  </div>
                </td>
                <td className={cn(td, "text-end")}>
                  <RowAction o={o} onCollect={onCollect} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ compact: cards */

function OrderCards({ rows }: { rows: LabOrder[] }) {
  const { t, lineOf } = useRowText()
  const { ar } = useLabText()
  return (
    <ul className="flex flex-col @4xl/wl:hidden">
      {rows.map((o) => {
        const critical = uncalledCriticals(o).length > 0
        const sub = ar ? (
          <>
            <Latin>{o.patient.mrn}</Latin> · <Latin>{o.no}</Latin>
          </>
        ) : (
          `${o.no} · ${o.patient.mrn}`
        )
        return (
          <li key={o.no} className="flex flex-col gap-2 border-b py-3 last:border-b-0">
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <PatientWho o={o} sub={sub} />
              </div>
              {critical && <CriticalMark size={18} />}
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href={orderHref(o.no)} aria-label={t("openOrder", { no: o.no })}>
                  <Icon name="arrow-right-1" size={24} />
                </Link>
              </Button>
            </div>
            <TestChips o={o} n={3} />
            <div className="flex flex-wrap items-center gap-1.5">
              <LabStatusBadge status={statusOf(o)} />
              <PriorityChip priority={o.priority} />
              <span className="text-xs text-muted-foreground tabular-nums">{lineOf(o)}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
