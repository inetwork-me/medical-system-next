"use client"


import { asset } from "@/lib/static"
import * as React from "react"
import Image from "next/image"
import { useFormatter, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { PCard } from "../profile/side"
import { usePatient, useText } from "../profile/use-patient"
import { dentalSummary, patientShare, specialtyHref, type DentalRecord, type InsuranceStatus, type PlanItem } from "./data"
import { useDentalRecord } from "./dental-store"
import { DentalChartView, DentalLegend } from "./tooth"

/**
 * Patients · Patient page · Dental (Widget / Patient Tab · Dental, Wide | Compact): 4 tiles, the dental chart (Mini on
 * desktop, Compact on tablet / mobile) + legend, treatment plan (+ the 3D mouth card on desktop) and the dental history.
 * Mobile is view-only: Open dental chart and Add treatment are hidden; 3D view stays (view-only there too).
 */
export function DentalTab() {
  const t = useTranslations("specialties.dental")
  const data = usePatient()
  const rec = useDentalRecord(data?.patient.id ?? "")
  if (!data) return null
  const id = data.patient.id
  if (!rec)
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon="health"
          title={t("empty.title")}
          description={t("empty.text")}
          className="py-16"
          actions={
            <Button asChild className="max-md:hidden">
              <Link href={specialtyHref.dentalChart(id)}>{t("empty.start")}</Link>
            </Button>
          }
        />
      </div>
    )
  return (
    <>
      <Tiles rec={rec} />
      <PCard title={t("chart.title")} description={<bdi>{t("chart.description")}</bdi>} className="max-md:p-4">
        <DentalChartView chart={rec.chart} size="mini" className="hidden @min-[45rem]/tab:flex" />
        <DentalChartView chart={rec.chart} size="compact" className="@min-[45rem]/tab:hidden" />
        <DentalLegend />
        <div className="flex gap-2 *:flex-1 @min-[45rem]/tab:justify-end @min-[45rem]/tab:*:flex-none">
          <Button variant="outline" asChild>
            <Link href={specialtyHref.dental3d(id)}>
              <Icon name="3dcube" size={20} />
              {t("chart.view3d")}
            </Link>
          </Button>
          <Button asChild className="max-md:hidden">
            <Link href={specialtyHref.dentalChart(id, rec.chart.selected)}>
              {t("chart.open")}
              <Icon name="arrow-right-1" size={20} />
            </Link>
          </Button>
        </div>
      </PCard>
      <div className="grid items-start gap-4 @min-[45rem]/tab:grid-cols-[minmax(0,1fr)_300px] @min-[45rem]/tab:gap-6">
        <PlanCompact rec={rec} addHref={specialtyHref.dentalPlan(id)} />
        <Mouth3dCard id={id} className="hidden @min-[45rem]/tab:flex" />
      </div>
      <DentalHistory rec={rec} />
    </>
  )
}

/* ---------------------------------------------------------------- tiles */

function Tiles({ rec }: { rec: DentalRecord }) {
  const t = useTranslations("specialties.dental.tiles")
  const format = useFormatter()
  const n = (v: number) => format.number(v, "integer")
  const sar = useSarFn()
  const s = dentalSummary(rec)
  const pa = rec.preApproval
  const tiles: { icon: IconName; label: string; value: string; caption: string; tone?: string }[] = [
    { icon: "health", label: t("teeth"), value: n(s.teeth), caption: t("teethCaption", { unerupted: s.unerupted, missing: s.missing }) },
    { icon: "clipboard-text", label: t("planned"), value: n(s.planned), caption: t("plannedCaption", { amount: n(s.plannedFees) }) },
    ...(pa
      ? [
          {
            icon: "shield-tick" as IconName,
            label: t("preApproval"),
            value: t(pa.status),
            caption: t(pa.steps.find((x) => x.key === "sent")?.at ? "preApprovalCaption" : "preApprovalReady", { tooth: pa.teeth.join(", ") }),
            tone: pa.status === "pending" ? "text-warning-soft-foreground" : pa.status === "approved" ? "text-success-soft-foreground" : "text-destructive",
          },
        ]
      : []),
    { icon: "wallet-money", label: t("patientPays"), value: sar(s.patientPays), caption: t("patientPaysCaption") },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 @min-[45rem]/tab:grid-cols-4">
      {tiles.map((x) => (
        <div key={x.label} className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-4">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name={x.icon} size={18} className="shrink-0" />
            <span className="truncate">{x.label}</span>
          </span>
          <span className={cn("text-xl font-semibold tracking-tight tabular-nums", x.tone ?? "text-foreground")}>
            <bdi>{x.value}</bdi>
          </span>
          <span className="text-xs text-muted-foreground">{x.caption}</span>
        </div>
      ))}
    </div>
  )
}

