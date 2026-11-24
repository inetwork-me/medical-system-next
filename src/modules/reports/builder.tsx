"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BRANCHES, CLINICS, DOCTORS, PAYERS, type ReportFilters } from "./data"
import {
  BUILDER_SOURCES,
  HAS_STATUS,
  NEW_REPORT,
  SOURCE_GROUPS,
  SOURCE_MEASURES,
  cfgOfReport,
  previewRows,
  withSource,
  type BuilderCfg,
  type ChartType,
  type GroupBy,
  type PreviewRow,
} from "./builder-data"
import { FiltersDialog } from "./filters"
import { LIBRARY_HREF, reportHref } from "./href"
import type { SavedReport } from "./library"
import { MEASURES, type MeasureId } from "./measures"
import { useB, usePeriodText } from "./parts"
import { useValue } from "./report-page"
import { SaveReportDialog } from "./save-dialog"
import { query } from "./server"
import { sessionEmail, useReport } from "./store"
import { Strip } from "./strip"

/* ------------------------------------------------------------------ labels */

function useBuilderText() {
  const t = useTranslations("reports.builder")
  const tv = useTranslations("reports.viewer")
  const ts = useTranslations("reports.save")
  const b = useB()
  return {
    measure: (m: MeasureId) => t(`measureUnit.${MEASURES[m].unit}`, { name: b(MEASURES[m].name) }),
    group: (g: GroupBy) => t(`group.${g}`),
    /** "No-show rate by clinic" — the name a new report is offered. */
    suggested: (c: BuilderCfg) => ts("nameBy", { measure: b(MEASURES[c.measure].name), group: tv(`group.${c.groupBy}`) }),
  }
}

type FilterRow = { key: "date" | "branch" | "clinic" | "doctor" | "payer" | "status"; label: string }

function useFilterRows() {
  const t = useTranslations("reports.builder.filter")
  const b = useB()
  const p = usePeriodText()
  const name = <T extends { id: string; name: { en: string; ar: string } }>(list: T[], id: string) => b(list.find((x) => x.id === id)?.name ?? { en: id, ar: id })
  return (c: BuilderCfg): FilterRow[] => {
    const f = c.filters
    const rows: FilterRow[] = []
    if (c.dated) rows.push({ key: "date", label: t("date", { value: f.period === "custom" ? p.range(f) : t(`period.${f.period}`) }) })
    if (f.branch !== "all") rows.push({ key: "branch", label: t("branch", { value: b(BRANCHES.find((x) => x.id === f.branch)?.short ?? { en: f.branch, ar: f.branch }) }) })
    if (f.clinic !== "all") rows.push({ key: "clinic", label: t("clinic", { value: name(CLINICS, f.clinic) }) })
    if (f.doctor !== "all") rows.push({ key: "doctor", label: t("doctor", { value: name(DOCTORS, f.doctor) }) })
    if (f.payer !== "all") rows.push({ key: "payer", label: t("payer", { value: name(PAYERS, f.payer) }) })
    if (c.status && HAS_STATUS.includes(c.source)) rows.push({ key: "status", label: t("status") })
    return rows
  }
}

/** Taking a filter row off: the date row means every date; the others go back to "all" (still only your branches). */
function withoutFilter(c: BuilderCfg, key: FilterRow["key"]): BuilderCfg {
  if (key === "date") return { ...c, dated: false }
  if (key === "status") return { ...c, status: false }
  return { ...c, filters: { ...c.filters, [key]: "all" } }
}

/* ------------------------------------------------------------------ steps */

function StepCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <h2 id={id} className="pb-2 text-lg font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * Widget / Rep Builder Steps: 1 Data (one source), 2 Measure (Show*, Group by*, Then by), 3 Filters (rows with change
 * and remove, Add filter → the Filters dialog), 4 Chart (Bars / Line / Table only). Every change updates the preview.
 */
