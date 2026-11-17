"use client"

import { patientHref } from "@/modules/patients/href"
import * as React from "react"
import { useTranslations } from "next-intl"
import { notify } from "@/components/ds/toast"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { ModuleTabsNav, PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { allPatients, type Patient } from "../data"
import { useText } from "../profile/use-patient"
import { usePatientsStore } from "../store"
import type { ReportKey } from "./data"

/** Shared report building blocks now live in components/reports; re-exported here for the Patients reports. */
export { Chips, Donut, HBars, Kpis, ReportCard, ReportFilters, ReportTable, VBars, type Column, type Kpi, type SelectSpec } from "@/components/reports/parts"

/* ================================================================== page shell */

export type Csv = { name: string; head: string[]; rows: (string | number)[][] }

/**
 * Report page (Patients · Report · <name> · 1440 / 768 / 390): back to Reports, title + description,
 * Print · Export (CSV of the filtered rows), module tabs, filters, KPIs, body.
 */
export function ReportShell({
  report,
  filters,
  kpis,
  csv,
  children,
}: {
  report: ReportKey
  filters?: React.ReactNode
  kpis?: React.ReactNode
  csv: () => Csv
  children: React.ReactNode
}) {
  const t = useTranslations("patients.reports")
  const tp = useTranslations("patients")
  const { patients } = usePatientsStore()
  const total = patients.length || allPatients().length
  const exportCsv = () => {
    const { name, head, rows } = csv()
    const lines = [head, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    notify.success(t("exported"), { description: t("exportedText", { count: rows.length }) })
  }
  return (
    <PageContainer>
      <PageTitle
        title={t(`cards.${report}.title`)}
        back="/patients/reports"
        crumbs={[
          { label: tp("title"), href: "/patients" },
          { label: t("back"), href: "/patients/reports" },
        ]}
      />
      <Button variant="ghost" size="sm" className="-ms-2 -mb-2 w-fit md:hidden" asChild>
        <Link href="/patients/reports">
          <Icon name="arrow-left" size={20} />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        tabs={<ModuleTabsNav module="patients" counts={{ list: total.toLocaleString("en-US") }} />}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Icon name="printer" size={20} />
              {t("print")}
            </Button>
            <Button onClick={exportCsv}>
              <Icon name="export" size={20} />
              {t("export")}
            </Button>
          </>
        }
      />
      {filters}
      {kpis}
      {children}
    </PageContainer>
  )
}


/** Avatar + name + MRN (links to the patient page). Activity log: no avatar, regular name. */
export function PatientCell({ patient, mrn, avatar = true }: { patient: Patient | null; mrn: string; avatar?: boolean }) {
  const { b } = useText()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {avatar && (
        <Avatar size="sm">
          <AvatarFallback>{patient?.initials ?? "—"}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex min-w-0 flex-col">
        {patient ? (
          <Link href={patientHref(patient.id)} className={cn("truncate hover:underline", avatar && "font-medium")}>
            {b(patient.name)}
          </Link>
        ) : (
          <span className="font-medium">—</span>
        )}
        <bdi dir="ltr" className="text-xs text-muted-foreground tabular-nums rtl:text-right">
          MRN {mrn}
        </bdi>
      </div>
    </div>
  )
}


/** "1h 42m" / "1س 42د" */
export function useDuration() {
  const t = useTranslations("patients.reports")
  return (min: number) => {
    const h = Math.floor(min / 60)
    const m = String(min % 60).padStart(h ? 2 : 1, "0")
    return h ? t("hm", { h, m }) : t("m", { m })
  }
}