/** "SAR 1,590" / "1,590 ر.س". */
export function useSarFn() {
  const t = useTranslations("specialties")
  const format = useFormatter()
  return (v: number) => t("sar", { amount: format.number(v, "integer") })
}

/* ---------------------------------------------------------------- treatment plan (compact) */

export const INS_TONE: Record<InsuranceStatus, StatusTone> = { pending: "warning", covered: "success", claimSent: "info", selfPay: "neutral" }

export function PlanCompact({ rec, addHref, className }: { rec: DentalRecord; addHref: string; className?: string }) {
  const t = useTranslations("specialties.dental.plan")
  const { b } = useText()
  const sar = useSarFn()
  const s = dentalSummary(rec)
  return (
    <PCard
      title={t("title")}
      description={
        rec.insurance.insured
          ? t("description", { planned: s.planned, done: s.doneToday, payer: b(rec.insurance.payerShort), cls: rec.insurance.className })
          : t("descriptionSelf", { planned: s.planned, done: s.doneToday })
      }
      className={cn("max-md:p-4", className)}
      action={
        <Button variant="ghost" size="sm" asChild className="max-md:hidden">
          <Link href={addHref}>
            <Icon name="add" size={16} />
            {t("add")}
          </Link>
        </Button>
      }
    >
      {!rec.plan.length && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
      <ul>
        {rec.plan.map((i: PlanItem) => {
          const sel = i.teeth.includes(rec.chart.selected)
          return (
            <li key={i.id} className="flex items-start gap-3 border-b py-3 last:border-0">
              <span
                dir="ltr"
                className={cn(
                  "flex h-8 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-medium tabular-nums",
                  sel ? "bg-accent text-primary" : "bg-muted text-foreground",
                )}
                title={i.teeth.join(" · ")}
              >
                {i.teeth.length > 1 ? `×${i.teeth.length}` : i.teeth[0]}
              </span>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
                <span className="text-sm font-medium">{b(i.procedure)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  <bdi dir="ltr">{i.cdt}</bdi> · {sar(i.fee)}
                </span>
                <StatusBadge tone={INS_TONE[i.insuranceStatus]}>{t(`ins.${i.insuranceStatus}`)}</StatusBadge>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-end">
                <span className="text-sm font-medium tabular-nums">{sar(patientShare(i))}</span>
                <span className="text-xs text-muted-foreground">{t("patient")}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </PCard>
  )
}

/* ---------------------------------------------------------------- 3D card */

function Mouth3dCard({ id, className }: { id: string; className?: string }) {
  const t = useTranslations("specialties.dental.card3d")
  return (
    <section className={cn("flex-col overflow-hidden rounded-xl border bg-card", className)}>
      <div className="relative h-[200px] bg-slate-900">
        <Image src={asset("/specialties/dent_card.png")} alt={t("alt")} fill sizes="300px" className="object-cover" />
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("text")}</p>
        <Button variant="outline" asChild className="w-full">
          <Link href={specialtyHref.dental3d(id)}>
            <Icon name="3dcube" size={20} />
            {t("open")}
          </Link>
        </Button>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- history */

function DentalHistory({ rec }: { rec: DentalRecord }) {
  const t = useTranslations("specialties.dental.history")
  const { b } = useText()
  const dates = useDates()
  const h = rec.history
  return (
    <PCard
      title={t("title")}
      description={h.length ? t("description", { count: h.length, since: dates.monthYear(h[h.length - 1].date) }) : t("none")}
      className="max-md:p-4"
    >
      <ul>
        {h.map((v) => (
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
    </PCard>
  )
}
