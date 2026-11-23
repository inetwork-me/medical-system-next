"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { isTabEnabled } from "@/lib/modules"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatCard } from "@/components/ds/stat-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { USERS } from "./data"
import { accessCounts, completionCounts, inMine, noteCounts, requestCounts } from "./counts"
import { COMPLETION_HREF, noteHref, notesHref, requestHref } from "./href"
import { patientOf } from "./lookup"
import { InitialsAvatar, Latin, NoteStatusBadge, useB, useWhen } from "./parts"
import { byList } from "./notes"
import { recCan } from "./roles"
import { dueIn, dueSoon, isOpenRequest, noteAge, noteStatus, requestStatus, toSign } from "./rules"
import { ME } from "./session"
import { useAccess, useCompletion, useDuplicates, useEncounters, useNotes, useRecRole, useRequests } from "./store"

const KPI = "max-md:gap-3 max-md:p-4 [&>div:nth-child(2)]:whitespace-nowrap max-md:[&>div:nth-child(2)]:text-xl"

/**
 * Overview KPIs: Notes to sign (overdue in red) · Open requests (due within 3 days) · Charts not complete (over 48 h) ·
 * Flagged access (break the glass), each from the same counts as the tabs. A tab off for the branch takes its KPI.
 */
export function RecordsKpis() {
  const t = useTranslations("records.overview.kpi")
  const notes = useNotes()
  const n = noteCounts(notes, ME)
  const r = requestCounts(useRequests())
  const c = completionCounts(useCompletion(), notes, useEncounters())
  const a = accessCounts(useAccess())
  const on = (tab: string) => isTabEnabled("records", tab)
  return (
    <div className="grid grid-cols-2 gap-4 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none xl:gap-6">
      {on("notes") && (
        <StatCard
          className={KPI}
          icon="edit-2"
          tile="warning"
          label={t("notes")}
          value={n.toSign}
          delta={n.overdue ? t("overdue", { n: n.overdue }) : t("noneOverdue")}
          deltaTone={n.overdue ? "destructive" : "success"}
          caption={t("notesCaption")}
        />
      )}
      {on("requests") && (
        <StatCard
          className={KPI}
          icon="folder-open"
          tile="info"
          label={t("requests")}
          value={r.open}
          delta={r.soon ? t("dueSoon", { n: r.soon }) : t("noneDue")}
          deltaTone={r.soon ? "warning" : "success"}
          caption={t("requestsCaption", { n: r.all })}
        />
      )}
      {on("completion") && (
        <StatCard
          className={KPI}
          icon="note-2"
          tile="info"
          label={t("charts")}
          value={c.open}
          delta={c.over48 ? t("over48", { n: c.over48 }) : t("noneOver")}
          deltaTone={c.over48 ? "destructive" : "success"}
          caption={t("chartsCaption", { n: c.onTimePct })}
        />
      )}
      {on("access") && (
        <StatCard
          className={KPI}
          icon="lock"
          tile="destructive"
          label={t("access")}
          value={a.flagged}
          delta={a.breakGlass ? t("breakGlass", { n: a.breakGlass }) : a.flagged ? t("unusual", { n: a.flagged }) : t("noneFlagged")}
          deltaTone={a.breakGlass ? "destructive" : a.flagged ? "warning" : "success"}
          caption={t("accessCaption", { n: a.today })}
        />
      )}
    </div>
  )
}

/**
 * Widget / Rec My Notes (Notes to sign): "Sign within 24 hours of the visit", All notes; rows with the visit line
 * ("Today 09:40 · follow-up · hypertension") and Draft · 2 h / Overdue · 19 h; Open (wide) or the whole row (compact).
 */
