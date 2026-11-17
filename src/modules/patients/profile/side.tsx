"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon, type IconName } from "@/components/ds/icon"
import { StatusBadge } from "@/components/ds/status-badge"
import { Widget, WidgetMenu } from "@/components/ds/widget"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { REGIONS } from "../data"
import { useOverlay } from "./overlays"
import { usePatient, useText } from "./use-patient"

/** Patient page card: Widget with the page's tighter padding (p-5, gap-4). */
export function PCard({ className, ...props }: React.ComponentProps<typeof Widget>) {
  return <Widget className={cn("gap-4 p-5", className)} {...props} />
}

/** Label / value box (muted, rows divided). */
export function KeyValues({ rows, className }: { rows: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("overflow-hidden rounded-lg bg-muted", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-xs last:border-0">
          <dt className="flex-1 text-muted-foreground">{k}</dt>
          <dd className="font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Widget / Patient Profile Card: photo (initials), name, sex · age · city, MRN + status, key facts, contact buttons. */
export function ProfileCard({ className }: { className?: string }) {
  const t = useTranslations("patients")
  const overlay = useOverlay()
  const { b } = useText()
  const date = useDates().short
  const data = usePatient()
  if (!data) return null
  const { patient: p, record } = data
  const d = record.details
  const sex = p.gender === "unset" ? t("page.info.unset") : t(`gender.single.${p.gender}`)
  const banned = p.tags.includes("banned")
  const contact: [IconName, string, string | null][] = [
    ["call", t("page.card.call"), p.mobile && `tel:${p.mobile.replace(/\s/g, "")}`],
    ["message", t("page.card.whatsapp"), d.whatsapp && `https://wa.me/966${d.whatsapp.replace(/\s/g, "").slice(1)}`],
    ["sms", t("page.card.sms"), p.mobile && `sms:${p.mobile.replace(/\s/g, "")}`],
  ]

  return (
    <section className={cn("flex flex-col items-center gap-3.5 rounded-xl border bg-card p-5 text-card-foreground", className)}>
      <div className="flex size-26 items-center justify-center rounded-2xl bg-accent text-4xl font-semibold text-accent-foreground" aria-hidden>
        {p.initials}
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <h2 className="text-xl font-semibold">{b(p.name)}</h2>
        <p className="text-xs text-muted-foreground">
          {t("page.card.meta", {
            gender: sex,
            age: t("page.years", { n: p.age }),
            place: b(p.city ?? REGIONS[p.region].short),
          })}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Badge variant="secondary">
          <bdi dir="ltr">MRN {p.mrn}</bdi>
        </Badge>
        {banned ? <StatusBadge tone="destructive">{t("page.card.banned")}</StatusBadge> : <StatusBadge tone="success">{t("page.card.active")}</StatusBadge>}
        {p.tags.includes("vip") && <StatusBadge tone="info">{t("tags.vip")}</StatusBadge>}
      </div>
      <KeyValues
        className="w-full"
        rows={[
          [t("page.card.insurance"), d.insurance ? b(d.insurance) : t("page.card.none")],
          [t("page.card.bloodType"), d.bloodType ? <bdi dir="ltr">{d.bloodType}</bdi> : "—"],
          [t("page.card.since"), date(p.registered)],
          [t("page.card.classification"), b(d.classification)],
        ]}
      />
      <div className="flex w-full items-center gap-1.5">
        <span className="flex-1 text-xs text-muted-foreground">{t("page.card.contact")}</span>
        {contact.map(([icon, label, href]) => (
          <Tooltip key={icon}>
            <TooltipTrigger asChild>
              {icon === "sms" ? (
                <Button variant="outline" size="icon-sm" aria-label={label} onClick={() => overlay.open({ kind: "sms" })}>
                  <Icon name={icon} size={20} />
                </Button>
              ) : href ? (
                <Button variant="outline" size="icon-sm" asChild>
                  <a href={href} aria-label={label} target={icon === "message" ? "_blank" : undefined} rel="noreferrer">
                    <Icon name={icon} size={20} />
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="icon-sm" aria-label={label} disabled>
                  <Icon name={icon} size={20} />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </section>
  )
}

/** Widget / Patient Personal Info: icon tiles (accent; warning + "Missing" badge when a field is empty). */
export function PersonalInfo({ className }: { className?: string }) {
  const t = useTranslations("patients")
  const { b } = useText()
  const date = useDates().short
  const data = usePatient()
  if (!data) return null
  const { patient: p, record, summary } = data
  const d = record.details
  const address = record.missing.includes("address") ? null : b(p.city ?? REGIONS[p.region].long)
  const rows: [IconName, string, React.ReactNode | null][] = [
    ["user", t("page.info.gender"), p.gender === "unset" ? null : t(`gender.single.${p.gender}`)],
    ["calendar-2", t("page.info.birth"), record.missing.includes("birthDate") ? null : `${date(d.birthDate)} · ${t("page.years", { n: p.age })}`],
    ["call", t("page.info.phone"), p.mobile && <bdi dir="ltr">{p.mobile}</bdi>],
    ["personalcard", t("page.info.nationalId"), d.nationalId && <bdi dir="ltr">{`${d.nationalId.slice(0, 1)}•••••••${d.nationalId.slice(-2)}`}</bdi>],
    ["global", t("page.info.nationality"), record.missing.includes("nationality") ? null : b(d.nationality)],
    ["location", t("page.info.address"), address],
  ]
  return (
    <PCard
      className={className}
      title={t("page.info.title")}
      description={t("page.info.complete", {
        done: summary.profile.complete,
        total: summary.profile.total,
      })}
      action={<WidgetMenu />}
    >
      <ul className="flex flex-col gap-3.5">
        {rows.map(([icon, label, value]) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md",
                value ? "bg-accent text-primary" : "bg-warning-soft text-warning-soft-foreground",
              )}
            >
              <Icon name={icon} size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{label}</span>
              {value ? (
                <span className="truncate text-sm font-medium tabular-nums">{value}</span>
              ) : (
                <StatusBadge tone="warning">{t("page.info.missing")}</StatusBadge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PCard>
  )
}

/** Widget / Patient Attention: data-quality alerts with link actions (Complete now → edit, Review & merge → merge). */
export function Attention({ className }: { className?: string }) {
  const t = useTranslations("patients.page.attention")
  const { locale } = useText()
  const data = usePatient()
  if (!data) return null
  const { patient: p, record } = data
  const f = record.missing.map((k) => t(`fields.${k}`))
  const fields = new Intl.ListFormat(locale, { type: "conjunction" }).format(f)
  const dup = record.details.duplicate
  const alerts = [
    f.length > 0 && {
      key: "missing",
      icon: "warning-2" as IconName,
      tile: "bg-warning-soft text-warning-soft-foreground",
      title: t("missingTitle"),
      text: t("missingText", {
        fields: fields.charAt(0).toUpperCase() + fields.slice(1),
      }),
      action: t("completeNow"),
      href: `/patients/${p.id}/edit`,
    },
    dup && {
      key: "duplicate",
      icon: "people" as IconName,
      tile: "bg-info-soft text-info-soft-foreground",
      title: t("duplicateTitle"),
      text: t("duplicateText", { mrn: dup.mrn }),
      action: t("reviewMerge"),
      href: `/patients/merge?a=${p.id}&b=${dup.mrn}`,
    },
  ].filter(Boolean) as {
    key: string
    icon: IconName
    tile: string
    title: string
    text: string
    action: string
    href: string
  }[]
  if (!alerts.length) return null
  return (
    <PCard className={className} title={t("title")} description={t("count", { count: alerts.length })}>
      <ul className="flex flex-col gap-4">
        {alerts.map((a) => (
          <li key={a.key} className="flex items-start gap-3">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", a.tile)}>
              <Icon name={a.icon} size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.text}</p>
              <Button variant="link" size="sm" className="h-7 w-fit px-0" asChild>
                <Link href={a.href}>{a.action}</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </PCard>
  )
}

