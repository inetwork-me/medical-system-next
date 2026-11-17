"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { PCard } from "../profile/side"
import { useText } from "../profile/use-patient"
import { dentalSummary, patientShare, type DentalRecord } from "./data"
import { INS_TONE, useSarFn } from "./dental-tab"

/**
 * Widget / Treatment Plan · Wide: Tooth (+ phase) · Procedure (+ CDT) · Fee · Insurance (covers % + status) ·
 * Patient pays · Status, rows of the selected tooth tinted, then the Total / Insurance pays / Patient pays bar.
 * Rows select their tooth; "Add treatment" is handed in by the screen.
 */
export function PlanTable({
  rec,
  selected,
  onSelect,
  onAdd,
  className,
}: {
  rec: DentalRecord
  selected?: number | null
  onSelect?: (fdi: number) => void
  onAdd?: () => void
  className?: string
}) {
  const t = useTranslations("specialties.dental.plan")
  const { b } = useText()
  const sar = useSarFn()
  const s = dentalSummary(rec)
  return (
    <PCard
      title={t("title")}
      description={t("description", { planned: s.planned, done: s.doneToday, payer: b(rec.insurance.payerShort), cls: rec.insurance.className })}
      className={className}
      action={
        onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Icon name="add" size={16} />
            {t("add")}
          </Button>
        )
      }
    >
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr className="h-10 *:px-4 *:text-start *:font-medium">
              <th className="w-[130px]">{t("col.tooth")}</th>
              <th>{t("col.procedure")}</th>
              <th className="w-[100px]">{t("col.fee")}</th>
              <th className="w-[190px]">{t("col.insurance")}</th>
              <th className="w-[110px]">{t("col.pays")}</th>
              <th className="w-[100px]">{t("col.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rec.plan.map((i) => {
              const on = selected != null && i.teeth.includes(selected)
              return (
                <tr
                  key={i.id}
                  onClick={onSelect ? () => onSelect(i.teeth[0]) : undefined}
                  className={cn("border-t *:px-4 *:py-3", on && "bg-accent", onSelect && "cursor-pointer hover:bg-muted/60", on && onSelect && "hover:bg-accent")}
                >
                  <td>
                    <span className="flex flex-col gap-0.5">
                      {onSelect ? (
                        <button
                          type="button"
                          dir="ltr"
                          className="w-fit text-start font-medium whitespace-nowrap tabular-nums outline-none focus-visible:underline"
                          aria-label={t("selectTooth", { n: i.teeth.join(", ") })}
                        >
                          {i.teeth.join(" · ")}
                        </button>
                      ) : (
                        <span dir="ltr" className="w-fit font-medium whitespace-nowrap tabular-nums">
                          {i.teeth.join(" · ")}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{t(`phase.${i.phase}`)}</span>
                    </span>
                  </td>
                  <td>
                    <span className="flex flex-col gap-0.5">
                      <span>{b(i.procedure)}</span>
                      <span dir="ltr" className="w-fit text-xs text-muted-foreground">
                        {i.cdt}
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{sar(i.fee)}</td>
                  <td>
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">{t("covers", { pct: i.coveragePct })}</span>
                      <StatusBadge tone={INS_TONE[i.insuranceStatus]}>{t(`ins.${i.insuranceStatus}`)}</StatusBadge>
                    </span>
                  </td>
                  <td className="font-medium whitespace-nowrap tabular-nums">{sar(patientShare(i))}</td>
                  <td>
                    <StatusBadge tone={i.status === "done" ? "success" : "warning"}>{t(`status.${i.status}`)}</StatusBadge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <dl className="grid grid-cols-3 gap-6 rounded-[10px] bg-muted px-4 py-3">
        {(
          [
            ["total", s.fees, false],
            ["insurancePays", s.insurancePays, false],
            ["patientPays", s.patientPays, true],
          ] as const
        ).map(([k, v, strong]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{t(`totals.${k}`)}</dt>
            <dd className={cn("text-base font-semibold tabular-nums", strong ? "text-primary" : "text-foreground")}>{sar(v)}</dd>
          </div>
        ))}
      </dl>
    </PCard>
  )
}
