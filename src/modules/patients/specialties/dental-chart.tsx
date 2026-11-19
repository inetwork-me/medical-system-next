"use client"

import { usePatientId } from "@/modules/patients/href"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { useIsMobile } from "@/hooks/use-media-query"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PCard } from "../profile/side"
import { useText } from "../profile/use-patient"
import type { Dentition } from "./data"
import { DentalActions } from "./dental-actions"
import { startDentalChart, useDentalRecord, useSelectedTooth } from "./dental-store"
import { PlanTable } from "./plan"
import { DentalChartView, DentalLegend, type Layer } from "./tooth"
import { ToothPanel } from "./tooth-panel"
import { Workspace } from "./workspace"

/**
 * Patients · Dental chart (1440 / 768). Desktop: toolbar (layers · dentition · History), full chart + legend, wide treatment
 * plan, Tooth Panel on the side. Tablet: mode tabs, layers, tablet-size chart, Tooth Panel below. Phones: view-only.
 * One selection drives the chart, the plan rows and the panel (shared with the 3D view).
 */
export function DentalChartWorkspace() {
  const sp = useSearchParams()
  const toothParam = Number(sp.get("tooth"))
  const initialTooth = Number.isFinite(toothParam) && toothParam > 0 ? toothParam : undefined
  const t = useTranslations("specialties.chartWs")
  const id = usePatientId()
  const rec = useDentalRecord(id)
  const [selected, setSelected] = useSelectedTooth(id, initialTooth)
  const [layer, setLayer] = React.useState<Layer>("all")
  const [dentition, setDentition] = React.useState<Dentition>("permanent")
  const [history, setHistory] = React.useState(false)
  const mobile = useIsMobile()
  // A patient's first dental visit: opening the chart on a tablet / computer starts a blank chart.
  React.useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) startDentalChart(id)
  }, [id])

  const addTreatment = () => {
    if (selected == null) {
      toast.info(t("pickTooth"), { description: t("pickToothText") })
      return
    }
    const el = document.getElementById(`treatment-${selected}`)
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
    el?.focus()
  }

  return (
    <Workspace kind="dental" mode="chart" actions={rec && <DentalActions />}>
      {!rec ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="health" title={t("emptyTitle")} description={t("emptyText")} className="py-16" />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4" data-print-area>
            {mobile && (
              <p className="flex items-center gap-2 rounded-[10px] bg-info-soft px-3 py-2 text-xs text-info-soft-foreground">
                <Icon name="info-circle" size={16} className="shrink-0" />
                {t("viewOnly")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Seg
                label={t("layers.label")}
                value={layer}
                onChange={setLayer}
                options={(["all", "existing", "planned", "done"] as const).map((k) => ({ value: k, label: t(`layers.${k}`) }))}
                className="max-xl:w-full max-xl:*:flex-1"
              />
              <Seg
                label={t("dentition.label")}
                value={dentition}
                onChange={setDentition}
                options={(["permanent", "mixed", "baby"] as const).map((k) => ({ value: k, label: t(`dentition.${k}`) }))}
                className="max-xl:hidden"
              />
              <Button variant="ghost" onClick={() => setHistory(true)} className="ms-auto max-xl:hidden">
                <Icon name="clock" size={20} />
                {t("history")}
              </Button>
            </div>
            <PCard
              title={t("chartTitle")}
              description={
                <bdi>
                  <span className="max-xl:hidden">{t("chartHint")}</span>
                  <span className="xl:hidden">{t("chartHintShort", { dentition: t(`dentition.${dentition}Teeth`) })}</span>
                </bdi>
              }
              className="max-md:p-4 md:p-4 xl:p-6"
            >
              <ChartSizes chart={rec.chart} selected={selected} onSelect={setSelected} dentition={dentition} layer={layer} />
              <DentalLegend />
            </PCard>
            <PlanTable rec={rec} selected={selected} onSelect={setSelected} onAdd={mobile ? undefined : addTreatment} className="max-xl:hidden" />
          </div>
          <ToothPanel
            id={id}
            rec={rec}
            fdi={selected}
            onClose={() => setSelected(null)}
            readOnly={mobile}
            className="xl:sticky xl:top-20 xl:max-h-[calc(100svh-6rem)] xl:overflow-y-auto"
          />
        </div>
      )}
      {rec && <HistorySheet open={history} onOpenChange={setHistory} rec={rec} />}
    </Workspace>
  )
}

/** Full chart on wide cards, the tablet size from 41.5rem, four compact rows on phones (by the card's own width). */
function ChartSizes(props: Omit<React.ComponentProps<typeof DentalChartView>, "size" | "className">) {
  return (
    <>
      <DentalChartView {...props} size="full" className="hidden @min-[54rem]/widget:flex" />
      <DentalChartView {...props} size="tablet" className="hidden @min-[41.5rem]/widget:flex @min-[54rem]/widget:hidden" />
      <DentalChartView {...props} size="compact" className="@min-[41.5rem]/widget:hidden" />
    </>
  )
}

function Seg<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-0.5 rounded-lg bg-muted p-[3px]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className="h-8 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-xs"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Chart history (toolbar "History"): the dental visits that changed the chart. */
function HistorySheet({ open, onOpenChange, rec }: { open: boolean; onOpenChange: (v: boolean) => void; rec: NonNullable<ReturnType<typeof useDentalRecord>> }) {
  const t = useTranslations("specialties.dental.history")
  const { b } = useText()
  const dates = useDates()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>
            {rec.history.length ? t("description", { count: rec.history.length, since: dates.monthYear(rec.history[rec.history.length - 1].date) }) : t("none")}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <ul>
            {rec.history.map((v) => (
              <li key={v.date + v.title.en} className="flex items-center gap-3 border-b py-3 last:border-0">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{b(v.title)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {dates.short(v.date)} · {b(v.doctor)}
                  </span>
                </div>
                <StatusBadge tone="success">{t("done")}</StatusBadge>
              </li>
            ))}
          </ul>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
