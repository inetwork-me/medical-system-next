"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useClinics } from "@/modules/clinics/store"
import { ASSIGN_ROLES, DOCTORS_TODAY, WEEKDAYS, assignmentsOn, type AssignRole, type Doctor, type Weekday } from "./data"
import { updateDoctor, useDoctor } from "./store"
import { ltr, useDoctorText } from "./text"

const WORKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu"]
const HOURS = ["08:00–12:00", "13:00–16:00", "16:00–20:00", "20:00–22:00"]
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const split = (range: string) => range.split("–") as [string, string]
const overlaps = (a: [string, string], b: [string, string]) => minutes(a[0]) < minutes(b[1]) && minutes(b[0]) < minutes(a[1])
const hoursOn = (d: Doctor, day: Weekday) => d.week[day].reduce((n, s) => n + minutes(s.to) - minutes(s.from), 0)
/** Busy ranges that day: own shifts (telehealth too) and other clinics already assigned. */
const busyOn = (d: Doctor, day: Weekday): [string, string][] => [...d.week[day].map((s) => [s.from, s.to] as [string, string]), ...assignmentsOn(d, day).map((a) => [a.from, a.to] as [string, string])]
/** First `day` at least a week out ("bookable from next week"; design: Thursday → 26 Nov from Wed 18 Nov). */
export function startOn(day: Weekday, today = DOCTORS_TODAY) {
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7)
  while (WEEKDAYS[d.getUTCDay()] !== day) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Overlay · Assign clinic (Works in → Assign; desktop dialog, mobile sheet): Clinic; Role · Room; Days · Hours; a note
 * saying whether those hours are free in the main clinic's hours. Assign adds a weekly shift in that clinic, bookable
 * from next week, and swaps to the "clinic-assigned" toast. Clashing hours can't be assigned.
 */
export function AssignClinicDialog({ doctorKey, onOpenChange }: { doctorKey: string; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("doctors.assign")
  const { b, dates, clinicName } = useDoctorText()
  const d = useDoctor(doctorKey)
  const clinics = useClinics().filter((c) => !c.archived && c.key !== d?.clinic)
  const [clinic, setClinic] = React.useState(() => (clinics.find((c) => c.key === "eyes") ?? clinics[0])?.key ?? "")
  const c = clinics.find((x) => x.key === clinic)
  const [role, setRole] = React.useState<AssignRole>("visiting")
  const [room, setRoom] = React.useState(() => c?.rooms.at(-1)?.number ?? "")
  // Default day: the lightest working day (Thursday for Dr. Ahmed Zaki), then the first hours that are free.
  const [day, setDay] = React.useState<Weekday>(() => (d ? [...WORKDAYS].reverse().sort((a, z) => hoursOn(d, a) - hoursOn(d, z))[0] : "thu"))
  const [hours, setHours] = React.useState(() => (d ? (HOURS.find((h) => !busyOn(d, day).some((x) => overlaps(split(h), x))) ?? HOURS[1]) : HOURS[1]))
  if (!d) return null

  const range = split(hours)
  const clashOwn = d.week[day].some((s) => overlaps(range, [s.from, s.to]))
  const clashAssigned = assignmentsOn(d, day).find((a) => overlaps(range, [a.from, a.to]))
  const clash = clashOwn || !!clashAssigned
  const main = clinicName(d.clinic)
  const female = String(d.female)
  const note = clashAssigned
    ? t("taken", { clinic: clinicName(clashAssigned.clinic) })
    : clashOwn
      ? t("clash", { day, hours, female, clinic: main })
      : t("free", { day, hours, female, clinic: main })
  const rooms = c?.rooms.map((r) => r.number) ?? []

  const pickClinic = (k: string) => {
    setClinic(k)
    setRoom(clinics.find((x) => x.key === k)?.rooms.at(-1)?.number ?? "")
  }
  const assign = () => {
    if (clash || !c) return
    const start = startOn(day)
    updateDoctor(d.key, (x) => ({ assignments: [...(x.assignments ?? []), { clinic: c.key, role, room, day, from: range[0], to: range[1], start }] }))
    onOpenChange(false)
    toast.success(t("toast", { clinic: b(c.name) }), { description: ltr(t("toastText", { day, date: dates.dayMonth(start), female })) })
  }

  const pick = (label: string, value: string, set: (v: string) => void, items: { value: string; label: string }[], opts: { required?: boolean; wide?: boolean } = {}) => (
    <Field label={label} required={opts.required} className={cn(opts.wide && "sm:col-span-2")}>
      {(p) => (
        <Select value={value || undefined} onValueChange={set}>
          <SelectTrigger {...p} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((it) => (
              <SelectItem key={it.value} value={it.value}>
                {it.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="hospital"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={assign} disabled={clash || !c}>
          {t("confirm")}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pick(t("clinic"), clinic, pickClinic, clinics.map((x) => ({ value: x.key, label: b(x.name) })), { required: true, wide: true })}
        {pick(t("role"), role, (v) => setRole(v as AssignRole), ASSIGN_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`, { grade: d.grade }) })))}
        {pick(t("room"), room, setRoom, rooms.map((r) => ({ value: r, label: b({ en: `Room ${r}`, ar: `غرفة ${r}` }) })))}
        {pick(t("days"), day, (v) => setDay(v as Weekday), WORKDAYS.map((w) => ({ value: w, label: t("day", { day: w }) })))}
        <Field label={t("hours")}>
          {(p) => (
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>
                    <bdi dir="ltr" className="tabular-nums">
                      {h}
                    </bdi>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <p
        role={clash ? "alert" : undefined}
        className={cn(
          "flex items-start gap-2.5 rounded-lg p-3 text-xs tabular-nums",
          clash ? "bg-warning-soft text-warning-soft-foreground" : "bg-info-soft text-info-soft-foreground"
        )}
      >
        <Icon name={clash ? "warning-2" : "info-circle"} size={16} className="mt-px shrink-0" />
        <span>{ltr(note)}</span>
      </p>
    </ResponsiveDialog>
  )
}
