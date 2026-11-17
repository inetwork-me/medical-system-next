"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi } from "@/lib/mock/bi"
import { Link, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { StatusBadge } from "@/components/ds/status-badge"
import { notify } from "@/components/ds/toast"
import { PageContainer } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { allPatients, filterPatients, patientById, patientDetails, type Patient } from "@/modules/patients/data"
import { UnsavedDialog, useLeaveGuard } from "@/modules/patients/edit/leave-guard"
import { addMonths, DOCTORS, doctorById, hhmm, isClosed, monthCells, SERVICES, slotsFor, TODAY, type DoctorId } from "../data"
import { useAppointmentActions, useAppointmentsOn, useTimeOff } from "../store"

/** Design sample: Fahad Al-Dosari (MRN 004891) — guardian Abdullah, balance SAR 180. */
const GUARDIAN: Record<string, { en: string; ar: string }> = { "004891": { en: "Abdullah", ar: "عبدالله" } }
const BALANCE: Record<string, number> = { "004891": 180 }
const COPAY = 50

export type NewAppointmentInitial = { patient?: string; doctor?: string; date?: string }

/**
 * Appointments · New appointment (+ Conflict) · 1440 / 768 / 390: four numbered cards — Patient (search, picked
 * card with balance, "Not registered?"), Service (clinic, doctor, service, in person / telehealth), Date & time
 * (month + morning / afternoon slots; a booked slot shows the conflict + "Double-book anyway"), Reminders & notes —
 * and the summary card with Book appointment (sticky beside the form on xl, under it below xl).
 */
export function NewAppointment({ initial }: { initial: NewAppointmentInitial }) {
  const t = useTranslations("appointments.new")
  const tn = useTranslations("shell.nav")
  const locale = useLocale()
  const dates = useDates()
  const router = useRouter()
  const on = useAppointmentsOn()
  const timeOff = useTimeOff()
  const { book } = useAppointmentActions()

  const startDoctor = (DOCTORS.find((d) => d.id === initial.doctor)?.id ?? "az") as DoctorId
  const [patient, setPatient] = React.useState<Patient | null>(() => (initial.patient ? patientById(initial.patient) ?? null : null))
  const [doctor, setDoctor] = React.useState<DoctorId>(startDoctor)
  const [service, setService] = React.useState(SERVICES[startDoctor][0].key)
  const [visit, setVisit] = React.useState<"inPerson" | "telehealth">("inPerson")
  const [date, setDate] = React.useState(initial.date && initial.date >= TODAY ? initial.date : TODAY)
  const [time, setTime] = React.useState<number | null>(null)
  const [urgent, setUrgent] = React.useState(false)
  const [urgentReason, setUrgentReason] = React.useState("")
  const [sms, setSms] = React.useState(true)
  const [whatsapp, setWhatsapp] = React.useState(true)
  const [note, setNote] = React.useState("")
  const [tried, setTried] = React.useState(false)

  const doc = doctorById(doctor)
  const svc = SERVICES[doctor].find((s) => s.key === service) ?? SERVICES[doctor][0]
  const docName = bi(doc.name, locale)
  const leave = timeOff.find((o) => o.doctor === doctor && o.from <= date && o.to >= date)
  const slots = leave || isClosed(date) ? [] : slotsFor(doctor, date)
  const clash =
    time === null ? undefined : on(date).find((a) => a.doctor === doctor && a.status !== "cancelled" && a.start < time + svc.minutes && a.start + a.duration > time)
  const dirty = !!patient || time !== null || !!note.trim()
  const guard = useLeaveGuard(dirty)

  const pickDoctor = (id: DoctorId) => {
    setDoctor(id)
    setService(SERVICES[id][0].key)
    setTime(null)
    setUrgent(false)
  }
  const pickDate = (d: string) => {
    setDate(d)
    setTime(null)
    setUrgent(false)
  }

  const errors = {
    patient: !patient ? t("patient.required") : undefined,
    time: time === null ? t("when.required") : undefined,
    reason: clash && urgent && !urgentReason.trim() ? t("when.reasonRequired") : undefined,
  }
  const blocked = !!clash && !urgent

  const submit = () => {
    setTried(true)
    if (errors.patient || errors.time || errors.reason || blocked || !patient || time === null) return
    book({
      id: `new-${date}-${doctor}-${time}-${patient.id}`,
      date,
      doctor,
      start: time,
      duration: svc.minutes,
      patient: patient.name,
      reason: svc.name,
      status: "booked",
      telehealth: visit === "telehealth",
    })
    guard.allow()
    notify.success(t("booked"), {
      description: t("bookedText", {
        name: bi(patient.name, locale).split(" ")[0],
        date: `${dates.weekdayShort(date)} ${dates.dayMonth(date)}`,
        time: hhmm(time),
        doctor: docName,
        reminder: sms || whatsapp ? "yes" : "no",
      }),
    })
    router.push(date === TODAY ? "/appointments" : `/appointments?date=${date}`)
  }

  const summary = (
    <Summary
      rows={[
        [t("summary.patient"), patient ? bi(patient.name, locale) : "—"],
        [t("summary.doctor"), docName],
        [t("summary.date"), `${dates.weekdayShort(date)} ${dates.short(date)}`],
        [t("summary.time"), time === null ? "—" : `${hhmm(time)}–${hhmm(time + svc.minutes)}`],
        [t("summary.service"), t("summary.serviceValue", { name: bi(svc.name, locale), n: svc.minutes })],
        [t("summary.fee"), t("summary.feeValue", { n: svc.fee })],
        [t("summary.insurance"), insuranceText(patient)],
      ]}
      conflict={blocked}
      onBook={submit}
    />
  )

  function insuranceText(p: Patient | null) {
    if (!p) return "—"
    const plan = patientDetails(p).insurance
    if (!plan) return t("summary.selfPay")
    return t("summary.insured", { plan: bi(plan, locale).replace(/ · (Class|فئة) /, " "), n: COPAY })
  }

  return (
    <>
      <PageTitle title={t("title")} back="/appointments" crumbs={[{ label: tn("appointments"), href: "/appointments" }]} />
      {/* Mobile: no bottom navigation on this form (design) */}
      <span data-mobile-action-bar hidden />
      <PageContainer className="gap-4 md:gap-6">
        {/* Mobile heading: back · title · Cancel, breadcrumb under it */}
        <div className="flex flex-col gap-1 md:hidden">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="-ms-1.5" aria-label={tn("appointments")} onClick={() => guard.leave(`/${locale}/appointments`)}>
              <Icon name="arrow-left" size={24} />
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{t("title")}</h1>
            <Button variant="outline" onClick={() => guard.leave(`/${locale}/appointments`)}>
              <Icon name="close-circle" size={20} />
              {t("cancel")}
            </Button>
          </div>
          <nav className="text-xs" aria-label={tn("appointments")}>
            <Link href="/appointments" className="text-primary hover:underline">
              {tn("appointments")}
            </Link>
            <span className="text-muted-foreground"> / {t("title")}</span>
          </nav>
        </div>
        <div className="hidden justify-end md:flex">
          <Button variant="outline" onClick={() => guard.leave(`/${locale}/appointments`)}>
            <Icon name="close-circle" size={20} />
            {t("cancel")}
          </Button>
        </div>

        <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* 1 · Patient */}
            <Step n={1} title={t("patient.title")} text={t("patient.text")}>
              <PatientPicker value={patient} onChange={setPatient} error={tried ? errors.patient : undefined} />
            </Step>

            {/* 2 · Service */}
            <Step n={2} title={t("service.title")} text={t("service.text")}>
              <div className="@container/svc">
                <div className="grid gap-4 @min-[30rem]/svc:grid-cols-2">
                  <Field label={t("service.clinic")} required>
                    {(p) => (
                      <Select value={doctor} onValueChange={(v) => pickDoctor(v as DoctorId)}>
                        <SelectTrigger {...p} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCTORS.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {bi(d.clinic, locale)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field label={t("service.doctor")} required>
                    {(p) => (
                      <Select value={doctor} onValueChange={(v) => pickDoctor(v as DoctorId)}>
                        <SelectTrigger {...p} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCTORS.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {bi(d.name, locale)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field label={t("service.service")} required>
                    {(p) => (
                      <Select
                        value={service}
                        onValueChange={(v) => {
                          setService(v)
                          setUrgent(false)
                        }}
                      >
                        <SelectTrigger {...p} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICES[doctor].map((s) => (
                            <SelectItem key={s.key} value={s.key}>
                              {t("service.serviceOption", { name: bi(s.name, locale), n: s.minutes, fee: s.fee })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium" id="visit-type">
                      {t("service.visitType")}
                    </span>
                    <Segmented
                      aria-labelledby="visit-type"
                      value={visit}
                      onValueChange={setVisit}
                      options={[
                        { value: "inPerson", label: t("service.inPerson") },
                        { value: "telehealth", label: t("service.telehealth") },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </Step>

            {/* 3 · Date & time */}
            <Step n={3} title={t("when.title")} text={t("when.text", { doctor: docName })}>
              <div className="@container/when flex flex-col gap-4">
                <div className="grid gap-5 @min-[36rem]/when:grid-cols-[17.5rem_minmax(0,1fr)]">
                  <MonthPicker date={date} onPick={pickDate} />
                  <Slots
                    label={`${dates.weekdayShort(date)} ${dates.dayMonth(date)}`}
                    slots={slots}
                    value={time}
                    empty={leave ? t("when.onLeave", { doctor: docName }) : isClosed(date) ? t("when.closed") : t("when.noSlots", { doctor: docName })}
                    onPick={(m) => {
                      setTime(m)
                      setUrgent(false)
                    }}
                    error={tried ? errors.time : undefined}
                  />
                </div>
                {clash && (
                  <>
                    <p role="alert" className="flex items-start gap-2.5 rounded-lg bg-destructive-soft p-3 text-xs text-destructive-soft-foreground">
                      <Icon name="danger" size={18} className="shrink-0" />
                      {t("when.conflict", {
                        doctor: docName,
                        patient: clash.patient ? bi(clash.patient, locale) : "—",
                        time: hhmm(clash.start),
                        date: dates.dayMonth(date),
                      })}
                    </p>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium">{t("when.doubleBook")}</span>
                        <span className="text-xs text-muted-foreground">{t("when.doubleBookText")}</span>
                      </span>
                      <Switch checked={urgent} onCheckedChange={setUrgent} />
                    </label>
                    {urgent && (
                      <Field label={t("when.reason")} required error={tried ? errors.reason : undefined}>
                        <Input value={urgentReason} onChange={(e) => setUrgentReason(e.target.value)} placeholder={t("when.reasonPlaceholder")} />
                      </Field>
                    )}
                  </>
                )}
              </div>
            </Step>

            {/* 4 · Reminders & notes */}
            <Step n={4} title={t("reminders.title")} text={t("reminders.text")}>
              <div className="@container/rem flex flex-col gap-4">
                <div className="grid gap-4 @min-[30rem]/rem:grid-cols-2">
                  <SwitchCard label={t("reminders.sms")} hint={t("reminders.smsText")} checked={sms} onChange={setSms} />
                  <SwitchCard label={t("reminders.whatsapp")} hint={t("reminders.whatsappText")} checked={whatsapp} onChange={setWhatsapp} />
                </div>
                <Field label={t("reminders.note")}>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("reminders.notePlaceholder")} className="min-h-16" />
                </Field>
              </div>
            </Step>
          </div>
          <div className="xl:sticky xl:top-24">{summary}</div>
        </div>
      </PageContainer>
      <UnsavedDialog guard={guard} count={[patient, time !== null, note.trim()].filter(Boolean).length} />
    </>
  )
}

/* ================================================================== pieces */

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6" aria-labelledby={`step-${n}`}>
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">{n}</span>
        <span className="flex min-w-0 flex-col">
          <h2 id={`step-${n}`} className="text-lg font-semibold">
            {title}
          </h2>
          <span className="text-xs text-muted-foreground">{text}</span>
        </span>
      </header>
      {children}
    </section>
  )
}

function SwitchCard({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

/** Patient search: results while typing; the picked patient shows as an accent card (MRN · age · guardian · plan · balance). */
function PatientPicker({ value, onChange, error }: { value: Patient | null; onChange: (p: Patient | null) => void; error?: string }) {
  const t = useTranslations("appointments.new.patient")
  const locale = useLocale()
  const [q, setQ] = React.useState("")
  const results = React.useMemo(() => (q.trim().length >= 2 ? filterPatients(allPatients(), { q }, locale).slice(0, 5) : []), [q, locale])

  return (
    <div className="flex flex-col gap-3">
      <Field label={t("find")} error={error}>
        {(p) => (
          <div className="relative">
            <Icon name="search-normal-1" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              {...p}
              value={value ? bi(value.name, locale) : q}
              onChange={(e) => {
                if (value) onChange(null)
                setQ(e.target.value)
              }}
              placeholder={t("placeholder")}
              className="ps-9"
              autoComplete="off"
            />
          </div>
        )}
      </Field>
      {value ? (
        <PatientCard p={value} selected onClick={() => onChange(null)} label={t("change")} />
      ) : (
        q.trim().length >= 2 &&
        (results.length ? (
          <ul aria-label={t("results")} className="flex flex-col gap-2">
            {results.map((p) => (
              <li key={p.id}>
                <PatientCard
                  p={p}
                  onClick={() => {
                    onChange(p)
                    setQ("")
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("none", { q: q.trim() })}</p>
        ))
      )}
      <Link href="/patients/new" className="flex w-fit items-center gap-2 text-sm text-primary hover:underline">
        <Icon name="user-add" size={24} className="text-foreground" />
        {t("notRegistered")}
      </Link>
    </div>
  )
}

function PatientCard({ p, selected, onClick, label }: { p: Patient; selected?: boolean; onClick: () => void; label?: string }) {
  const t = useTranslations("appointments.new.patient")
  const locale = useLocale()
  const plan = patientDetails(p).insurance
  const guardian = GUARDIAN[p.id]
  const meta = [t("meta", { mrn: p.mrn, age: p.age }), guardian && t("guardian", { name: bi(guardian, locale) }), plan && bi(plan, locale).replace(/ · (Class|فئة) /, " ")]
    .filter(Boolean)
    .join(" · ")
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label ? `${bi(p.name, locale)} · ${label}` : undefined}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:px-4",
        selected ? "border-primary bg-accent" : "bg-card hover:bg-muted/60"
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-medium text-accent-foreground", !selected && "bg-accent")}>{p.initials}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{bi(p.name, locale)}</span>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </span>
      {BALANCE[p.id] && <StatusBadge tone="warning">{t("balance", { n: BALANCE[p.id] })}</StatusBadge>}
    </button>
  )
}

/** Month for booking: today outlined, picked = primary, past days, Fridays and other months greyed. */
export function MonthPicker({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  const t = useTranslations("appointments.calendar")
  const dates = useDates()
  const [month, setMonth] = React.useState(date.slice(0, 7))
  const cells = monthCells(`${month}-01`)
  const weekdays = t("weekdays").split(",")
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <span className="flex-1 text-sm font-medium" aria-live="polite">
          {dates.monthLong(`${month}-01`)}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label={t("prevMonth")} disabled={month <= TODAY.slice(0, 7)} onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}>
          <Icon name="arrow-left-1" size={20} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("nextMonth")} onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}>
          <Icon name="arrow-right-1" size={20} />
        </Button>
      </div>
      <div role="grid" className="grid grid-cols-7 gap-1 text-center text-xs">
        {weekdays.map((w, i) => (
          <span key={i} role="columnheader" className="pb-1 text-muted-foreground">
            {w}
          </span>
        ))}
        {cells.map((d) => {
          const out = !d.startsWith(month)
          const off = d < TODAY || isClosed(d)
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              disabled={off || out}
              aria-selected={d === date}
              aria-current={d === TODAY ? "date" : undefined}
              aria-label={dates.full(d)}
              onClick={() => onPick(d)}
              className={cn(
                "flex h-9 items-center justify-center rounded-lg tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                d === date ? "bg-primary font-medium text-primary-foreground" : d === TODAY ? "border border-primary" : "hover:bg-muted",
                (off || out) && d !== date && "text-muted-foreground/60 hover:bg-transparent"
              )}
            >
              {Number(d.slice(8, 10))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Slots({
  label,
  slots,
  value,
  empty,
  onPick,
  error,
}: {
  label: string
  slots: ReturnType<typeof slotsFor>
  value: number | null
  empty: string
  onPick: (m: number) => void
  error?: string
}) {
  const t = useTranslations("appointments.new.when")
  if (!slots.length) return <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">{empty}</p>
  const groups = [
    { title: t("morning", { date: label }), list: slots.filter((s) => s.start < 12 * 60) },
    { title: t("afternoon"), list: slots.filter((s) => s.start >= 12 * 60) },
  ].filter((g) => g.list.length)
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={label} aria-invalid={!!error || undefined}>
      {groups.map((g) => (
        <React.Fragment key={g.title}>
          <span className="text-sm font-medium">{g.title}</span>
          <div className="flex flex-wrap gap-2">
            {g.list.map((s) => {
              const off = s.held || s.past
              const on = value === s.start
              return (
                <button
                  key={s.start}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={off}
                  title={s.held ? t("held") : s.past ? t("past") : undefined}
                  onClick={() => onPick(s.start)}
                  className={cn(
                    "h-8 min-w-14 rounded-md border px-3 text-xs font-medium tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    off && "border-border/60 text-muted-foreground/50 hover:bg-card"
                  )}
                >
                  {hhmm(s.start)}
                </button>
              )
            })}
          </div>
        </React.Fragment>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Summary({ rows, conflict, onBook }: { rows: [string, string][]; conflict: boolean; onBook: () => void }) {
  const t = useTranslations("appointments.new.summary")
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-6" aria-labelledby="summary-title">
      <header className="flex flex-col gap-1">
        <h2 id="summary-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <span className="text-xs text-muted-foreground">{t("text")}</span>
      </header>
      <dl className="flex flex-col divide-y divide-card overflow-hidden rounded-lg bg-muted text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start gap-3 px-3 py-2.5">
            <dt className="shrink-0 text-muted-foreground">{k}</dt>
            <dd className="min-w-0 flex-1 text-end font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {conflict && (
        <p role="alert" className="flex items-start gap-2.5 rounded-lg bg-destructive-soft p-3 text-xs text-destructive-soft-foreground">
          <Icon name="danger" size={18} className="shrink-0" />
          {t("conflict")}
        </p>
      )}
      <Button className="h-10 w-full" onClick={onBook} disabled={conflict}>
        <Icon name="tick-circle" size={20} />
        {t("book")}
      </Button>
    </section>
  )
}
