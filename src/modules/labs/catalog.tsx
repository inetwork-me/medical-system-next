"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { CATALOG_TOTALS, PANEL_TESTS, TUBES, type Section, type TestDef } from "./data"
import { LabFrame } from "./frame"
import { AddTestDialog } from "./add-test"
import { Latin, TubeDot, TubeLabel } from "./parts"
import { labCan } from "./roles"
import { LabCard } from "./samples"
import { setTestActive, useCatalog, useLabRole } from "./store"
import { useLabText } from "./text"

type Filter = "all" | "chemistry" | "hematology" | "hormones" | "microbiology" | "panels"
const FILTERS: Filter[] = ["all", "chemistry", "hematology", "hormones", "microbiology", "panels"]
/** Compact keeps the first four (design). */
const FILTERS_COMPACT: Filter[] = ["all", "chemistry", "hematology", "hormones"]
const matchesFilter = (x: TestDef, f: Filter) => f === "all" || (f === "panels" ? PANEL_TESTS.includes(x.key) : x.section === (f as Section))

/** The catalog rows: the designed tests with a catalog price, and the tests added with Add test (the order-only placeholders aren't priced yet). */
const listed = (x: TestDef) => x.price > 0 || !!x.custom

export function useCatalogText() {
  const t = useTranslations("labs.catalog")
  const ts = useTranslations("labs.section")
  return {
    tat: (h: number) => (h >= 24 ? t("tatD", { n: Math.round(h / 24) }) : t("tatH", { n: h })),
    price: (n: number) => (n ? t("price", { n }) : t("noPrice")),
    section: (s: Section) => ts(s),
  }
}

/**
 * Widget / Lab Test Catalog: search (name or code), section filter (All · Chemistry · Hematology · Hormones ·
 * Microbiology · Panels), then a table Code · Test · Section · Tube · TAT · Price (SAR, before VAT) · Active switch —
 * or compact rows (tube dot, name, "code · section · TAT · price", switch). Add test isn't designed yet (coming soon).
 * Wide from an 896px container.
 */
export function TestCatalog() {
  const t = useTranslations("labs.catalog")
  const { b } = useLabText()
  const fmt = useCatalogText()
  const role = useLabRole()
  const [adding, setAdding] = React.useState(false)
  const all = useCatalog().filter(listed)
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const q = query.trim().toLowerCase()
  const rows = all.filter((x) => matchesFilter(x, filter) && (!q || x.code.includes(q) || x.name.en.toLowerCase().includes(q) || x.name.ar.includes(query.trim())))
  const canEdit = labCan(role, "catalog")

  const toggle = (x: TestDef, on: boolean) => {
    setTestActive(x.key, on)
    toast.success(t(on ? "on" : "off", { test: b(x.name) }), { description: t(on ? "onText" : "offText") })
  }
  const sw = (x: TestDef) => <Switch checked={x.active} onCheckedChange={(v) => toggle(x, v)} disabled={!canEdit} aria-label={t("activeLabel", { test: b(x.name) })} />
  const th = "h-10 px-1.5 text-start text-xs font-medium text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"

  return (
    <LabCard
      title={t("title")}
      text={t("text", CATALOG_TOTALS)}
      action={
        canEdit && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Icon name="add" size={24} />
            {t("add")}
          </Button>
        )
      }
      className="@container/cat"
    >
      <div className="flex flex-col gap-2 @4xl/cat:flex-row @4xl/cat:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/cat:w-70"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden *:h-6 @4xl/cat:ms-auto @4xl/cat:flex"
          options={FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "all"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 @4xl/cat:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: t(`filter.${f}`) }))}
        />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-sm font-medium">{t("empty")}</span>
          <span className="text-xs text-muted-foreground">{t("emptyText")}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("")
              setFilter("all")
            }}
          >
            {t("clear")}
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border @4xl/cat:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[92px]" />
                <col />
                <col className="w-[162px]" />
                <col className="w-[172px]" />
                <col className="w-[102px]" />
                <col className="w-[102px]" />
                <col className="w-[92px]" />
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  {(["code", "test", "section", "tube", "tat", "price", "active"] as const).map((k) => (
                    <th key={k} className={th}>
                      {t(`col.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.key} className="border-t">
                    <td className={cn(td, "text-muted-foreground")}>
                      <Latin>{x.code}</Latin>
                    </td>
                    <td className={cn(td, "font-medium")}>{b(x.name)}</td>
                    <td className={cn(td, "text-muted-foreground")}>{fmt.section(x.section)}</td>
                    <td className={td}>
                      <TubeLabel tube={x.tube} full />
                    </td>
                    <td className={td}>{fmt.tat(x.tatH)}</td>
                    <td className={cn(td, "tabular-nums")}>{fmt.price(x.price)}</td>
                    <td className={td}>{sw(x)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col @4xl/cat:hidden">
            {rows.map((x) => (
              <li key={x.key} className="flex items-center gap-2.5 border-b py-2.5 last:border-b-0">
                <TubeDot tube={x.tube} size={14} />
                <span className="sr-only">{b(TUBES[x.tube].name)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{b(x.name)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("line", { code: x.code, section: fmt.section(x.section), tat: fmt.tat(x.tatH), price: fmt.price(x.price) })}
                  </span>
                </div>
                {sw(x)}
              </li>
            ))}
          </ul>
        </>
      )}
      {adding && <AddTestDialog open onOpenChange={setAdding} />}
    </LabCard>
  )
}

/** Lab · Test catalog (module tab): Export; the catalog. */
export function CatalogPage() {
  const t = useTranslations("labs.catalog")
  const tn = useTranslations("shell.nav")
  const { b, ar } = useLabText()
  const fmt = useCatalogText()
  const all = useCatalog().filter(listed)
  const exportList = () => {
    const file = `lab-test-catalog-${stamp()}.xlsx`
    const head = (["code", "test", "section", "tube", "tat", "price", "active"] as const).map((k) => t(`col.${k}`))
    const body = all.map((x) => [x.code, b(x.name), fmt.section(x.section), b(TUBES[x.tube].full), fmt.tat(x.tatH), String(x.price), x.active ? "✓" : "—"])
    saveBlob(xlsxBlob(head, body, { sheet: t("title"), rtl: ar }), file)
    toast.success(t("exported"), { description: file })
  }
  return (
    <LabFrame
      actions={
        <Button variant="outline" onClick={exportList}>
          <Icon name="export" size={24} />
          {t("export")}
        </Button>
      }
    >
      <PageTitle title={t("title")} crumbs={[{ label: tn("lab"), href: "/lab" }]} />
      <TestCatalog />
    </LabFrame>
  )
}