export function NotesToSign() {
  const t = useTranslations("records.overview")
  const b = useB()
  const when = useWhen()
  const notes = useNotes()
  const encounters = useEncounters()
  const rows = notes
    .filter((n) => n.author === ME && inMine(n) && toSign(noteStatus(n)))
    .sort(byList)
  return (
    <section aria-labelledby="rec-ov-notes" className="@container/mn flex flex-col gap-4 rounded-xl border bg-card p-4 @xl/mn:p-5">
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="rec-ov-notes" className="text-lg font-semibold text-foreground">
            {t("notesTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("notesText")}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={notesHref("mine")}>{t("allNotes")}</Link>
        </Button>
      </header>
      {rows.length === 0 ? (
        <EmptyState icon="tick-circle" title={t("notesEmpty")} description={t("notesEmptyText")} className="py-10" />
      ) : (
        <ul className="flex flex-col">
          {rows.map((n) => {
            const e = encounters.find((x) => x.id === n.encounter)!
            const p = patientOf(e.patient)
            const kind = b(e.kind).toLocaleLowerCase()
            const reason = b(e.reason)
            const line = reason.toLocaleLowerCase() === kind ? `${when(n.createdAt)} · ${kind}` : `${when(n.createdAt)} · ${kind} · ${reason}`
            return (
              <li key={n.id} className="border-b last:border-b-0">
                <Link
                  href={noteHref(n.id)}
                  aria-label={t("openNote", { name: b(p.name) })}
                  className="group flex items-center gap-3 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <InitialsAvatar initials={p.initials} className="self-start" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm text-foreground">{b(p.name)}</span>
                    <span className="text-xs text-muted-foreground">{line}</span>
                    <NoteStatusBadge status={noteStatus(n)} hours={noteAge(n)} />
                  </span>
                  <span className="hidden rounded-md border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-xs group-hover:bg-muted @xl/mn:inline-flex">
                    {t("open")}
                  </span>
                  <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center text-foreground @xl/mn:hidden">
                    <Icon name="arrow-right-1" size={24} />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

type Item = { key: string; icon: IconName; tone: "destructive" | "warning" | "info"; title: React.ReactNode; text: React.ReactNode; action: React.ReactNode }

/**
 * Widget / Rec Attention (Needs attention · Records office): restricted file opened (→ Review access), copy of a
 * file due (→ Request), possible duplicate file (→ Merge files), charts not complete (→ Chart completion). Each from
 * the live data; an item leaves when it's dealt with, and a tab off for the branch (or the role) takes its item.
 */
export function NeedsAttention({ onReview, onMerge }: { onReview: (eventId: string) => void; onMerge: (pairId: string) => void }) {
  const t = useTranslations("records.overview.attention")
  const b = useB()
  const role = useRecRole()
  const access = useAccess()
  const requests = useRequests()
  const dups = useDuplicates()
  const notes = useNotes()
  const encounters = useEncounters()
  const c = completionCounts(useCompletion(), notes, encounters)
  const on = (tab: string) => isTabEnabled("records", tab)
  const items: Item[] = []

  // Break the glass waiting for review (newest).
  const bg = access.filter((e) => e.flag === "breakGlass" && !e.review).sort((x, y) => y.at.localeCompare(x.at))[0]
  if (bg && on("access") && recCan(role, "reviewAccess")) {
    const p = patientOf(bg.patient)
    items.push({
      key: "bg",
      icon: "lock",
      tone: "destructive",
      title: t("restricted", { time: bg.at.slice(11, 16) }),
      text: t("restrictedText", { name: b(USERS[bg.user].name), kind: p.restricted ?? "sensitive" }),
      action: (
        <Button size="sm" variant="outline" onClick={() => onReview(bg.id)}>
          {t("review")}
        </Button>
      ),
    })
  }
  // A copy due soon: the one ready to release first, else the soonest.
  const due = requests.filter(dueSoon).sort((x, y) => Number(requestStatus(y) === "ready") - Number(requestStatus(x) === "ready") || x.due.localeCompare(y.due))[0]
  if (due && on("requests") && isOpenRequest(due)) {
    const n = dueIn(due)
    items.push({
      key: "req",
      icon: "timer-1",
      tone: "warning",
      title: n <= 0 ? t("copyToday") : n === 1 ? t("copyTomorrow") : t("copyIn", { n }),
      text: (
        <>
          <Latin>{due.no}</Latin> · {b(patientOf(due.patient).name)} · {t("forWho", { who: b(due.requesterShort) })}
        </>
      ),
      action: (
        <Button size="sm" variant="outline" asChild>
          <Link href={requestHref(due.no)}>{t("open")}</Link>
        </Button>
      ),
    })
  }
  // Possible duplicate file.
  const dup = dups[0]
  if (dup && recCan(role, "merge")) {
    const [x, y] = dup.files.map((f) => patientOf(f.key))
    items.push({
      key: "dup",
      icon: "profile-2user",
      tone: "info",
      title: t("duplicate"),
      text: (
        <bdi>
          {t("duplicateText", { name: b(x.name), a: `⁦${x.mrn}⁩`, b: `⁦${y.mrn}⁩` })}
        </bdi>
      ),
      action: (
        <Button size="sm" variant="outline" onClick={() => onMerge(dup.id)}>
          {t("merge")}
        </Button>
      ),
    })
  }
  // Charts not complete.
  if (c.open && on("completion")) {
    items.push({
      key: "cc",
      icon: "note-2",
      tone: "warning",
      title: t("charts", { n: c.open }),
      text: t("chartsText", { n: c.over48, d: c.redDoctors }),
      action: (
        <Button size="sm" variant="outline" asChild>
          <Link href={COMPLETION_HREF}>{t("view")}</Link>
        </Button>
      ),
    })
  }

  const tile = { destructive: "bg-destructive-soft text-destructive-soft-foreground", warning: "bg-warning-soft text-warning-soft-foreground", info: "bg-info-soft text-info-soft-foreground" }
  return (
    <section aria-labelledby="rec-ov-att" className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rec-ov-att" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("text")}</p>
      </header>
      {items.length === 0 ? (
        <EmptyState icon="tick-circle" title={t("empty")} description={t("emptyText")} className="py-10" />
      ) : (
        <ul className="flex flex-col">
          {items.map((x) => (
            <li key={x.key} className="flex items-center gap-3 border-b py-3 last:border-b-0">
              <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center self-start rounded-lg", tile[x.tone])}>
                <Icon name={x.icon} size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">{x.title}</span>
                <span className="text-xs text-muted-foreground">{x.text}</span>
              </span>
              {x.action}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
