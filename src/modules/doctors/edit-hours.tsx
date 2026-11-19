"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { ReassignBookings, type ReassignChoice } from "@/components/ds/reassign-bookings"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { addToWaitlist } from "@/modules/appointments/waitlist"
import { useClinics } from "@/modules/clinics/store"
import { DOCTORS_TODAY, WEEKDAYS, daysIn, weekOn, weekdayOf, type Doctor, type Shift, type Weekday } from "./data"
import { doctorCandidates, movedOn } from "./reassign"
import { updateDoctor, useDoctors, useLeaves } from "./store"
import { ltr, useDoctorText } from "./text"

/* ================================================================== model */

type Draft = { id: string; from: string; to: string; /** "tele" or a room number */ loc: string }
type Week = Record<Weekday, Draft[]>
type ErrorKind = "order" | "overlap" | "room"
export type HoursError = { kind: ErrorKind; room?: string; doctor?: string }

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
/** 15-minute steps, 06:00 → 23:45. */
const TIMES = Array.from({ length: 72 }, (_, i) => hhmm(6 * 60 + i * 15))
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
/** Default "Applies from": the next Sunday (design: 22/11/2026 from Wed 18 Nov). */
export const nextSunday = (today = DOCTORS_TODAY) => {
  let d = addDays(today, 1)
  while (weekdayOf(d) !== "sun") d = addDays(d, 1)
  return d
}
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromIso = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
const overlaps = (a: { from: string; to: string }, b: { from: string; to: string }) => mins(a.from) < mins(b.to) && mins(b.from) < mins(a.to)
const hoursOf = (shifts: { from: string; to: string }[]) => shifts.reduce((n, s) => n + Math.max(0, mins(s.to) - mins(s.from)), 0) / 60
const fmtH = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1))

let seq = 0
const draftOf = (d: Doctor): Week =>
  Object.fromEntries(WEEKDAYS.map((w) => [w, d.week[w].map((s) => ({ id: `s${++seq}`, from: s.from, to: s.to, loc: s.telehealth ? "tele" : (s.room ?? d.room) }))])) as Week

/** Bookings the new hours leave outside them in the first week they apply (design: 2 on Thu 26 Nov after 12:00). */
function conflictsOf(d: Doctor, week: Week, applies: string) {
  const rows: { date: string; n: number; kind: "after" | "before" | "outside"; time?: string }[] = []
  for (const date of daysIn(applies, addDays(applies, 6))) {
    const w = weekdayOf(date)
    const old = weekOn(d, date)[w]
    const booked = movedOn(d, date)
    if (!old.length || !booked) continue
    const now = week[w]
    let total = 0
    let uncovered = 0
    let late = 0
    let early = 0
    const end = Math.max(0, ...now.map((s) => mins(s.to)))
    const start = now.length ? Math.min(...now.map((s) => mins(s.from))) : 24 * 60
    for (const s of old)
      for (let m = mins(s.from); m < mins(s.to); m += 5) {
        total += 5
        if (!now.some((x) => mins(x.from) <= m && m < mins(x.to))) {
          uncovered += 5
          if (m >= end) late += 5
          else if (m < start) early += 5
        }
      }
    const n = total ? Math.round((booked * uncovered) / total) : 0
    if (!n) continue
    const kind = !now.length ? "outside" : late === uncovered ? "after" : early === uncovered ? "before" : "outside"
    rows.push({ date, n, kind, time: kind === "after" ? hhmm(end) : kind === "before" ? hhmm(start) : undefined })
  }
  return rows
}

