"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { RadioOption } from "@/components/ds/radio-option"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ANNUAL_LEAVE, DOCTORS_TODAY, bookingsBetween, workingDays, type LeaveType } from "./data"
import { addLeave, useDoctors } from "./store"
import { ltr, useDoctorText } from "./text"

const TYPES: LeaveType[] = ["annual", "sick", "conference", "training", "dayOff"]
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/**
 * Overlay · Request leave (desktop dialog, mobile sheet): Type · Cover doctor; From · Until; a warning with the booked
 * visits in those dates and the annual balance; move bookings to the cover / cancel them; text patients. Send request
 * adds a pending request (it goes to the medical director) and swaps to the "leave-requested" toast. Without a fixed
 * doctor (Leave & cover · Add leave) a Doctor select comes first.
 */
export function RequestLeaveDialog({ doctorKey, onOpenChange }: { doctorKey?: string; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("doctors.request")
  const tl = useTranslations("doctors.leave")
  const tc = useTranslations("doctors.col")
  const { b, dates } = useDoctorText()
  const doctors = useDoctors().filter((x) => x.active)
  const [who, setWho] = React.useState(doctorKey ?? doctors[0]?.key ?? "")
  const d = doctors.find((x) => x.key === who)
  const peersOf = (key: string) => {
    const me = doctors.find((x) => x.key === key)
    return doctors.filter((x) => x.key !== key).sort((a, z) => Number(z.clinic === me?.clinic) - Number(a.clinic === me?.clinic))
  }
  const peers = peersOf(who)
  const [type, setType] = React.useState<LeaveType>("annual")
  const [cover, setCover] = React.useState(() => peers[0]?.key ?? "")
  const [from, setFrom] = React.useState<Date | undefined>()
  const [to, setTo] = React.useState<Date | undefined>()
  const [move, setMove] = React.useState<"move" | "cancel">("move")
  const [text, setText] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  if (!d) return null

  const a = from ? isoOf(from) : ""
  const z = to ? isoOf(to) : ""
  const left = ANNUAL_LEAVE - d.leaveUsed
  const ready = !!a && !!z && z >= a
  const n = ready ? bookingsBetween(d, a, z) : 0
  const days = ready ? workingDays(d, a, z) : 0
  const coverDoc = doctors.find((x) => x.key === cover)
  const fromErr = tried && !a ? t("required") : a && a < DOCTORS_TODAY ? t("past") : undefined
  const toErr = tried && !z ? t("required") : a && z && z < a ? t("order") : undefined
  const coverErr = tried && move === "move" && !coverDoc ? t("needCover") : undefined

  const send = () => {
    setTried(true)
    if (!ready || a < DOCTORS_TODAY || (move === "move" && !coverDoc)) return
    addLeave({ id: `lv-${d.key}-${a}-${z}-${type}`, doctor: d.key, type, from: a, to: z, cover: coverDoc?.key, status: "pending", bookings: n, ...(move === "cancel" ? { cancelBookings: true } : {}) })
    onOpenChange(false)
    const range = a === z ? dates.dayMonth(a) : dates.dayRange(a, z).replace(" – ", "–").replace(/ \d{4}$/, "")
    notify.success(t("sent"), { description: ltr(t("sentText", { dates: range })) })
  }

  const pick = (label: string, value: string, set: (v: string) => void, items: { value: string; label: string }[], error?: string) => (
    <Field label={label} error={error}>
      {(p) => (
        <Select value={value} onValueChange={set}>
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
      {!doctorKey &&
        pick(
          tc("doctor"),
          who,
          (v) => {
            setWho(v)
            setCover(peersOf(v)[0]?.key ?? "")
          },
          doctors.map((x) => ({ value: x.key, label: b(x.name) }))
        )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pick(t("type"), type, (v) => setType(v as LeaveType), TYPES.map((k) => ({ value: k, label: tl(`type.${k}`) })))}
        {pick(t("cover"), cover, setCover, peers.map((x) => ({ value: x.key, label: b(x.name) })), coverErr)}
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
      <RadioGroup value={move} onValueChange={(v) => setMove(v as "move" | "cancel")} className="gap-2" aria-label={t("cover")}>
        <RadioOption value="move" title={coverDoc ? t("move", { name: b(coverDoc.name) }) : t("moveNone")} />
        <RadioOption value="cancel" title={t("cancelBookings")} />
      </RadioGroup>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={text} onCheckedChange={(v) => setText(v === true)} />
        {t("notify")}
      </label>
    </ResponsiveDialog>
  )
}
