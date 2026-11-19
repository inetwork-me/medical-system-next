"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Widget } from "@/components/ds/widget"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ANNUAL_LEAVE, AWAY_WEEK, DOCTORS_TODAY, awayKind, countsAgainstBalance, leaveDays, type Doctor, type Leave } from "./data"
import { shortName } from "./doctor/patients"
import { DoctorsFrame } from "./frame"
import { RequestLeaveDialog } from "./leave-dialog"
import { DoctorName } from "./link"
import { updateDoctor, updateLeave, useDoctors, useLeaves } from "./store"
import { ltr, useDoctorText } from "./text"

const KIND = {
  leave: "bg-warning-soft text-warning-soft-foreground",
  off: "bg-muted text-muted-foreground",
  training: "bg-info-soft text-info-soft-foreground",
} as const
const DOT = { leave: "bg-warning", off: "bg-muted-foreground", training: "bg-info" } as const
type Kind = keyof typeof KIND

/** "07–11 Dec 2026" */
function useRange() {
  const { dates } = useDoctorText()
  return (l: { from: string; to: string }) => (l.from === l.to ? dates.short(l.from) : dates.dayRange(l.from, l.to).replace(" – ", "–"))
}

/**
 * Doctors · Leave & cover (module tab): Widget / Leave Board — "Waiting for approval" request cards (doctor, type ·
 * dates · days, cover, bookings to move; Decline / Review), then "Who's away this week": a doctors × Sun–Thu grid with
 * leave / day off / training cells (today highlighted; Sun first in reading order in both languages), and Add leave.
 */