/** Edit hours state: the draft week, Applies from, validation, totals and the booking conflict. */
export function useHoursEditor(d: Doctor, seed?: (w: Week) => Week) {
  const all = useDoctors()
  const [week, setWeek] = React.useState<Week>(() => (seed ? seed(draftOf(d)) : draftOf(d)))
  const parked = React.useRef<Partial<Week>>({})
  const [applies, setApplies] = React.useState<string>(() => nextSunday())
  const [focusId, setFocusId] = React.useState<string>()

  const setDay = (w: Weekday, shifts: Draft[]) => setWeek((x) => ({ ...x, [w]: shifts }))
  const toggle = (w: Weekday, on: boolean) => {
    if (!on) {
      parked.current[w] = week[w]
      setDay(w, [])
    } else setDay(w, parked.current[w]?.length ? parked.current[w]! : [{ id: `s${++seq}`, from: "08:00", to: "16:00", loc: d.room }])
  }
  const update = (w: Weekday, id: string, patch: Partial<Draft>) => setDay(w, week[w].map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const remove = (w: Weekday, id: string) => setDay(w, week[w].filter((s) => s.id !== id))
  const add = (w: Weekday) => {
    const last = week[w].at(-1)
    const from = last ? Math.min(mins(last.to) + 60, 22 * 60) : 8 * 60
    const id = `s${++seq}`
    setDay(w, [...week[w], { id, from: hhmm(from), to: hhmm(Math.min(from + 120, 23 * 60 + 45)), loc: last?.loc ?? d.room }])
    setFocusId(id)
  }
  // Copy Sunday's shifts to every workday whose switch is on.
  const copySunday = () =>
    setWeek((x) => {
      const next = { ...x }
      for (const w of WEEKDAYS) if (w !== "sun" && x[w].length) next[w] = x.sun.map((s) => ({ ...s, id: `s${++seq}` }))
      return next
    })

  // Validation: order, overlap within the day, and the room free at those hours (other doctors' shifts in that room).
  const errors: Record<string, HoursError> = {}
  for (const w of WEEKDAYS)
    for (const s of week[w]) {
      if (mins(s.to) <= mins(s.from)) errors[s.id] = { kind: "order" }
      else if (week[w].some((o) => o.id !== s.id && mins(o.to) > mins(o.from) && overlaps(o, s))) errors[s.id] = { kind: "overlap" }
      else if (s.loc !== "tele") {
        const other = all.find(
          (x) => x.key !== d.key && x.active && x.clinic === d.clinic && weekOn(x, applies)[w].some((o) => !o.telehealth && (o.room ?? x.room) === s.loc && overlaps(o, s))
        )
        if (other) errors[s.id] = { kind: "room", room: s.loc, doctor: other.key }
      }
    }

  const h = WEEKDAYS.reduce((n, w) => n + hoursOf(week[w]), 0)
  const was = WEEKDAYS.reduce((n, w) => n + hoursOf(d.week[w]), 0)
  const workdays = WEEKDAYS.filter((w) => week[w].length > 0).length
  const conflicts = applies ? conflictsOf(d, week, applies) : []
  const affected = conflicts.reduce((n, c) => n + c.n, 0)
  const toWeek = (): Record<Weekday, Shift[]> =>
    Object.fromEntries(
      WEEKDAYS.map((w) => [
        w,
        [...week[w]].sort((a, z) => mins(a.from) - mins(z.from)).map((s) => (s.loc === "tele" ? { from: s.from, to: s.to, telehealth: true } : { from: s.from, to: s.to, room: s.loc })),
      ])
    ) as Record<Weekday, Shift[]>

  return { d, week, applies, setApplies, toggle, update, remove, add, copySunday, errors, h, was, workdays, conflicts, affected, toWeek, focusId }
}
export type HoursEditor = ReturnType<typeof useHoursEditor>

/* ================================================================== Overlay · Edit hours (body) */

/**
 * Edit weekly hours (body): Applies from + Copy Sunday to all workdays; the days panel (Sun → Sat, switch + day 128
 * wide; shifts: Start – End (104 each, 15-min steps), Location (clinic rooms + Telehealth), trash, + on the last shift
 * and a 32px spacer otherwise; day off = muted row); the conflict alert with Keep / Move (ReassignBookings when more
 * than 5 bookings); the live summary. Narrow (< 36rem, the mobile sheet): day line on top, start – end + trash (+),
 * location full width underneath. Logical CSS only, so RTL mirrors.
 */
export function HoursEditorBody({
  editor: e,
  plan,
  setPlan,
  reassign,
  appliesError,
}: {
  editor: HoursEditor
  plan: "keep" | "move"
  setPlan: (p: "keep" | "move") => void
  reassign?: React.ReactNode
  appliesError?: string
}) {
  const t = useTranslations("doctors.editHours")
  const th = useTranslations("doctors.hours")
  const { b, dates, locale } = useDoctorText()
  const all = useDoctors()
  const clinic = useClinics().find((c) => c.key === e.d.clinic)
  const rooms = [...new Set([e.d.room, ...(clinic?.rooms.map((r) => r.number) ?? [])])]
  const starts = React.useRef<Record<string, HTMLButtonElement | null>>({})
  // Add shift: focus moves to the new shift's Start select.
  React.useEffect(() => {
    if (e.focusId) starts.current[e.focusId]?.focus()
  }, [e.focusId])

  const dayLabel = (iso: string) => (locale === "ar" ? dates.weekday(iso) : `${dates.weekdayShort(iso)} ${dates.dayMonth(iso)}`)
  const errText = (x: HoursError) =>
    x.kind === "order" ? t("errOrder") : x.kind === "overlap" ? t("errOverlap") : t("errRoom", { room: x.room ?? "", doctor: b(all.find((y) => y.key === x.doctor)?.name ?? { en: "", ar: "" }) })
  const first = e.conflicts[0]
  const conflictText = !first
    ? ""
    : e.conflicts.length > 1
      ? t("conflictMany", { n: e.affected, date: dayLabel(first.date) })
      : t(first.kind === "after" ? "conflictAfter" : first.kind === "before" ? "conflictBefore" : "conflictOutside", { n: first.n, date: dayLabel(first.date), time: first.time ?? "" })

  const timeSelect = (w: Weekday, s: Draft, k: "from" | "to", invalid: boolean) => (
    <Select value={s[k]} onValueChange={(v) => e.update(w, s.id, { [k]: v })}>
      <SelectTrigger
        ref={
          k === "from"
            ? (el: HTMLButtonElement | null) => {
                starts.current[s.id] = el
              }
            : undefined
        }
        aria-label={t(k === "from" ? "start" : "end", { day: th(`days.${w}`) })}
        aria-invalid={invalid || undefined}
        className="w-full tabular-nums @xl/eh:w-26"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {TIMES.map((x) => (
          <SelectItem key={x} value={x}>
            <bdi dir="ltr">{x}</bdi>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  const iconBtn = (label: string, icon: "trash" | "add", onClick: () => void) => (
    <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className="shrink-0">
      <Icon name={icon} size={20} />
    </Button>
  )

  return (
    <div className="@container/eh flex flex-col gap-4">
      {/* Tools: Applies from · Copy Sunday */}
      <div className="flex flex-col gap-2 @xl/eh:flex-row @xl/eh:items-end @xl/eh:gap-3">
        <Field label={t("appliesFrom")} required error={appliesError} className="min-w-0 flex-1">
          {(p) => <DatePicker {...p} value={e.applies ? fromIso(e.applies) : undefined} onChange={(v) => e.setApplies(v ? isoOf(v) : "")} placeholder="dd/mm/yyyy" />}
        </Field>
        <Button variant="ghost" onClick={e.copySunday} className="self-start @xl/eh:self-end">
          <Icon name="copy" size={24} />
          {t("copy")}
        </Button>
      </div>

      {/* Days panel */}
      <div className="overflow-hidden rounded-[10px] border bg-card">
        <ul className="divide-y @xl/eh:max-h-122 @xl/eh:overflow-y-auto">
          {WEEKDAYS.map((w) => {
            const shifts = e.week[w]
            const on = shifts.length > 0
            const name = th(`days.${w}`)
            return (
              <li key={w} className={cn("flex flex-col gap-3 px-3 py-2.5 @xl/eh:flex-row @xl/eh:gap-4", !on && "bg-muted")}>
                <div className="flex h-9 shrink-0 items-center gap-2.5 @xl/eh:w-32">
                  <Switch checked={on} onCheckedChange={(v) => e.toggle(w, v)} aria-label={name} />
                  <span className={cn("flex-1 text-sm", !on && "text-muted-foreground")}>{name}</span>
                  {!on && <span className="text-xs text-muted-foreground @xl/eh:hidden">{t("offShort")}</span>}
                </div>
                {!on ? (
                  <span className="hidden h-9 items-center text-sm text-muted-foreground @xl/eh:flex">{t("off")}</span>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {shifts.map((s, i) => {
                      const err = e.errors[s.id]
                      const last = i === shifts.length - 1
                      const loc = (
                        <Select value={s.loc} onValueChange={(v) => e.update(w, s.id, { loc: v })}>
                          <SelectTrigger aria-label={t("location", { day: name })} aria-invalid={err?.kind === "room" || undefined} className="w-full @xl/eh:min-w-0 @xl/eh:flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rooms.map((r) => (
                              <SelectItem key={r} value={r}>
                                {t("room", { n: r })}
                              </SelectItem>
                            ))}
                            <SelectItem value="tele">{t("telehealth")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )
                      return (
                        <div key={s.id} className="flex flex-col gap-1.5">
                          <div className="flex flex-col gap-2 @xl/eh:flex-row @xl/eh:items-center">
                            <div className="flex items-center gap-2 @xl/eh:contents">
                              <div className="flex min-w-0 flex-1 items-center gap-2 @xl/eh:flex-none">
                                {timeSelect(w, s, "from", !!err && err.kind !== "room")}
                                <span className="text-sm text-muted-foreground">–</span>
                                {timeSelect(w, s, "to", !!err && err.kind !== "room")}
                              </div>
                              <span className="hidden @xl/eh:contents">{loc}</span>
                              {iconBtn(t("removeShift"), "trash", () => e.remove(w, s.id))}
                              {last ? iconBtn(t("addShift"), "add", () => e.add(w)) : <span aria-hidden className="size-8 shrink-0" />}
                            </div>
                            <div className="@xl/eh:hidden">{loc}</div>
                          </div>
                          {err && <p className="text-xs text-destructive">{errText(err)}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Conflict */}
      {e.affected > 0 && Object.keys(e.errors).length === 0 && (
        <>
          <p role="alert" className="flex items-start gap-2 rounded-[10px] bg-warning-soft p-3 text-xs text-warning-soft-foreground tabular-nums">
            <Icon name="warning-2" size={16} className="mt-px shrink-0" />
            <span>{ltr(conflictText)}</span>
          </p>
          {reassign ?? (
            <div role="radiogroup" aria-label={conflictText} className="flex flex-col gap-2">
              {(["keep", "move"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={plan === k}
                  onClick={() => setPlan(k)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-[10px] border p-3 text-start text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    plan === k ? "border-primary bg-accent" : "border-border bg-card"
                  )}
                >
                  <span aria-hidden className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border bg-card", plan === k ? "border-primary" : "border-input")}>
                    {plan === k && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  {k === "keep" ? t("keep") : t("move", { female: String(e.d.female) })}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Summary */}
      <p className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums" aria-live="polite">
        <Icon name="clock" size={16} className="shrink-0" />
        {t("summary", { h: fmtH(e.h), d: e.workdays, old: fmtH(e.was) })}
      </p>
    </div>
  )
}

/* ================================================================== the dialog */

/**
 * Overlay · Edit hours (Schedule › Weekly hours › Edit hours; desktop dialog 680 wide, mobile bottom sheet). Save hours
 * stores a new hours version from Applies from (earlier dates keep the old hours), updates the Weekly hours card, the
 * week total and the Appointments slots, then swaps to the "hours-saved" toast. Disabled while there are errors.
 */
export function EditHoursDialog({ doctor, onOpenChange }: { doctor: Doctor; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("doctors.editHours")
  const { b, dates, locale } = useDoctorText()
  const all = useDoctors()
  const leaves = useLeaves()
  const clinic = useClinics().find((c) => c.key === doctor.clinic)
  const e = useHoursEditor(doctor)
  const [plan, setPlan] = React.useState<"keep" | "move">("keep")
  const [choice, setChoice] = React.useState<ReassignChoice>("doctor")
  const [picked, setPicked] = React.useState<string>()
  const appliesError = !e.applies ? t("required") : e.applies < DOCTORS_TODAY ? t("past") : undefined
  const invalid = Object.keys(e.errors).length > 0 || !!appliesError

  // More than 5 bookings affected → the shared ReassignBookings block (colleagues covering those days).
  const many = e.affected > 5
  const days = e.conflicts.map((c) => c.date)
  const covers = many ? doctorCandidates(doctor, all, leaves, days[0], days[days.length - 1]) : []
  const scale = (n: number, total: number) => (total ? Math.min(e.affected, Math.round((n * e.affected) / total)) : 0)
  const rows = covers.map((c) => ({
    key: c.doctor.key,
    name: b(c.doctor.name),
    sub: b(c.doctor.title),
    initials: c.doctor.initials,
    coverage:
      c.state === "leave"
        ? ({ state: "leave", until: dates.dayMonth(c.until) } as const)
        : c.state === "unavailable"
          ? ({ state: "unavailable" } as const)
          : ({ state: scale(c.covered, c.total) >= e.affected ? "all" : "some", covered: scale(c.covered, c.total), total: e.affected } as const),
  }))
  const pick = picked && rows.some((r) => r.key === picked && r.coverage.state !== "leave" && r.coverage.state !== "unavailable") ? picked : rows.find((r) => r.coverage.state === "all" || r.coverage.state === "some")?.key

  const save = () => {
    if (invalid) return
    const until = addDays(e.applies, -1)
    updateDoctor(doctor.key, (x) => ({
      week: e.toWeek(),
      hoursHistory: [...(x.hoursHistory ?? []).filter((h) => h.until < until), { until, week: weekOn(x, until) }],
    }))
    if (many && choice !== "cancel") {
      const r = rows.find((x) => x.key === pick)
      const covered = choice === "doctor" && r && "covered" in r.coverage ? (r.coverage.covered ?? 0) : choice === "spread" ? e.affected : 0
      addToWaitlist({ count: e.affected - covered, source: "hours", doctor: doctor.key, from: days[0], to: days[days.length - 1] })
    }
    onOpenChange(false)
    const date = locale === "ar" ? dates.weekday(e.applies) : `${dates.weekdayShort(e.applies)} ${dates.dayMonth(e.applies)}`
    toast.success(t("saved"), { description: ltr(t("savedText", { date, h: fmtH(e.h) })) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title", { name: b(doctor.name) })}
      description={t("text")}
      icon="clock"
      width="sm:max-w-170 max-h-[calc(100dvh-2rem)] overflow-y-auto"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={save} disabled={invalid}>
          {t("save")}
        </Button>
      }
    >
      <HoursEditorBody
        editor={e}
        plan={plan}
        setPlan={setPlan}
        appliesError={appliesError}
        reassign={
          many ? (
            <ReassignBookings
              target="doctor"
              count={e.affected}
              department={{ name: clinic ? b(clinic.name) : "", short: clinic ? b(clinic.short) : "" }}
              value={choice}
              onValueChange={setChoice}
              picked={pick}
              onPick={setPicked}
              candidates={rows}
            />
          ) : undefined
        }
      />
    </ResponsiveDialog>
  )
}

