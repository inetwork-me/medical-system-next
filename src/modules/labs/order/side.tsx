"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isModuleEnabled } from "@/lib/modules"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { patientHref } from "@/modules/patients/href"
import { PREVIOUS_ORDERS, type LabOrder } from "../data"
import { Latin } from "../parts"
import { LabCard } from "../samples"
import { useLabText } from "../text"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-3 border-b py-3.5 first:pt-0 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

/**
 * Widget / Lab Order Side: Clinical details (diagnosis with ICD-10, fasting, medicines, allergies, payer, the doctor's
 * note) and Previous orders (last 12 months; All → the patient file).
 */
export function OrderSide({ order: o }: { order: LabOrder }) {
  const t = useTranslations("labs.order.side")
  const { b, doctorName } = useLabText()
  const dates = useDates()
  const history = PREVIOUS_ORDERS[o.patient.mrn] ?? []
  const linked = o.patient.patientId && isModuleEnabled("patients")
  const fasting = o.fasting ? (o.fastingHours ? t("fastingYes", { h: o.fastingHours }) : t("fastingYesNoH")) : t("fastingNo")
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <LabCard title={t("clinical")} text={t("clinicalText")}>
        <dl className="flex flex-col">
          <Row label={t("diagnosis")}>
            {o.diagnosis ? b(o.diagnosis) : "—"}
            {o.diagnosisIcd10 && (
              <>
                {" · "}
                <Latin>{o.diagnosisIcd10}</Latin>
              </>
            )}
          </Row>
          <Row label={t("fasting")}>{fasting}</Row>
          <Row label={t("medicines")}>{o.patient.medicines ? b(o.patient.medicines) : "—"}</Row>
          <Row label={t("allergies")}>{o.patient.allergies ? b(o.patient.allergies) : "—"}</Row>
          <Row label={t("payer")}>{o.patient.payer ? t("payerApproved", { payer: b(o.patient.payer) }) : "—"}</Row>
        </dl>
        {o.note && (
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
            <span className="text-xs font-medium text-foreground">{doctorName(o.doctorId)}</span>
            <span className="text-xs text-muted-foreground">{b(o.note)}</span>
          </div>
        )}
      </LabCard>

      <LabCard
        title={t("history")}
        text={t("historyText")}
        action={
          linked && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={patientHref(o.patient.patientId!)}>
                {t("all")}
                <Icon name="arrow-right-1" size={20} />
              </Link>
            </Button>
          )
        }
      >
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {history.map((h) => (
              <li key={h.no} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground tabular-nums">
                  {dates.short(h.date)} · <Latin>{h.no}</Latin>
                </span>
                <span className="text-xs text-muted-foreground">
                  <bdi>{b(h.summary)}</bdi>
                </span>
              </li>
            ))}
          </ul>
        )}
      </LabCard>
    </div>
  )
}
