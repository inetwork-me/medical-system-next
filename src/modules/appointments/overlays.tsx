"use client"

import { patientHref } from "@/modules/patients/href"
import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi, type Bi } from "@/lib/mock/bi"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { useIsMobile } from "@/hooks/use-media-query"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { StatusBadge } from "@/components/ds/status-badge"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { RadioGroup } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useClinicLimits } from "@/modules/clinics/booking"
import { allPatients, patientDetails, type Patient } from "@/modules/patients/data"
import { STATUS_TONE } from "./calendar/agenda"
import { addDays, doctorById, hhmm, isClosed, NOW_MIN, SERVICES, slotsFor, TODAY, type Appointment } from "./data"
import { MonthPicker, Slots } from "./new/new-appointment"
import { useAppointmentActions, useAppointmentsOn, useTimeOff, type LiveAppointment } from "./store"

/* ================================================================== context */

export type OverlayKind = "details" | "checkIn" | "noShow" | "cancel" | "reschedule" | "sms"
type Open = { kind: OverlayKind; id: string; date: string }
const Ctx = React.createContext<{ open: (o: Open) => void } | null>(null)

/** Overlays shared by every Appointments screen: open({ kind, id, date }) from a block, row, card or menu. */
export function AppointmentOverlays({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Open | null>(null)
  const on = useAppointmentsOn()
  const appt = state ? on(state.date).find((a) => a.id === state.id) : undefined
  // Keep the last appointment while a dialog closes / after it moves (reschedule changes its id).
  const [last, setLast] = React.useState<LiveAppointment | undefined>(undefined)
  if (appt && appt.id !== last?.id) setLast(appt)
  const a = appt ?? last
  const ctx = React.useMemo(() => ({ open: (o: Open) => setState(o) }), [])
  const close = (o: boolean) => !o && setState(null)
  const go = (kind: OverlayKind) => a && setState({ kind, id: a.id, date: a.date })
  return (
    <Ctx.Provider value={ctx}>
      {children}
      {a && (
        <>
          <DetailsSheet a={a} open={state?.kind === "details"} onOpenChange={close} onAction={go} />
          {state?.kind === "checkIn" && <CheckInDialog a={a} onOpenChange={close} />}
          {state?.kind === "noShow" && <NoShowDialog a={a} onOpenChange={close} />}
          {state?.kind === "cancel" && <CancelDialog a={a} onOpenChange={close} />}
          {state?.kind === "reschedule" && <RescheduleDialog a={a} onOpenChange={close} />}
          {state?.kind === "sms" && <SmsDialog a={a} onOpenChange={close} />}
        </>
      )}
    </Ctx.Provider>
  )
}

export function useApptOverlay() {
  const ctx = React.useContext(Ctx)
  return {
    open: (kind: OverlayKind, a: Pick<Appointment, "id" | "date">) => ctx?.open({ kind, id: a.id, date: a.date }),
  }
}

/* ================================================================== shared facts */

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const byName = new Map<string, Patient>()
function patientOf(a: Appointment): Patient | undefined {
  if (!a.patient) return undefined
  if (!byName.size) for (const p of allPatients()) byName.set(p.name.en, p)
  return byName.get(a.patient.en)
}

const GUARDIAN: Record<string, { name: Bi; mobile: string }> = { "004891": { name: { en: "Abdullah", ar: "عبدالله" }, mobile: "050 771 2045" } }
const COPAY = 50

/** Facts the overlays show for an appointment: file, plan, guardian, who booked it and how. */
function useFacts(a: LiveAppointment) {
  const locale = useLocale()
  const t = useTranslations("appointments")
  const dates = useDates()
  const p = patientOf(a)
  const h = hash(a.id)
  const doc = doctorById(a.doctor)
  const plan = p ? patientDetails(p).insurance : h % 3 ? { en: "Tawuniya · Class A", ar: "التعاونية · فئة A" } : null
  const shortPlan = plan ? bi(plan, locale).replace(/ · (Class|فئة) /, " ") : null
  const guardian = p ? GUARDIAN[p.id] : undefined
  const name = a.patient ? bi(a.patient, locale) : t("calendar.bookedSlot")
  const bookedOn = addDays(a.date, -(2 + (h % 5)))
  const via = (["phone", "online", "desk"] as const)[h % 3]
  return {
    p,
    doc,
    name,
    first: name.split(" ")[0],
    doctor: bi(doc.name, locale),
    clinic: bi(doc.clinic, locale),
    reason: a.reason ? bi(a.reason, locale) : "—",
    plan: shortPlan,
    guardian,
    mobile: guardian?.mobile ?? p?.mobile ?? `05${String(h % 100000000).padStart(8, "0").replace(/(\d)(\d{3})(\d{4})$/, "$1 $2 $3")}`,
    mrn: p?.mrn ?? String(4000 + (h % 999)).padStart(6, "0"),
    age: p?.age ?? 18 + (h % 50),
    vip: p?.tags.includes("vip") ?? h % 7 === 0,
    when: `${dates.weekdayShort(a.date)} ${dates.dayMonth(a.date)}`,
    time: hhmm(a.start),
    range: `${hhmm(a.start)}–${hhmm(a.start + a.duration)}`,
    bookedOn,
    bookedBy: bi([{ en: "Reem", ar: "ريم" }, { en: "Huda", ar: "هدى" }, { en: "Sami", ar: "سامي" }][h % 3], locale),
    via,
    noShows: 1 + (h % 2),
  }
}

/** Muted key/value list (design: Details 10px radius, 12/16 rows, border between). */
function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="flex flex-col divide-y overflow-hidden rounded-lg bg-muted text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 px-3 py-[9px]">
          <dt className="min-w-0 flex-1 text-muted-foreground">{k}</dt>
          <dd className="text-end font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const open = (a: LiveAppointment) => a.status === "booked" || a.status === "confirmed"

/* ================================================================== details */

/**
 * Overlay · Appointment details: end sheet (440) on md+, bottom sheet on mobile. Name · MRN · age · VIP, status
 * badge with the live timer, facts, timeline, secondary actions and the next step (Check in / Call in / Finish).
 */
function DetailsSheet({ a, open: isOpen, onOpenChange, onAction }: { a: LiveAppointment; open: boolean; onOpenChange: (o: boolean) => void; onAction: (k: OverlayKind) => void }) {
  const t = useTranslations("appointments.ov")
  const ts = useTranslations("appointments.status")
  const mobile = useIsMobile()
  const f = useFacts(a)
  const { setStatus } = useAppointmentActions()
  const tl = useTranslations("appointments.list")
  const dates = useDates()
  const mins = a.since !== undefined ? Math.max(0, NOW_MIN - a.since) : 0

  const badge = a.status === "arrived" ? t("details.waiting", { n: mins }) : a.status === "withDoctor" ? t("details.withDoctor", { n: mins }) : ts(a.status)
  const header = (
    <>
      <span className="text-lg font-semibold">{f.name}</span>
      <span className="text-xs text-muted-foreground">
        {[t("details.meta", { mrn: f.mrn, age: f.age }), f.vip && t("details.vip")].filter(Boolean).join(" · ")}
      </span>
    </>
  )

  const quick = (to: "withDoctor" | "completed") => {
    const from = a.status
    const since = a.since
    setStatus(a.id, to)
    onOpenChange(false)
    notify.success(to === "withDoctor" ? tl("toast.calledIn") : tl("toast.finished"), {
      description: to === "withDoctor" ? tl("toast.calledInText", { name: f.name, doctor: f.doctor }) : tl("toast.finishedText", { name: f.name, time: f.time, doctor: f.doctor }),
      action: { label: tl("toast.undo"), onClick: () => setStatus(a.id, from, since) },
    })
  }

  const next =
    open(a) ? (
      <Button onClick={() => onAction("checkIn")}>
        <Icon name="tick-circle" size={24} />
        {t("details.checkIn")}
      </Button>
    ) : a.status === "arrived" ? (
      <Button onClick={() => quick("withDoctor")}>
        <Icon name="people" size={24} />
        {t("details.callIn")}
      </Button>
    ) : a.status === "withDoctor" ? (
      <Button onClick={() => quick("completed")}>
        <Icon name="tick-square" size={24} />
        {t("details.finish")}
      </Button>
    ) : a.status === "noShow" || a.status === "cancelled" ? (
      <Button asChild>
        <Link href={`/appointments/new?doctor=${a.doctor}${f.p ? `&patient=${f.p.id}` : ""}`}>
          <Icon name="calendar-add" size={24} />
          {t("details.rebook")}
        </Link>
      </Button>
    ) : null
  const reschedule = (open(a) || a.status === "arrived") && (
    <Button variant="outline" onClick={() => onAction("reschedule")}>
      <Icon name="calendar-2" size={24} />
      {t("details.reschedule")}
    </Button>
  )

  const events: { icon: IconName; title: string; meta: string }[] = [
    { icon: "calendar-add", title: t("details.ev.booked", { via: f.via }), meta: t("details.ev.bookedMeta", { date: dates.dayMonth(f.bookedOn), time: "14:02", who: f.bookedBy }) },
    a.reminded && a.date >= TODAY && { icon: "sms" as IconName, title: t("details.ev.reminder"), meta: t("details.ev.reminderMeta", { date: dates.dayMonth(addDays(a.date, -1)), time: "10:00" }) },
    a.status !== "booked" &&
      a.status !== "cancelled" && { icon: "tick-circle" as IconName, title: t("details.ev.confirmed"), meta: t("details.ev.confirmedMeta", { date: dates.dayMonth(addDays(a.date, -1)), time: "10:12" }) },
    ["arrived", "withDoctor", "completed"].includes(a.status) && {
      icon: "profile-2user" as IconName,
      title: t("details.ev.arrived"),
      meta: t("details.ev.arrivedMeta", { date: dates.dayMonth(a.date), time: hhmm(a.status === "arrived" && a.since !== undefined ? a.since : Math.max(a.start - 8, 0)) }),
    },
    ["withDoctor", "completed"].includes(a.status) && {
      icon: "people" as IconName,
      title: t("details.ev.calledIn"),
      meta: t("details.ev.calledInMeta", { date: dates.dayMonth(a.date), time: hhmm(a.status === "withDoctor" && a.since !== undefined ? a.since : a.start), room: f.doc.room }),
    },
    a.status === "completed" && { icon: "tick-square" as IconName, title: t("details.ev.finished"), meta: `${dates.dayMonth(a.date)} · ${hhmm(a.start + a.duration)}` },
    a.status === "noShow" && { icon: "close-circle" as IconName, title: t("details.ev.noShow"), meta: `${dates.dayMonth(a.date)} · ${hhmm(a.start + 15)}` },
    a.status === "cancelled" && { icon: "close-circle" as IconName, title: t("details.ev.cancelled"), meta: dates.dayMonth(f.bookedOn) },
  ].filter(Boolean) as { icon: IconName; title: string; meta: string }[]

  const body = (
    <div className="flex flex-col gap-4">
      <StatusBadge tone={STATUS_TONE[a.status]}>{badge}</StatusBadge>
      <KV
        rows={[
          [t("details.dateTime"), `${f.when} · ${f.range}`],
          [t("details.doctor"), f.doctor],
          [t("details.clinicRoom"), t("details.clinicRoomValue", { clinic: f.clinic, room: f.doc.room })],
          [t("details.service"), t("details.serviceValue", { name: f.reason, n: a.duration })],
          [t("details.insurance"), f.plan ? t("details.insured", { plan: f.plan, n: COPAY }) : t("details.selfPay")],
          [t("details.bookedBy"), t("details.bookedByValue", { who: f.bookedBy, date: dates.dayMonth(f.bookedOn), via: t(`details.via.${f.via}`) })],
        ]}
      />
      <span className="text-xs font-medium">{t("details.timeline")}</span>
      <ol className="flex flex-col">
        {events.map((e) => (
          <li key={e.title} className="flex gap-2.5 py-1.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon name={e.icon} size={14} />
            </span>
            <span className="flex min-w-0 flex-col text-xs">
              <span className="font-medium">{e.title}</span>
              <span className="text-muted-foreground">{e.meta}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {open(a) && (
          <Button variant="outline" size="sm" onClick={() => onAction("sms")}>
            <Icon name="sms" size={24} />
            {t("details.sendReminder")}
          </Button>
        )}
        {(open(a) || a.status === "arrived") && (
          <Button variant="outline" size="sm" onClick={() => onAction("noShow")}>
            <Icon name="close-circle" size={24} />
            {t("details.noShow")}
          </Button>
        )}
        {(open(a) || a.status === "arrived") && (
          <Button variant="ghost" size="sm" onClick={() => onAction("cancel")}>
            {t("details.cancelAppt")}
          </Button>
        )}
        {f.p && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={patientHref(f.p.id)}>{t("details.openFile")}</Link>
          </Button>
        )}
      </div>
    </div>
  )

  if (mobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-start">
            <DrawerTitle className="flex flex-col gap-1">{header}</DrawerTitle>
            <DrawerDescription className="sr-only">{f.range}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-2">{body}</div>
          <div className="flex flex-col gap-2 p-4 *:h-10 *:w-full">
            {next}
            {reschedule}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="end" showCloseButton={false} className="w-110 gap-5 p-6 sm:max-w-110">
        <div className="flex items-start gap-3">
          <SheetTitle className="flex min-w-0 flex-1 flex-col gap-1">{header}</SheetTitle>
          <SheetDescription className="sr-only">{f.range}</SheetDescription>
          <Button variant="ghost" size="icon-sm" aria-label={t("close")} onClick={() => onOpenChange(false)}>
            <Icon name="close-circle" size={24} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        <div className="flex justify-end gap-2">
          {reschedule}
          {next}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ================================================================== check in */

function CheckInDialog({ a, onOpenChange }: { a: LiveAppointment; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("appointments.ov")
  const tl = useTranslations("appointments.list")
  const tf = useTranslations("appointments.new.summary")
  const f = useFacts(a)
  const { setStatus } = useAppointmentActions()
  const [checks, setChecks] = React.useState({ id: true, insurance: !!f.plan, contact: false })
  const [pay, setPay] = React.useState<"mada" | "cash" | "later">("mada")
  const [room, setRoom] = React.useState(String(f.doc.room))

  const confirm = () => {
    const from = a.status
    const since = a.since
    setStatus(a.id, "arrived")
    onOpenChange(false)
    notify.success(tl("toast.checkedIn"), {
      description: t("checkIn.toastText", { name: f.first, room }),
      action: { label: tl("toast.undo"), onClick: () => setStatus(a.id, from, since) },
    })
  }
  const check = (k: keyof typeof checks, label: string) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checks[k]} onCheckedChange={(v) => setChecks((c) => ({ ...c, [k]: v === true }))} />
      {label}
    </label>
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      icon="profile-2user"
      title={t("checkIn.title", { name: f.name })}
      description={t("checkIn.sub", { time: f.time, doctor: f.doctor, clinic: f.clinic })}
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={confirm}>
          <Icon name="tick-circle" size={24} />
          {t("checkIn.confirm")}
        </Button>
      }
    >
      {check("id", t("checkIn.id"))}
      {f.plan ? check("insurance", t("checkIn.insurance", { plan: f.plan })) : <p className="text-sm text-muted-foreground">{t("checkIn.noInsurance")}</p>}
      {check("contact", t("checkIn.contact"))}
      <KV rows={[[t("checkIn.copay"), tf("feeValue", { n: f.plan ? COPAY : (SERVICES[a.doctor].find((s) => s.name.en === a.reason?.en)?.fee ?? 300) })]]} />
      <RadioGroup value={pay} onValueChange={(v) => setPay(v as typeof pay)} className="gap-2" aria-label={t("checkIn.payLabel")}>
        {(["mada", "cash", "later"] as const).map((k) => (
          <RadioOption key={k} value={k} title={t(`checkIn.pay.${k}`)} />
        ))}
      </RadioGroup>
      <Field label={t("checkIn.room")}>
        {(p) => (
          <Select value={room} onValueChange={setRoom}>
            <SelectTrigger {...p} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {t("checkIn.roomValue", { n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    </ResponsiveDialog>
  )
}

/* ================================================================== no-show */

function NoShowDialog({ a, onOpenChange }: { a: LiveAppointment; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("appointments.ov")
  const tl = useTranslations("appointments.list")
  const f = useFacts(a)
  const { setStatus } = useAppointmentActions()
  const [sms, setSms] = React.useState(true)
  const confirm = () => {
    const from = a.status
    const since = a.since
    setStatus(a.id, "noShow")
    onOpenChange(false)
    notify.info(tl("toast.noShow"), {
      description: t("noShow.toastText", { name: f.name, time: f.time, doctor: f.doctor, sms: sms ? "yes" : "no" }),
      action: { label: tl("toast.undo"), onClick: () => setStatus(a.id, from, since) },
    })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      icon="close-circle"
      tone="destructive"
      title={t("noShow.title", { name: f.name })}
      description={t("noShow.sub", { time: f.time, doctor: f.doctor, clinic: f.clinic })}
      width="sm:max-w-115"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("keep")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={confirm}>
          {t("noShow.confirm")}
        </Button>
      }
    >
      <p className="flex items-start gap-2.5 rounded-lg bg-warning-soft p-3 text-xs text-warning-soft-foreground">
        <Icon name="warning-2" size={18} className="shrink-0" />
        {f.noShows > 1 ? t("noShow.second", { name: f.first }) : t("noShow.first", { name: f.first })}
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={sms} onCheckedChange={(v) => setSms(v === true)} />
        {t("noShow.rebook")}
      </label>
    </ResponsiveDialog>
  )
}

/* ================================================================== cancel */

function CancelDialog({ a, onOpenChange }: { a: LiveAppointment; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("appointments.ov")
  const tl = useTranslations("appointments.list")
  const f = useFacts(a)
  const { setStatus } = useAppointmentActions()
  const [reason, setReason] = React.useState<"patient" | "doctor" | "mistake">("patient")
  const [sms, setSms] = React.useState(true)
  const confirm = () => {
    const from = a.status
    const since = a.since
    setStatus(a.id, "cancelled")
    onOpenChange(false)
    notify.info(tl("toast.cancelled"), {
      description: t("cancelAppt.toastText", { name: f.name, when: `${f.when} · ${f.time}`, doctor: f.doctor }),
      action: { label: tl("toast.undo"), onClick: () => setStatus(a.id, from, since) },
    })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      icon="close-circle"
      tone="destructive"
      title={t("cancelAppt.title")}
      description={t("cancelAppt.sub")}
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("keep")}
        </Button>
      }
      primary={
        <Button variant="destructive" onClick={confirm}>
          {t("cancelAppt.confirm")}
        </Button>
      }
    >
      <KV
        rows={[
          [t("cancelAppt.current"), `${f.when} · ${f.time}`],
          [t("cancelAppt.clinic"), t("cancelAppt.clinicValue", { clinic: f.clinic, doctor: f.doctor })],
        ]}
      />
      <RadioGroup value={reason} onValueChange={(v) => setReason(v as typeof reason)} className="gap-2" aria-label={t("cancelAppt.reasonLabel")}>
        {(["patient", "doctor", "mistake"] as const).map((k) => (
          <RadioOption key={k} value={k} title={t(`cancelAppt.reason.${k}`)} />
        ))}
      </RadioGroup>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={sms} onCheckedChange={(v) => setSms(v === true)} />
        {f.guardian ? t("cancelAppt.notifyGuardian") : t("cancelAppt.notifyPatient")}
      </label>
    </ResponsiveDialog>
  )
}

/* ================================================================== reschedule */

function RescheduleDialog({ a, onOpenChange }: { a: LiveAppointment; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("appointments.ov")
  const tn = useTranslations("appointments.new.when")
  const tl = useTranslations("appointments.list")
  const locale = useLocale()
  const dates = useDates()
  const f = useFacts(a)
  const on = useAppointmentsOn()
  const timeOff = useTimeOff()
  const { reschedule } = useAppointmentActions()
  const firstOpen = (() => {
    let d = a.date < TODAY ? TODAY : a.date
    for (let i = 0; i < 14 && (isClosed(d) || d === a.date); i++) d = addDays(d, 1)
    return d
  })()
  const [date, setDate] = React.useState(firstOpen)
  const [time, setTime] = React.useState<number | null>(null)
  const [sms, setSms] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const leave = timeOff.find((o) => o.doctor === a.doctor && o.from <= date && o.to >= date)
  // Free times only: booked ones are greyed (unlike New appointment, a move never double-books).
  const taken = on(date).filter((x) => x.doctor === a.doctor && x.status !== "cancelled" && x.id !== a.id)
  const clinicLimits = useClinicLimits()
  const slots = leave || isClosed(date) ? [] : slotsFor(a.doctor, date, clinicLimits(a.doctor, date)).map((s) => ({ ...s, held: s.held || taken.some((x) => x.start < s.start + a.duration && x.start + x.duration > s.start) }))

  const confirm = () => {
    setTried(true)
    if (time === null) return
    const undo = reschedule(a, date, time)
    onOpenChange(false)
    notify.success(t("reschedule.toast"), {
      description: t("reschedule.toastText", { name: f.name, from: `${f.when} · ${f.time}`, to: `${dates.weekdayShort(date)} ${dates.dayMonth(date)} · ${hhmm(time)}`, sms: sms ? "yes" : "no" }),
      action: { label: tl("toast.undo"), onClick: undo },
    })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      icon="calendar-2"
      title={t("reschedule.title")}
      description={t("reschedule.sub")}
      width="sm:max-w-150"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={confirm}>
          <Icon name="tick-circle" size={24} />
          {t("reschedule.confirm")}
        </Button>
      }
    >
      <KV
        rows={[
          [t("reschedule.current"), `${f.when} · ${f.time}`],
          [t("reschedule.clinic"), t("cancelAppt.clinicValue", { clinic: f.clinic, doctor: f.doctor })],
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-[17rem_minmax(0,1fr)]">
        <MonthPicker
          date={date}
          onPick={(d) => {
            setDate(d)
            setTime(null)
          }}
        />
        <div className="flex flex-col gap-3">
          <Slots
            label={`${dates.weekdayShort(date)} ${dates.dayMonth(date)}`}
            slots={slots}
            value={time}
            empty={leave ? tn("onLeave", { doctor: f.doctor }) : isClosed(date) ? tn("closed") : tn("noSlots", { doctor: f.doctor })}
            onPick={setTime}
            error={tried && time === null ? t("reschedule.pick") : undefined}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={sms} onCheckedChange={(v) => setSms(v === true)} />
            {f.guardian ? t("reschedule.notifyGuardian") : t("reschedule.notifyPatient")}
          </label>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {locale && time !== null ? `${dates.full(date)} ${hhmm(time)}` : ""}
      </span>
    </ResponsiveDialog>
  )
}

/* ================================================================== SMS */

function SmsDialog({ a, onOpenChange }: { a: LiveAppointment; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("appointments.ov.sms")
  const tc = useTranslations("appointments.ov")
  const locale = useLocale()
  const dates = useDates()
  const f = useFacts(a)
  const { remind } = useAppointmentActions()
  const to = {
    patient: t("toPatient", { name: f.name, mobile: f.mobile }),
    ...(f.guardian ? { guardian: t("toGuardian", { name: bi(f.guardian.name, locale), mobile: f.guardian.mobile }) } : {}),
  } as Record<string, string>
  const [recipient, setRecipient] = React.useState(f.guardian ? "guardian" : "patient")
  const [template, setTemplate] = React.useState<"reminder" | "confirm" | "late">("reminder")
  const body = (k: typeof template) =>
    t(`body.${k}`, { name: f.first, clinic: f.clinic, doctor: f.doctor, date: `${dates.weekdayShort(a.date)} ${dates.dayMonth(a.date)}`, time: f.time })
  const [text, setText] = React.useState(() => body("reminder"))
  const [tried, setTried] = React.useState(false)
  const send = () => {
    setTried(true)
    if (!text.trim()) return
    remind(a.id)
    onOpenChange(false)
    notify.success(t("toast"), { description: t("toastText", { to: to[recipient].split(" · ").slice(0, 2).join(" · "), template: t(`templates.${template}`) }) })
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      icon="sms"
      title={t("title")}
      width="sm:max-w-125"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("cancel")}
        </Button>
      }
      primary={
        <Button onClick={send}>
          <Icon name="sms" size={24} />
          {t("send")}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("to")}>
          {(p) => (
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(to).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("template")}>
          {(p) => (
            <Select
              value={template}
              onValueChange={(v) => {
                setTemplate(v as typeof template)
                setText(body(v as typeof template))
              }}
            >
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["reminder", "confirm", "late"] as const).map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`templates.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={t("message")} helper={t("counter", { n: text.length, sms: Math.max(1, Math.ceil(text.length / 160)) })} error={tried && !text.trim() ? t("required") : undefined}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className={cn("min-h-27.5")} />
      </Field>
    </ResponsiveDialog>
  )
}