export function BuilderSteps({
  cfg,
  onChange,
  onFilters,
  onRemoveFilter,
}: {
  cfg: BuilderCfg
  onChange: (c: BuilderCfg) => void
  onFilters: () => void
  onRemoveFilter: (key: FilterRow["key"]) => void
}) {
  const t = useTranslations("reports.builder")
  const x = useBuilderText()
  const filterRows = useFilterRows()(cfg)
  const groups = SOURCE_GROUPS[cfg.source]
  const statusOff = HAS_STATUS.includes(cfg.source) && !cfg.status

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <StepCard id="rb-data" title={t("step.data")}>
        <RadioGroupPrimitive.Root value={cfg.source} onValueChange={(v) => onChange(withSource(cfg, v as BuilderCfg["source"]))} aria-label={t("dataLabel")} className="flex flex-col gap-3">
          {BUILDER_SOURCES.map((s) => (
            <RadioGroupPrimitive.Item
              key={s}
              value={s}
              className="group/src flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 text-start text-sm text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-accent"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]/src:border-primary">
                <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
              </span>
              {t(`source.${s}`)}
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
      </StepCard>

      <StepCard id="rb-measure" title={t("step.measure")}>
        <Field label={t("show")} required>
          {(fp) => (
            <Select value={cfg.measure} onValueChange={(v) => onChange({ ...cfg, measure: v as MeasureId })}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_MEASURES[cfg.source].map((m) => (
                  <SelectItem key={m} value={m}>
                    {x.measure(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("groupBy")} required>
          {(fp) => (
            <Select value={cfg.groupBy} onValueChange={(v) => onChange({ ...cfg, groupBy: v as GroupBy, thenBy: cfg.thenBy === v ? "none" : cfg.thenBy })}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {x.group(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("thenBy")}>
          {(fp) => (
            <Select value={cfg.thenBy} onValueChange={(v) => onChange({ ...cfg, thenBy: v as GroupBy | "none" })}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("none")}</SelectItem>
                {groups
                  .filter((g) => g !== cfg.groupBy)
                  .map((g) => (
                    <SelectItem key={g} value={g}>
                      {x.group(g)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </StepCard>

      <StepCard id="rb-filters" title={t("step.filters")}>
        {filterRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("filter.none")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {filterRows.map((r) => (
              <li key={r.key} className="flex h-[50px] items-center gap-1 rounded-lg border bg-card ps-1 pe-2">
                {r.key === "status" ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2 px-2 text-sm text-foreground">
                    <Icon name="filter" size={18} className="shrink-0 text-muted-foreground" />
                    <span className="truncate">{r.label}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onFilters}
                    aria-label={t("filter.change", { name: r.label })}
                    className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-start text-sm text-foreground outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Icon name="filter" size={18} className="shrink-0 text-muted-foreground" />
                    <bdi className="truncate">{r.label}</bdi>
                  </button>
                )}
                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => onRemoveFilter(r.key)} aria-label={t("filter.remove", { name: r.label })}>
                  <Icon name="close-circle" size={22} />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {statusOff ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="w-fit">
                <Icon name="add" size={16} />
                {t("filter.add")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={onFilters}>{t("filter.more")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onChange({ ...cfg, status: true })}>{t("filter.status")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="sm" className="w-fit" onClick={onFilters}>
            <Icon name="add" size={16} />
            {t("filter.add")}
          </Button>
        )}
      </StepCard>

      <StepCard id="rb-chart" title={t("step.chart")}>
        <div className="flex flex-col gap-1.5">
          <span id="rb-chart-type" className="text-xs font-medium text-foreground">
            {t("chartType")}
          </span>
          <Segmented<ChartType>
            value={cfg.chart}
            onValueChange={(v) => onChange({ ...cfg, chart: v })}
            aria-labelledby="rb-chart-type"
            className="*:flex-1"
            options={(["bars", "line", "table"] as const).map((v) => ({ value: v, label: t(`chart.${v}`) }))}
          />
        </div>
      </StepCard>
    </div>
  )
}

/* ------------------------------------------------------------------ preview */

function PreviewBars({ rows, cfg, label }: { rows: PreviewRow[]; cfg: BuilderCfg; label: string }) {
  const value = useValue()
  const b = useB()
  const max = Math.max(...rows.map((r) => r.now), 0) * 1.15 || 1
  const r0 = { measure: cfg.measure } as SavedReport
  return (
    <ul className="flex flex-col gap-2.5" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,104px)_minmax(0,1fr)_auto] items-center gap-2.5 text-xs @lg/pv:grid-cols-[120px_minmax(0,1fr)_48px]">
          <span className="truncate text-foreground">{b(r.label)}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (r.now / max) * 100)}%` }} />
          </span>
          <bdi dir="ltr" className="text-end text-foreground tabular-nums">
            {value(r0, r.now)}
          </bdi>
        </li>
      ))}
    </ul>
  )
}

/** A line across the groups: this period in blue, the month before dashed grey. */
function PreviewLine({ rows, cfg, label }: { rows: PreviewRow[]; cfg: BuilderCfg; label: string }) {
  const value = useValue()
  const b = useB()
  const r0 = { measure: cfg.measure } as SavedReport
  const max = Math.max(...rows.flatMap((r) => [r.now, r.before]), 0) * 1.15 || 1
  const W = 600
  const H = 160
  const step = rows.length > 1 ? W / (rows.length - 1) : 0
  const pt = (v: number, i: number) => `${rows.length > 1 ? i * step : W / 2},${H - (v / max) * H}`
  return (
    <figure aria-label={label} className="flex flex-col gap-2">
      <svg viewBox={`-8 -8 ${W + 16} ${H + 16}`} className="h-40 w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
        <polyline points={rows.map((r, i) => pt(r.before, i)).join(" ")} fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" opacity="0.5" />
        <polyline points={rows.map((r, i) => pt(r.now, i)).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between gap-1 text-xs text-muted-foreground" dir="ltr">
        {rows.map((r) => (
          <span key={r.key} className="min-w-0 flex-1 truncate text-center first:text-start last:text-end" title={`${b(r.label)}: ${value(r0, r.now)}`}>
            {b(r.label)}
          </span>
        ))}
      </div>
    </figure>
  )
}

function PreviewTable({ rows, cfg, limit }: { rows: PreviewRow[]; cfg: BuilderCfg; limit: number }) {
  const t = useTranslations("reports.builder")
  const b = useB()
  const value = useValue()
  const x = useBuilderText()
  const r0 = { measure: cfg.measure } as SavedReport
  const base = cfg.measure === "noShowRate" && rows[0]?.base !== undefined
  const sub = cfg.thenBy !== "none"
  const head = [x.group(cfg.groupBy), ...(sub ? [x.group(cfg.thenBy as GroupBy)] : []), ...(base ? [t("col.booked"), t("col.count"), t("col.rate")] : [b(MEASURES[cfg.measure].name), t("preview.last")])]
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={cn("h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4", i === 0 && "w-[40%]")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => (
            <tr key={r.key} className="h-10 border-t">
              <td className="truncate px-2 ps-4 text-foreground">{b(r.label)}</td>
              {sub && <td className="truncate px-2 text-foreground">{r.sub ? b(r.sub) : ""}</td>}
              {base ? (
                <>
                  <td className="px-2 tabular-nums">{(r.base ?? 0).toLocaleString("en-US")}</td>
                  <td className="px-2 tabular-nums">{(r.count ?? 0).toLocaleString("en-US")}</td>
                  <td className="px-2 tabular-nums">
                    <bdi dir="ltr">{value(r0, r.now)}</bdi>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-2 tabular-nums">
                    <bdi dir="ltr">{value(r0, r.now)}</bdi>
                  </td>
                  <td className="px-2 text-muted-foreground tabular-nums">
                    <bdi dir="ltr">{value(r0, r.before)}</bdi>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Widget / Rep Builder Preview: "Preview · Updates as you change the steps · 6 rows", the name + "Not saved" chip,
 * live bars (or line), the first rows of the table (Table only: more rows, also on mobile), and the note that only
 * visible branches go in and patient names never appear.
 */
export function BuilderPreview({ cfg, rows, table, name, dirty, busy }: { cfg: BuilderCfg; rows: PreviewRow[]; table: PreviewRow[]; name?: string; dirty: boolean; busy?: boolean }) {
  const t = useTranslations("reports.builder.preview")
  const b = useB()
  const x = useBuilderText()
  const label = t("chartLabel", { measure: b(MEASURES[cfg.measure].name), group: x.group(cfg.groupBy) })
  return (
    <section aria-labelledby="rb-preview" aria-busy={busy || undefined} className="@container/pv flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rb-preview" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("text", { n: table.length })}
        </p>
      </header>
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-lg font-semibold text-foreground">{name || t("untitled")}</h3>
        {dirty && <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-warning-soft px-2.5 text-xs text-warning-soft-foreground">{t("notSaved")}</span>}
      </div>
      <div className={cn("flex flex-col gap-4 transition-opacity", busy && "opacity-50")}>
        {rows.length === 0 ? (
          <EmptyState icon="chart-2" title={t("empty")} description={t("emptyText")} className="py-10" />
        ) : (
          <>
            {cfg.chart === "bars" && <PreviewBars rows={rows} cfg={cfg} label={label} />}
            {cfg.chart === "line" && <PreviewLine rows={rows} cfg={cfg} label={label} />}
            <div className={cn(cfg.chart !== "table" && "hidden @lg/pv:block")}>
              <PreviewTable rows={table} cfg={cfg} limit={cfg.chart === "table" ? 10 : 4} />
            </div>
          </>
        )}
      </div>
      <Strip tone="info" icon="info-circle">
        {t("note")}
      </Strip>
    </section>
  )
}

/* ------------------------------------------------------------------ page */

const same = (a: BuilderCfg, z: BuilderCfg) => JSON.stringify(a) === JSON.stringify(z)

/**
 * Report builder (`/reports/library/builder`, `?id=` to edit): header Back · "Reports / Library" over "New report"
 * (or the report's name); Run (refresh the preview through the server query) · Save report. Steps column (360) beside
 * the preview; tablet and mobile stack them, steps first. Mobile: Back · "New report" · ⋯ (Start over), and a fixed
 * bar with Run and Save report.
 */
export function BuilderPage() {
  const t = useTranslations("reports.builder")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.reports")
  const tv = useTranslations("reports.viewer")
  const b = useB()
  const x = useBuilderText()
  const router = useRouter()
  const id = useSearchParams().get("id") ?? ""
  const editing = useReport(id)
  const start = React.useMemo(() => (editing ? cfgOfReport(editing) : NEW_REPORT), [editing])
  const [cfg, setCfg] = React.useState<BuilderCfg>(start)
  const [busy, setBusy] = React.useState(false)
  const [dlg, setDlg] = React.useState<"filters" | "save" | null>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const email = sessionEmail()
  const { rows, table } = React.useMemo(() => previewRows(cfg, email), [cfg, email])
  const dirty = !editing || !same(cfg, start)
  const back = editing ? reportHref(editing.id) : LIBRARY_HREF

  if (id && !editing) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="document-text"
            title={tv("notFound")}
            description={tv("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={LIBRARY_HREF}>{tv("backToList")}</Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }

  const run = async () => {
    setBusy(true)
    const started = performance.now()
    // Heavy queries run in the background on the server; the preview keeps showing the last result meanwhile.
    const res = await query(email, cfg.filters, () => previewRows(cfg, email))
    setBusy(false)
    toast.success(t("runToast"), { description: t("runToastText", { n: res.data.table.length, s: ((performance.now() - started) / 1000).toFixed(1) }) })
  }
  const removeFilter = (key: FilterRow["key"]) => {
    setCfg((c) => withoutFilter(c, key))
    toast.info(t("removed"), { description: t("removedText") })
  }
  const applyFilters = (f: ReportFilters) => setCfg((c) => ({ ...c, filters: f, dated: true }))
  const title = editing ? b(editing.name) : t("newTitle")

  const runButton = (
    <Button variant="outline" onClick={run} disabled={busy}>
      <Icon name="play" size={20} />
      {busy ? t("running") : t("run")}
    </Button>
  )
  const saveButton = (
    <Button onClick={() => setDlg("save")}>
      <Icon name="tick-circle" size={20} />
      {t("save")}
    </Button>
  )

  return (
    <>
      <PageTitle
        title={title}
        crumbs={[
          { label: tn("reports"), href: "/reports" },
          { label: tt("library"), href: LIBRARY_HREF },
        ]}
        back={back}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={back} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{editing ? t("editTitle") : t("newTitle")}</h1>
        <ActionMenu
          title={title}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[[{ key: "reset", icon: "rotate-left", label: t("startOver"), onSelect: () => setCfg(start) }]]}
        />
      </div>
      <PageContainer className="@container/rb">
        <PageHeader
          actions={
            <span className="hidden gap-2 md:flex">
              {runButton}
              {saveButton}
            </span>
          }
        />
        <div className="grid gap-4 @[60rem]/rb:grid-cols-[360px_minmax(0,1fr)] @[60rem]/rb:items-start @[60rem]/rb:gap-6">
          <BuilderSteps cfg={cfg} onChange={setCfg} onFilters={() => setDlg("filters")} onRemoveFilter={removeFilter} />
          <BuilderPreview cfg={cfg} rows={rows} table={table} name={editing ? b(editing.name) : undefined} dirty={dirty} busy={busy} />
        </div>
      </PageContainer>
      <MobileActionBar>
        {runButton}
        {saveButton}
      </MobileActionBar>
      {dlg === "filters" && <FiltersDialog scope="builder" initial={cfg.filters} onApply={applyFilters} onOpenChange={close} />}
      {dlg === "save" && (
        <SaveReportDialog
          cfg={cfg}
          rows={rows}
          editing={editing}
          suggested={x.suggested(cfg)}
          onOpenChange={close}
          onSaved={(newId) => router.push(reportHref(newId))}
        />
      )}
    </>
  )
}
