"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { REC_TODAY, daysBetween, type Encounter, type VisitNote } from "./data"
import { inMine, noteCounts } from "./counts"
import { noteHref } from "./href"
import { patientOf } from "./lookup"
import { DiagnosisLabel, InitialsAvatar, Latin, NoteStatusBadge, RestrictedMark, useB, useShowMore } from "./parts"
import { recCan } from "./roles"
import { mainDiagnosis, needsBreakGlass, noteStatus, type NoteStatus } from "./rules"
import { ME } from "./session"
import { useEncounters, useGrants, useNotes, useRecRole } from "./store"

export type NoteFilter = "mine" | "drafts" | "overdue" | "signed" | "all"
const FILTERS: NoteFilter[] = ["mine", "drafts", "overdue", "signed", "all"]
const FILTERS_COMPACT: NoteFilter[] = ["mine", "drafts", "overdue"]
const PAGE = 6

/** Today first, then the day before…; within a day drafts (oldest first), signed, overdue (newest first), as drawn. */
const RANK: Record<NoteStatus, number> = { draft: 0, signed: 1, addendum: 1, overdue: 2 }
export function byList(a: VisitNote, b: VisitNote) {
  const ma = inMine(a) ? 0 : 1
  const mb = inMine(b) ? 0 : 1
  if (ma !== mb) return ma - mb
  const day = b.createdAt.slice(0, 10).localeCompare(a.createdAt.slice(0, 10))
  if (day) return day
  const sa = noteStatus(a)
  const sb = noteStatus(b)
  if (RANK[sa] !== RANK[sb]) return RANK[sa] - RANK[sb]
  return sa === "draft" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)
}

function inFilter(n: VisitNote, f: NoteFilter) {
  const s = noteStatus(n)
  if (f === "all") return true
  if (n.author !== ME) return false
  if (f === "drafts") return s === "draft"
  if (f === "overdue") return s === "overdue"
  if (f === "signed") return s === "signed" || s === "addendum"
  return true
}

export type NoteRowAction = { kind: "sign" | "addendum" | "restricted"; note: string }

/** What a row's button does: Sign (overdue, mine) · Addendum (signed, mine) · Open (restricted, others, drafts). */
function rowAction(n: VisitNote, patientRestricted: boolean, canWrite: boolean): "open" | "sign" | "addendum" {
  if (patientRestricted || n.author !== ME || !canWrite) return "open"
  const s = noteStatus(n)
  if (s === "overdue") return "sign"
  if (s === "signed" || s === "addendum") return "addendum"
  return "open"
}

/**
 * Widget / Rec Notes. Wide: "Visit notes · Today and anything not signed yet", search, filter (Mine · Drafts · Overdue ·
 * Signed · All clinics), table Time · Patient (avatar + MRN, "restricted") · Visit · Main diagnosis · Status · action
 * (Open / Sign on overdue / Addendum on signed; overdue rows tinted), "Showing 6 of 37 notes" + Show more.
 * Compact: 3 filters, rows that open the note, "Show 31 more". Opening a restricted file outside the care team goes
 * through the Restricted file dialog (`onAction` "restricted").
 */
