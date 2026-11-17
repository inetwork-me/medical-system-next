"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useDates } from "@/i18n/dates"
import { useIsMobile } from "@/hooks/use-media-query"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { PCard } from "../profile/side"
import { MUSCLES, type Diplopia, type EyeExam } from "./data"
import { EyeActions, EyeViewport, FindingsForm, GazePad, MuscleEditor, MuscleInfo, formatGrade, useEyeText } from "./eye-parts"
import { useEyeRecord, useEyeView, useTodayExam } from "./eye-store"
import { Workspace } from "./workspace"

/**
 * Eye movement exam workspaces (1440 / 768): Exam (gaze pad · viewport · muscles + findings), Anatomy (muscles ·
 * viewport · muscle info) and Compare (two synced exam cards + What changed · gaze pad). Phones: view-only.
 */

/** Today's exam (editable), or a past exam opened from the history (`?exam=`), which is read-only. */
function useEyeWs(examId?: string) {
  const { id } = useParams<{ id: string }>()
  const today = useTodayExam(id)
  const rec = useEyeRecord(id)
  const [view, setView] = useEyeView(id)
  const mobile = useIsMobile()
  const past = examId ? rec?.exams.find((e) => e.id === examId && e.kind !== "today") : undefined
  const exam = past ?? today.exam
  const readOnly = mobile || !!past || today.signedAt != null
  return { id, exam, patch: past ? () => {} : today.patch, view, setView, mobile, readOnly }
}

function NoExams() {
  const t = useTranslations("specialties.eyes.empty")
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState icon="eye" title={t("title")} description={t("text")} className="py-16" />
    </div>
  )
}

function ViewOnly() {
  const t = useTranslations("specialties.eyes.ews")
  return (
    <p className="flex items-center gap-2 rounded-[10px] bg-info-soft px-3 py-2 text-xs text-info-soft-foreground">
      <Icon name="info-circle" size={16} className="shrink-0" />
      {t("viewOnly")}
    </p>
  )
}

/** Desktop body height: viewport minus the 64px bar and 16px padding top and bottom. */
const FILL = "xl:h-[calc(100svh-6rem)] xl:min-h-[640px]"

export function EyeExamWorkspace({ examId }: { examId?: string }) {
  const { id, exam, patch, view, setView, mobile, readOnly } = useEyeWs(examId)
  return (
    <Workspace kind="eye" mode="exam" actions={exam && <EyeActions id={id} />}>
      {!exam ? (
        <NoExams />
      ) : (
        <div className={cn("flex flex-col gap-4 xl:grid xl:grid-cols-[300px_minmax(0,1fr)_360px]", FILL)}>
          {mobile && <ViewOnly />}
          <div className="order-2 flex min-h-0 flex-col gap-4 xl:order-1 xl:overflow-y-auto">
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
              <GazePad view={view} set={setView} readOnly={mobile} />
              <MuscleEditor exam={exam} patch={patch} view={view} set={setView} readOnly={readOnly} className="xl:hidden" />
            </div>
          </div>
          <EyeViewport exam={exam} view={view} mode="exam" className="order-1 h-[300px] md:h-[420px] xl:order-2 xl:h-full" />
          <div className="order-3 flex min-h-0 flex-col gap-4 xl:overflow-y-auto">
            <MuscleEditor exam={exam} patch={patch} view={view} set={setView} readOnly={readOnly} className="max-xl:hidden" />
            <FindingsForm exam={exam} patch={patch} readOnly={readOnly} />
          </div>
        </div>
      )}
    </Workspace>
  )
}

export function EyeAnatomyWorkspace() {
  const { id, exam, patch, view, setView, mobile, readOnly } = useEyeWs()
  return (
    <Workspace kind="eye" mode="anatomy" actions={exam && <EyeActions id={id} />}>
      {!exam ? (
        <NoExams />
      ) : (
        <div className={cn("flex flex-col gap-4 xl:grid xl:grid-cols-[360px_minmax(0,1fr)_340px]", FILL)}>
          {mobile && <ViewOnly />}
          <EyeViewport exam={exam} view={view} mode="anatomy" onSelectMuscle={(m) => setView({ muscle: m })} className="h-[300px] md:h-[420px] xl:order-2 xl:h-full" />
          <div className="grid items-start gap-4 md:grid-cols-2 xl:contents">
            <MuscleInfo id={id} exam={exam} view={view} className="xl:order-3 xl:self-start" />
            <MuscleEditor
              exam={exam}
              patch={patch}
              view={view}
              set={setView}
              readOnly={readOnly}
              selectable
              className="xl:order-1 xl:max-h-full xl:self-start xl:overflow-y-auto"
            />
          </div>
        </div>
      )}
    </Workspace>
  )
}

/* ---------------------------------------------------------------- compare */

const RANK: Record<Diplopia, number> = { none: 0, right: 1, left: 1, vertical: 1, most: 2 }

