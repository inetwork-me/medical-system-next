"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { isModuleEnabled } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { allPatients } from "@/modules/patients/data"
import { patientHref } from "@/modules/patients/href"
import { isFollowUpDue, panelOf, patientsOf, type Doctor, type DoctorPatient } from "../data"
import { bookHref } from "../href"
import { ltr, useDoctorText } from "../text"
import { DoctorPage, useCurrentDoctor } from "./frame"

type Filter = "all" | "due" | "new"

/** "Dr. Ahmed Zaki" → "Dr. Ahmed" / "د. أحمد" */
export const shortName = (name: string) => name.split(" ").slice(0, 2).join(" ")

/**
 * Doctor page · Patients: Widget / Doctor Patients — search, All / Follow-up due / New this month, and the patient table
 * (patient + MRN, age, last visit, next visit (Overdue = destructive), condition chip, payer, ⋯) when wide (≥ 56rem);
 * rows with age · MRN, last visit and the condition chip otherwise. Rows open the patient file in Patients.
 */
export function DoctorPatients() {
  const d = useCurrentDoctor()
  return (
    <DoctorPage>
      <PatientsCard doctor={d} />
    </DoctorPage>
  )
}

function PatientsCard({ doctor: d }: { doctor: Doctor }) {
  const t = useTranslations("doctors.patients")
  const { b, dates, locale } = useDoctorText()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const files = React.useMemo(() => allPatients(), [])
  const fileOf = (p: DoctorPatient) => files.find((f) => f.name.en === p.name.en)
  const panel = panelOf(d)
  const all = patientsOf(d)
  const q = query.trim().toLowerCase()
  const rows = all
    .filter((p) => !q || p.name.en.toLowerCase().includes(q) || p.name.ar.includes(query.trim()) || p.mrn.toLowerCase().includes(q))
    .filter((p) => filter === "all" || (filter === "due" ? isFollowUpDue(p) : p.isNew))
  const next = (p: DoctorPatient) => (p.next === "overdue" ? t("overdue") : p.next ? dates.short(p.next) : "—")

  const exportList = () => {
    const file = `patients-${d.key}-${stamp()}.xlsx`
    const head = (["patient", "mrn", "age", "last", "next", "condition", "payer"] as const).map((k) => t(`col.${k}`))
    const body = rows.map((p) => [b(p.name), p.mrn, b(p.age), dates.short(p.last), next(p), b(p.condition), b(p.payer)])
    saveBlob(xlsxBlob(head, body, { sheet: t("sheet"), rtl: locale === "ar" }), file)
    toast.success(t("exported"), { description: t("exportedText", { file }) })
  }

  const menu = (p: DoctorPatient) => {
    const f = fileOf(p)
    return (
      <ActionMenu
        title={b(p.name)}
        align="end"
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={t("menu")}>
            <Icon name="more" size={16} />
          </Button>
        }
        groups={[
          [
            { key: "open", icon: "user", label: f ? t("open") : t("noFile"), href: f ? patientHref(f.id) : undefined, disabled: !f },
            ...(isModuleEnabled("appointments")
              ? [{ key: "book", icon: "calendar-add" as const, label: t("book"), href: `${bookHref(d.key)}${f ? `${bookHref(d.key).includes("?") ? "&" : "?"}patient=${f.id}` : ""}` }]
              : []),
          ],
        ]}
      />
    )
  }
  const name = (p: DoctorPatient, className?: string) => {
    const f = fileOf(p)
    return f ? (
      <Link href={patientHref(f.id)} className={cn("rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}>
        {b(p.name)}
      </Link>
    ) : (
      <span className={className}>{b(p.name)}</span>
    )
  }
  const chip = (v: string) => <span className="inline-flex h-6 items-center rounded-full border bg-card px-2.5 text-xs font-medium whitespace-nowrap">{v}</span>

  return (
    <Widget
      title={t("title", { name: shortName(b(d.name)) })}
      description={t(d.female ? "textF" : "text")}
      className="gap-4 p-4 md:p-5"
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={exportList}>
          <Icon name="export" size={16} />
          {t("export")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2 @4xl/widget:flex-row @4xl/widget:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/widget:w-70"
        />
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] @4xl/widget:ms-auto @4xl/widget:me-0 @4xl/widget:px-0">
          <Segmented
            size="sm"
            value={filter}
            onValueChange={setFilter}
            aria-label={t("filter.label")}
            className="min-w-full @4xl/widget:min-w-0"
            options={[
              { value: "all", label: ltr(t("filter.all", { n: panel.all.toLocaleString("en") })) },
              { value: "due", label: ltr(t("filter.due", { n: panel.due })) },
              { value: "new", label: ltr(t("filter.new", { n: panel.newMonth })) },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="profile-2user"
          title={t("empty")}
          description={t("emptyText")}
          className="py-10"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setFilter("all")
              }}
            >
              {t("clear")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border @4xl/widget:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr className="h-10">
                  <th scope="col" className="ps-4 text-start font-medium">{t("col.patient")}</th>
                  <th scope="col" className="w-20 px-3 text-start font-medium">{t("col.age")}</th>
                  <th scope="col" className="w-33 px-3 text-start font-medium">{t("col.last")}</th>
                  <th scope="col" className="w-33 px-3 text-start font-medium">{t("col.next")}</th>
                  <th scope="col" className="w-40 px-3 text-start font-medium">{t("col.condition")}</th>
                  <th scope="col" className="w-28 px-3 text-start font-medium">{t("col.payer")}</th>
                  <th scope="col" className="w-12 pe-4">
                    <span className="sr-only">{t("menu")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((p) => (
                  <tr key={p.mrn}>
                    <td className="py-2.5 ps-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback>{p.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          {name(p, "truncate font-medium")}
                          <span className="truncate text-xs text-muted-foreground tabular-nums">{p.mrn}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 tabular-nums">{ltr(b(p.age))}</td>
                    <td className="px-3 tabular-nums">{dates.short(p.last)}</td>
                    <td className="px-3 tabular-nums">{p.next === "overdue" ? <StatusBadge tone="destructive">{t("overdue")}</StatusBadge> : next(p)}</td>
                    <td className="px-3">{chip(b(p.condition))}</td>
                    <td className="px-3 text-muted-foreground">{b(p.payer)}</td>
                    <td className="pe-4 text-end">{menu(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y @4xl/widget:hidden">
            {rows.map((p) => {
              const f = fileOf(p)
              return (
                <li key={p.mrn} className="flex items-start gap-2.5 py-3">
                  <Avatar size="sm">
                    <AvatarFallback>{p.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    {name(p, "text-sm font-medium")}
                    <span className="text-xs text-muted-foreground tabular-nums">{ltr(`${b(p.age)} · ${p.mrn}`)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{t("lastVisit", { date: dates.short(p.last) })}</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {chip(b(p.condition))}
                      {p.next === "overdue" && <StatusBadge tone="destructive">{t("overdue")}</StatusBadge>}
                    </div>
                  </div>
                  {f ? (
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link href={patientHref(f.id)} aria-label={t("open")}>
                        <Icon name="arrow-right-1" size={16} />
                      </Link>
                    </Button>
                  ) : (
                    menu(p)
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Widget>
  )
}
