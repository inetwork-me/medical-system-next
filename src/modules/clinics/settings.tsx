"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import type { Bi } from "@/lib/mock/bi"
import { Icon } from "@/components/ds/icon"
import { Field } from "@/components/ds/field"
import { DatePicker } from "@/components/ds/pickers"
import { ReassignBookings, type ReassignChoice } from "@/components/ds/reassign-bookings"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClinicPage, useCurrentClinic } from "./clinic/frame"
import {
  ALL_DOCTORS,
  BRANCHES,
  CHECKLIST,
  CLINICS_TODAY,
  SPECIALTIES,
  WEEKDAYS,
  blankClinic,
  checklistOf,
  type ChecklistKey,
  type Clinic,
} from "./data"
import { addToWaitlist } from "@/modules/appointments/waitlist"
import { ltr } from "@/modules/doctors/text"
import { clinicHref, type ClinicTab } from "./href"
import { nextOpenDays, siteCandidates, type SiteCover } from "./reassign"
import { SwitchCard } from "./parts"
import { addClinic, updateClinic, useClinics } from "./store"
import { useClinicText } from "./text"

/* ================================================================== form model */

type Ages = "all" | "kids" | "teens" | "adults"
const AGES: Record<Ages, [number, number] | null> = { all: null, kids: [0, 14], teens: [15, 120], adults: [18, 120] }
const agesKey = (a: [number, number] | null): Ages => (!a ? "all" : a[0] === 0 ? "kids" : a[0] === 15 ? "teens" : "adults")

type Form = {
  nameEn: string
  nameAr: string
  specialty: string
  head: string
  ages: Ages
  branch: string
  place: string
  ext: string
  whatsapp: string
  online: boolean
  walkIns: boolean
  eyes: boolean
  dental: boolean
}

/** "Floor 2 · Wing B" / "الدور 2 · الجناح B" → floor 2, wing B (0 / "" when it can't be read). */
const parsePlace = (s: string) => ({ floor: Number(s.match(/\d+/)?.[0] ?? 0), wing: s.match(/([A-Za-z])\s*$/)?.[1]?.toUpperCase() ?? "" })

function formOf(c: Clinic, placeText: string): Form {
  return {
    nameEn: c.name.en,
    nameAr: c.name.ar,
    specialty: c.specialty.en,
    head: c.head.en,
    ages: agesKey(c.ages),
    branch: BRANCHES.find((b) => b.name.en === c.branch.en)?.key ?? BRANCHES[0].key,
    place: c.floor ? placeText : "",
    ext: c.ext,
    whatsapp: c.whatsapp,
    online: c.rules.online,
    walkIns: c.rules.walkIns,
    eyes: c.specialtyTools.eyes,
    dental: c.specialtyTools.dental,
  }
}

type Errors = Partial<Record<keyof Form, string>>

function validate(f: Form, t: (k: "required" | "extInvalid") => string): Errors {
  const e: Errors = {}
  if (!f.nameEn.trim()) e.nameEn = t("required")
  if (!f.nameAr.trim()) e.nameAr = t("required")
  if (!f.specialty) e.specialty = t("required")
  if (f.ext && !/^\d{4}$/.test(f.ext)) e.ext = t("extInvalid")
  return e
}

/** The clinic fields a saved form writes. */
function fieldsOf(f: Form, list: Clinic[], base: Clinic): Partial<Clinic> {
  const spec = SPECIALTIES.find((s) => s.en === f.specialty)
  const head = ALL_DOCTORS(list).find((d) => d.name.en === f.head)
  const { floor, wing } = parsePlace(f.place)
  return {
    name: { en: f.nameEn.trim(), ar: f.nameAr.trim() },
    short: base.short.en ? base.short : { en: f.nameEn.trim(), ar: f.nameAr.trim() },
    specialty: spec ?? base.specialty,
    ...(head ? { head: head.name, headInitials: head.initials } : {}),
    ages: AGES[f.ages],
    branch: BRANCHES.find((b) => b.key === f.branch)?.name ?? base.branch,
    floor,
    wing,
    ext: f.ext,
    whatsapp: f.whatsapp,
    rules: { ...base.rules, online: f.online, walkIns: f.walkIns },
    specialtyTools: { eyes: f.eyes, dental: f.dental },
  }
}