export function LeaveBoard() {
  const t = useTranslations("doctors.leaveBoard")
  const tl = useTranslations("doctors.leave")
  const { b, dates, locale } = useDoctorText()
  const range = useRange()
  const doctors = useDoctors()
  const leaves = useLeaves()
  const [reviewing, setReviewing] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const pending = leaves.filter((l) => l.status === "pending").sort((a, z) => a.from.localeCompare(z.from))
  const doc = (key: string) => doctors.find((d) => d.key === key)
  const coverName = (l: Leave) => {
    const c = l.cover ? doc(l.cover)?.name : l.coverName
    return c ? b(c) : ""
  }

  const decline = (l: Leave) => {
    updateLeave(l.id, { status: "declined" })
    const d = doc(l.doctor)
    toast.info(t("declined"), {
      description: t("declinedText", { name: d ? shortName(b(d.name)) : "" }),
      action: { label: t("undo"), onClick: () => updateLeave(l.id, { status: "pending" }) },
    })
  }

  // Who's away: approved leave overlapping Sun–Thu of this week.
  const away = AWAY_WEEK[0]
  const end = AWAY_WEEK[AWAY_WEEK.length - 1]
  const week = leaves.filter((l) => l.status === "approved" && l.from <= end && l.to >= away)
  const rows = [...new Set(week.map((l) => l.doctor))]
    .map((key) => doc(key))
    .filter((d): d is Doctor => !!d)
    .map((d) => ({
      d,
      cells: AWAY_WEEK.map((day): Kind | null => {
        const l = week.find((x) => x.doctor === d.key && x.from <= day && x.to >= day)
        return l ? awayKind(l.type) : null
      }),
    }))
    .sort((a, z) => z.cells.filter(Boolean).length - a.cells.filter(Boolean).length)
  const cellLabel = (k: Kind) => t(`legend.${k}`)

  return (
    <DoctorsFrame>
      <Widget
        title={t("waiting")}
        description={t("waitingText", { n: pending.length })}
        className="gap-4 p-4 md:p-5"
      >
        {pending.length === 0 ? (
          <EmptyState icon="calendar-tick" title={t("none")} className="py-8" />
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((l) => {
              const d = doc(l.doctor)
              if (!d) return null
              const cover = coverName(l)
              return (
                <li key={l.id} className="@container/req rounded-xl border p-4">
                  <div className="flex flex-col gap-3 @2xl/req:flex-row @2xl/req:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{d.initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <DoctorName en={d.name.en} className="text-sm font-medium">
                          {b(d.name)}
                        </DoctorName>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {ltr(t("line", { type: tl(`type.${l.type}`), dates: range(l), days: leaveDays(l) }))}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col text-xs @2xl/req:w-56">
                      <span className="font-medium">{cover && !l.cancelBookings ? t("cover", { name: cover }) : t("noCover")}</span>
                      <span className="text-warning-soft-foreground tabular-nums">{cover && !l.cancelBookings ? t("toMove", { n: l.bookings }) : t("toCancel", { n: l.bookings })}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 @2xl/req:flex">
                      <Button variant="outline" onClick={() => decline(l)}>
                        {t("decline")}
                      </Button>
                      <Button onClick={() => setReviewing(l.id)}>{t("review")}</Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Widget>

      <Widget
        title={t("away")}
        description={ltr(dates.dayRange(away, end).replace(" – ", "–"))}
        className="gap-4 p-4 md:p-5"
        action={
          <Button variant="ghost" size="sm" className="-me-2 shrink-0" onClick={() => setAdding(true)}>
            <Icon name="add" size={16} />
            {t("addLeave")}
          </Button>
        }
      >
        <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label={t("away")}>
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", DOT[k])} />
              {cellLabel(k)}
            </li>
          ))}
        </ul>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t("noneAway")}</p>
        ) : (
          <table className="w-full table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1.5 text-sm @lg/widget:border-spacing-x-1.5">
            <thead>
              <tr>
                <th scope="col" className="w-26 @xl/widget:w-56">
                  <span className="sr-only">{t("away")}</span>
                </th>
                {AWAY_WEEK.map((day) => {
                  const today = day === DOCTORS_TODAY
                  return (
                    <th
                      key={day}
                      scope="col"
                      className={cn("pb-1 text-center text-xs font-normal tabular-nums", today ? "font-medium text-primary" : "text-muted-foreground")}
                      aria-label={dates.weekday(day)}
                    >
                      <span className="hidden @xl/widget:inline">
                        {dates.weekdayShort(day)} {Number(day.slice(8))}
                      </span>
                      <span className="@xl/widget:hidden">{(locale === "ar" ? AR_DAY : EN_DAY)[AWAY_WEEK.indexOf(day)]}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ d, cells }) => (
                <tr key={d.key}>
                  <th scope="row" className="pe-2 text-start font-normal">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar size="sm" className="hidden @xl/widget:flex">
                        <AvatarFallback>{d.initials}</AvatarFallback>
                      </Avatar>
                      <DoctorName en={d.name.en} className="truncate text-xs font-medium @xl/widget:text-sm @xl/widget:font-normal">
                        <span className="hidden @xl/widget:inline">{b(d.name)}</span>
                        <span className="@xl/widget:hidden">{shortName(b(d.name))}</span>
                      </DoctorName>
                    </div>
                  </th>
                  {cells.map((k, i) => (
                    <td key={AWAY_WEEK[i]} className="p-0">
                      <div
                        className={cn(
                          "flex h-8 items-center justify-center rounded-md text-xs",
                          k ? KIND[k] : "border bg-card"
                        )}
                        title={k ? cellLabel(k) : undefined}
                      >
                        {k && <span className="hidden @xl/widget:inline">{cellLabel(k)}</span>}
                        {k && <span className="sr-only @xl/widget:hidden">{cellLabel(k)}</span>}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Widget>

      {reviewing && <ReviewLeaveDialog leaveId={reviewing} onOpenChange={(o) => !o && setReviewing(null)} />}
      {adding && <RequestLeaveDialog onOpenChange={setAdding} />}
    </DoctorsFrame>
  )
}

/** Compact grid heads (design): one letter in English, three in Arabic. Sun → Thu. */
const EN_DAY = ["S", "M", "T", "W", "T"]
const AR_DAY = ["أحد", "اثن", "ثلا", "أرب", "خمي"]

/**
 * Overlay · Review leave (desktop dialog, mobile sheet): Doctor · Leave · Balance after · Cover (key–value rows), an
 * info note with the bookings that will move, and a note to the doctor. Approve marks it approved (the doctor's slots
 * close on those days, annual days come off the balance) and swaps to the "leave-approved" toast.
 */
function ReviewLeaveDialog({ leaveId, onOpenChange }: { leaveId: string; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("doctors.review")
  const tl = useTranslations("doctors.leave")
  const { b, clinicName } = useDoctorText()
  const range = useRange()
  const doctors = useDoctors()
  const leaves = useLeaves()
  const l = leaves.find((x) => x.id === leaveId)
  const [note, setNote] = React.useState("")
  if (!l) return null
  const d = doctors.find((x) => x.key === l.doctor)
  if (!d) return null
  const days = leaveDays(l)
  const coverDoc = l.cover ? doctors.find((x) => x.key === l.cover) : undefined
  const coverFull = coverDoc ? b(coverDoc.name) : l.coverName ? b(l.coverName) : ""
  const coverShort = coverFull ? shortName(coverFull) : ""
  // Days the cover doctor is away themselves in these dates.
  const clash = coverDoc
    ? leaves.filter((x) => x.doctor === coverDoc.key && x.status === "approved" && x.from <= l.to && x.to >= l.from).reduce((n, x) => {
        const a = x.from > l.from ? x.from : l.from
        const z = x.to < l.to ? x.to : l.to
        return n + leaveDays({ from: a, to: z })
      }, 0)
    : 0
  const moving = !l.cancelBookings && !!coverFull
  const rows: [string, string][] = [
    [t("doctor"), t("doctorValue", { name: b(d.name), clinic: clinicName(d.clinic) })],
    [t("leave"), t("leaveValue", { type: t(`type.${l.type}`), dates: range(l), days })],
    [t("balance"), countsAgainstBalance(l.type) ? tl("left", { n: Math.max(0, ANNUAL_LEAVE - d.leaveUsed - days) }) : t("notCounted")],
    [t("cover"), !coverFull ? t("noCover") : clash ? t("busy", { name: coverFull, n: clash }) : t("free", { name: coverFull, n: days })],
  ]

  const approve = () => {
    updateLeave(l.id, { status: "approved", ...(note.trim() ? { note: { en: note.trim(), ar: note.trim() } } : {}) })
    if (countsAgainstBalance(l.type)) updateDoctor(d.key, (x) => ({ leaveUsed: x.leaveUsed + days }))
    onOpenChange(false)
    toast.success(t("approved"), { description: t("approvedText", { n: moving ? l.bookings : 0, cover: coverShort }) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="calendar-2"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={approve}>{t("approve")}</Button>}
    >
      <dl className="flex flex-col divide-y">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 py-3 first:pt-0">
            <dt className="w-28 shrink-0 text-xs text-muted-foreground">{k}</dt>
            <dd className="min-w-0 flex-1 text-sm">{ltr(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="flex items-start gap-2.5 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
        <Icon name="info-circle" size={16} className="mt-px shrink-0" />
        <span>{moving ? t("info", { n: l.bookings, cover: coverShort }) : t("infoCancel", { n: l.bookings })}</span>
      </p>
      <Field label={t("note")}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePh")} rows={3} />
      </Field>
    </ResponsiveDialog>
  )
}
