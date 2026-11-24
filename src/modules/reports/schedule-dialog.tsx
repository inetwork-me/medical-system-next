"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { useDates } from "@/i18n/dates"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Bi } from "@/lib/mock/bi"
import { PEOPLE, REP_NOW, nextSend, type Frequency, type Recipient, type Schedule } from "./data"
import { ltrRun, useB } from "./parts"
import { saveSchedule, useLibrary, useSchedules } from "./store"
import { Strip } from "./strip"

const FREQS = ["daily", "weekly", "monthly"] as const
const TIMES = Array.from({ length: 15 }, (_, i) => `${String(6 + i).padStart(2, "0")}:00`)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The design's recipients for a new schedule (medical director, front office lead, dental clinic manager). */
const DEFAULT_RECIPIENTS: Recipient[] = ["ghamdi", "fahad", "harthi"].map((id) => {
  const p = PEOPLE.find((x) => x.id === id)!
  return { personId: id, email: p.email, name: p.name, role: p.role }
})

/**
 * Overlay · Send it on a schedule (Schedule, Edit, Fix, New schedule). Every day / week / month, the day, the time
 * (Riyadh), recipients (remove in place; Add someone by name or email), PDF / Excel, skip the email when nothing
 * changed. Save schedule → schedule-saved ("Next send Sunday 29 Nov at 08:00").
 */
