"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { FilterChip } from "@/components/ds/module-controls"
import { StatCard } from "@/components/ds/stat-card"
import { EmptyState } from "@/components/ds/states"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-media-query"
import { useClinics } from "@/modules/clinics/store"
import { DOCTORS_TODAY, doctorKpis, isAway, isInClinic, type Doctor } from "../data"
import { DoctorsFrame } from "../frame"
import { useDoctors } from "../store"
import { useDoctorText } from "../text"
import { DoctorCard } from "./doctor-card"

type Chip = "all" | "in" | "later" | "away"
const CHIPS: Chip[] = ["all", "in", "later", "away"]
const matches = (d: Doctor, c: Chip) => c === "all" || (c === "in" ? isInClinic(d) : c === "later" ? d.status === "later" : isAway(d))
/** Desktop / tablet show 9 cards a page ("Showing 9 of 23 doctors" · Show more); mobile shows 5, then all. */
const PAGE = 9
const MOBILE_FIRST = 5

/**
 * Doctors · Doctors (module tab 1): 4 KPI cards (2 per row on mobile); search · clinic · status chips (mobile: search,
 * then chips); doctor cards 3 / 2 / 1 per row; "Showing n of N" + Show more. Actions: Export, Add doctor.
 */
export function DoctorsList() {
  const { t, b, nextFree, dates, locale, clinicName } = useDoctorText()
  const tn = useTranslations("shell.nav")
  const doctors = useDoctors().filter((d) => d.active)
  const clinics = useClinics()
  const mobile = useIsMobile()
  const [query, setQuery] = React.useState("")
  const [chip, setChip] = React.useState<Chip>("all")
  const [clinic, setClinic] = React.useState("all")
  const [pages, setPages] = React.useState(1)
  const [expanded, setExpanded] = React.useState(false)

  const k = doctorKpis(doctors)
  const q = query.trim().toLowerCase()
  const searched = doctors.filter(
    (d) =>
      (clinic === "all" || d.clinic === clinic) &&
      (!q || [d.name, d.title].some((v) => v.en.toLowerCase().includes(q) || v.ar.includes(query.trim())) || clinicName(d.clinic).toLowerCase().includes(q))
  )
  const rows = searched.filter((d) => matches(d, chip))
  const shown = mobile ? (expanded ? rows : rows.slice(0, MOBILE_FIRST)) : rows.slice(0, pages * PAGE)

  const exportList = () => {
    const file = `doctors-${stamp()}.xlsx`
    const head = (["doctor", "title", "clinic", "room", "status", "seen", "booked", "nextFree", "rating", "month"] as const).map((c) => t(`col.${c}`))
    const body = rows.map((d) => [
      b(d.name),
      b(d.title),
      clinicName(d.clinic),
      d.room,
      b(d.statusLabel),
      String(d.today.seen),
      String(d.today.booked),
      nextFree(d),
      d.month.rating,
      String(d.month.visits),
    ])
    saveBlob(xlsxBlob(head, body, { sheet: tn("doctors"), rtl: locale === "ar" }), file)
    notify.success(t("exported"), { description: t("exportedText", { file }) })
  }

  return (
    <DoctorsFrame
      actions={
        <>
          <Button variant="outline" onClick={exportList}>
            <Icon name="export" size={24} />
            {t("export")}
          </Button>
          <Button asChild>
            <Link href="/doctors/new">
              <Icon name="add" size={24} />
              {t("addDoctor")}
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          icon="people"
          tile="accent"
          label={t("kpi.doctors")}
          value={k.doctors}
          delta={t("kpi.onDuty", { n: k.onDuty })}
          caption={t("kpi.today")}
          className="max-md:p-4"
        />
        <StatCard
          icon="calendar-2"
          tile="info"
          label={t("kpi.booked")}
          value={k.booked}
          delta={`+${k.bookedDelta}%`}
          deltaTone="info"
          caption={t("kpi.vsLast", { day: dates.weekdayShort(DOCTORS_TODAY) })}
          className="max-md:p-4"
        />
        <StatCard
          icon="clock"
          tile="warning"
          label={t("kpi.away")}
          value={k.away}
          delta={t("kpi.onLeave", { n: k.onLeave })}
          deltaTone="warning"
          caption={t("kpi.offToday", { n: k.offToday })}
          className="max-md:p-4"
        />
        <StatCard
          icon="shield-tick"
          tile="destructive"
          label={t("kpi.due")}
          value={k.due}
          delta={k.expired ? t("kpi.expired", { n: k.expired }) : undefined}
          deltaTone="destructive"
          caption={t("kpi.next60")}
          className="max-md:p-4"
        />
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("filters.search")}
          aria-label={t("filters.search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="md:w-70"
        />
        <Select value={clinic} onValueChange={setClinic}>
          <SelectTrigger className="hidden w-50 md:flex" aria-label={t("filters.clinic")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allClinics")}</SelectItem>
            {clinics.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {b(c.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("filters.status")}>
          {CHIPS.map((c) => (
            <FilterChip key={c} selected={chip === c} count={searched.filter((d) => matches(d, c)).length} onClick={() => setChip(c)}>
              {t(`filters.${c}`)}
            </FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="people"
            title={t("empty")}
            description={t("emptyText")}
            className="py-16"
            actions={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("")
                  setChip("all")
                  setClinic("all")
                }}
              >
                {t("clearFilters")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-3 @5xl:gap-6">
            {shown.map((d) => (
              <DoctorCard key={d.key} doctor={d} />
            ))}
          </div>
        </div>
      )}

      {shown.length < rows.length &&
        (mobile ? (
          <Button variant="outline" size="lg" className="w-full" onClick={() => setExpanded(true)}>
            {t("showMoreN", { n: rows.length - shown.length })}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-xs text-muted-foreground tabular-nums">{t("showing", { shown: shown.length, total: rows.length })}</p>
            <Button variant="outline" onClick={() => setPages((p) => p + 1)}>
              {t("showMore")}
            </Button>
          </div>
        ))}
    </DoctorsFrame>
  )
}
