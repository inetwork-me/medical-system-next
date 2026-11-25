"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { saveBlob, stamp, xlsxBlob } from "@/lib/export/files"
import { Icon } from "@/components/ds/icon"
import { FilterChip } from "@/components/ds/module-controls"
import { StatCard } from "@/components/ds/stat-card"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { IfCan } from "@/components/shell/permissions"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-media-query"
import { BRANCHES, CLINICS_TODAY, clinicKpis, type Clinic, type ClinicStatus } from "../data"
import { ClinicsFrame } from "../frame"
import { useClinics } from "../store"
import { useClinicText } from "../text"
import { ClinicCard } from "./clinic-card"

type Chip = "all" | ClinicStatus
const CHIPS: Chip[] = ["all", "open", "busy", "paused"]
/** Mobile shows the first 5 clinics, then "Show 4 more clinics". */
const MOBILE_FIRST = 5

/**
 * Clinics · Clinics (module tab 1): 4 KPI cards (2 per row on mobile); search · branch · status chips (mobile: search,
 * then chips); clinic cards 3 / 2 / 1 per row. Actions: Export, Add clinic.
 */
export function ClinicsList() {
  const { t, b, place, status, dates, locale } = useClinicText()
  const tn = useTranslations("shell.nav")
  const clinics = useClinics()
  const mobile = useIsMobile()
  const [query, setQuery] = React.useState("")
  const [chip, setChip] = React.useState<Chip>("all")
  const [branch, setBranch] = React.useState(BRANCHES[0].key)
  const [expanded, setExpanded] = React.useState(false)

  const k = clinicKpis(clinics)
  const q = query.trim().toLowerCase()
  const searched = clinics.filter(
    (c) =>
      !q ||
      [c.name, c.specialty, c.head, ...c.doctors.map((d) => d.name)].some((v) => v.en.toLowerCase().includes(q) || v.ar.includes(query.trim()))
  )
  const rows = searched.filter((c) => chip === "all" || c.status === chip)
  const shown = mobile && !expanded ? rows.slice(0, MOBILE_FIRST) : rows

  const exportList = () => {
    const file = `clinics-${stamp()}.xlsx`
    const head = (["clinic", "status", "place", "head", "doctors", "rooms", "seen", "booked", "waiting", "avgWait"] as const).map((c) => t(`col.${c}`))
    const body = rows.map((c) => [
      b(c.name),
      status(c),
      place(c),
      b(c.head),
      String(c.doctorCount),
      String(c.roomCount),
      String(c.today.seen),
      String(c.today.booked),
      String(c.today.waiting),
      String(c.today.avgWait),
    ])
    saveBlob(xlsxBlob(head, body, { sheet: tn("clinics"), rtl: locale === "ar" }), file)
    toast.success(t("exported"), { description: t("exportedText", { file }) })
  }

  return (
    <ClinicsFrame
      actions={
        <>
          <IfCan module="clinics" action="export">
            <Button variant="outline" onClick={exportList}>
              <Icon name="export" size={24} />
              {t("export")}
            </Button>
          </IfCan>
          <IfCan module="clinics" action="create">
            <Button asChild>
              <Link href="/clinics/new">
                <Icon name="add" size={24} />
                {t("addClinic")}
              </Link>
            </Button>
          </IfCan>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          icon="hospital"
          tile="accent"
          label={t("kpi.clinics")}
          value={k.clinics}
          delta={t("kpi.open", { n: k.open })}
          caption={t("kpi.rightNow")}
          className="max-md:p-4"
        />
        <StatCard
          icon="people"
          tile="info"
          label={t("kpi.onDuty")}
          value={k.onDuty}
          delta={t("kpi.of", { n: k.doctors })}
          deltaTone="info"
          caption={t("kpi.today")}
          className="max-md:p-4"
        />
        <StatCard
          icon="profile-2user"
          tile="success"
          label={t("kpi.patients")}
          value={k.seen}
          delta={`${k.seenDelta >= 0 ? "+" : "−"}${Math.abs(k.seenDelta)}%`}
          caption={t("kpi.vsLast", { day: dates.weekdayShort(CLINICS_TODAY) })}
          className="max-md:p-4"
        />
        <StatCard
          icon="clock"
          tile="warning"
          label={t("kpi.avgWait")}
          value={t("kpi.minutes", { n: k.avgWait })}
          delta={k.longest && t("kpi.longestValue", { clinic: b(k.longest.name), n: k.longest.today.avgWait })}
          deltaTone="warning"
          caption={t("kpi.longest")}
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
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="hidden w-50 md:flex" aria-label={t("filters.branch")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRANCHES.map((br) => (
              <SelectItem key={br.key} value={br.key}>
                {b(br.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("filters.status")}>
          {CHIPS.map((c) => (
            <FilterChip
              key={c}
              selected={chip === c}
              count={c === "all" ? searched.length : searched.filter((x) => x.status === c).length}
              onClick={() => setChip(c)}
            >
              {c === "all" ? t("filters.all") : t(`statusShort.${c}`)}
            </FilterChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="hospital"
            title={t("empty")}
            description={t("emptyText")}
            className="py-16"
            actions={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("")
                  setChip("all")
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
            {shown.map((c: Clinic) => (
              <ClinicCard key={c.key} clinic={c} />
            ))}
          </div>
        </div>
      )}
      {shown.length < rows.length && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => setExpanded(true)}>
          {t("showMore", { n: rows.length - shown.length })}
        </Button>
      )}
    </ClinicsFrame>
  )
}
