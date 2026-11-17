"use client"

import * as React from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Button } from "@/components/ui/button"
import { PCard } from "../profile/side"
import { usePatient, useText } from "../profile/use-patient"
import { GAZES, GAZE_IMG, MUSCLES, icdName, specialtyHref, type EyeExam, type Gaze, type MuscleKey } from "./data"
import { GradeChip, Glass, formatGrade, useEyeText } from "./eye-parts"
import { useEyeRecord } from "./eye-store"

/**
 * Patients · Patient page · Eyes (Widget / Patient Tab · Eyes, Wide | Compact). Wide from 45rem of tab width (desktop),
 * Compact below (tablet, mobile). Anatomical blocks (eye labels, OD/OS columns, gaze grid) stay left-to-right in Arabic.
 * Mobile is view-only: Open simulator goes to the patient view and Compare is hidden.
 */
export function EyesTab() {
  const t = useTranslations("specialties.eyes")
  const data = usePatient()
  const rec = useEyeRecord(data?.patient.id ?? "")
  if (!data) return null
  const id = data.patient.id
  if (!rec)
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon="eye"
          title={t("empty.title")}
          description={t("empty.text")}
          className="py-16"
          actions={
            <Button asChild className="max-md:hidden">
              <Link href={specialtyHref.eyeExam(id)}>
                <Icon name="3d-rotate" size={20} />
                {t("empty.start")}
              </Link>
            </Button>
          }
        />
      </div>
    )
  const latest = rec.exams.find((e) => e.status === "signed") ?? rec.exams[0]
  return (
    <>
      <SimulatorCard id={id} exam={latest} />
      <div className="grid gap-4 @min-[45rem]/tab:grid-cols-2 @min-[45rem]/tab:gap-6">
        <LatestFindings exam={latest} />
        <MuscleSummary exam={latest} />
      </div>
      <NineGaze exam={latest} />
      <ExamHistory id={id} exams={rec.exams} />
    </>
  )
}

/* ---------------------------------------------------------------- shared bits */

/** Most affected muscle of an exam, e.g. "LR −3" (history tags). */
function worstMuscle(exam: EyeExam) {
  let best: { key: MuscleKey; g: number } | null = null
  for (const eye of ["OD", "OS"] as const)
    for (const m of MUSCLES) {
      const g = exam.grades[eye][m.key]
      if (g < 0 && (!best || g < best.g)) best = { key: m.key, g }
    }
  return best
}

/* ---------------------------------------------------------------- simulator card */

const MUSCLE_COLORS = [
  ["normal", "#C0605C"],
  ["under", "#F59E0B"],
  ["over", "#8B5CF6"],
  ["selected", "#2B6BFF"],
] as const

/**
 * Hero card: the 3D still (placeholder until the live viewer ships) with the gaze readout, view tools (zoom / reset /
 * full screen work on the still; rotate opens the simulator), OD / OS labels and the muscle colour legend.
 */