export function ScheduleDialog({
  target,
  targetName,
  existing,
  onOpenChange,
  initial,
}: {
  /** The report or dashboard to send; left out by New schedule (the dialog then asks which report). */
  target?: string
  targetName?: Bi
  existing?: Schedule
  onOpenChange: (open: boolean) => void
  initial?: { tried?: boolean; recipients?: Recipient[] }
}) {
  const t = useTranslations("reports.schedule")
  const b = useB()
  const locale = useLocale()
  const dates = useDates()
  const library = useLibrary()
  const scheduled = useSchedules()
  // New schedule offers the reports that aren't sent yet (a sent one is changed with its Edit / Fix instead).
  const free = library.filter((x) => !x.schedule && !scheduled.some((y) => y.target === x.id))
  const [picked, setPicked] = React.useState(target ?? "")
  const report = target ? undefined : library.find((x) => x.id === picked)
  const name = targetName ?? report?.name
  // Every 3 months isn't offered here (day / week / month): an old quarterly schedule starts on monthly.
  const [frequency, setFrequency] = React.useState<Frequency>(existing?.frequency === "quarterly" ? "monthly" : (existing?.frequency ?? "weekly"))
  const [day, setDay] = React.useState(existing?.day ?? 0)
  const [time, setTime] = React.useState(existing?.time ?? "08:00")
  const [recipients, setRecipients] = React.useState<Recipient[]>(initial?.recipients ?? existing?.recipients ?? DEFAULT_RECIPIENTS)
  const [format, setFormat] = React.useState<"pdf" | "xlsx">(existing?.format ?? "pdf")
  const [skip, setSkip] = React.useState(existing?.skipUnchanged ?? false)
  const [query, setQuery] = React.useState("")
  const [addError, setAddError] = React.useState("")
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const id = React.useId()
  const weekday = (i: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 22 + i, 12)))

  const q = query.trim().toLowerCase()
  const matches = q ? PEOPLE.filter((p) => !recipients.some((r) => r.email === p.email) && (p.name.en.toLowerCase().includes(q) || p.name.ar.includes(query.trim()) || p.email.includes(q))) : []
  const add = (r: Recipient) => {
    setRecipients((xs) => [...xs, r])
    setQuery("")
    setAddError("")
  }
  const addTyped = () => {
    if (matches[0]) return add({ personId: matches[0].id, email: matches[0].email, name: matches[0].name, role: matches[0].role })
    if (!EMAIL.test(query.trim())) return setAddError(t("addError"))
    if (recipients.some((r) => r.email === query.trim().toLowerCase())) return setAddError(t("already"))
    add({ email: query.trim().toLowerCase() })
  }

  const bounced = existing?.status === "failed" && existing.bounced && recipients.some((r) => r.email === existing.bounced) ? existing.bounced : undefined
  const invalid = !recipients.length || !picked || !!bounced
  const save = () => {
    setTried(true)
    if (invalid || !name) return
    const s: Schedule = {
      id: existing?.id ?? `sch-${picked}-${Date.now().toString(36)}`,
      target: picked,
      targetName: name,
      frequency,
      day: frequency === "daily" ? 0 : day,
      time,
      recipients,
      format,
      skipUnchanged: skip,
      status: "active",
    }
    saveSchedule(s)
    onOpenChange(false)
    const at = nextSend(s, REP_NOW)
    const wd = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${at.slice(0, 10)}T12:00:00Z`))
    toast.success(t("toast"), { description: t("toastText", { day: wd, date: dates.dayMonth(at.slice(0, 10)), time: at.slice(11, 16) }) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={name ? b(name) : t("newText")}
      icon="calendar-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("save")}</Button>}
    >
      {tried && invalid && (
        <Strip tone="destructive" icon="info-circle">
          {bounced ? t("stillBounced") : t("missing")}
        </Strip>
      )}
      {existing?.status === "failed" && existing.bounced && !(tried && invalid) && (
        <Strip tone="warning" icon="info-circle">
          {t("bounced", { email: ltrRun(existing.bounced) })}
        </Strip>
      )}
      {existing?.status === "paused" && (
        <Strip tone="info" icon="info-circle">
          {existing.frequency === "quarterly" ? t("pausedQuarterly") : t("paused")}
        </Strip>
      )}
      {!target && (
        <Field label={t("report")} required error={tried && !picked ? t("reportError") : undefined}>
          {(fp) => (
            <Select value={picked} onValueChange={setPicked}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue placeholder={t("reportPick")} />
              </SelectTrigger>
              <SelectContent>
                {free.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {b(x.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-s`} className="text-xs font-medium text-foreground">
          {t("send")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <Segmented
          value={frequency}
          onValueChange={(v) => {
            setFrequency(v)
            setDay(v === "monthly" ? 1 : 0)
          }}
          aria-labelledby={`${id}-s`}
          options={FREQS.map((f) => ({ value: f, label: t(`freq.${f}`) }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {frequency !== "daily" && (
          <Field label={t("day")}>
            {(fp) => (
              <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <SelectTrigger {...fp} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequency === "weekly"
                    ? [0, 1, 2, 3, 4, 5, 6].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {weekday(d)}
                        </SelectItem>
                      ))
                    : Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {t("dayOfMonth", { n: d })}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}
        <Field label={t("time")} className={frequency === "daily" ? "sm:col-span-2" : undefined}>
          {(fp) => (
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger {...fp} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {t("timeValue", { time: x })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      {recipients.length > 0 ? (
        <ul className="flex flex-col rounded-lg border px-3" aria-label={t("recipients")}>
          {recipients.map((r) => (
            <li key={r.email} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
              <span aria-hidden dir="ltr" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
                {r.name ? (r.initials ?? PEOPLE.find((p) => p.id === r.personId)?.initials) : <Icon name="sms" size={16} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{r.name ? b(r.name) : <bdi dir="ltr">{r.email}</bdi>}</span>
                {r.email === bounced ? (
                  <span className="truncate text-xs text-destructive">{t("bouncedTag")}</span>
                ) : (
                  <span className="truncate text-xs text-muted-foreground">{r.role ? b(r.role) : t("external")}</span>
                )}
              </span>
              {/* Removing someone takes the row away in place: no toast, the dialog stays open. */}
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setRecipients((xs) => xs.filter((x) => x.email !== r.email))} aria-label={t("remove", { name: r.name ? b(r.name) : r.email })}>
                <Icon name="close" size={18} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        tried && <p className="text-xs text-destructive">{t("noOne")}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <Field label={t("add")} error={addError || undefined}>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setAddError("")
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addTyped()
              }
            }}
            placeholder={t("addPlaceholder")}
            startIcon={<Icon name="user-add" size={20} className="text-muted-foreground" />}
          />
        </Field>
        {matches.length > 0 && (
          <ul className="flex flex-col rounded-lg border bg-card">
            {matches.slice(0, 4).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add({ personId: p.id, email: p.email, name: p.name, role: p.role })}
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <span className="flex-1 text-foreground">{b(p.name)}</span>
                  <span className="text-xs text-muted-foreground">{b(p.role)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-as`} className="text-xs font-medium text-foreground">
          {t("as")}
        </span>
        <Segmented
          value={format}
          onValueChange={setFormat}
          aria-labelledby={`${id}-as`}
          options={[
            { value: "pdf", label: "PDF" },
            { value: "xlsx", label: "Excel" },
          ]}
        />
      </div>
      <label htmlFor={`${id}-skip`} className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id={`${id}-skip`} checked={skip} onCheckedChange={(v) => setSkip(v === true)} />
        {t("skip")}
      </label>
    </ResponsiveDialog>
  )
}