export function NotesList({ onAction }: { onAction: (a: NoteRowAction) => void }) {
  const t = useTranslations("records.notes")
  const notes = useNotes()
  const encounters = useEncounters()
  const params = useSearchParams()
  const initial = params.get("filter") as NoteFilter | null
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<NoteFilter>(initial && FILTERS.includes(initial) ? initial : "mine")
  const { extra, more } = useShowMore(`${filter}|${query.trim()}`)
  const c = noteCounts(notes, ME)
  const enc = React.useMemo(() => new Map(encounters.map((e) => [e.id, e])), [encounters])
  const q = query.trim().toLowerCase()
  const matches = (n: VisitNote) => {
    if (!q) return true
    const p = patientOf(enc.get(n.encounter)!.patient)
    return [p.mrn, p.name.en, mainDiagnosis(n)?.code ?? ""].some((v) => v.toLowerCase().includes(q)) || p.name.ar.includes(query.trim())
  }
  const rows = notes.filter((n) => enc.has(n.encounter) && inFilter(n, filter) && matches(n)).sort(byList)
  const shown = Math.min(PAGE + extra, rows.length)
  const label = (f: NoteFilter) => (f === "all" ? t("filter.all") : t(`filter.${f}`, { n: f === "mine" ? c.mine : c[f] }))

  return (
    <section aria-labelledby="rec-notes" className="@container/notes flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/notes:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-notes" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-col gap-2 @4xl/notes:flex-row @4xl/notes:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/notes:w-70"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/notes:ms-auto @4xl/notes:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: label(f) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "mine"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/notes:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: label(f) }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="note-2"
          title={t("empty")}
          description={t("emptyText")}
          className="py-12"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setFilter("mine")
              }}
            >
              {t("clear")}
            </Button>
          }
        />
      ) : (
        <>
          <NotesTable rows={rows.slice(0, shown)} enc={enc} onAction={onAction} />
          <NoteCards rows={rows.slice(0, shown)} enc={enc} />
          <footer className="hidden items-center gap-3 @4xl/notes:flex">
            <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
              {t("showing", { shown, total: rows.length })}
            </span>
            {shown < rows.length && (
              <Button variant="outline" size="sm" onClick={() => more(rows.length - shown)}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {shown < rows.length && (
            <Button variant="outline" size="sm" className="w-full @4xl/notes:hidden" onClick={() => more(rows.length - shown)}>
              {t("showMoreN", { n: rows.length - shown })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}

/** "09:40" today, "22 Nov" before (the table's Time column). */
function useTimeCell() {
  const dates = useDates()
  return (iso: string) => (iso.slice(0, 10) === REC_TODAY ? iso.slice(11, 16) : dates.dayMonth(iso))
}

function PatientCell({ e }: { e: Encounter }) {
  const b = useB()
  const p = patientOf(e.patient)
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <InitialsAvatar initials={p.initials} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-foreground">{b(p.name)}</span>
        <span className="truncate text-xs text-muted-foreground">
          <Latin>{p.mrn}</Latin>
          {p.restricted && (
            <>
              {" · "}
              <RestrictedMark kind={p.restricted} />
            </>
          )}
        </span>
      </div>
    </div>
  )
}

function NotesTable({ rows, enc, onAction }: { rows: VisitNote[]; enc: Map<string, Encounter>; onAction: (a: NoteRowAction) => void }) {
  const t = useTranslations("records.notes")
  const b = useB()
  const time = useTimeCell()
  const canWrite = recCan(useRecRole(), "writeNote")
  const grants = useGrants()
  const th = "h-10 px-2 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-2 py-3 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/notes:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[92px]" />
          <col />
          <col className="w-[22%]" />
          <col className="w-[22%]" />
          <col className="w-[128px]" />
          <col className="w-[120px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.time")}</th>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.visit")}</th>
            <th className={th}>{t("col.diagnosis")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => {
            const e = enc.get(n.encounter)!
            const p = patientOf(e.patient)
            const s = noteStatus(n)
            const dx = mainDiagnosis(n)
            const act = rowAction(n, !!p.restricted, canWrite)
            const restricted = needsBreakGlass(p, ME, grants[e.patient])
            return (
              <tr key={n.id} className={cn("border-t", s === "overdue" && "bg-destructive-soft/60")}>
                <td className={cn(td, "tabular-nums", e.at.slice(0, 10) === REC_TODAY ? "text-xs" : "text-sm")}>{time(n.createdAt)}</td>
                <td className={td}>
                  <PatientCell e={e} />
                </td>
                <td className={cn(td, "truncate text-muted-foreground")}>
                  {b(e.kind)} · {b(e.clinic)}
                </td>
                <td className={cn(td, "truncate")}>{dx ? <DiagnosisLabel code={dx.code} /> : <span className="text-muted-foreground">{t("noDiagnosis")}</span>}</td>
                <td className={td}>
                  <NoteStatusBadge status={s} className={s === "overdue" ? "bg-transparent px-0.5" : undefined} />
                </td>
                <td className={cn(td, "text-end")}>
                  {act === "sign" ? (
                    <Button size="sm" onClick={() => onAction({ kind: "sign", note: n.id })}>
                      {t("sign")}
                    </Button>
                  ) : act === "addendum" ? (
                    <Button size="sm" variant="outline" onClick={() => onAction({ kind: "addendum", note: n.id })}>
                      {t("addendum")}
                    </Button>
                  ) : restricted ? (
                    <Button size="sm" variant="outline" onClick={() => onAction({ kind: "restricted", note: n.id })}>
                      {t("open")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={noteHref(n.id)} aria-label={t("openLabel", { name: b(p.name) })}>
                        {t("open")}
                      </Link>
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Compact rows: name, "09:40 · I10 · Hypertension" (Yesterday for the day before), status; the row opens the note. */
function NoteCards({ rows, enc }: { rows: VisitNote[]; enc: Map<string, Encounter> }) {
  const t = useTranslations("records.notes")
  const tw = useTranslations("records.when")
  const b = useB()
  const dates = useDates()
  const when = (iso: string) => {
    const d = daysBetween(iso)
    return d === 0 ? iso.slice(11, 16) : d === 1 ? tw("yesterday") : dates.dayMonth(iso)
  }
  return (
    <ul className="flex flex-col @4xl/notes:hidden">
      {rows.map((n) => {
        const e = enc.get(n.encounter)!
        const p = patientOf(e.patient)
        const dx = mainDiagnosis(n)
        return (
          <li key={n.id} className="border-b last:border-b-0">
            <Link
              href={noteHref(n.id)}
              aria-label={t("openLabel", { name: b(p.name) })}
              className="flex items-center gap-2.5 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <InitialsAvatar initials={p.initials} className="self-start" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm text-foreground">{b(p.name)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {when(n.createdAt)}
                  {dx && (
                    <>
                      {" · "}
                      <DiagnosisLabel code={dx.code} />
                    </>
                  )}
                </span>
                <NoteStatusBadge status={noteStatus(n)} />
              </div>
              <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center text-foreground">
                <Icon name="arrow-right-1" size={24} />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