/* ================================================================== Widget / Clinic Settings · New Clinic Form */

/**
 * Sections: Basics · Location & contact · Booking · Specialty tools (the switches turn the patient Eyes / Dental tabs
 * on; hidden when the branch has those tabs off) · [Pause or archive]. Two columns when wide (≥ 40rem), one on mobile.
 */
function ClinicForm({
  form,
  set,
  errors,
  heads,
  danger,
}: {
  form: Form
  set: <K extends keyof Form>(k: K, v: Form[K]) => void
  errors: Errors
  heads: { name: Bi; initials: string }[]
  danger?: React.ReactNode
}) {
  const t = useTranslations("clinics.settings")
  const { b } = useClinicText()
  const eyesOn = isTabEnabled("patients", "eyes")
  const dentalOn = isTabEnabled("patients", "dental")
  const select = (k: "specialty" | "head" | "ages" | "branch", label: string, options: { value: string; label: string }[], opts: { required?: boolean; ph?: string; wide?: boolean } = {}) => (
    <Field label={label} required={opts.required} error={errors[k]} className={cn(opts.wide && "@xl/form:col-span-2")}>
      {(p) => (
        <Select value={form[k] || undefined} onValueChange={(v) => set(k, v as never)}>
          <SelectTrigger {...p} className="w-full">
            <SelectValue placeholder={opts.ph} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
  const text = (k: "nameEn" | "nameAr" | "place" | "ext" | "whatsapp", label: string, opts: { required?: boolean; ph?: string; dir?: "ltr" | "rtl"; icon?: React.ReactNode; inputMode?: "numeric" | "tel" } = {}) => (
    <Field label={label} required={opts.required} error={errors[k]}>
      <Input
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={opts.ph}
        dir={opts.dir}
        inputMode={opts.inputMode}
        startIcon={opts.icon}
      />
    </Field>
  )
  const section = (title: string, desc: string, children: React.ReactNode) => (
    <Widget title={title} description={desc} className="gap-4 p-4 md:p-6">
      <div className="@container/form">
        <div className="grid grid-cols-1 gap-4 @xl/form:grid-cols-2">{children}</div>
      </div>
    </Widget>
  )
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <Icon name="danger" />
          <AlertTitle>{t("fixErrors")}</AlertTitle>
        </Alert>
      )}
      {section(
        t("basics"),
        t("basicsText"),
        <>
          {text("nameEn", t("nameEn"), { required: true, ph: t("nameEnPh"), dir: "ltr" })}
          {text("nameAr", t("nameAr"), { required: true, ph: t("nameArPh"), dir: "rtl" })}
          {select("specialty", t("specialty"), SPECIALTIES.map((s) => ({ value: s.en, label: b(s) })), { required: true, ph: t("specialtyPh") })}
          {select("head", t("head"), heads.map((d) => ({ value: d.name.en, label: b(d.name) })), { ph: t("headPh") })}
          {select("ages", t("ages"), (["all", "kids", "teens", "adults"] as const).map((a) => ({ value: a, label: t(`ageOptions.${a}`) })), { wide: true })}
        </>
      )}
      {section(
        t("location"),
        t("locationText"),
        <>
          {select("branch", t("branch"), BRANCHES.map((br) => ({ value: br.key, label: b(br.name) })), { required: true })}
          {text("place", t("place"), { ph: t("placePh") })}
          {text("ext", t("ext"), { ph: t("extPh"), dir: "ltr", inputMode: "numeric" })}
          {text("whatsapp", t("whatsapp"), { ph: "+966…", dir: "ltr", inputMode: "tel", icon: <Icon name="message" size={16} /> })}
        </>
      )}
      <Widget title={t("booking")} description={t("bookingText")} className="gap-4 p-4 md:p-6">
        <SwitchCard label={t("online")} hint={t("onlineText")} checked={form.online} onCheckedChange={(v) => set("online", v)} />
        <SwitchCard label={t("walkIns")} checked={form.walkIns} onCheckedChange={(v) => set("walkIns", v)} />
      </Widget>
      {isModuleEnabled("patients") && (eyesOn || dentalOn) && (
        <Widget title={t("tools")} description={t("toolsText")} className="gap-4 p-4 md:p-6">
          {eyesOn && <SwitchCard label={t("eyes")} hint={t("eyesText")} checked={form.eyes} onCheckedChange={(v) => set("eyes", v)} />}
          {dentalOn && <SwitchCard label={t("dental")} hint={t("dentalText")} checked={form.dental} onCheckedChange={(v) => set("dental", v)} />}
        </Widget>
      )}
      {danger}
    </div>
  )
}

