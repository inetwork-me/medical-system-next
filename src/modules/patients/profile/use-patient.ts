"use client"

import * as React from "react"
import { useParams, useSelectedLayoutSegment } from "next/navigation"
import { useFormatter, useLocale } from "next-intl"

import { bi, type Bi } from "@/lib/mock/bi"
import { usePatientsStore } from "../store"
import { patientRecord, recordSummary } from "./record"

export const PATIENT_TABS = ["overview", "visits", "payments", "medical", "files", "activity"] as const
export type PatientTab = (typeof PATIENT_TABS)[number]

/** Current patient (from the session store, so VIP / ban changes show) + its page record. */
export function usePatient() {
  const { id } = useParams<{ id: string }>()
  const { get } = usePatientsStore()
  const patient = get(id)
  const record = React.useMemo(() => (patient ? patientRecord(patient) : null), [patient])
  const summary = React.useMemo(() => (record ? recordSummary(record) : null), [record])
  return patient && record && summary ? { patient, record, summary } : null
}

/** Active patient tab from the route segment under /patients/[id]. */
export function usePatientTab(): PatientTab {
  const seg = useSelectedLayoutSegment()
  return (PATIENT_TABS as readonly string[]).includes(seg ?? "") ? (seg as PatientTab) : "overview"
}

/** Locale helpers shared by the page widgets. */
export function useText() {
  const locale = useLocale()
  const format = useFormatter()
  return {
    locale,
    b: (v: Bi) => bi(v, locale),
    n: (v: number) => format.number(v, "integer"),
  }
}
