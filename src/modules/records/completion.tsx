"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { CHART_RED_HOURS, REC_NOW, REC_TODAY, USERS, type CompletionItem, type Encounter } from "./data"
import { completionCounts } from "./counts"
import { noteHref } from "./href"
import { patientOf } from "./lookup"
import { reminders } from "./notify"
import { InitialsAvatar, WaitingBadge, useB } from "./parts"
import { recCan } from "./roles"
import { canRemind, completionOpen } from "./rules"
import { ME } from "./session"
import { getEncounter, saveCompletion, useCompletion, useEncounters, useNotes, useRecRole } from "./store"

/** "Note not signed", "Biopsy result not reviewed". */
function useMissing() {
  const t = useTranslations("records.missing")
  const b = useB()
  return (c: CompletionItem) => (c.missing === "resultNotReviewed" && c.what ? t("resultOf", { what: b(c.what) }) : t(c.missing))
}

/** Remind one item, or all the others' open items not reminded yet (Remind all): app notification + SMS (stub). */
export function useRemind() {
  const t = useTranslations("records.completion")
  const run = async (items: CompletionItem[]): Promise<void> => {
    if (!items.length) return
    const byDoctor = new Map<string, CompletionItem[]>()
    for (const c of items) {
      const doc = getEncounter(c.encounter)?.doctor
      if (!doc) continue
      byDoctor.set(doc, [...(byDoctor.get(doc) ?? []), c])
    }
    try {
      for (const [doc, xs] of byDoctor) await reminders.send({ doctorId: USERS[doc as keyof typeof USERS].id, items: xs.map((x) => x.id) })
      saveCompletion(items.map((c) => ({ ...c, remindedAt: REC_NOW })))
      toast.success(t("toast"), {
        description: items.length === 1 ? t("toastText") : t("toastAll", { n: byDoctor.size }),
      })
    } catch {
      toast.error(t("failed"), { description: t("failedText"), retry: () => void run(items) })
    }
  }
  return run
}

/** The open items the signed-in user can remind (other doctors', not reminded yet). */
export function remindable(items: CompletionItem[], encounters: Encounter[]) {
  return items.filter((c) => {
    const e = encounters.find((x) => x.id === c.encounter)
    return e && canRemind(c, e.doctor, ME) && !c.remindedAt
  })
}

function Tile({ icon, label, value, sub, tone }: { icon: IconName; label: string; value: string; sub: string; tone?: "destructive" }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon name={icon} size={18} />
        {label}
      </span>
      <span className={cn("text-2xl font-semibold tabular-nums", tone === "destructive" ? "text-destructive" : "text-foreground")}>{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}

/**
 * Widget / Rec Completion. "Chart completion · Every visit needs a signed note and a diagnosis code within 48 hours";
 * tiles Not complete (doctors) · Over 48 hours (red) · Done this week · On time %; then the list: Patient · Visit ·
 * What's missing · Doctor · Waiting (amber, red over 48 h) · Remind (other doctors) / Open (your own). Compact: tiles
 * 2 × 2 and rows ("Note not signed · Dr. Khaled Mansour").
 */
export function CompletionList() {
  const t = useTranslations("records.completion")
  const b = useB()
  const dates = useDates()
  const role = useRecRole()
  const items = useCompletion()
  const notes = useNotes()
  const encounters = useEncounters()
  const remind = useRemind()
  const missing = useMissing()
  const c = completionCounts(items, notes, encounters)
  const rows = items.filter((x) => completionOpen(x, notes))
  const canAct = recCan(role, "remind")
  const visit = (e: Encounter) => `${b(e.kind)} · ${e.at.slice(0, 10) === REC_TODAY ? t("today") : dates.dayMonth(e.at)}`

  const action = (x: CompletionItem, e: Encounter, size: "sm" = "sm") => {
    if (e.doctor === ME && x.note)
      return (
        <Button size={size} variant="outline" asChild>
          <Link href={noteHref(x.note)}>{t("open")}</Link>
        </Button>
      )
    if (!canAct) return null
    if (x.remindedAt)
      return (
        <Button size={size} variant="ghost" disabled>
          <Icon name="tick-circle" size={16} />
          {t("reminded")}
        </Button>
      )
    return (
      <Button size={size} variant="outline" onClick={() => void remind([x])}>
        {t("remind")}
      </Button>
    )
  }

  return (
    <section aria-labelledby="rec-cc" className="@container/cc flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/cc:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-cc" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle", { h: CHART_RED_HOURS })}</p>
      </header>
      <div className="grid grid-cols-2 gap-3 @4xl/cc:grid-cols-4">
        <Tile icon="note-2" label={t("tiles.open")} value={String(c.open)} sub={t("tiles.doctors", { n: c.doctors })} />
        <Tile icon="timer-1" label={t("tiles.over")} value={String(c.over48)} sub={c.over48 ? t("tiles.remindToday") : t("tiles.noneOver")} tone={c.over48 ? "destructive" : undefined} />
        <Tile icon="tick-circle" label={t("tiles.done")} value={String(c.done)} sub={t("tiles.doneText")} />
        <Tile icon="chart-2" label={t("tiles.onTime")} value={`${c.onTimePct}%`} sub={t("tiles.goal", { n: c.goalPct })} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="tick-circle" title={t("empty")} description={t("emptyText")} className="py-12" />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border @4xl/cc:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[17%]" />
                <col />
                <col className="w-[16%]" />
                <col className="w-[104px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  {(["patient", "visit", "missing", "doctor", "waiting"] as const).map((k) => (
                    <th key={k} className="h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4">
                      {t(`col.${k}`)}
                    </th>
                  ))}
                  <th className="h-10 pe-4">
                    <span className="sr-only">{t("col.action")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const e = encounters.find((y) => y.id === x.encounter)!
                  const p = patientOf(e.patient)
                  return (
                    <tr key={x.id} className="border-t">
                      <td className="px-2 py-3 ps-4 align-middle">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <InitialsAvatar initials={p.initials} />
                          <span className="truncate text-foreground">{b(p.name)}</span>
                        </span>
                      </td>
                      <td className="truncate px-2 py-3 text-muted-foreground">{visit(e)}</td>
                      <td className="truncate px-2 py-3 text-foreground">{missing(x)}</td>
                      <td className="truncate px-2 py-3 text-muted-foreground">{b(USERS[e.doctor].name)}</td>
                      <td className="px-2 py-3">
                        <WaitingBadge since={x.since} />
                      </td>
                      <td className="px-2 py-3 pe-4 text-end">{action(x, e)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col @4xl/cc:hidden">
            {rows.map((x) => {
              const e = encounters.find((y) => y.id === x.encounter)!
              const p = patientOf(e.patient)
              const mine = e.doctor === ME && x.note
              const body = (
                <>
                  <InitialsAvatar initials={p.initials} className="self-start" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm text-foreground">{b(p.name)}</span>
                    <span className="text-xs text-muted-foreground">
                      {missing(x)} · {b(USERS[e.doctor].name)}
                    </span>
                    <WaitingBadge since={x.since} />
                  </div>
                </>
              )
              return (
                <li key={x.id} className="border-b last:border-b-0">
                  {mine ? (
                    <Link href={noteHref(x.note!)} className="flex items-center gap-2.5 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {body}
                      <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center text-foreground">
                        <Icon name="arrow-right-1" size={24} />
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2.5 py-3">
                      {body}
                      {action(x, e)}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
