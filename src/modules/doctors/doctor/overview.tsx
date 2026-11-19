"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { IfModule, isModuleEnabled } from "@/lib/modules"
import { VBars } from "@/components/reports/parts"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { Widget } from "@/components/ds/widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { clinicHref } from "@/modules/clinics/href"
import { ClinicTile } from "@/modules/clinics/parts"
import { useClinics } from "@/modules/clinics/store"
import { allPatients } from "@/modules/patients/data"
import { patientHref } from "@/modules/patients/href"
import {
  ANNUAL_LEAVE,
  CRED_TONE,
  DOCTORS_TODAY,
  WEEKDAYS,
  credStatus,
  daysUntil,
  setupDone,
  setupOf,
  todayOf,
  type Credential,
  type CredentialType,
  type Doctor,
  type Shift,
  type VisitState,
  type Weekday,
} from "../data"
import { doctorHref } from "../href"
import { AssignClinicDialog } from "../assign-dialog"
import { RequestLeaveDialog } from "../leave-dialog"
import { SetupChecklist } from "../setup-checklist"
import { useDoctors, useLeaves } from "../store"
import { STATUS_TONE, ltr, useDoctorText } from "../text"
import { DoctorPage, OverviewActions, useCurrentDoctor } from "./frame"

/** This week runs Sun 15 – Thu 19 Nov (the design's "15–19 Nov"). */
const WEEK_FROM = "2026-11-15"
const MONTH_FROM = "2026-11-01"
/** A Sunday, to name weekdays in the locale. */
const dayDate = (d: Weekday) => `2026-11-${String(15 + WEEKDAYS.indexOf(d)).padStart(2, "0")}`
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
export const shiftHours = (s: Shift) => (minutes(s.to) - minutes(s.from)) / 60
/** Weekly hours in every clinic: own shifts + the clinics assigned with Assign clinic. */
export const weekHours = (d: Doctor) =>
  WEEKDAYS.reduce((n, w) => n + d.week[w].reduce((m, s) => m + shiftHours(s), 0), 0) + (d.assignments ?? []).reduce((m, a) => m + shiftHours(a), 0)

/** "Sun–Thu" for a run of days, else "Mon, Wed" / "الاثنين والأربعاء". */
export function useDaysLabel() {
  const { dates } = useDoctorText()
  const t = useTranslations("doctors.works")
  return (days: Weekday[]) => {
    if (!days.length) return ""
    const idx = days.map((d) => WEEKDAYS.indexOf(d))
    const run = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
    const name = (d: Weekday) => dates.weekdayShort(dayDate(d))
    if (run && days.length > 2) return `${name(days[0])}–${name(days[days.length - 1])}`
    return days.map(name).join(t("and"))
  }
}

/**
 * Doctor page · Overview. One DOM order, arranged by the content width:
 *  · wide (≥ 64rem): header; left = Today's patients, Patients this week, This month; right (360) = Works in, Licence &
 *    credentials, Leave
 *  · medium (tablet): header; Today; This month (2×2); Works in | Credentials; Patients this week | Leave
 *  · narrow (mobile): header; Today (from the patient in the room on); Works in; Credentials; This month; Week; Leave
 */
export function DoctorOverview() {
  const d = useCurrentDoctor()
  return (
    <DoctorPage actions={<OverviewActions />}>
      <DoctorHeader doctor={d} />
      {/* A new doctor: the New doctor checklist stays on top until they can be booked (open steps link to their tab). */}
      {!setupDone(d) && <SetupChecklist done={setupOf(d)} doctorKey={d.key} />}
      <div className="@container/ov">
        <div className="grid grid-cols-1 gap-4 @xl/ov:grid-cols-2 @5xl/ov:grid-cols-[minmax(0,1fr)_22.5rem] @5xl/ov:items-start @5xl/ov:gap-6">
          <div className="contents @5xl/ov:flex @5xl/ov:flex-col @5xl/ov:gap-6">
            <Today doctor={d} className="order-1 @xl/ov:col-span-2 @5xl/ov:order-none" />
            <WeekLoad doctor={d} className="order-5 @xl/ov:self-start @5xl/ov:self-stretch @5xl/ov:order-none" />
            <Month doctor={d} className="order-4 @xl/ov:order-2 @xl/ov:col-span-2 @5xl/ov:order-none" />
          </div>
          <div className="contents @5xl/ov:flex @5xl/ov:flex-col @5xl/ov:gap-6">
            <WorksIn doctor={d} className="order-2 @xl/ov:order-3 @xl/ov:self-start @5xl/ov:self-stretch @5xl/ov:order-none" />
            <CredSummary doctor={d} className="order-3 @xl/ov:order-4 @xl/ov:self-start @5xl/ov:self-stretch @5xl/ov:order-none" />
            <LeaveCard doctor={d} className="order-6 @xl/ov:self-start @5xl/ov:self-stretch @5xl/ov:order-none" />
          </div>
        </div>
      </div>
    </DoctorPage>
  )
}