/** Form validation never toasts (DS sheet 12): the fields show their errors, an Alert tops the form, focus goes to the first one. */
const focusInvalid = () => requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus())

function useForm(initial: () => Form) {
  const [form, setForm] = React.useState<Form>(initial)
  const [tried, setTried] = React.useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  return { form, setForm, set, tried, setTried }
}

/* ================================================================== Clinic page · Settings */

/** Clinic page · Settings: Discard (→ Overview) · Save changes (toast); mobile: fixed action bar instead of the bottom nav. */
export function ClinicSettingsPage() {
  const c = useCurrentClinic()
  const t = useTranslations("clinics.settings")
  const { place, b } = useClinicText()
  const router = useRouter()
  const clinics = useClinics()
  const { form, set, setForm, tried, setTried } = useForm(() => formOf(c, place(c)))
  const errors = tried ? validate(form, t) : {}
  const [dialog, setDialog] = React.useState<null | "pause" | "archive">(null)

  const discard = () => {
    setForm(formOf(c, place(c)))
    setTried(false)
    router.push(clinicHref(c.key))
  }
  const save = () => {
    setTried(true)
    if (Object.keys(validate(form, t)).length) return focusInvalid()
    updateClinic(c.key, fieldsOf(form, clinics, c))
    toast.success(t("saved"), { description: t("savedText") })
  }
  const paused = c.status === "paused" || (!!c.pausedFrom && !!c.pausedUntil && c.pausedUntil > CLINICS_TODAY)
  const resume = () => {
    updateClinic(c.key, { status: "open", pausedFrom: undefined, pausedUntil: undefined, pauseNote: undefined })
    toast.success(t("resumed"), { description: t("resumedText", { clinic: b(c.name) }) })
  }
  const actions = (
    <>
      <Button variant="outline" onClick={discard}>
        {t("discard")}
      </Button>
      <Button onClick={save}>
        <Icon name="tick-circle" size={24} />
        {t("save")}
      </Button>
    </>
  )
  return (
    <ClinicPage
      actions={
        <>
          <Button variant="outline" className="max-md:hidden" onClick={discard}>
            {t("discard")}
          </Button>
          <Button className="max-md:hidden" onClick={save}>
            <Icon name="tick-circle" size={24} />
            {t("save")}
          </Button>
        </>
      }
      className="max-md:pb-28"
    >
      <ClinicForm
        form={form}
        set={set}
        errors={errors}
        heads={c.doctors.map((d) => ({ name: d.name, initials: d.initials }))}
        danger={
          <Widget title={t("danger")} description={t("dangerText")} className="gap-4 p-4 md:p-6">
            <div className="flex flex-col gap-2 md:flex-row">
              {paused ? (
                <Button variant="outline" onClick={resume}>
                  <Icon name="refresh" size={24} />
                  {t("resume")}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setDialog("pause")}>
                  <Icon name="pause-circle" size={24} />
                  {t("pause")}
                </Button>
              )}
              <Button variant="destructive" onClick={() => setDialog("archive")}>
                <Icon name="archive" size={24} />
                {t("archive")}
              </Button>
            </div>
          </Widget>
        }
      />
      <MobileActionBar>{actions}</MobileActionBar>
      {dialog === "pause" && <PauseDialog clinic={c} onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "archive" && <ArchiveDialog clinic={c} onOpenChange={(o) => !o && setDialog(null)} />}
    </ClinicPage>
  )
}