export function EyeCompareWorkspace() {
  const t = useTranslations("specialties.eyes.ews.compare")
  const { id } = useParams<{ id: string }>()
  const rec = useEyeRecord(id)
  const [view, setView] = useEyeView(id)
  const dates = useDates()
  const signed = rec?.exams.filter((e) => e.status === "signed") ?? []
  const latest = signed[0]
  const base = signed[signed.length - 1]
  return (
    <Workspace kind="eye" mode="compare" actions={rec && <EyeActions id={id} />}>
      {!latest || !base || latest === base ? (
        <NoExams />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid gap-4 md:max-xl:grid-cols-1 xl:grid-cols-2">
              <CompareCard exam={base} label={t("baseline")} view={view} still="eye_cmp_before" />
              <CompareCard exam={latest} label={t("latest")} view={view} still="eye_cmp_after" />
            </div>
            <p className="flex items-center gap-2 rounded-[10px] bg-info-soft px-3 py-3 text-xs text-info-soft-foreground max-xl:hidden">
              <Icon name="info-circle" size={18} className="shrink-0" />
              {t("sync")}
            </p>
            <Changes from={base} to={latest} range={t("range", { from: dates.short(base.date), to: dates.short(latest.date) })} />
          </div>
          <GazePad view={view} set={setView} className="max-xl:hidden xl:sticky xl:top-20" />
        </div>
      )}
    </Workspace>
  )
}

function CompareCard({ exam, label, view, still }: { exam: EyeExam; label: string; view: ReturnType<typeof useEyeView>[0]; still: string }) {
  const dates = useDates()
  const worst = MUSCLES.map((m) => ({ m, g: exam.grades.OD[m.key] })).sort((a, b) => a.g - b.g)[0]
  // The before / after renders show the eyes looking right; other directions use the nine-gaze stills.
  const src = view.gaze === "right" ? { src: `/specialties/${still}.png`, fit: "cover" as const } : undefined
  return (
    <section className="overflow-hidden rounded-[14px] border bg-card">
      <header className="flex items-center gap-2 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium tabular-nums">{dates.short(exam.date)}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span dir="ltr" className="flex gap-1.5">
          {worst.g < 0 && (
            <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning-soft-foreground tabular-nums">
              {worst.m.key} {formatGrade(worst.g)}
            </span>
          )}
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums">
            {exam.coverTest === "exotropia" ? "XT" : "ET"} {exam.deviation.near}Δ
          </span>
        </span>
      </header>
      <EyeViewport exam={exam} view={view} mode="exam" compact still={src} className="h-[320px] rounded-none xl:h-[380px]" />
    </section>
  )
}

function Changes({ from, to, range }: { from: EyeExam; to: EyeExam; range: string }) {
  const t = useTranslations("specialties.eyes.ews.compare")
  const tx = useEyeText()
  const dates = useDates()
  const cmp = (a: number, b: number) => (b < a ? "better" : b > a ? "worse" : "same")
  const rows: { k: string; a: string; b: string; c: "better" | "worse" | "same"; ltr?: boolean }[] = [
    { k: t("lr"), a: formatGrade(from.grades.OD.LR), b: formatGrade(to.grades.OD.LR), c: cmp(Math.abs(from.grades.OD.LR), Math.abs(to.grades.OD.LR)), ltr: true },
    { k: t("near"), a: `${from.deviation.near}Δ`, b: `${to.deviation.near}Δ`, c: cmp(from.deviation.near, to.deviation.near), ltr: true },
    { k: t("turn"), a: `${from.headPosture.deg}°`, b: `${to.headPosture.deg}°`, c: cmp(from.headPosture.deg, to.headPosture.deg), ltr: true },
    { k: t("diplopia"), a: tx.diplopiaShort(from.diplopia), b: tx.diplopiaShort(to.diplopia), c: cmp(RANK[from.diplopia], RANK[to.diplopia]) },
  ]
  const tone: Record<string, StatusTone> = { better: "success", worse: "destructive", same: "neutral" }
  return (
    <PCard title={t("changed")} description={<bdi>{range}</bdi>}>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr className="h-10 *:px-4 *:text-start *:font-medium">
              <th>{t("measure")}</th>
              <th className="w-[150px]">{dates.dayMonth(from.date)}</th>
              <th className="w-[150px]">{dates.dayMonth(to.date)}</th>
              <th className="w-[120px]">{t("change")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className="border-t *:px-4 *:py-3">
                <td>{r.k}</td>
                <td className="font-medium tabular-nums">{r.ltr ? <bdi dir="ltr">{r.a}</bdi> : r.a}</td>
                <td className="font-medium tabular-nums">{r.ltr ? <bdi dir="ltr">{r.b}</bdi> : r.b}</td>
                <td>
                  <StatusBadge tone={tone[r.c]}>{t(r.c)}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PCard>
  )
}