/** Widget / Doctor Header: avatar · name + status · title (· head of) · SCFHS no. + extension; fact chips at the end (under it when narrow). */
export function DoctorHeader({ doctor: d }: { doctor: Doctor }) {
  const t = useTranslations("doctors.header")
  const { b, clinicName } = useDoctorText()
  const scfhs = d.credentials.find((c) => c.type === "scfhs")
  const f = d.female ? "F" : ""
  const facts = [
    t("years", { n: d.yearsExp }),
    b(d.languages),
    d.ages && t("ages", { from: d.ages[0], to: d.ages[1] }),
    d.booking.acceptsNew ? t(`acceptsNew${f}`) : t(`noNew${f}`),
  ].filter(Boolean) as string[]
  const status = d.status === "in" ? t("statusRoom", { status: b(d.statusLabel), room: d.room }) : b(d.statusLabel)
  return (
    <section className="@container/hd rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-4 @4xl/hd:flex-row @4xl/hd:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <Avatar size="lg" className="size-13">
            <AvatarFallback>{d.initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-col items-start gap-1 @4xl/hd:flex-row @4xl/hd:items-center @4xl/hd:gap-2">
              <h2 className="text-xl font-semibold">{b(d.name)}</h2>
              <StatusBadge tone={STATUS_TONE[d.status]}>{status}</StatusBadge>
            </div>
            <p className="text-sm text-muted-foreground">
              {d.headOf ? t(`head${f}`, { title: b(d.title), clinic: clinicName(d.headOf) }) : b(d.title)}
            </p>
            {scfhs && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("ids", { no: scfhs.number, ext: d.ext || "none" })}
              </p>
            )}
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5 @4xl/hd:w-90 @4xl/hd:justify-end">
          {facts.map((x) => (
            <li key={x} className="inline-flex h-6 items-center rounded-full border bg-card px-2.5 text-xs font-medium text-foreground">
              {ltr(x)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const VISIT_TONE: Record<VisitState, "success" | "info" | "warning" | "neutral"> = {
  done: "success",
  inRoom: "info",
  waiting: "warning",
  checkedIn: "warning",
  free: "neutral",
  booked: "neutral",
}

/** Widget / Doctor Today: time · patient over reason · status; narrow cards start at the patient in the room. Day view → Appointments. */
function Today({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.today")
  const { b, nextFree } = useDoctorText()
  const list = todayOf(d)
  const patients = React.useMemo(() => allPatients(), [])
  const fileOf = (en?: string) => (en ? patients.find((p) => p.name.en === en) : undefined)
  const firstLive = list.findIndex((v) => v.state !== "done")
  return (
    <Widget
      title={t("title")}
      description={
        list.length === 0
          ? b(d.statusLabel)
          : d.status === "later"
            ? t("textLater", { booked: d.today.booked, time: d.today.nextFree })
            : t("text", { seen: d.today.seen, booked: d.today.booked, time: nextFree(d) })
      }
      className={cn("gap-2 p-4 md:p-5", className)}
      action={
        <IfModule id="appointments">
          <Button variant="ghost" size="sm" className="-me-2 shrink-0" asChild>
            <Link href={`/appointments?view=day&date=${DOCTORS_TODAY}`}>
              {t("dayView")}
              <Icon name="arrow-right-1" size={16} />
            </Link>
          </Button>
        </IfModule>
      }
    >
      {list.length === 0 ? (
        <EmptyState icon="calendar-2" title={t("empty")} description={d.awayNote && b(d.awayNote)} className="py-6" />
      ) : (
        <ul className="flex flex-col divide-y">
          {list.map((v, i) => {
            const file = fileOf(v.patient?.en)
            return (
              <li
                key={v.time + i}
                className={cn("flex items-center gap-3 py-2.5", i < firstLive && i < 2 && "hidden @lg/widget:flex")}
              >
                <span className="w-11 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{v.time}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  {v.patient ? (
                    <>
                      <span className="truncate text-sm font-medium">
                        {file ? (
                          <Link href={patientHref(file.id)} className="rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                            {b(v.patient)}
                          </Link>
                        ) : (
                          b(v.patient)
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{b(v.reason)}</span>
                    </>
                  ) : (
                    <span className="truncate text-sm text-muted-foreground">{b(v.reason)}</span>
                  )}
                </div>
                <StatusBadge tone={VISIT_TONE[v.state]}>{t(`state.${v.state}`, { room: d.room, n: v.waited ?? 0 })}</StatusBadge>
              </li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}

/** Widget / Doctor Week Load: booked per day Sun–Thu, today highlighted. */
function WeekLoad({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.week")
  const { dates } = useDoctorText()
  const days: Weekday[] = ["sun", "mon", "tue", "wed", "thu"]
  const vals = days.map((w) => d.booked[w])
  const vmax = Math.max(24, Math.ceil(Math.max(...vals) / 6) * 6)
  const short = (w: Weekday) => dates.weekdayShort(dayDate(w))
  return (
    <Widget
      title={t("title")}
      description={ltr(t("text", { range: `15–19 ${dates.month(WEEK_FROM)}` }))}
      className={cn("gap-4 p-4 md:p-5", className)}
    >
      <VBars values={vals} labels={days.map(short)} vmax={vmax} highlight={days.indexOf("wed")} height={150} ariaLabel={t("title")} />
    </Widget>
  )
}

/** Widget / Doctor Month: Visits · Avg consult · No-show · Rating, against the clinic (4 in a row when wide, else 2×2). */
function Month({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.month")
  const { dates, clinicName } = useDoctorText()
  const doctors = useDoctors()
  const clinic = useClinics().find((c) => c.key === d.clinic)
  const peers = doctors.filter((x) => x.clinic === d.clinic && x.active)
  const clinicConsult = Math.round(peers.reduce((s, x) => s + x.month.consult, 0) / Math.max(1, peers.length))
  const m = d.month
  const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")
  const items = [
    { k: "visits", label: t("visits"), value: m.visits.toLocaleString("en"), cap: t("visitsDelta", { d: sign(m.delta), month: dates.month("2026-10-15") }), good: m.delta >= 0 },
    { k: "consult", label: t("consult"), value: t("min", { n: m.consult }), cap: t("clinicMin", { n: clinicConsult }) },
    {
      k: "noShow",
      label: t("noShow"),
      value: `${m.noShow}%`,
      cap: clinic ? t("clinicPct", { n: clinic.month.noShow }) : "",
      good: clinic ? m.noShow <= clinic.month.noShow : false,
    },
    { k: "rating", label: t("rating"), value: `${m.rating} / 5`, cap: t("reviews", { n: m.reviews }) },
  ]
  return (
    <Widget
      title={t("title")}
      description={ltr(t("text", { range: dates.dayRange(MONTH_FROM, DOCTORS_TODAY).replace(" – ", "–"), clinic: clinicName(d.clinic) }))}
      className={cn("gap-4 p-4 md:p-5", className)}
    >
      <div className="grid grid-cols-2 gap-3 @2xl/widget:grid-cols-4">
        {items.map((it) => (
          <div key={it.k} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted p-3">
            <span className="text-xs text-muted-foreground">{it.label}</span>
            <span className="text-lg font-semibold text-foreground tabular-nums">
              {ltr(it.value)}
            </span>
            <span className={cn("text-xs tabular-nums", it.good ? "text-success" : "text-muted-foreground")}>
              {ltr(it.cap)}
            </span>
          </div>
        ))}
      </div>
    </Widget>
  )
}

/** Widget / Doctor Works In: the main clinic (head / member · days · room → clinic page) and telehealth evenings. */
function WorksIn({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.works")
  const { clinicName, dates } = useDoctorText()
  const clinic = useClinics().find((c) => c.key === d.clinic)
  const daysLabel = useDaysLabel()
  const f = d.female ? "F" : ""
  const clinicDays = WEEKDAYS.filter((w) => d.week[w].some((s) => !s.telehealth))
  const teleDays = WEEKDAYS.filter((w) => d.week[w].some((s) => s.telehealth))
  const tele = teleDays.length ? d.week[teleDays[0]].find((s) => s.telehealth)! : null
  const clinicsOn = isModuleEnabled("clinics")
  const name = clinicName(d.clinic)
  const tx = useTranslations("doctors.worksExtra")
  const tr = useTranslations("doctors.assign.roles")
  const tp = useTranslations("doctors.profile")
  const clinics = useClinics()
  const [assigning, setAssigning] = React.useState(false)
  const assigned = d.assignments ?? []
  const count = 1 + (tele ? 1 : 0) + new Set(assigned.map((a) => a.clinic)).size
  return (
    <Widget
      title={t(`title${f}`)}
      description={t("text", { clinics: count, h: weekHours(d) })}
      className={cn("gap-2 p-5", className)}
      action={
        clinicsOn && (
          <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setAssigning(true)}>
            <Icon name="add" size={16} />
            {tx("assign")}
          </Button>
        )
      }
    >
      <ul className="flex flex-col divide-y">
        <li className="flex items-center gap-2.5 py-2.5">
          {clinic && <ClinicTile icon={clinic.icon} tone={clinic.tone} className="size-9" />}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{d.headOf === d.clinic ? t(`head${f}`, { clinic: name }) : t("member", { clinic: name })}</span>
            <span className="truncate text-xs text-muted-foreground tabular-nums">{ltr(clinicDays.length ? t("where", { days: daysLabel(clinicDays), room: d.room }) : tp("roomValue", { n: d.room }))}</span>
          </div>
          {clinicsOn && clinic && (
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={clinicHref(clinic.key)} aria-label={t("openClinic", { clinic: name })}>
                <Icon name="arrow-right-1" size={16} />
              </Link>
            </Button>
          )}
        </li>
        {tele && (
          <li className="flex items-center gap-2.5 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <Icon name="video" size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{t("telehealth")}</span>
              <span className="truncate text-xs text-muted-foreground tabular-nums">
                {ltr(t("teleWhere", { days: daysLabel(teleDays), hours: `${tele.from}–${tele.to}` }))}
              </span>
            </div>
          </li>
        )}
        {assigned.map((a) => {
          const c = clinics.find((x) => x.key === a.clinic)
          const started = a.start <= DOCTORS_TODAY
          return (
            <li key={`${a.clinic}-${a.day}-${a.from}`} className="flex items-center gap-2.5 py-2.5">
              {c ? <ClinicTile icon={c.icon} tone={c.tone} className="size-9" /> : <span className="size-9 shrink-0" />}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{tx("assigned", { clinic: clinicName(a.clinic), role: tr(a.role, { grade: d.grade }) })}</span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {ltr(tx("assignedWhere", { day: a.day, hours: `${a.from}–${a.to}`, room: a.room }) + (started ? "" : tx("startsOn", { date: dates.dayMonth(a.start) })))}
                </span>
              </div>
              {clinicsOn && c && (
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link href={clinicHref(c.key)} aria-label={t("openClinic", { clinic: clinicName(a.clinic) })}>
                    <Icon name="arrow-right-1" size={16} />
                  </Link>
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {assigning && <AssignClinicDialog doctorKey={d.key} onOpenChange={(o) => !o && setAssigning(false)} />}
    </Widget>
  )
}

const CRED_ORDER: CredentialType[] = ["scfhs", "bls", "pals", "acls", "malpractice", "moh"]

/** Status badge text for a credential: Valid · Expired · "38 days left". */
export function useCredLabel() {
  const t = useTranslations("doctors.creds")
  return (c: Credential) => {
    const s = credStatus(c)
    return s === "valid" ? t("status.valid") : s === "expired" ? t("status.expired") : t("status.left", { n: daysUntil(c.expires) })
  }
}

/** Widget / Doctor Credentials Summary: up to 4 credentials (the ones due first), each with its expiry and status. View all → Credentials tab. */
function CredSummary({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.creds")
  const { dates } = useDoctorText()
  const label = useCredLabel()
  const byOrder = (a: Credential, z: Credential) => CRED_ORDER.indexOf(a.type) - CRED_ORDER.indexOf(z.type)
  const due = d.credentials.filter((c) => credStatus(c) !== "valid")
  const rest = d.credentials.filter((c) => credStatus(c) === "valid").sort(byOrder)
  const shown = [...due, ...rest].slice(0, 4).sort(byOrder)
  return (
    <Widget
      title={t("title")}
      description={t("text", { n: due.length })}
      className={cn("gap-2 p-5", className)}
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" asChild>
          <Link href={doctorHref(d.key, "credentials")}>
            {t("viewAll")}
            <Icon name="arrow-right-1" size={16} />
          </Link>
        </Button>
      }
    >
      <ul className="flex flex-col divide-y">
        {shown.map((c) => (
          <li key={c.type} className="flex items-center gap-2.5 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                <bdi>{t(`name.${c.type}`)}</bdi>
              </span>
              <span className="truncate text-xs text-muted-foreground tabular-nums">{t("until", { date: dates.short(c.expires) })}</span>
            </div>
            <StatusBadge tone={CRED_TONE[credStatus(c)]}>{label(c)}</StatusBadge>
          </li>
        ))}
      </ul>
    </Widget>
  )
}

/** Widget / Doctor Leave: annual balance (n days left · used of 21, bar) and the upcoming leave with its status. */
export function LeaveCard({ doctor: d, className }: { doctor: Doctor; className?: string }) {
  const t = useTranslations("doctors.leave")
  const tr = useTranslations("doctors.request")
  const { b, dates } = useDoctorText()
  const doctors = useDoctors()
  const [requesting, setRequesting] = React.useState(false)
  const upcoming = useLeaves().filter((l) => l.doctor === d.key && l.to >= DOCTORS_TODAY && l.status !== "declined").sort((a, z) => a.from.localeCompare(z.from))
  const left = ANNUAL_LEAVE - d.leaveUsed
  const coverOf = (key?: string, name?: { en: string; ar: string }) => {
    const c = key ? doctors.find((x) => x.key === key)?.name : name
    return c ? b(c) : ""
  }
  return (
    <Widget title={t("title")} description={t("text", { year: DOCTORS_TODAY.slice(0, 4) })} className={cn("gap-3 p-5", className)}
      action={
        <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setRequesting(true)}>
          <Icon name="add" size={16} />
          {tr("open")}
        </Button>
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">{t("left", { n: left })}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{t("used", { used: d.leaveUsed, total: ANNUAL_LEAVE })}</span>
      </div>
      <Progress value={(d.leaveUsed / ANNUAL_LEAVE) * 100} className="h-1.5" aria-label={t("used", { used: d.leaveUsed, total: ANNUAL_LEAVE })} />
      {upcoming.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {upcoming.map((l) => {
            const cover = coverOf(l.cover, l.coverName)
            const sub = [t(`type.${l.type}`), cover ? t("cover", { name: cover }) : l.place ? b(l.place) : ""].filter(Boolean).join(" · ")
            return (
              <li key={l.id} className="flex items-center gap-2.5 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium tabular-nums">{ltr(l.from === l.to ? dates.short(l.from) : dates.dayRange(l.from, l.to).replace(" – ", "–"))}</span>
                  <span className="text-xs text-muted-foreground">{sub}</span>
                </div>
                <StatusBadge tone={l.status === "approved" ? "success" : "warning"}>{t(`status.${l.status}`)}</StatusBadge>
              </li>
            )
          })}
        </ul>
      )}
      {requesting && <RequestLeaveDialog doctorKey={d.key} onOpenChange={setRequesting} />}
    </Widget>
  )
}