function SimulatorCard({ id, exam }: { id: string; exam: EyeExam }) {
  const t = useTranslations("specialties.eyes.sim")
  const { b, locale } = useText()
  const dates = useDates()
  const [zoom, setZoom] = React.useState(1)
  const tools: { key: string; icon: IconName; label: string; onClick?: (e: React.MouseEvent<HTMLElement>) => void; href?: string }[] = [
    { key: "rotate", icon: "rotate-left", label: t("tools.rotate"), href: specialtyHref.eyeExam(id) },
    { key: "in", icon: "search-zoom-in", label: t("tools.zoomIn"), onClick: () => setZoom((z) => Math.min(2, z + 0.25)) },
    { key: "out", icon: "search-zoom-out", label: t("tools.zoomOut"), onClick: () => setZoom((z) => Math.max(1, z - 0.25)) },
    { key: "reset", icon: "refresh", label: t("tools.reset"), onClick: () => setZoom(1) },
    {
      key: "full",
      icon: "maximize-4",
      label: t("tools.fullscreen"),
      onClick: (e) => (document.fullscreenElement ? document.exitFullscreen() : e.currentTarget.closest<HTMLElement>("[data-viewport]")?.requestFullscreen?.()),
    },
  ]
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div data-viewport className="relative h-[200px] overflow-hidden bg-slate-900 @min-[45rem]/tab:h-[300px]">
        <div className="absolute inset-0 transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
          <Image src="/specialties/eye_card_m.png" alt={t("alt")} fill sizes="400px" className="object-cover md:hidden" priority />
          <Image src="/specialties/eye_card_d.png" alt={t("alt")} fill sizes="(min-width: 1280px) 816px, 100vw" className="object-cover max-md:hidden" priority />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3 @min-[45rem]/tab:p-4">
          <Glass className="me-auto font-medium">
            <Icon name="3d-rotate" size={16} className="text-slate-200" />
            {t("readout")}
          </Glass>
          <div dir="ltr" className="hidden items-center gap-0.5 rounded-[10px] bg-slate-900/80 p-[3px] @min-[45rem]/tab:flex">
            {tools.map((x) =>
              x.href ? (
                <Link key={x.key} href={x.href} aria-label={x.label} title={x.label} className={TOOL}>
                  <Icon name={x.icon} size={18} mirror={false} />
                </Link>
              ) : (
                <button key={x.key} type="button" aria-label={x.label} title={x.label} onClick={x.onClick} className={TOOL}>
                  <Icon name={x.icon} size={18} mirror={false} />
                </button>
              ),
            )}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-3 @min-[45rem]/tab:p-4">
          {/* Anatomical: OD (patient's right) on the viewer's left in both languages. */}
          <div dir="ltr" className="flex justify-around">
            {(["OD", "OS"] as const).map((eye) => (
              <Glass key={eye} className="font-medium" dir={locale === "ar" ? "rtl" : "ltr"}>
                <span>{t(eye === "OD" ? "rightEye" : "leftEye")}</span>
                <span className="font-normal text-slate-400">{eye}</span>
              </Glass>
            ))}
          </div>
          <ul className="mx-auto hidden items-center gap-3.5 rounded-full bg-slate-900/80 px-3 py-1.5 @min-[45rem]/tab:flex">
            {MUSCLE_COLORS.map(([k, c]) => (
              <li key={k} className="flex items-center gap-1.5 text-xs text-slate-200">
                <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: c }} />
                {t(`legend.${k}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3.5 @min-[45rem]/tab:flex-row @min-[45rem]/tab:items-center @min-[45rem]/tab:p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("lastExam", { date: dates.short(exam.date), doctor: b(exam.doctor) })}</p>
        </div>
        <div className="flex gap-2 *:flex-1 @min-[45rem]/tab:*:flex-none">
          <Button variant="outline" asChild>
            <Link href={specialtyHref.eyePatientView(id)}>
              <Icon name="presention-chart" size={20} />
              {t("patientView")}
            </Link>
          </Button>
          {/* Phones are view-only: the simulator opens as the patient view. */}
          <Button asChild className="md:hidden">
            <Link href={specialtyHref.eyePatientView(id)}>
              <Icon name="3d-rotate" size={20} />
              {t("open")}
            </Link>
          </Button>
          <Button asChild className="max-md:hidden">
            <Link href={specialtyHref.eyeExam(id)}>
              <Icon name="3d-rotate" size={20} />
              {t("open")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
const TOOL =
  "flex size-8 items-center justify-center rounded-lg text-slate-200 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"

/* ---------------------------------------------------------------- latest findings */

function LatestFindings({ exam }: { exam: EyeExam }) {
  const t = useTranslations("specialties.eyes.findings")
  const { b } = useText()
  const dates = useDates()
  const tx = useEyeText()
  const rows: [string, React.ReactNode, boolean?][] = [
    [
      t("diagnosis"),
      <>
        <bdi dir="ltr">{exam.icd10}</bdi> · {b(icdName(exam.icd10))}
      </>,
    ],
    [t("deviation"), t("deviationValue", { type: t(`cover.${exam.coverTest}`), near: exam.deviation.near, far: exam.deviation.far })],
    [t("diplopia"), tx.diplopia(exam.diplopia), exam.diplopia !== "none"],
    [t("headPosture"), tx.posture(exam.headPosture)],
    [t("nystagmus"), tx.nystagmus(exam.nystagmus)],
    [t("acuity"), <bdi key="a" dir="ltr">{`OD ${exam.acuity.OD} · OS ${exam.acuity.OS}`}</bdi>],
  ]
  return (
    <PCard title={t("title")} description={t("description", { date: dates.short(exam.date), doctor: b(exam.doctor) })}>
      <dl>
        {rows.map(([k, v, warn]) => (
          <div key={k} className="flex items-start gap-3 border-b py-2.5 last:border-0">
            <dt className="w-[100px] shrink-0 pt-0.5 text-xs text-muted-foreground @min-[45rem]/tab:w-[140px]">{k}</dt>
            <dd className={cn("min-w-0 flex-1 text-sm font-medium tabular-nums", warn ? "text-warning-soft-foreground" : "text-foreground")}>{v}</dd>
          </div>
        ))}
      </dl>
    </PCard>
  )
}

/* ---------------------------------------------------------------- muscle summary */

function MuscleSummary({ exam }: { exam: EyeExam }) {
  const t = useTranslations("specialties.eyes.muscles")
  const { b } = useText()
  return (
    <PCard title={t("title")} description={t.rich("scale", { n: (c) => <bdi dir="ltr">{c}</bdi> })}>
      <table className="w-full overflow-hidden rounded-lg border-separate border-spacing-0 border text-xs">
        <thead>
          <tr className="bg-muted text-muted-foreground">
            <th className="px-3 py-2 text-start font-medium">{t("muscle")}</th>
            {/* OD then OS in both languages (anatomical order). */}
            <th className="w-[104px] px-3 py-2 font-medium" dir="ltr">
              <span className="flex justify-end gap-2">
                <span className="w-11 text-center">OD</span>
                <span className="w-11 text-center">OS</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {MUSCLES.map((m) => (
            <tr key={m.key} className="[&>td]:border-t">
              <td className="px-3 py-[7px]">
                <span className="flex items-center gap-2">
                  <span className="w-6 shrink-0 font-medium text-foreground" dir="ltr">
                    {m.key}
                  </span>
                  <span className="text-muted-foreground">{b(m.name)}</span>
                </span>
              </td>
              <td className="px-3 py-[7px]" dir="ltr">
                <span className="flex justify-end gap-2">
                  <GradeChip grade={exam.grades.OD[m.key]} />
                  <GradeChip grade={exam.grades.OS[m.key]} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PCard>
  )
}

/* ---------------------------------------------------------------- nine gaze */

function NineGaze({ exam }: { exam: EyeExam }) {
  const t = useTranslations("specialties.eyes.gaze")
  return (
    <PCard title={t("title")} description={t("description")}>
      <div dir="ltr" className="flex flex-col gap-2">
        <ul className="grid grid-cols-3 gap-2">
          {GAZES.map((g: Gaze) => {
            const limited = exam.limited.includes(g)
            return (
              <li key={g} className="flex min-w-0 flex-col items-center gap-1">
                <span className="relative block h-[46px] w-full overflow-hidden rounded-md bg-slate-900 @min-[45rem]/tab:h-[110px]">
                  <Image src={`/specialties/eye_9_${GAZE_IMG[g]}.png`} alt="" fill sizes="(min-width: 768px) 260px, 33vw" className="object-cover" />
                  {limited && <span aria-hidden className="absolute inset-0 rounded-md border-2 border-warning" />}
                </span>
                <span dir="auto" className={cn("text-xs", limited ? "text-warning-soft-foreground" : "text-muted-foreground")}>
                  {t(`pos.${g}`)}
                  {limited && <span className="sr-only"> · {t("limited")}</span>}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span dir="auto">{t("patientRight")}</span>
          <span dir="auto">{t("patientLeft")}</span>
        </div>
      </div>
    </PCard>
  )
}

/* ---------------------------------------------------------------- history */

const TREND_TONE: Record<EyeExam["trend"] | "signed", StatusTone> = { draft: "info", improving: "success", baseline: "neutral", signed: "success" }

const trend = (e: EyeExam) => (e.trend === "draft" && e.status === "signed" ? "signed" : e.trend)

function ExamHistory({ id, exams }: { id: string; exams: EyeExam[] }) {
  const t = useTranslations("specialties.eyes.history")
  const { b } = useText()
  const dates = useDates()
  return (
    <PCard
      title={t("title")}
      description={t("description", { count: exams.length, doctor: b(exams[0].doctor) })}
      action={
        exams.length > 1 && (
          <Button variant="ghost" size="sm" asChild className="max-md:hidden">
            <Link href={specialtyHref.eyeCompare(id)}>
              <Icon name="presention-chart" size={16} />
              {t("compare")}
            </Link>
          </Button>
        )
      }
    >
      <ul>
        {exams.map((e, i) => {
          const worst = worstMuscle(e)
          return (
            <li key={e.id} className="flex items-center gap-3 border-b py-3 last:border-0">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", i === 0 ? "bg-accent text-primary" : "bg-muted text-muted-foreground")}>
                <Icon name="eye" size={18} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium tabular-nums">{dates.short(e.date)}</span>
                <span className="text-xs text-muted-foreground">{t(e.kind === "today" && e.status === "signed" ? "kind.todaySigned" : `kind.${e.kind}`)}</span>
              </div>
              <span className="hidden items-center gap-1.5 @min-[45rem]/tab:flex" dir="ltr">
                {worst && (
                  <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning-soft-foreground tabular-nums">
                    {worst.key} {formatGrade(worst.g)}
                  </span>
                )}
                <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums">
                  {e.coverTest === "exotropia" ? "XT" : "ET"} {e.deviation.near}Δ
                </span>
              </span>
              <StatusBadge tone={TREND_TONE[trend(e)]}>{t(`trend.${trend(e)}`)}</StatusBadge>
              <Button variant="ghost" size="icon-sm" asChild className="hidden @min-[45rem]/tab:inline-flex">
                <Link href={specialtyHref.eyeExam(id, e.id)} aria-label={`${t("view")} · ${dates.short(e.date)}`}>
                  <Icon name="eye" size={18} />
                </Link>
              </Button>
            </li>
          )
        })}
      </ul>
    </PCard>
  )
}
