"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { HIJRI_MONTHS, fromHijri, hijriMonthLength, isoOf, monthLength, toHijri, weekdayOf, ymdOf, type Ymd } from "@/lib/hijri"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { TODAY } from "../data"

/**
 * Birth date picker (Patients · design v9.1 · "Patients · Birth date picker"): year first → month → day, instead of paging a
 * month calendar back 40 years. Gregorian / Hijri switch (both values are stored), an "Or type it" box (DD/MM/YYYY; a full
 * date jumps to the result), steps that go back when clicked, a 12-year grid around a sensible default, "Only the year is
 * known" (saved as 1 July of that year, flagged estimated), and a summary with age, age group and the other calendar's date.
 * Desktop: 380 dialog; mobile: bottom sheet. No future dates; warns over 120 years. Grids read right to left in Arabic;
 * arrows move, Enter selects, Esc closes.
 */
export type BirthValue = { birthDate: string; birthHijri: string; birthEstimated: boolean }

type Cal = "g" | "h"
type Step = "year" | "month" | "day"

const TODAY_G = ymdOf(TODAY)
const TODAY_H = toHijri(TODAY_G)
const cmp = (a: Ymd, b: Ymd) => a.y - b.y || a.m - b.m || a.d - b.d
const today = (cal: Cal) => (cal === "g" ? TODAY_G : TODAY_H)
const toG = (cal: Cal, v: Ymd) => (cal === "g" ? v : fromHijri(v))
const daysIn = (cal: Cal, y: number, m: number) => (cal === "g" ? monthLength(y, m) : hijriMonthLength(y, m))

export function ageOn(g: Ymd) {
  return TODAY_G.y - g.y - (TODAY_G.m < g.m || (TODAY_G.m === g.m && TODAY_G.d < g.d) ? 1 : 0)
}
export const ageGroup = (age: number) => (age < 18 ? "child" : age < 60 ? "adult" : "senior")

/** Month and weekday labels: Gregorian from Intl in the page language (Latin digits); Hijri from the Umm al-Qura names. */
function useCalText() {
  const locale = useLocale()
  const lang = locale === "ar" ? "ar" : "en"
  const tag = lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB"
  return React.useMemo(() => {
    const month = new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" })
    const monthLong = new Intl.DateTimeFormat(tag, { month: "long", timeZone: "UTC" })
    const wd = new Intl.DateTimeFormat(tag, { weekday: lang === "ar" ? "narrow" : "short", timeZone: "UTC" })
    const wdLong = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" })
    return {
      lang,
      monthName: (cal: Cal, m: number, long = false) => (cal === "h" ? HIJRI_MONTHS[lang][m - 1] : (long ? monthLong : month).format(new Date(Date.UTC(2000, m - 1, 1))).replace("Sept", "Sep")),
      // 2023-01-01 was a Sunday.
      weekdays: Array.from({ length: 7 }, (_, i) => wd.format(new Date(Date.UTC(2023, 0, 1 + i))).slice(0, lang === "ar" ? 1 : 2)),
      weekdayName: (g: Ymd) => wdLong.format(new Date(Date.UTC(g.y, g.m - 1, g.d))),
    }
  }, [lang, tag])
}

/** Arrow keys move inside a grid of buttons (columns `cols`), mirrored in RTL; Enter is the button's own click. */
function gridKeys(cols: number, rtl: boolean) {
  return (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: cols, ArrowUp: -cols }
    const step = keys[e.key]
    if (!step) return
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = buttons[Math.max(0, Math.min(buttons.length - 1, (i < 0 ? 0 : i) + step))]
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }
}

const cell =
  "flex h-11 items-center justify-center rounded-lg border bg-card text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"

