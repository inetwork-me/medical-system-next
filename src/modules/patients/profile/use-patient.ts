"use client"

import { usePatientId } from "@/modules/patients/href"
import * as React from "react"
import { useSelectedLayoutSegment } from "next/navigation"
import { useFormatter, useLocale } from "next-intl"

import { bi, type Bi } from "@/lib/mock/bi"
import { isTabEnabled } from "@/lib/modules"
import { useSpecialtyTabs } from "@/modules/clinics/specialty-tabs"
import { applyForm } from "../edit/apply"
import { usePatientsStore } from "../store"
import { applyChanges, applyCollections, patientRecord, recordSummary } from "./record"

export const PATIENT_TABS = ["overview", "visits", "payments", "medical", "eyes", "dental", "files", "activity"] as const
export type PatientTab = (typeof PATIENT_TABS)[number]

/** Tabs shown for the active branch: Eyes / Dental are record tabs that a branch can switch off (config/modules.ts). */
export const VISIBLE_PATIENT_TABS = PATIENT_TABS.filter((k) => (k !== "eyes" && k !== "dental") || isTabEnabled("patients", k))

/** Visible tabs, also following the clinics' Specialty tools switches (Clinics · Settings). */
export function usePatientTabs(): PatientTab[] {
  const on = useSpecialtyTabs()
  return PATIENT_TABS.filter((k) => (k !== "eyes" && k !== "dental") || on[k])
}

/** Current patient (from the session store, so VIP / ban changes show) + its page record. */
export function usePatient() {
  const id = usePatientId()
  const { get, savedForm, collections, changes } = usePatientsStore()
  const patient = get(id)
  const form = savedForm(id)
  const paid = collections(id)
  const ch = changes(id)
  const record = React.useMemo(() => {
    if (!patient) return null
    let r = patientRecord(patient)
    if (form) r = applyForm(r, form)
    r = applyCollections(r, paid)
    r = applyChanges(r, ch)
    // Merged / cleared duplicates: no "possible duplicate" alert any more.
    if (!patient.duplicateOf && r.details.duplicate) r = { ...r, details: { ...r.details, duplicate: undefined } }
    return r
  }, [patient, form, paid, ch])
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