/* ================================================================== Pause clinic */

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromIso = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Booked visits in a date range: the clinic's daily bookings on its open days (design: Pediatrics 20–24 Nov = 23). */
export function bookedIn(c: Clinic, from: string, to: string) {
  let days = 0
  for (let d = from; d <= to; d = addDays(d, 1)) if (c.hours[WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]].length) days++
  return Math.round(days * c.today.booked * 0.103)
}
const REASONS = ["leave", "renovation", "training", "other"] as const
const REASON_TEXT: Record<(typeof REASONS)[number], Bi> = {
  leave: { en: "Doctor on leave", ar: "الطبيب في إجازة" },
  renovation: { en: "Renovation", ar: "صيانة وتجديد" },
  training: { en: "Staff training", ar: "تدريب الموظفين" },
  other: { en: "Other", ar: "سبب ثاني" },
}

/**
 * Overlay · Pause clinic: warning with the booked visits in the dates · From | Until · Reason · move bookings to the
 * clinic's next doctor / cancel them · text patients → toast "Pediatrics paused 20–24 Nov". Closes those days for
 * booking (Appointments slots too).
 */
function PauseDialog({ clinic: c, onOpenChange }: { clinic: Clinic; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("clinics.pause")
  const tr = useTranslations("common.reassign")
  const { b, dates, locale } = useClinicText()
  const [from, setFrom] = React.useState<Date | undefined>(() => fromIso("2026-11-20"))
  const [until, setUntil] = React.useState<Date | undefined>(() => fromIso("2026-11-24"))
  const [reason, setReason] = React.useState<(typeof REASONS)[number]>("leave")
  const [choice, setChoice] = React.useState<ReassignChoice>("date")
  const [picked, setPicked] = React.useState<string>()
  const [sms, setSms] = React.useState(true)
  const f = from ? isoOf(from) : ""
  const u = until ? isoOf(until) : ""
  const bad = !f || !u || u < f
  const n = bad ? 0 : bookedIn(c, f, u)
  const name = b(c.name)
  const next = bad ? null : nextOpenDays(c, u, n, CLINICS_TODAY)
  const sites = bad ? [] : siteCandidates(c, f, u, n)
  const open = sites.filter((s) => s.state !== "unavailable")
  const pick = picked && open.some((s) => s.site.key === picked) ? picked : open[0]?.site.key
  const ar = locale === "ar"
  const dayLabel = (d: string) => (ar ? dates.weekday(d) : `${dates.weekdayShort(d)} ${dates.dayMonth(d)}`)
  // "25–26 Nov" / "ليوم 25 و26 نوفمبر" (design toast); longer runs as a range.
  const daysText = (days: string[]) => {
    if (!days.length) return ""
    const a = days[0]
    const z = days[days.length - 1]
    if (a === z) return ar ? `ليوم ${dates.dayMonth(a)}` : dates.dayMonth(a)
    if (a.slice(0, 7) !== z.slice(0, 7)) return ar ? `من ${dates.dayMonth(a)} لين ${dates.dayMonth(z)}` : `${dates.dayMonth(a)}–${dates.dayMonth(z)}`
    if (ar) return days.length === 2 ? `ليوم ${Number(a.slice(8))} و${dates.dayMonth(z)}` : `من ${Number(a.slice(8))} لين ${dates.dayMonth(z)}`
    return `${Number(a.slice(8))}–${dates.dayMonth(z)}`
  }
  const siteSub = (s: SiteCover) =>
    s.state === "unavailable" && s.paused
      ? t("sitePaused", { range: `${Number(s.paused[0].slice(8))}–${dates.dayMonth(s.paused[1])}` })
      : s.site.floor !== undefined
        ? t("siteHere", { n: s.site.floor })
        : t("siteAway", { n: s.site.minutesAway ?? 0 })

  const confirm = () => {
    if (bad) return
    // Design: "Pediatrics paused 20–24 Nov" (one month) / "28 Nov–02 Dec".
    const range = f.slice(0, 7) === u.slice(0, 7) ? `${Number(f.slice(8))}–${dates.dayMonth(u)}` : `${dates.dayMonth(f)}–${dates.dayMonth(u)}`
    const enRange = `${f.slice(8)}–${u.slice(8)}`
    updateClinic(c.key, {
      pausedFrom: f,
      pausedUntil: addDays(u, 1),
      ...(f <= CLINICS_TODAY ? { status: "paused" as const } : {}),
      pauseNote: {
        en: `Paused ${enRange} · ${REASON_TEXT[reason].en}`,
        ar: `موقفة ${enRange} · ${REASON_TEXT[reason].ar}`,
      },
    })
    let description: string
    if (choice === "cancel") description = t("toastCancelled", { n, notified: sms ? t("notified") : t("notNotified") })
    else {
      const site = sites.find((s) => s.site.key === pick)
      const moved = choice === "date" ? (next?.moved ?? 0) : site && site.state !== "unavailable" ? site.covered : 0
      const waiting = n - moved
      addToWaitlist({ count: waiting, source: "pause", clinic: c.key, from: f, to: u })
      const after = waiting ? tr("waitingAfter", { n: waiting }) : ""
      description = !moved
        ? t("toastNone") + after
        : (choice === "date" ? t("toastNextDays", { n: moved, days: daysText(next!.days.map((d) => d.date)) }) : t("toastSite", { n: moved, clinic: b(site!.site.name) })) + after
    }
    onOpenChange(false)
    toast.success(t("toast", { clinic: name, range }), { description: ltr(description) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title", { clinic: name })}
      description={t("text")}
      icon="pause-circle"
      tone="warning"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={confirm} disabled={bad}>
          {t("confirm")}
        </Button>
      }
    >
      <div className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs font-medium text-warning-soft-foreground" role="status">
        <Icon name="warning-2" size={18} className="shrink-0" />
        <span>{t("warning", { n })}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-3">
        <Field label={t("from")}>{(p) => <DatePicker {...p} value={from} onChange={setFrom} placeholder="dd/mm/yyyy" />}</Field>
        <Field label={t("until")} error={f && u && u < f ? t("untilError") : undefined}>
          {(p) => <DatePicker {...p} value={until} onChange={setUntil} placeholder="dd/mm/yyyy" />}
        </Field>
      </div>
      <Field label={t("reason")}>
        {(p) => (
          <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
            <SelectTrigger {...p} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`reasons.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      {!bad && (
        <ReassignBookings
          target="clinic"
          count={n}
          department={{ name, short: b(c.short) }}
          value={choice}
          onValueChange={setChoice}
          picked={pick}
          onPick={setPicked}
          candidates={sites.map((s) => ({
            key: s.site.key,
            name: b(s.site.name),
            sub: siteSub(s),
            coverage: s.state === "unavailable" ? { state: "unavailable" } : { state: s.state, covered: s.covered, total: s.total },
          }))}
          preview={next ? { days: next.days.map((d) => ({ key: d.date, label: dayLabel(d.date), n: d.n })), waiting: next.waiting } : undefined}
        />
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={sms} onCheckedChange={(v) => setSms(v === true)} />
        {t("notify")}
      </label>
    </ResponsiveDialog>
  )
}

/* ================================================================== Archive clinic (not in the design) */

function ArchiveDialog({ clinic: c, onOpenChange }: { clinic: Clinic; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("clinics.archive")
  const { b } = useClinicText()
  const router = useRouter()
  const name = b(c.name)
  const confirm = () => {
    updateClinic(c.key, { archived: true })
    onOpenChange(false)
    router.replace("/clinics")
    toast.success(t("toast", { clinic: name }), {
      description: t("toastText"),
      action: { label: t("undo"), onClick: () => updateClinic(c.key, { archived: false }) },
    })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title", { clinic: name })}
      description={t("text")}
      icon="archive"
      tone="destructive"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={confirm}>
          {t("confirm")}
        </Button>
      }
    />
  )
}

/* ================================================================== Widget / New Clinic Checklist */

const STEP_TAB: Partial<Record<ChecklistKey, ClinicTab>> = { hours: "schedule", services: "services", doctor: "doctors", name: "settings", location: "settings" }

/** "Before you open it": progress, the 5 steps (done = green tick) and the note. On a clinic page the open steps link to their tab. */
export function Checklist({ done, clinicKey, className }: { done: Record<ChecklistKey, boolean>; clinicKey?: string; className?: string }) {
  const t = useTranslations("clinics.checklist")
  const n = CHECKLIST.filter((k) => done[k]).length
  return (
    <Widget title={t("title")} description={t("done", { n, total: CHECKLIST.length })} className={cn("gap-4 p-5", className)}>
      <Progress value={(n / CHECKLIST.length) * 100} className="h-1.5" aria-label={t("done", { n, total: CHECKLIST.length })} />
      <ul className="flex flex-col gap-3">
        {CHECKLIST.map((k) => {
          const ok = done[k]
          const label = <span className={cn("text-sm", ok ? "text-foreground" : "text-muted-foreground")}>{t(k)}</span>
          return (
            <li key={k} className="flex items-center gap-2">
              <Icon name={ok ? "tick-circle" : "record-circle"} size={18} className={ok ? "text-success" : "text-muted-foreground"} />
              {clinicKey && !ok && STEP_TAB[k] ? (
                <Link href={clinicHref(clinicKey, STEP_TAB[k])} className="text-sm text-primary underline-offset-2 hover:underline">
                  {t(k)}
                </Link>
              ) : (
                label
              )}
            </li>
          )
        })}
      </ul>
      <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
        <Icon name="info-circle" size={18} className="shrink-0" />
        {t("note")}
      </p>
    </Widget>
  )
}

/* ================================================================== New clinic */

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "clinic"

/**
 * Clinics · New clinic: Cancel (→ list) · Create clinic (→ the new clinic's page + toast). Desktop: the form beside the
 * 280px checklist; tablet / mobile: checklist above the form; mobile: fixed action bar.
 */
export function NewClinicPage() {
  const t = useTranslations("clinics.newClinic")
  const ts = useTranslations("clinics.settings")
  const tn = useTranslations("shell.nav")
  const clinics = useClinics()
  const router = useRouter()
  const empty = blankClinic("", {})
  const { form, set, tried, setTried } = useForm(() => ({ ...formOf(empty, ""), online: true, walkIns: true, ages: "all" as Ages, head: "" }))
  const errors = tried ? validate(form, ts) : {}
  const heads = ALL_DOCTORS(clinics)
  const draft: Clinic = { ...empty, ...fieldsOf(form, clinics, empty) }
  const headDoc = clinics.flatMap((c) => c.doctors).find((d) => d.name.en === form.head)
  const done = checklistOf({ ...draft, doctors: headDoc ? [headDoc] : [] })

  const create = () => {
    setTried(true)
    if (Object.keys(validate(form, ts)).length) return focusInvalid()
    let key = slug(form.nameEn)
    while (clinics.some((c) => c.key === key)) key += "-2"
    const doctors = headDoc
      ? [
          {
            ...headDoc,
            role: { en: "Consultant · head of clinic", ar: "استشاري · رئيس العيادة" },
            today: { tone: "neutral" as const, label: { en: "Starts tomorrow", ar: "يبدأ بكرة" } },
            month: 0,
          },
        ]
      : []
    addClinic(blankClinic(key, { ...fieldsOf(form, clinics, empty), doctors, doctorCount: doctors.length }))
    toast.success(t("toast"), { description: t("toastText") })
    router.push(clinicHref(key))
  }

  return (
    <>
      <PageTitle title={t("title")} crumbs={[{ label: tn("clinics"), href: "/clinics" }]} back="/clinics" />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clinics" aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("title")}</h1>
      </div>
      <PageContainer className="max-md:pb-28">
        <PageHeader
          className="max-md:hidden"
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href="/clinics">{t("cancel")}</Link>
              </Button>
              <Button onClick={create}>
                <Icon name="tick-circle" size={24} />
                {t("create")}
              </Button>
            </>
          }
        />
        <div className="@container/new">
          <div className="flex flex-col gap-4 md:gap-6 @5xl/new:flex-row @5xl/new:items-start">
            <Checklist done={done} className="@5xl/new:order-2 @5xl/new:w-70 @5xl/new:shrink-0" />
            <div className="min-w-0 flex-1 @5xl/new:order-1">
              <ClinicForm form={form} set={set} errors={errors} heads={heads} />
            </div>
          </div>
        </div>
      </PageContainer>
      <MobileActionBar>
        <Button variant="outline" asChild>
          <Link href="/clinics">{t("cancel")}</Link>
        </Button>
        <Button onClick={create}>
          <Icon name="tick-circle" size={24} />
          {t("create")}
        </Button>
      </MobileActionBar>
    </>
  )
}