export function BirthDatePicker({
  value,
  onApply,
  onOpenChange,
}: {
  value: BirthValue
  onApply: (v: BirthValue) => void
  onOpenChange: (o: boolean) => void
}) {
  const t = useTranslations("patients.birth")
  const c = useCalText()
  const rtl = c.lang === "ar"
  const initial = value.birthDate ? ymdOf(value.birthDate) : null
  const [cal, setCal] = React.useState<Cal>("g")
  // Opens on the year step, on the saved year's page, or 30 years ago.
  const [sel, setSel] = React.useState<Partial<Ymd>>(initial && !value.birthEstimated ? initial : initial ? { y: initial.y } : {})
  const [page, setPage] = React.useState(Math.floor((initial?.y ?? TODAY_G.y - 30) / 12) * 12)
  const [view, setView] = React.useState<{ y: number; m: number }>({ y: initial?.y ?? TODAY_G.y - 30, m: initial?.m ?? 1 })
  const [step, setStep] = React.useState<Step>("year")
  const [estimated, setEstimated] = React.useState(value.birthEstimated)
  const [typed, setTyped] = React.useState("")
  const [typedError, setTypedError] = React.useState<string | null>(null)
  const now = today(cal)

  /* ---------- calendar switch: carry the selection over */
  const switchCal = (next: Cal) => {
    if (next === cal) return
    const g = sel.y ? toG(cal, { y: sel.y, m: sel.m ?? 7, d: sel.d ?? 1 }) : null
    const conv = g ? (next === "h" ? toHijri(g) : g) : null
    setCal(next)
    setSel(conv ? (sel.d ? conv : sel.m ? { y: conv.y, m: conv.m } : { y: conv.y }) : {})
    const y = conv?.y ?? today(next).y - (next === "h" ? 31 : 30)
    setPage(Math.floor(y / 12) * 12)
    setView({ y, m: conv?.m ?? 1 })
    setTyped("")
    setTypedError(null)
  }

  /* ---------- picks */
  const pickYear = (y: number) => {
    setSel({ y })
    setView({ y, m: 1 })
    if (!estimated) setStep("month")
  }
  const pickMonth = (m: number) => {
    setSel({ y: view.y, m })
    setView({ y: view.y, m })
    setStep("day")
  }
  const pickDay = (d: number) => setSel({ y: view.y, m: view.m, d })

  /* ---------- typed date */
  const onType = (v: string) => {
    setTyped(v)
    const m = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
    if (!m) {
      setTypedError(v.trim().length >= 10 ? t("typedInvalid") : null)
      return
    }
    const ymd = { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) }
    if (ymd.m < 1 || ymd.m > 12 || ymd.d < 1 || ymd.d > daysIn(cal, ymd.y, ymd.m) || !toG(cal, ymd)) return setTypedError(t("typedInvalid"))
    if (cmp(ymd, now) > 0) return setTypedError(t("future"))
    setTypedError(null)
    setEstimated(false)
    setSel(ymd)
    setView({ y: ymd.y, m: ymd.m })
    setPage(Math.floor(ymd.y / 12) * 12)
    setStep("day")
  }

  /* ---------- result */
  const full = sel.y && sel.m && sel.d ? (sel as Ymd) : null
  const result: { g: Ymd; h: Ymd } | null = estimated && sel.y
    ? (() => {
        const g = cal === "g" ? { y: sel.y!, m: 7, d: 1 } : fromHijri({ y: sel.y!, m: 7, d: 1 })!
        return { g, h: toHijri(g) }
      })()
    : full
      ? (() => {
          const g = toG(cal, full)!
          return { g, h: cal === "h" ? full : toHijri(g) }
        })()
      : null
  const age = result ? ageOn(result.g) : null
  const apply = () => {
    if (!result) return
    onApply({ birthDate: isoOf(result.g), birthHijri: isoOf(result.h), birthEstimated: estimated })
    onOpenChange(false)
  }

  /* ---------- texts */
  const yearLabel = (y: number) => String(y)
  const subtitle =
    step === "year"
      ? t(cal === "h" ? "subYearHijri" : "subYear")
      : step === "month"
        ? t("subMonth", { year: sel.y ?? view.y })
        : t("subDay", { month: c.monthName(cal, view.m, true), year: view.y })
  const gText = (g: Ymd) => `${c.weekdayName(g)} ${g.d} ${c.monthName("g", g.m)} ${g.y}`
  const hText = (h: Ymd) => `${h.d} ${c.monthName("h", h.m)} ${h.y}`

  const stepPill = (s: Step, label: string, done: string | null) => {
    const active = step === s
    const reachable = s === "year" || (s === "month" && !!sel.y && !estimated) || (s === "day" && !!sel.m && !estimated)
    return (
      <button
        type="button"
        disabled={!reachable}
        onClick={() => setStep(s)}
        aria-current={active ? "step" : undefined}
        className={cn(
          "flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-between gap-1 rounded-md px-2.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default",
          active ? "bg-primary text-primary-foreground" : done ? "bg-accent text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <span className="truncate">{label}</span>
        {!active && done && <span className="truncate">{done}</span>}
      </button>
    )
  }
  const nav = (onPrev: () => void, onNext: () => void, nextDisabled: boolean, title: React.ReactNode, onTitle?: () => void) => (
    <div className="flex items-center gap-2">
      {onTitle ? (
        <button type="button" onClick={onTitle} className="flex cursor-pointer items-center gap-1 rounded-sm text-sm font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {title}
          <Icon name="arrow-down" size={16} className="text-muted-foreground" />
        </button>
      ) : (
        <span className="text-sm font-medium text-foreground tabular-nums">{title}</span>
      )}
      <span className="flex-1" />
      <Button variant="outline" size="icon-sm" onClick={onPrev} aria-label={t("prev")}>
        <Icon name="arrow-left-1" size={18} />
      </Button>
      <Button variant="outline" size="icon-sm" onClick={onNext} disabled={nextDisabled} aria-label={t("next")}>
        <Icon name="arrow-right-1" size={18} />
      </Button>
    </div>
  )

  /* ---------- day grid */
  const dayCells = () => {
    const len = daysIn(cal, view.y, view.m)
    const firstG = toG(cal, { y: view.y, m: view.m, d: 1 })!
    const lead = weekdayOf(firstG)
    const prevLen = view.m === 1 ? daysIn(cal, view.y - 1, 12) : daysIn(cal, view.y, view.m - 1)
    const total = Math.ceil((lead + len) / 7) * 7
    return Array.from({ length: total }, (_, i) => {
      const d = i - lead + 1
      if (d < 1) return { d: prevLen + d, out: true }
      if (d > len) return { d: d - len, out: true }
      return { d, out: false }
    })
  }
  const monthStepNext = view.y >= now.y
  const dayStepNext = view.y > now.y || (view.y === now.y && view.m >= now.m)
  const moveMonth = (delta: number) => {
    let m = view.m + delta
    let y = view.y
    if (m < 1) [m, y] = [12, y - 1]
    if (m > 12) [m, y] = [1, y + 1]
    setView({ y, m })
  }

  const primary =
    step === "day" || (step === "year" && estimated) ? (
      <Button onClick={apply} disabled={!result}>
        {t("apply")}
      </Button>
    ) : undefined

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={subtitle}
      icon="calendar-2"
      width="sm:max-w-95"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={primary}
    >
      {step === "year" && (
        <>
          <Segmented<Cal>
            value={cal}
            onValueChange={switchCal}
            options={[
              { value: "g", label: t("gregorian") },
              { value: "h", label: t("hijri") },
            ]}
            aria-label={t("calendar")}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="birth-typed" className="text-sm font-medium text-foreground">
              {t("typeIt")}
            </label>
            <div className="relative" dir="ltr">
              <Icon name="calendar-2" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="birth-typed"
                dir="ltr"
                inputMode="numeric"
                value={typed}
                onChange={(e) => onType(e.target.value)}
                placeholder={cal === "h" ? t("typePhHijri") : t("typePh")}
                aria-invalid={!!typedError || undefined}
                className={cn("ps-9", rtl ? "text-end" : "text-start")}
              />
            </div>
            {typedError && <p className="text-xs text-destructive">{typedError}</p>}
          </div>
        </>
      )}

      <div className="flex gap-2">
        {stepPill("year", t("year"), sel.y ? yearLabel(sel.y) : null)}
        {stepPill("month", t("month"), sel.m && !estimated ? (cal === "h" ? String(sel.m) : c.monthName(cal, sel.m)) : null)}
        {stepPill("day", t("day"), sel.d && !estimated ? String(sel.d) : null)}
      </div>

      {step === "year" && (
        <>
          {nav(
            () => setPage((p) => p - 12),
            () => setPage((p) => p + 12),
            page + 12 > now.y,
            <bdi dir="ltr">{`${page} – ${page + 11}`}</bdi>
          )}
          <div role="grid" aria-label={t("year")} className="grid grid-cols-4 gap-2" onKeyDown={gridKeys(4, rtl)}>
            {Array.from({ length: 12 }, (_, i) => page + i).map((y) => (
              <button key={y} type="button" className={cn(cell, "tabular-nums")} aria-pressed={sel.y === y} disabled={y > now.y} onClick={() => pickYear(y)}>
                {y}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox id="birth-estimated" checked={estimated} onCheckedChange={(v) => {
                setEstimated(v === true)
                setTyped("")
                setTypedError(null)
              }} />
            <label htmlFor="birth-estimated" className="cursor-pointer text-sm text-foreground">
              {t("onlyYear")}
            </label>
          </div>
          {estimated && result && (
            <Summary text={t("estimatedSummary", { year: sel.y!, age: age! })} sub={cal === "g" ? t("hijriLine", { date: hText(result.h) }) : t("gregorianLine", { date: gText(result.g) })} warn={age! > 120 ? t("over120") : undefined} />
          )}
        </>
      )}

      {step === "month" && (
        <>
          {nav(
            () => setView((v) => ({ ...v, y: v.y - 1 })),
            () => setView((v) => ({ ...v, y: v.y + 1 })),
            monthStepNext,
            view.y,
            () => {
              setPage(Math.floor(view.y / 12) * 12)
              setStep("year")
            }
          )}
          <div role="grid" aria-label={t("month")} className="grid grid-cols-3 gap-2" onKeyDown={gridKeys(3, rtl)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                type="button"
                className={cell}
                aria-pressed={sel.y === view.y && sel.m === m}
                disabled={view.y > now.y || (view.y === now.y && m > now.m)}
                onClick={() => pickMonth(m)}
              >
                {c.monthName(cal, m, cal === "g" && c.lang === "ar")}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "day" && (
        <>
          {nav(() => moveMonth(-1), () => moveMonth(1), dayStepNext, `${c.monthName(cal, view.m, true)} ${view.y}`, () => setStep("month"))}
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
            {c.weekdays.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div role="grid" aria-label={t("day")} className="-mt-2 grid grid-cols-7 gap-y-1" onKeyDown={gridKeys(7, rtl)}>
            {dayCells().map((x, i) =>
              x.out ? (
                <span key={i} className="flex h-9 items-center justify-center text-sm text-muted-foreground/70 tabular-nums">
                  {x.d}
                </span>
              ) : (
                <button
                  key={i}
                  type="button"
                  aria-pressed={sel.y === view.y && sel.m === view.m && sel.d === x.d}
                  disabled={cmp({ y: view.y, m: view.m, d: x.d }, now) > 0}
                  onClick={() => pickDay(x.d)}
                  className="mx-auto flex h-9 w-11 cursor-pointer items-center justify-center rounded-lg text-sm text-foreground tabular-nums outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {x.d}
                </button>
              )
            )}
          </div>
          {result && (
            <Summary
              text={t("summary", { date: gText(result.g), age: age!, group: t(`groups.${ageGroup(age!)}`) })}
              sub={cal === "g" ? t("hijriLine", { date: hText(result.h) }) : t("gregorianLine", { date: gText(result.g) })}
              warn={age! > 120 ? t("over120") : age! < 18 ? t("guardian") : undefined}
              tone={age! > 120 ? "warning" : "info"}
            />
          )}
        </>
      )}
    </ResponsiveDialog>
  )
}

function Summary({ text, sub, warn, tone = "warning" }: { text: string; sub: string; warn?: string; tone?: "warning" | "info" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/70 px-3 py-2.5">
      <span className="text-sm text-foreground">{text}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
      {warn && <span className={cn("pt-1 text-xs", tone === "warning" ? "text-warning-soft-foreground" : "text-info-soft-foreground")}>{warn}</span>}
    </div>
  )
}

/** The Date of birth input: shows the date (or "1988 · estimated"), opens the picker. */
export function BirthDateField({
  value,
  onChange,
  placeholder,
  ...aria
}: {
  value: BirthValue
  onChange: (v: BirthValue) => void
  placeholder: string
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}) {
  const t = useTranslations("patients.birth")
  const dates = useDates()
  const [open, setOpen] = React.useState(false)
  const label = value.birthDate ? (value.birthEstimated ? t("estimatedValue", { year: value.birthDate.slice(0, 4) }) : dates.numeric(value.birthDate)) : placeholder
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-placeholder={!value.birthDate || undefined}
        className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-start text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive data-[placeholder]:text-muted-foreground"
        {...aria}
      >
        <Icon name="calendar-2" size={16} className="text-muted-foreground" />
        <span className="flex-1 truncate tabular-nums">{label}</span>
      </button>
      {open && <BirthDatePicker value={value} onApply={onChange} onOpenChange={setOpen} />}
    </>
  )
}
