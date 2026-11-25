"use client"

import { patientHref } from "@/modules/patients/href"
import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-media-query"
import { Link } from "@/i18n/navigation"
import { bi } from "@/lib/mock/bi"
import { Icon } from "@/components/ds/icon"
import { FilterChip, Pagination } from "@/components/ds/module-controls"
import { EmptyState } from "@/components/ds/states"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { IfCan } from "@/components/shell/permissions"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDates } from "@/i18n/dates"
import { REGIONS, filterPatients, type Patient, type Tag } from "../data"
import { usePatientsStore } from "../store"
import { FiltersPanel } from "./filters-panel"
import { PatientTags } from "./patient-badges"
import { PatientSheet } from "./patient-sheet"
import { RowActions } from "./row-actions"
import { useListQuery } from "./use-list-query"

const PAGE = 8

/**
 * Widget / Patients Table (md+) and Patients List · Compact (mobile).
 * Toolbar: search, filter chips (with counts), Filters panel. Table columns: select · patient · phone · region ·
 * tags · last visit · visits · view (side sheet) · row menu — tablet keeps patient · tags · last visit · actions.
 */
export function PatientsList() {
  const t = useTranslations("patients.list")
  const locale = useLocale()
  const format = useFormatter()
  const { patients, get } = usePatientsStore()
  const { query, page, update, activeFilters, sheetId } = useListQuery()
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [mobileCount, setMobileCount] = React.useState(PAGE)
  const [search, setSearch] = React.useState(query.q ?? "")
  const mobile = useIsMobile()

  // Debounced search → URL
  React.useEffect(() => {
    if ((query.q ?? "") === search) return
    const h = setTimeout(() => update({ q: search }), 250)
    return () => clearTimeout(h)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const withoutChip = React.useMemo(() => filterPatients(patients, { ...query, chip: "all" }, locale), [patients, query, locale])
  const rows = React.useMemo(() => filterPatients(patients, query, locale), [patients, query, locale])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pageCount)
  const pageRows = rows.slice((current - 1) * PAGE, current * PAGE)
  const chipCount = (tag: Tag | "all") => (tag === "all" ? withoutChip.length : withoutChip.filter((p) => p.tags.includes(tag)).length)
  const n = (v: number) => format.number(v, "integer")

  const allOnPage = pageRows.length > 0 && pageRows.every((p) => selected.has(p.id))
  const someOnPage = pageRows.some((p) => selected.has(p.id))
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const clearAll = () => {
    setSearch("")
    update({ q: null, chip: null, gender: null, ageFrom: null, ageTo: null, region: null, branch: null, from: null, to: null, tags: null })
  }

  const chips: { key: Tag | "all"; label: string; short?: string }[] = [
    { key: "all", label: t("chips.all") },
    { key: "vip", label: t("chips.vip") },
    { key: "banned", label: t("chips.banned") },
    { key: "incomplete", label: t("chips.incomplete") },
    { key: "duplicate", label: t("chips.duplicate"), short: t("chips.duplicateShort") },
  ]

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-2 md:w-75">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startIcon={<Icon name="search-normal-1" size={16} />}
            placeholder={mobile ? t("searchShort") : t("search")}
            aria-label={t("search")}
            className="flex-1"
          />
          {/* Mobile has no Filters button in the toolbar design; the panel exists, so it opens from here. */}
          <Button variant="outline" size="icon" className="relative md:hidden" onClick={() => setFiltersOpen(true)} aria-label={t("filters")}>
            <Icon name="filter" size={20} />
            {activeFilters > 0 && <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">{activeFilters}</span>}
          </Button>
        </div>
        {chips.map((c) => (
          <FilterChip key={c.key} selected={query.chip === c.key} count={n(chipCount(c.key))} onClick={() => update({ chip: c.key })}>
            {c.short ? (
              <>
                <span className="md:hidden">{c.short}</span>
                <span className="hidden md:inline">{c.label}</span>
              </>
            ) : (
              c.label
            )}
          </FilterChip>
        ))}
        <div className="hidden flex-1 md:block" />
        <Button variant="outline" className="hidden md:inline-flex" onClick={() => setFiltersOpen(true)}>
          <Icon name="filter" size={20} />
          {t("filters")}
          {activeFilters > 0 && <span className="inline-flex h-5 items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{activeFilters}</span>}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="search-normal-1"
          title={t("noResultsTitle")}
          description={t("noResultsText")}
          className="py-12"
          actions={
            <>
              <Button variant="outline" onClick={clearAll}>
                <Icon name="close-circle" size={20} />
                <ClearLabel />
              </Button>
              <IfCan module="patients" action="create">
                <Button asChild>
                  <Link href="/patients/new">
                    <Icon name="user-add" size={20} />
                    <AddLabel />
                  </Link>
                </Button>
              </IfCan>
            </>
          }
        />
      ) : (
        <>
          {/* md+: table */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-4">
                    <Checkbox
                      checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                      onCheckedChange={(v) => pageRows.forEach((p) => toggle(p.id, v === true))}
                      aria-label={t("selectAll")}
                    />
                  </TableHead>
                  <TableHead className="xl:w-58.5">{t("columns.patient")}</TableHead>
                  <TableHead className="hidden w-30 xl:table-cell">{t("columns.phone")}</TableHead>
                  <TableHead className="hidden w-22.5 xl:table-cell">{t("columns.region")}</TableHead>
                  <TableHead>{t("columns.tags")}</TableHead>
                  <TableHead className="w-26">{t("columns.lastVisit")}</TableHead>
                  <TableHead className="hidden w-14 xl:table-cell">{t("columns.visits")}</TableHead>
                  <TableHead className="w-18">
                    <span className="sr-only">{t("columns.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((p) => (
                  <PatientRow key={p.id} p={p} selected={selected.has(p.id)} onSelect={(on) => toggle(p.id, on)} onView={() => update({ patient: p.id })} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* mobile: cards + load more */}
          <ul className="flex flex-col md:hidden">
            {rows.slice(0, mobileCount).map((p) => (
              <PatientCard key={p.id} p={p} />
            ))}
          </ul>
          {mobileCount < rows.length && (
            <Button variant="outline" className="h-10 md:hidden" onClick={() => setMobileCount((c) => c + PAGE)}>
              {t("loadMore")}
            </Button>
          )}

          <Pagination
            className="hidden md:flex"
            page={current}
            pageCount={pageCount}
            onPage={(pg) => update({ page: pg })}
            info={<ShowingLine from={(current - 1) * PAGE + 1} to={Math.min(current * PAGE, rows.length)} total={rows.length} />}
          />
        </>
      )}

      <FiltersPanel open={filtersOpen} onOpenChange={setFiltersOpen} />
      <PatientSheet patient={sheetId ? get(sheetId) : undefined} onOpenChange={(o) => !o && update({ patient: null })} />
    </section>
  )
}

function ShowingLine({ from, to, total }: { from: number; to: number; total: number }) {
  const t = useTranslations("common.pagination")
  const format = useFormatter()
  return <>{t("showing", { from, to, total: format.number(total, "integer") })}</>
}

function ClearLabel() {
  return <>{useTranslations("common.actions")("clearFilters")}</>
}
function AddLabel() {
  return <>{useTranslations("patients")("addPatient")}</>
}

function useRowText(p: Patient) {
  const t = useTranslations("patients")
  const locale = useLocale()
  const dates = useDates()
  const sex = p.gender === "unset" ? "—" : t(p.gender === "male" ? "gender.short.male" : "gender.short.female")
  return {
    name: bi(p.name, locale),
    mrnLine: t("list.mrnLine", { mrn: p.mrn, sex, age: p.age }),
    region: bi(p.city ?? REGIONS[p.region].short, locale),
    lastVisit: p.lastVisit ? dates.short(p.lastVisit) : "—",
  }
}

function PatientRow({ p, selected, onSelect, onView }: { p: Patient; selected: boolean; onSelect: (on: boolean) => void; onView: () => void }) {
  const t = useTranslations("patients.list")
  const r = useRowText(p)
  return (
    <TableRow data-state={selected ? "selected" : undefined} className="[tbody_&]:h-15">
      <TableCell>
        <Checkbox checked={selected} onCheckedChange={(v) => onSelect(v === true)} aria-label={t("selectRow", { name: r.name })} />
      </TableCell>
      <TableCell className="min-w-48 xl:max-w-0">
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback>{p.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              <bdi dir="ltr">MRN {p.mrn}</bdi>
              {r.mrnLine.slice(r.mrnLine.indexOf(" · "))}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className={cn("hidden xl:table-cell", !p.mobile && "text-muted-foreground")}>
        <bdi dir="ltr">{p.mobile ?? "—"}</bdi>
      </TableCell>
      <TableCell className="hidden xl:table-cell">{r.region}</TableCell>
      <TableCell className="whitespace-normal">
        <PatientTags tags={p.tags} />
      </TableCell>
      <TableCell>{r.lastVisit}</TableCell>
      <TableCell className="hidden font-medium xl:table-cell">{p.visits}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onView} aria-label={t("viewPatient", { name: r.name })}>
            <Icon name="eye" size={20} />
          </Button>
          <RowActions patient={p} />
        </div>
      </TableCell>
    </TableRow>
  )
}

/** Patient card · Compact (mobile): opens the full patient page (prototype). */
function PatientCard({ p }: { p: Patient }) {
  const t = useTranslations("patients.list")
  const r = useRowText(p)
  return (
    <li className="flex items-start gap-1 border-b last:border-0">
      <Link href={patientHref(p.id)} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <Avatar>
          <AvatarFallback>{p.initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-sm font-medium">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            <bdi dir="ltr">MRN {p.mrn}</bdi>
            {r.mrnLine.slice(r.mrnLine.indexOf(" · "))} · {r.region}
          </p>
          {p.tags.length > 0 && <PatientTags tags={p.tags} />}
          <p className="text-xs text-muted-foreground">{t("lastVisitLine", { date: r.lastVisit })}</p>
        </div>
      </Link>
      <div className="pt-2.5">
        <RowActions patient={p} />
      </div>
    </li>
  )
}
