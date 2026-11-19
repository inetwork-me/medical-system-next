"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { csvBlob, saveBlob, stamp } from "@/lib/export/files"
import { pdfDocument, type PdfBlock } from "@/lib/export/pdf"
import { toast } from "@/components/ds/toast"
import { useDates } from "@/i18n/dates"
import { REGIONS, type Patient } from "../data"
import type { ActivityItem, PatientRecord } from "./record"
import { useText } from "./use-patient"

/**
 * Patient page exports, generated in the browser (no server yet) and confirmed with a DS success toast:
 *  · More actions › Download PDF → patient summary (profile, visits, diagnoses, medications, allergies)
 *  · Activity tab › Export → CSV of the (filtered) activity log
 */
export function usePatientExports() {
  const t = useTranslations("patients.page.pdf")
  const tTags = useTranslations("patients.tags")
  const dates = useDates()
  const { b } = useText()
  const rtl = useLocale() === "ar"
  const [busy, setBusy] = React.useState(false)

  const guard = async (name: string, make: () => Promise<Blob> | Blob) => {
    setBusy(true)
    try {
      saveBlob(await make(), name)
      toast.success(t("ready"), { description: t("readyText", { name }) })
    } catch {
      toast.error(t("failed"), { description: t("failedText"), retry: () => void guard(name, make) })
    } finally {
      setBusy(false)
    }
  }

  const summaryPdf = (patient: Patient, record: PatientRecord) => {
    const blocks: PdfBlock[] = [
      { kind: "brand", title: t("clinic"), subtitle: t("generated", { date: dates.short(new Date()) }) },
      { kind: "title", text: b(patient.name) },
      { kind: "meta", text: t("meta", { mrn: patient.mrn, gender: t(`gender.${patient.gender}`), age: patient.age }) },
      {
        kind: "kv",
        rows: [
          [t("mobile"), patient.mobile ?? "—"],
          [t("region"), b(patient.city ?? REGIONS[patient.region].long)],
          [t("registered"), dates.short(patient.registered)],
          [t("lastVisit"), dates.short(patient.lastVisit)],
          [t("visitsCount"), String(patient.visits)],
          [t("tags"), patient.tags.length ? patient.tags.map((x) => tTags(x)).join(" · ") : "—"],
        ],
      },
    ]
    if (record.visits.length)
      blocks.push(
        { kind: "title", text: t("visits") },
        {
          kind: "table",
          head: [t("date"), t("clinic_"), t("doctor"), t("reason"), t("status")],
          weights: [1.35, 1.1, 1.3, 1.7, 0.95],
          rows: record.visits.map((v) => [dates.short(v.date), b(v.clinic), b(v.doctor), b(v.reason), t(`visit.${v.status}`)]),
        },
      )
    if (record.diagnoses.length)
      blocks.push(
        { kind: "title", text: t("diagnoses") },
        { kind: "table", head: [t("name"), t("status")], weights: [3, 1], rows: record.diagnoses.map((d) => [b(d.name), t(`dx.${d.status}`)]) },
      )
    if (record.medications.length)
      blocks.push(
        { kind: "title", text: t("medications") },
        {
          kind: "table",
          head: [t("name"), t("dose"), t("prescriber"), t("status")],
          weights: [1.6, 1.6, 1.4, 0.9],
          rows: record.medications.map((m) => [b(m.name), b(m.dose), b(m.by), t(`med.${m.status}`)]),
        },
      )
    if (record.allergies.length)
      blocks.push(
        { kind: "title", text: t("allergies") },
        {
          kind: "table",
          head: [t("name"), t("detail"), t("severity")],
          weights: [1.4, 2.4, 1],
          rows: record.allergies.map((a) => [b(a.name), b(a.detail), t(`level.${a.severity}`)]),
        },
      )
    return guard(`patient-${patient.mrn}-${stamp()}.pdf`, () => pdfDocument(blocks, { dir: rtl ? "rtl" : "ltr", title: `patient-${patient.mrn}` }))
  }

  const activityCsv = (patient: Patient, items: ActivityItem[], kindLabel: (k: ActivityItem["kind"]) => string) =>
    guard(`activity-${patient.mrn}-${stamp()}.csv`, () =>
      csvBlob(
        [t("date"), t("time"), t("by"), t("type"), t("details")],
        items.map((a) => [a.date, a.time, b(a.by), kindLabel(a.kind), b(a.text)]),
      ),
    )

  return { busy, summaryPdf, activityCsv }
}
