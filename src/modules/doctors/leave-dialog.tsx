"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addToWaitlist } from "@/modules/appointments/waitlist"
import { ANNUAL_LEAVE, DOCTORS_TODAY, workingDays, type LeaveType } from "./data"
import { useDoctorMoveBookings } from "./move-bookings"
import { addLeave, useDoctors } from "./store"
import { ltr, useDoctorText } from "./text"

const TYPES: LeaveType[] = ["annual", "sick", "conference", "training", "dayOff"]
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/**
 * Overlay · Request leave (desktop dialog, mobile sheet): Type; From · Until; a warning with the booked visits in those
 * dates and the annual balance; the Move bookings block ("Move to a cover doctor" — the doctor picked there is the cover
 * —, spread across the department, or cancel); text patients. Send request adds a pending request (it goes to the
 * medical director) and swaps to the "leave-requested" toast. Without a fixed doctor (Leave & cover · Add leave) a
 * Doctor select comes first.
 */
export function RequestLeaveDialog({ doctorKey, onOpenChange }: { doctorKey?: string; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("doctors.request")
  const tl = useTranslations("doctors.leave")
  const tc = useTranslations("doctors.col")
  const { b, dates } = useDoctorText()
  const doctors = useDoctors().filter((x) => x.active)
  const [who, setWho] = React.useState(doctorKey ?? doctors[0]?.key ?? "")
  const d = doctors.find((x) => x.key === who)
  const [type, setType] = React.useState<LeaveType>("annual")
  const [from, setFrom] = React.useState<Date | undefined>()
  const [to, setTo] = React.useState<Date | undefined>()
  const [text, setText] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const a = from ? isoOf(from) : ""
  const z = to ? isoOf(to) : ""
  const ready = !!a && !!z && z >= a
  const move = useDoctorMoveBookings(d, ready ? a : "", ready ? z : "", { leave: true })
  if (!d) return null

  const left = ANNUAL_LEAVE - d.leaveUsed
  const n = move.count
  const days = ready ? workingDays(d, a, z) : 0
  const fromErr = tried && !a ? t("required") : a && a < DOCTORS_TODAY ? t("past") : undefined
  const toErr = tried && !z ? t("required") : a && z && z < a ? t("order") : undefined

  const send = () => {
    setTried(true)
    if (!ready || a < DOCTORS_TODAY) return
    const o = move.outcome()
    const plan =
      o.kind === "doctor" && o.cover
        ? { cover: o.cover.key }
        : o.kind === "spread"
          ? { coverName: { en: `Spread across ${o.doctors} doctors`, ar: `موزّعة على ${o.doctors} أطباء` } }
          : { cancelBookings: true }
    addLeave({ id: `lv-${d.key}-${a}-${z}-${type}`, doctor: d.key, type, from: a, to: z, status: "pending", bookings: n, ...plan })
    if (o.kind !== "cancel") addToWaitlist({ count: o.waiting, source: "leave", doctor: d.key, from: a, to: z })
    onOpenChange(false)
    const range = a === z ? dates.dayMonth(a) : dates.dayRange(a, z).replace(" – ", "–").replace(/ \d{4}$/, "")
    toast.success(t("sent"), { description: ltr(t("sentText", { dates: range })) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title", { name: b(d.name) })}
      description={t("sub")}
      icon="calendar-2"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={send}>{t("send")}</Button>}
    >
      {!doctorKey && (
        <Field label={tc("doctor")}>
          {(p) => (
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((x) => (
                  <SelectItem key={x.key} value={x.key}>
                    {b(x.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      <Field label={t("type")}>
        {(p) => (
          <Select value={type} onValueChange={(v) => setType(v as LeaveType)}>
            <SelectTrigger {...p} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((k) => (
                <SelectItem key={k} value={k}>
                  {tl(`type.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("from")} required error={fromErr}>
          {(p) => <DatePicker {...p} value={from} onChange={setFrom} placeholder="dd/mm/yyyy" />}
        </Field>
        <Field label={t("until")} required error={toErr}>
          {(p) => <DatePicker {...p} value={to} onChange={setTo} placeholder="dd/mm/yyyy" />}
        </Field>
      </div>
      {ready && (
        <p className="flex items-start gap-2.5 rounded-lg bg-warning-soft p-3 text-xs text-warning-soft-foreground">
          <Icon name="info-circle" size={16} className="mt-px shrink-0" />
          <span>
            {t("warn", { n, left })}
            {type === "annual" && days > left && <> {t("over", { days, left })}</>}
          </span>
        </p>
      )}
      {move.element}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={text} onCheckedChange={(v) => setText(v === true)} />
        {t("notify")}
      </label>
    </ResponsiveDialog>
  )
}
