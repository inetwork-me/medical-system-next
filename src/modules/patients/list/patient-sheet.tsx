"use client"

import { patientHref } from "@/modules/patients/href"
import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { IfModule } from "@/lib/modules"
import { bi } from "@/lib/mock/bi"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { STATUS_TONE } from "@/lib/mock/dashboard"
import { useDates } from "@/i18n/dates"
import { REGIONS, patientDetails, type Patient } from "../data"
import { PatientTags } from "./patient-badges"

/**
 * Widget / Patient Sheet (prototype: list "View patient" → "Patient sheet open"; desktop + tablet only — on mobile a
 * patient card opens the full page). 600 wide drawer from the inline-end edge.
 */
export function PatientSheet({ patient, onOpenChange }: { patient?: Patient; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("patients.sheet")
  return (
    <Sheet open={!!patient} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="gap-0 overflow-y-auto sm:max-w-150" aria-describedby={undefined}>
        {patient && <SheetBodyContent patient={patient} />}
        {!patient && <SheetTitle className="sr-only">{t("label")}</SheetTitle>}
      </SheetContent>
    </Sheet>
  )
}

function SheetBodyContent({ patient: p }: { patient: Patient }) {
  const t = useTranslations("patients")
  const tg = useTranslations("patients.gender")
  const ts = useTranslations("common.status")
  const format = useFormatter()
  const locale = useLocale()
  const d = React.useMemo(() => patientDetails(p), [p])
  const date = useDates().short
  const name = bi(p.name, locale)
  const sex = p.gender === "unset" ? tg("unset") : tg(p.gender === "male" ? "single.male" : "single.female")

  const facts: [string, React.ReactNode, boolean?][] = [
    [t("sheet.facts.phone"), p.mobile, true],
    [t("sheet.facts.whatsapp"), d.whatsapp, true],
    [t("sheet.facts.nationalId"), d.nationalId ? `${d.nationalId.slice(0, 1)}•••••••${d.nationalId.slice(-2)}` : null, true],
    [t("sheet.facts.birth"), `${date(d.birthDate)} · ${t("sheet.years", { n: p.age })}`],
    [t("sheet.facts.nationality"), bi(d.nationality, locale)],
    [t("sheet.facts.region"), [bi(p.city ?? REGIONS[p.region].long, locale), d.district && bi(d.district, locale)].filter(Boolean).join(" · ")],
    [t("sheet.facts.insurance"), d.insurance && bi(d.insurance, locale)],
    [t("sheet.facts.classification"), bi(d.classification, locale)],
    [t("sheet.facts.registered"), `${date(p.registered)} · ${bi(d.registeredBy, locale)}`],
    [t("sheet.facts.bloodType"), d.bloodType, true],
  ]

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Top: label · Open full page (the sheet's own close button sits at the end) */}
      <div className="flex items-center gap-2 pe-10">
        <p className="flex-1 text-xs font-medium text-muted-foreground">{t("sheet.label")}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={patientHref(p.id)}>
            {t("sheet.openFull")}
            <Icon name="arrow-right-1" size={16} />
          </Link>
        </Button>
      </div>

      {/* Identity */}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar size="lg">
          <AvatarFallback>{p.initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SheetTitle className="text-xl">{name}</SheetTitle>
          <SheetDescription className="text-sm">
            <bdi dir="ltr">MRN {p.mrn}</bdi> · {sex} · {t("sheet.years", { n: p.age })}
          </SheetDescription>
          <PatientTags tags={p.tags} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={patientHref(p.id, "edit")}>
              <Icon name="edit-2" size={16} />
              {t("sheet.edit")}
            </Link>
          </Button>
          <IfModule id="appointments">
            <Button size="sm" asChild>
              <Link href={patientHref(p.id, undefined, { action: "book" })}>
                <Icon name="calendar-add" size={16} />
                {t("sheet.book")}
              </Link>
            </Button>
          </IfModule>
        </div>
      </div>

      {/* Data-quality callouts */}
      {p.tags.includes("incomplete") && (
        <Callout tone="warning" icon="warning-2" title={t("sheet.missingTitle")} text={t("sheet.missingText")}>
          <Button variant="outline" size="sm" asChild>
            <Link href={patientHref(p.id, "edit")}>{t("sheet.completeNow")}</Link>
          </Button>
        </Callout>
      )}
      {d.duplicate && (
        <Callout
          tone="info"
          icon="people"
          title={t("sheet.duplicateTitle")}
          text={t.rich("sheet.duplicateText", {
            mrn: d.duplicate.mrn,
            name: bi(d.duplicate.name, locale),
          })}
        >
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/merge?a=${p.id}&b=${d.duplicate.mrn}`}>{t("sheet.reviewMerge")}</Link>
          </Button>
        </Callout>
      )}

      {/* Facts (2 columns) */}
      <dl className="grid grid-cols-1 gap-3 rounded-xl border p-4 sm:grid-cols-2">
        {facts.map(([label, value, ltr]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("truncate text-sm font-medium tabular-nums", !value && "text-muted-foreground")}>
              {value ? ltr ? <bdi dir="ltr">{value}</bdi> : value : "—"}
            </dd>
          </div>
        ))}
      </dl>

      {/* In-sheet tabs */}
      <Tabs defaultValue="visits" className="gap-4">
        <TabsList>
          <TabsTrigger value="visits">{t("sheet.tabs.visits", { count: p.visits })}</TabsTrigger>
          <TabsTrigger value="payments">{t("sheet.tabs.payments")}</TabsTrigger>
          <TabsTrigger value="activity">{t("sheet.tabs.activity")}</TabsTrigger>
          <TabsTrigger value="files">{t("sheet.tabs.files")}</TabsTrigger>
        </TabsList>
        <TabsContent value="visits">
          {d.visitsList.length ? (
            <ul className="overflow-hidden rounded-xl border">
              {d.visitsList.map((v, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-4 last:border-0">
                  <span className="w-27.5 text-sm font-medium tabular-nums">{date(v.date)}</span>
                  <span className="min-w-0 flex-1 text-sm">{bi(v.service, locale)}</span>
                  <StatusBadge tone={STATUS_TONE[v.status]}>{ts(v.status)}</StatusBadge>
                  <span className="w-18 text-end text-sm font-medium tabular-nums">{t("sheet.sar", { amount: format.number(v.amount, "integer") })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{t("sheet.noVisits")}</p>
          )}
        </TabsContent>
        <TabsContent value="payments">
          <ul className="overflow-hidden rounded-xl border">
            {d.visitsList
              .filter((v) => v.amount > 0)
              .map((v, i) => (
                <li key={i} className="flex items-center gap-4 border-b px-4 py-4 text-sm last:border-0">
                  <span className="w-27.5 font-medium tabular-nums">{date(v.date)}</span>
                  <span className="flex-1">{t("sheet.paidVisit")}</span>
                  <span className="font-medium tabular-nums">{t("sheet.sar", { amount: format.number(v.amount, "integer") })}</span>
                </li>
              ))}
          </ul>
        </TabsContent>
        <TabsContent value="activity">
          <ul className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
            {d.visitsList.slice(0, 3).map((v, i) => (
              <li key={i} className="flex items-center gap-2">
                <Icon name="calendar-tick" size={16} className="text-muted-foreground" />
                <span className="flex-1">{t("sheet.activityVisit", { date: date(v.date) })}</span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Icon name="user-add" size={16} className="text-muted-foreground" />
              <span className="flex-1">{t("sheet.activityRegistered", { by: bi(d.registeredBy, locale) })}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{date(p.registered)}</span>
            </li>
          </ul>
        </TabsContent>
        <TabsContent value="files">
          <div className="rounded-xl border">
            <EmptyState icon="document-text" title={t("sheet.noFiles")} description={t("sheet.noFilesText")} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const CALLOUT = {
  warning: "bg-warning-soft text-warning-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
} as const

function Callout({
  tone,
  icon,
  title,
  text,
  children,
}: {
  tone: keyof typeof CALLOUT
  icon: IconName
  title: React.ReactNode
  text: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg p-3.5", CALLOUT[tone])}>
      <Icon name={icon} size={20} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs">{text}</p>
      </div>
      {children}
    </div>
  )
}
