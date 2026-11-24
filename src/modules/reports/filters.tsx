"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/ds/pickers"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { useIsMobile } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CLINICS, DOCTORS, PAYERS, BRANCHES, rangeOf, type Period, type ReportFilters } from "./data"
import { useB, usePeriodText } from "./parts"
import { branchOptions } from "./server"
import { saveFilters, sessionEmail, useFilters } from "./store"

const PERIODS: Period[] = ["today", "week", "month", "custom"]
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const toDate = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/** Chip labels for a set of filters. */
function useFilterText() {
  const t = useTranslations("reports.filters")
  const b = useB()
  const p = usePeriodText()
  return {
    branch: (f: ReportFilters) => (f.branch === "all" ? t("allBranches") : b(BRANCHES.find((x) => x.id === f.branch)?.name ?? { en: f.branch, ar: f.branch })),
    branchShort: (f: ReportFilters) => (f.branch === "all" ? t("allBranches") : b(BRANCHES.find((x) => x.id === f.branch)?.short ?? { en: f.branch, ar: f.branch })),
    clinic: (f: ReportFilters) => (f.clinic === "all" ? t("allClinics") : b(CLINICS.find((x) => x.id === f.clinic)?.name ?? { en: f.clinic, ar: f.clinic })),
    range: p.range,
    compare: p.compare,
  }
}

function Chip({ icon, children, onClick, active, label }: { icon: IconName; children: React.ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-2 rounded-md border px-2.5 text-xs text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active ? "bg-muted" : "bg-card"
      )}
    >
      <Icon name={icon} size={16} className="shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
      <Icon name="arrow-down" size={14} className="shrink-0 text-muted-foreground" />
    </button>
  )
}

/**
 * Widget / Rep Filters: date range · compare to the period before · branch · clinic, and More filters at the end;
 * every chip opens the Filters dialog. Compact (mobile, tablet): the chips wrap and More filters goes under them.
 * `scope` keeps each page's filters apart (a dashboard and a saved report don't share them).
 */
export function FiltersBar({ scope, className }: { scope: string; className?: string }) {
  const t = useTranslations("reports.filters")
  const f = useFilters(scope)
  const x = useFilterText()
  const [open, setOpen] = React.useState(false)
  const extra = (f.doctor !== "all" ? 1 : 0) + (f.payer !== "all" ? 1 : 0)
  const show = () => setOpen(true)
  return (
    <section aria-label={t("label")} className={cn("@container/fb rounded-xl border bg-card p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip icon="calendar-2" onClick={show} active label={t("chipPeriod", { value: x.range(f) })}>
          <bdi>{x.range(f)}</bdi>
        </Chip>
        <Chip icon="arrow-swap-horizontal" onClick={show} label={t("chipCompare", { value: x.compare(f) })}>
          {x.compare(f)}
        </Chip>
        <Chip icon="hospital" onClick={show} label={t("chipBranch", { value: x.branch(f) })}>
          {x.branch(f)}
        </Chip>
        <Chip icon="category" onClick={show} label={t("chipClinic", { value: x.clinic(f) })}>
          {x.clinic(f)}
        </Chip>
        <button
          type="button"
          onClick={show}
          className="inline-flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 @3xl/fb:ms-auto @3xl/fb:w-auto"
        >
          <Icon name="setting-4" size={20} />
          {t("more")}
          {extra > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs text-accent-foreground tabular-nums">{extra}</span>}
        </button>
      </div>
      {open && <FiltersDialog scope={scope} onOpenChange={setOpen} />}
    </section>
  )
}

/**
 * Overlay · Filters (More filters, any filter chip, Add filter in the builder). Period (Today / This week / This month /
 * Custom; mobile drops Today, as drawn), from–to, compare with the period before, branch (only the branches the
 * server says this user may see), clinic, doctor, payer. Apply → filters-applied. `onApply` replaces saving (the
 * builder uses the same dialog for its own filter rows).
 */
export function FiltersDialog({
  scope,
  onOpenChange,
  onApply,
  initial,
}: {
  scope: string
  onOpenChange: (open: boolean) => void
  onApply?: (f: ReportFilters) => void
  initial?: Partial<ReportFilters> & { tried?: boolean }
}) {
  const t = useTranslations("reports.filters")
  const b = useB()
  const x = useFilterText()
  const mobile = useIsMobile()
  const current = useFilters(scope)
  const [f, setF] = React.useState<ReportFilters>({ ...current, ...initial })
  const set = (p: Partial<ReportFilters>) => setF((v) => ({ ...v, ...p }))
  const branches = branchOptions(sessionEmail())
  const periods = mobile ? PERIODS.filter((p) => p !== "today") : PERIODS
  const bad = f.from > f.to
  const id = React.useId()

  const pickPeriod = (p: Period) => set(p === "custom" ? { period: p } : { period: p, ...rangeOf(p) })
  const apply = () => {
    if (bad) return
    if (onApply) onApply(f)
    else saveFilters(scope, f)
    onOpenChange(false)
    const parts = [x.range(f).replace(/\s\d{4}$/, ""), x.branchShort(f)]
    if (f.compare) parts.push(x.compare(f))
    toast.success(t("toast"), { description: parts.join(" · ") })
  }

  const select = (label: string, value: string, onChange: (v: string) => void, all: string, options: { id: string; name: { en: string; ar: string } }[]) => (
    <Field label={label}>
      {(fp) => (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger {...fp} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{all}</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {b(o.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="filter"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={apply} disabled={bad}>
          {t("apply")}
        </Button>
      }
    >
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-p`} className="text-xs font-medium text-foreground">
          {t("period")}
        </span>
        <Segmented value={f.period} onValueChange={pickPeriod} aria-labelledby={`${id}-p`} options={periods.map((p) => ({ value: p, label: t(`periods.${p}`) }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("from")}>
          {(fp) => <DatePicker {...fp} value={toDate(f.from)} onChange={(d) => d && set({ from: isoDay(d), period: "custom" })} placeholder={t("pickDate")} />}
        </Field>
        <Field label={t("to")} error={bad ? t("toError") : undefined}>
          {(fp) => <DatePicker {...fp} value={toDate(f.to)} onChange={(d) => d && set({ to: isoDay(d), period: "custom" })} placeholder={t("pickDate")} aria-invalid={bad} />}
        </Field>
      </div>
      <label htmlFor={`${id}-c`} className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={`${id}-c`} checked={f.compare} onCheckedChange={(v) => set({ compare: v === true })} />
        {t("compareLabel")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {select(t("branch"), f.branch, (v) => set({ branch: v }), t("allMyBranches"), branches)}
        {select(t("clinic"), f.clinic, (v) => set({ clinic: v }), t("allClinics"), CLINICS)}
        {select(t("doctor"), f.doctor, (v) => set({ doctor: v }), t("allDoctors"), DOCTORS)}
        {select(t("payer"), f.payer, (v) => set({ payer: v }), t("allPayers"), PAYERS)}
      </div>
    </ResponsiveDialog>
  )
}
