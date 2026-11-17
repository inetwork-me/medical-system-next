"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { PCard } from "../profile/side"
import { useText } from "../profile/use-patient"
import { GUM_LOWER, GUM_UPPER, gumSummary, type DentalRecord } from "./data"
import { DentalActions, printOnly } from "./dental-actions"
import { useDentalRecord, useSelectedTooth } from "./dental-store"
import { Workspace } from "./workspace"

/** Patients · Dental · Gum chart (1440 / 768): gum chart (Wide | Compact) + Gum health (side on desktop, below on tablet). */
export function GumsWorkspace() {
  const t = useTranslations("specialties.chartWs")
  const { id } = useParams<{ id: string }>()
  const rec = useDentalRecord(id)
  const [selected, setSelected] = useSelectedTooth(id)
  return (
    <Workspace kind="dental" mode="gums" actions={rec && <DentalActions />}>
      {!rec ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="health" title={t("emptyTitle")} description={t("emptyText")} className="py-16" />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0" data-print-area>
            <GumChart rec={rec} selected={selected} onSelect={setSelected} />
          </div>
          <GumHealthCard rec={rec} className="xl:sticky xl:top-20" />
        </div>
      )}
    </Workspace>
  )
}

/**
 * Widget / Gum Chart: summary tiles + upper / lower tables (Tooth · Depth ×3 · Bleeding ×3 · Recession · Mobility).
 * Tooth columns are anatomical (patient's right first) in both languages; in Arabic only the label column moves to the right.
 * Columns are 56px when the card is wide, 38px otherwise (tablet).
 */
export function GumChart({ rec, selected, onSelect }: { rec: DentalRecord; selected: number | null; onSelect?: (fdi: number) => void }) {
  const t = useTranslations("specialties.gums")
  const { locale } = useText()
  const format = useFormatter()
  const s = gumSummary(rec.gums)
  const mm = (v: number) => t("mm", { v: format.number(v, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) })
  const tiles: [string, string, string?][] = [
    [t("avgDepth"), mm(s.avgDepth)],
    [t("deep"), String(s.deep), s.deep ? "text-warning-soft-foreground" : undefined],
    [t("bleeding"), `${s.bleedingPct}%`, s.bleedingPct ? "text-destructive" : undefined],
    [t("plaque"), `${rec.gumHealth.plaquePct}%`],
  ]
  const ar = locale === "ar"
  return (
    <PCard title={t("title")} description={t("description")} className="min-w-0 max-md:p-4">
      <dl className="grid grid-cols-2 gap-3 @min-[40rem]/widget:grid-cols-4">
        {tiles.map(([k, v, tone]) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-[10px] bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={cn("text-base font-semibold tabular-nums", tone ?? "text-foreground")}>
              <bdi>{v}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      {(
        [
          ["upper", GUM_UPPER],
          ["lower", GUM_LOWER],
        ] as const
      ).map(([arch, teeth]) => (
        <div key={arch} className="overflow-x-auto rounded-[10px] border">
          <table dir="ltr" className="w-full min-w-max border-collapse text-xs">
            <tbody>
              {(["tooth", "depth", "bleeding", "recession", "mobility"] as const).map((row) => {
                const label = (
                  <th
                    scope="row"
                    className={cn(
                      "px-3 font-normal whitespace-nowrap text-muted-foreground",
                      ar ? "text-right" : "text-left",
                      row === "tooth" && "font-medium",
                    )}
                  >
                    {row === "tooth" ? t(arch) : t(`row.${row}`)}
                  </th>
                )
                const cells = teeth.map((fdi) => {
                  const g = rec.gums[fdi]
                  const on = fdi === selected
                  const cls = cn("w-[38px] p-0 text-center @min-[56rem]/widget:w-14", on && row !== "tooth" && "bg-accent")
                  if (row === "tooth")
                    return (
                      <th key={fdi} scope="col" className={cn(cls, "font-medium tabular-nums", !g ? "text-muted-foreground" : on ? "text-primary" : "text-foreground")}>
                        {onSelect && g ? (
                          <button type="button" onClick={() => onSelect(fdi)} className="h-8 w-full rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            {fdi}
                          </button>
                        ) : (
                          fdi
                        )}
                      </th>
                    )
                  if (!g)
                    return (
                      <td key={fdi} className={cls}>
                        <span className="text-muted-foreground">—</span>
                      </td>
                    )
                  return (
                    <td key={fdi} className={cls}>
                      {row === "depth" ? (
                        <span className="flex justify-center gap-px @min-[56rem]/widget:gap-0.5">
                          {g.depth.map((d, k) => (
                            <span
                              key={k}
                              className={cn(
                                "flex h-5 w-[11px] items-center justify-center rounded-sm tabular-nums @min-[56rem]/widget:w-[15px]",
                                d >= 4 ? "bg-warning-soft text-warning-soft-foreground" : "text-foreground",
                              )}
                            >
                              {d}
                            </span>
                          ))}
                        </span>
                      ) : row === "bleeding" ? (
                        <span className="flex justify-center gap-0.5" aria-label={t("bleedSites", { n: g.bleeding.filter(Boolean).length })}>
                          {g.bleeding.map((b, k) => (
                            <span key={k} aria-hidden className={cn("size-[7px] rounded-full", b ? "bg-destructive" : "bg-muted")} />
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground tabular-nums">{row === "recession" ? g.recession : g.mobility}</span>
                      )}
                    </td>
                  )
                })
                return (
                  <tr key={row} className={cn("h-[34px] border-b last:border-0", row === "tooth" && "h-8 bg-muted")}>
                    {ar ? (
                      <>
                        {cells}
                        {label}
                      </>
                    ) : (
                      <>
                        {label}
                        {cells}
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </PCard>
  )
}

/** Gum health: risk, next cleaning, what to watch, home-care advice, Print advice for the patient. */
export function GumHealthCard({ rec, className }: { rec: DentalRecord; className?: string }) {
  const t = useTranslations("specialties.gums.health")
  const { b } = useText()
  const dates = useDates()
  const ref = React.useRef<HTMLElement>(null)
  const h = rec.gumHealth
  const months = Math.round((Date.parse(h.nextCleaning) - Date.parse("2026-11-17")) / (30.44 * 86400000))
  const rows: [string, string][] = [
    [t("next"), `${dates.monthYear(h.nextCleaning)} · ${t("inMonths", { n: months })}`],
    ...(h.watch ? [[t("watch"), b(h.watch)] as [string, string]] : []),
  ]
  return (
    <section ref={ref} className={cn("min-w-0", className)}>
      <PCard title={t("title")} description={t("description")}>
        <StatusBadge tone={h.risk === "low" ? "success" : h.risk === "moderate" ? "warning" : "destructive"}>{t(`risk.${h.risk}`)}</StatusBadge>
        <dl>
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start gap-3 border-b py-2.5 last:border-0">
              <dt className="w-[100px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
              <dd className="min-w-0 flex-1 text-sm font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium">{t("homeCare")}</span>
          <ul className="flex flex-wrap gap-1.5">
            {h.advice.map((a) => (
              <li key={a.en} className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                {b(a)}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="outline" className="w-full print:hidden" onClick={() => printOnly(ref.current)}>
          <Icon name="printer" size={20} />
          {t("print")}
        </Button>
      </PCard>
    </section>
  )
}
