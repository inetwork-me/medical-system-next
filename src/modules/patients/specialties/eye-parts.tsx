"use client"

import * as React from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { useIsMobile } from "@/hooks/use-media-query"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { PCard } from "../profile/side"
import { usePatient, useText } from "../profile/use-patient"
import {
  EYE_ICD,
  GAZES,
  GAZE_IMG,
  MUSCLES,
  MUSCLE_INFO,
  icdName,
  specialtyHref,
  type CoverTest,
  type Diplopia,
  type Eye,
  type EyeExam,
  type Gaze,
  type HeadPosture,
  type MuscleKey,
  type Nystagmus,
} from "./data"
import { signExam, useTodayExam, type EyeView } from "./eye-store"

/** −3 / 0 / +1 grade chip: under-acting warning, over-acting info, normal muted. Always LTR. */
export function GradeChip({ grade, className }: { grade: number; className?: string }) {
  return (
    <span
      dir="ltr"
      className={cn(
        "inline-flex h-[22px] w-11 shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums",
        grade < 0 ? "bg-warning-soft text-warning-soft-foreground" : grade > 0 ? "bg-info-soft text-info-soft-foreground" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {formatGrade(grade)}
    </span>
  )
}
export const formatGrade = (g: number) => (g === 0 ? "0" : g < 0 ? `−${Math.abs(g)}` : `+${g}`)

/* ================================================================== wording */

/** Findings wording shared by the Eyes tab, the exam form and Compare. */
export function useEyeText() {
  const t = useTranslations("specialties.eyes.f")
  return {
    diplopia: (d: Diplopia) => t(`diplopia.${d}`),
    diplopiaShort: (d: Diplopia) => t(`diplopiaShort.${d}`),
    posture: (h: HeadPosture) => (h.kind === "none" ? t("posture.none") : t(`posture.${h.kind}`, { deg: h.deg })),
    postureOpt: (k: HeadPosture["kind"]) => t(`postureOpt.${k}`),
    nystagmus: (n: Nystagmus) => t(`nystagmus.${n}`),
    coverOpt: (c: CoverTest) => t(`coverOpt.${c}`),
  }
}

/* ================================================================== viewport */

const MUSCLE_COLORS = [
  ["normal", "#C0605C"],
  ["under", "#F59E0B"],
  ["over", "#8B5CF6"],
  ["selected", "#2B6BFF"],
] as const

type Still = { src: string; fit: "cover" | "contain" }
/** Design stills standing in for the 3D viewer: portrait (desktop centre column) and landscape (tablet / cards). */
function stills(mode: "exam" | "anatomy", gaze: Gaze, muscle: MuscleKey | null): { portrait: Still; landscape: Still } {
  const s = (src: string, fit: Still["fit"] = "cover") => ({ src: `/specialties/${src}.png`, fit })
  if (mode === "anatomy")
    return muscle === "LR" || !muscle
      ? { portrait: s("eye_ws_d_anat"), landscape: s("eye_ws_t_anat") }
      : { portrait: s("eye_anat_od", "contain"), landscape: s("eye_anat_od") }
  if (gaze === "right") return { portrait: s("eye_ws_d_right"), landscape: s("eye_ws_t_right") }
  if (gaze === "primary") return { portrait: s("eye_ws_d_primary"), landscape: s("eye_ws_d_primary", "contain") }
  return { portrait: s(`eye_9_${GAZE_IMG[gaze]}`, "contain"), landscape: s(`eye_9_${GAZE_IMG[gaze]}`, "contain") }
}

/** Readout chip text for the current view. */
export function useReadout(view: EyeView, mode: "exam" | "anatomy") {
  const t = useTranslations("specialties.eyes.ews")
  if (mode === "anatomy") return t("anatReadout", { eye: t(`eyeName.${view.muscleEye}`) })
  return view.gaze === "primary" ? t("gaze.readoutAhead") : t("gaze.readout", { dir: t(`gaze.dir.${view.gaze}`), angle: view.angle })
}

/** Dark viewport chip. */
export function Glass({ className, children, dir }: { className?: string; children: React.ReactNode; dir?: "ltr" | "rtl" }) {
  return (
    <span dir={dir} className={cn("inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs text-slate-50", className)}>
      {children}
    </span>
  )
}

/**
 * 3D viewport (still render until the live viewer): readout, view tools (zoom / reset / full screen), callout for an
 * under-acting muscle in the limited gaze, OD / OS labels (anatomical, never mirrored) and the muscle colour legend.
 */
export function EyeViewport({
  exam,
  view,
  mode,
  className,
  compact,
  still,
}: {
  exam: EyeExam
  view: EyeView
  mode: "exam" | "anatomy"
  className?: string
  /** Cards (Compare): no tools, legend or callout. */
  compact?: boolean
  /** Override the still (Compare cards). */
  still?: Still
}) {
  const t = useTranslations("specialties.eyes")
  const { b, locale } = useText()
  const readout = useReadout(view, mode)
  const [zoom, setZoom] = React.useState(1)
  const pics = stills(mode, view.gaze, view.muscle)
  const dir = locale === "ar" ? "rtl" : "ltr"
  const callout = (() => {
    if (mode !== "exam" || compact || !exam.limited.includes(view.gaze)) return null
    for (const eye of ["OD", "OS"] as const)
      for (const m of MUSCLES) if (exam.grades[eye][m.key] < 0) return { eye, m, g: exam.grades[eye][m.key] }
    return null
  })()
  const tools: { key: string; icon: IconName; label: string; onClick: (e: React.MouseEvent<HTMLElement>) => void }[] = [
    { key: "in", icon: "search-zoom-in", label: t("sim.tools.zoomIn"), onClick: () => setZoom((z) => Math.min(2, z + 0.25)) },
    { key: "out", icon: "search-zoom-out", label: t("sim.tools.zoomOut"), onClick: () => setZoom((z) => Math.max(1, z - 0.25)) },
    { key: "reset", icon: "refresh", label: t("sim.tools.reset"), onClick: () => setZoom(1) },
    {
      key: "full",
      icon: "maximize-4",
      label: t("sim.tools.fullscreen"),
      onClick: (e) => (document.fullscreenElement ? document.exitFullscreen() : e.currentTarget.closest<HTMLElement>("[data-viewport]")?.requestFullscreen?.()),
    },
  ]
  const img = (p: Still, cls: string, sizes: string) =>
    still ? null : (
      <Image src={p.src} alt={readout} fill sizes={sizes} className={cn(p.fit === "cover" ? "object-cover" : "object-contain", cls)} priority />
    )
  return (
    <div
      data-viewport
      className={cn("relative overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_50%_40%,#1e293b,#020617)]", className)}
    >
      <div className="absolute inset-0 transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
        {still ? (
          <Image src={still.src} alt={readout} fill sizes="600px" className={still.fit === "cover" ? "object-cover" : "object-contain"} />
        ) : (
          <>
            {img(pics.portrait, "max-xl:hidden", "760px")}
            {img(pics.landscape, "xl:hidden", "(min-width: 768px) 720px, 100vw")}
          </>
        )}
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3 xl:p-4">
        <Glass className="me-auto font-medium">
          <Icon name="3d-rotate" size={16} className="text-slate-200" />
          {readout}
        </Glass>
        {!compact && (
          <div dir="ltr" className="flex items-center gap-0.5 rounded-[10px] bg-slate-900/80 p-[3px]">
            {tools.map((x) => (
              <button
                key={x.key}
                type="button"
                aria-label={x.label}
                title={x.label}
                onClick={x.onClick}
                className="flex size-8 items-center justify-center rounded-lg text-slate-200 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Icon name={x.icon} size={18} mirror={false} />
              </button>
            ))}
          </div>
        )}
      </div>
      {callout && (
        // Anatomical: points at the right eye on the viewer's left in both languages.
        <div dir="ltr" className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 xl:inset-x-4">
          <div dir={dir} className="flex max-w-64 flex-col gap-0.5 rounded-[10px] border border-[#F59E0B] bg-slate-900/90 px-3 py-2">
            <span className="text-xs font-medium text-[#FCD34D]">
              {t(`ews.callout${callout.eye}`, { muscle: b(callout.m.name).toLocaleLowerCase(locale), grade: formatGrade(callout.g) })}
            </span>
            <span className="text-xs text-slate-200">{t("ews.calloutText", { eye: t(`ews.eyeName.${callout.eye}`), dir: t(`ews.calloutDir.${callout.m.key}`) })}</span>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-3 xl:p-4">
        {mode === "exam" && (
          <div dir="ltr" className="flex justify-around">
            {(["OD", "OS"] as const).map((eye) => (
              <Glass key={eye} className="font-medium" dir={dir}>
                <span>{t(eye === "OD" ? "sim.rightEye" : "sim.leftEye")}</span>
                <span className="font-normal text-slate-400">{eye}</span>
              </Glass>
            ))}
          </div>
        )}
        {!compact && (
          <ul className="mx-auto flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 rounded-full bg-slate-900/80 px-3 py-1.5">
            {MUSCLE_COLORS.map(([k, c]) => (
              <li key={k} className="flex items-center gap-1.5 text-xs text-slate-200">
                <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: c }} />
                {t(`sim.legend.${k}`)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ================================================================== gaze pad */

/** Widget / Eye Gaze Pad: eye select, 3×3 pad (as you face the patient; never mirrored), angle slider, toggles. */
export function GazePad({ view, set, readOnly, className }: { view: EyeView; set: (p: Partial<EyeView>) => void; readOnly?: boolean; className?: string }) {
  const t = useTranslations("specialties.eyes.ews.gaze")
  const tg = useTranslations("specialties.eyes.gaze")
  const { locale } = useText()
  return (
    <PCard title={t("title")} description={t("description")} className={className}>
      <div role="radiogroup" aria-label={t("title")} className="flex gap-0.5 rounded-lg bg-muted p-[3px]">
        {(["both", "OD", "OS"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={view.eye === k}
            onClick={() => set({ eye: k })}
            className="h-7 flex-1 rounded-md px-2 text-xs font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-xs"
          >
            {t(`eyes.${k}`)}
          </button>
        ))}
      </div>
      <div dir="ltr" className="flex flex-col items-center gap-2">
        <div role="radiogroup" aria-label={t("pad")} className="grid grid-cols-3 gap-1.5 rounded-[14px] bg-muted p-2.5">
          {GAZES.map((g, i) => {
            const ri = Math.floor(i / 3)
            const ci = i % 3
            const on = view.gaze === g
            const deg = (Math.atan2(1 - ri, ci - 1) * 180) / Math.PI
            return (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={tg(`pos.${g}`)}
                title={tg(`pos.${g}`)}
                onClick={() => set({ gaze: g })}
                className={cn(
                  "flex size-14 items-center justify-center rounded-[10px] border outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {g === "primary" ? (
                  <Icon name="record-circle" size={20} mirror={false} />
                ) : (
                  <Icon name="arrow-right" size={20} mirror={false} style={{ transform: `rotate(${-deg}deg)` }} />
                )}
              </button>
            )
          })}
        </div>
        <div className="flex w-full justify-between text-xs text-muted-foreground">
          <span dir="auto">{tg("patientRight")}</span>
          <span dir="auto">{tg("patientLeft")}</span>
        </div>
      </div>
      <label className="flex flex-col gap-2">
        <span className="flex items-center justify-between text-xs font-medium">
          {t("angle")}
          <span className="tabular-nums" dir="ltr">
            {view.angle}°
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={45}
          step={5}
          value={view.angle}
          onChange={(e) => set({ angle: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-card"
          style={{ background: `linear-gradient(to ${locale === "ar" ? "left" : "right"}, var(--primary) ${(view.angle / 45) * 100}%, var(--muted) 0)` }}
        />
      </label>
      <div className="flex flex-col gap-2.5">
        {(
          [
            ["together", "together"],
            ["muscles", "showMuscles"],
            ["lines", "showLines"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="flex items-center gap-2.5 text-sm">
            <span className="flex-1">{t(label)}</span>
            <Switch checked={view[key]} onCheckedChange={(v) => set({ [key]: v })} disabled={readOnly} />
          </label>
        ))}
      </div>
    </PCard>
  )
}

/* ================================================================== muscles */

/** Widget / Eye Muscles: OD / OS tabs, six muscles with −/+ steppers, note about the other eye. Rows select a muscle (Anatomy). */
export function MuscleEditor({
  exam,
  patch,
  view,
  set,
  readOnly,
  selectable,
  className,
}: {
  exam: EyeExam
  patch: (p: Partial<EyeExam>) => void
  view: EyeView
  set: (p: Partial<EyeView>) => void
  readOnly?: boolean
  selectable?: boolean
  className?: string
}) {
  const t = useTranslations("specialties.eyes.ews.muscles")
  const { b, locale } = useText()
  const eye = view.muscleEye
  const other: Eye = eye === "OD" ? "OS" : "OD"
  const step = (m: MuscleKey, d: number) => {
    const g = Math.max(-4, Math.min(4, exam.grades[eye][m] + d))
    patch({ grades: { ...exam.grades, [eye]: { ...exam.grades[eye], [m]: g } } })
  }
  const notes = MUSCLES.filter((m) => exam.grades[other][m.key] !== 0).map((m) =>
    t("note", {
      eye: t(`noteEye.${other}`),
      muscle: b(m.name).toLocaleLowerCase(locale),
      grade: formatGrade(exam.grades[other][m.key]),
      why: t(`why.${exam.grades[other][m.key] > 0 ? "over" : "under"}`),
    }),
  )
  return (
    <PCard title={t("title")} description={<bdi>{t("description")}</bdi>} className={className}>
      <div role="tablist" aria-label={t("title")} className="flex gap-0.5 rounded-lg bg-muted p-[3px]">
        {(["OD", "OS"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={eye === k}
            onClick={() => set({ muscleEye: k })}
            className="h-7 flex-1 rounded-md text-xs font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-xs"
          >
            {t(`eyeTabs.${k}`)}
          </button>
        ))}
      </div>
      <ul>
        {MUSCLES.map((m) => {
          const g = exam.grades[eye][m.key]
          const sel = selectable && view.muscle === m.key
          return (
            <li
              key={m.key}
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] border-b border-transparent px-2 py-2.5",
                g < 0 ? "bg-warning-soft" : g > 0 ? "bg-info-soft/60" : "border-b-border",
                sel && "ring-2 ring-primary ring-inset",
              )}
            >
              <button
                type="button"
                disabled={!selectable}
                onClick={() => set({ muscle: m.key })}
                aria-pressed={selectable ? sel : undefined}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
              >
                <span dir="ltr" className={cn("flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-xs font-medium", g !== 0 ? "bg-card" : "bg-muted")}>
                  {m.key}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{b(m.name)}</span>
                  <span className="truncate text-xs text-muted-foreground">{b(m.action)}</span>
                </span>
              </button>
              <span className="flex shrink-0 items-center gap-1" dir="ltr">
                {!readOnly && (
                  <Button variant="outline" size="icon-sm" onClick={() => step(m.key, -1)} disabled={g <= -4} aria-label={`${t("down")} · ${m.key}`}>
                    <Icon name="minus" size={16} />
                  </Button>
                )}
                <GradeChip grade={g} />
                {!readOnly && (
                  <Button variant="outline" size="icon-sm" onClick={() => step(m.key, 1)} disabled={g >= 4} aria-label={`${t("up")} · ${m.key}`}>
                    <Icon name="add" size={16} />
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {notes.length > 0 && (
        <p className="flex items-start gap-2 rounded-[10px] bg-info-soft p-3 text-xs text-info-soft-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          <span>{notes.join(" ")}</span>
        </p>
      )}
    </PCard>
  )
}

/* ================================================================== findings */

/** Widget / Eye Findings: diagnosis, cover test, deviation near / far, double vision, head posture, nystagmus, notes. */
export function FindingsForm({ exam, patch, readOnly, className }: { exam: EyeExam; patch: (p: Partial<EyeExam>) => void; readOnly?: boolean; className?: string }) {
  const t = useTranslations("specialties.eyes.ews.findings")
  const tx = useEyeText()
  const { b, locale } = useText()
  const sel = <T extends string>(label: string, value: T, options: { value: T; label: React.ReactNode }[], onChange: (v: T) => void, required?: boolean) => (
    <Field label={label} required={required}>
      {(control) => (
        <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={readOnly}>
          <SelectTrigger {...control} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
  const num = (label: string, v: number, onChange: (n: number) => void) => (
    <Field label={label} className="flex-1">
      <Input type="number" inputMode="numeric" min={0} max={60} value={v} readOnly={readOnly} dir="ltr" onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    </Field>
  )
  return (
    <PCard title={t("title")} description={t("description")} className={className}>
      {sel(
        t("diagnosis"),
        exam.icd10,
        EYE_ICD.map((x) => ({
          value: x.code,
          label: (
            <>
              <bdi dir="ltr">{x.code}</bdi> · {b(x.name)}
            </>
          ),
        })),
        (v) => patch({ icd10: v }),
        true,
      )}
      {sel(
        t("cover"),
        exam.coverTest,
        (["esotropia", "exotropia", "ortho"] as const).map((v) => ({ value: v, label: tx.coverOpt(v) })),
        (v) => patch({ coverTest: v }),
      )}
      <div className="flex gap-3">
        {num(t("near"), exam.deviation.near, (n) => patch({ deviation: { ...exam.deviation, near: n } }))}
        {num(t("far"), exam.deviation.far, (n) => patch({ deviation: { ...exam.deviation, far: n } }))}
      </div>
      {sel(
        t("diplopia"),
        exam.diplopia,
        (["none", "right", "left", "vertical", "most"] as const).map((v) => ({ value: v, label: tx.diplopia(v) })),
        (v) => patch({ diplopia: v }),
      )}
      <div className="flex gap-3 *:min-w-0 *:flex-1">
        {sel(
          t("posture"),
          exam.headPosture.kind,
          (["none", "turnRight", "turnLeft", "tiltRight", "tiltLeft"] as const).map((v) => ({ value: v, label: tx.postureOpt(v) })),
          (v) => patch({ headPosture: { ...exam.headPosture, kind: v } }),
        )}
        {sel(
          t("nystagmus"),
          exam.nystagmus,
          (["none", "horizontal", "vertical"] as const).map((v) => ({ value: v, label: tx.nystagmus(v) })),
          (v) => patch({ nystagmus: v }),
        )}
      </div>
      <Field label={t("notes")}>
        <Textarea
          rows={4}
          value={exam.notes[locale === "ar" ? "ar" : "en"]}
          readOnly={readOnly}
          onChange={(e) => patch({ notes: { ...exam.notes, [locale === "ar" ? "ar" : "en"]: e.target.value } })}
        />
      </Field>
    </PCard>
  )
}

/* ================================================================== anatomy info */

/** Muscle info card (Anatomy): what the selected muscle does, its nerve, this patient's grade, what they notice. */
export function MuscleInfo({ id, exam, view, className }: { id: string; exam: EyeExam; view: EyeView; className?: string }) {
  const t = useTranslations("specialties.eyes.ews")
  const { b } = useText()
  const m = MUSCLES.find((x) => x.key === view.muscle)
  if (!m)
    return (
      <PCard title={t("muscles.title")} className={className}>
        <p className="text-sm text-muted-foreground">{t("info.pick")}</p>
      </PCard>
    )
  const info = MUSCLE_INFO[m.key]
  const g = exam.grades[view.muscleEye][m.key]
  // Horizontal muscles: double vision is worst looking towards the weak muscle's pull (LR out, MR in).
  const right = view.muscleEye === "OD"
  const side = m.key === "LR" ? (right ? "right" : "left") : m.key === "MR" ? (right ? "left" : "right") : null
  const rows: [string, string, string?][] = [
    [t("info.moves"), b(info.moves)],
    [t("info.nerve"), b(info.nerve)],
    [
      t("info.patient"),
      g < 0 ? t("info.grade.under", { grade: formatGrade(g) }) : g > 0 ? t("info.grade.over", { grade: formatGrade(g) }) : t("info.grade.normal"),
      g < 0 ? "text-warning-soft-foreground" : g > 0 ? "text-info-soft-foreground" : undefined,
    ],
    [t("info.notices"), g < 0 ? (side ? t("info.noticesSide", { side: t(`info.side.${side}`) }) : b(info.notices)) : t("info.nothing")],
  ]
  const eyeName = t(`eyeName.${view.muscleEye}`)
  return (
    <PCard
      title={
        <>
          {b(m.name)} · <bdi dir="ltr">{m.key}</bdi>
        </>
      }
      description={t("info.selected", { eye: eyeName.charAt(0).toUpperCase() + eyeName.slice(1) })}
      className={className}
    >
      <dl>
        {rows.map(([k, v, tone]) => (
          <div key={k} className="flex items-start gap-3 border-b py-2.5 last:border-0">
            <dt className="w-[100px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
            <dd className={cn("min-w-0 flex-1 text-sm font-medium", tone ?? "text-foreground")}>
              <bdi>{v}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <Button variant="outline" asChild className="w-full">
        <Link href={specialtyHref.eyePatientView(id)}>
          <Icon name="presention-chart" size={20} />
          {t("info.show")}
        </Link>
      </Button>
    </PCard>
  )
}

/* ================================================================== bar actions + finish */

/** Eye workspace bar: Patient view (icon on tablet) + Finish exam ("Finish" on tablet) → Finish dialog → toast. */
export function EyeActions({ id }: { id: string }) {
  const t = useTranslations("specialties.eyes.ews")
  const mobile = useIsMobile()
  const dates = useDates()
  const { exam, signedAt } = useTodayExam(id)
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="outline" size="icon" asChild className="xl:hidden">
        <Link href={specialtyHref.eyePatientView(id)} aria-label={t("patientView")}>
          <Icon name="presention-chart" size={20} />
        </Link>
      </Button>
      <Button variant="outline" asChild className="max-xl:hidden">
        <Link href={specialtyHref.eyePatientView(id)}>
          <Icon name="presention-chart" size={20} />
          {t("patientView")}
        </Link>
      </Button>
      {!mobile && exam && (
        <Button onClick={() => setOpen(true)} disabled={!!signedAt} title={signedAt ? t("dlg.signed", { date: dates.short(signedAt) }) : undefined}>
          <Icon name="tick-circle" size={20} />
          <span className="xl:hidden">{signedAt ? t("dlg.signed", { date: "" }).trim() : t("finishShort")}</span>
          <span className="max-xl:hidden">{signedAt ? t("dlg.signed", { date: dates.short(signedAt) }) : t("finish")}</span>
        </Button>
      )}
      {exam && <FinishDialog id={id} exam={exam} open={open} onOpenChange={setOpen} />}
    </>
  )
}

/** Overlay · Finish exam → swaps to the "Exam saved and signed" toast. */
function FinishDialog({ id, exam, open, onOpenChange }: { id: string; exam: EyeExam; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("specialties.eyes.ews.dlg")
  const { b } = useText()
  const data = usePatient()
  const graded = (["OD", "OS"] as const).reduce((n, e) => n + MUSCLES.filter((m) => Number.isFinite(exam.grades[e][m.key])).length, 0)
  const rows: [string, React.ReactNode][] = [
    [
      t("diagnosis"),
      <>
        <bdi dir="ltr">{exam.icd10}</bdi> · {b(icdName(exam.icd10))}
      </>,
    ],
    [t("graded"), t("gradedValue", { n: graded })],
    [t("next"), t("nextValue")],
  ]
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="tick-circle"
      tone="primary"
      width="sm:max-w-110"
      title={t("title")}
      description={t("text", { name: data ? b(data.patient.name).split(" ")[0] : "" })}
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("keep")}
        </Button>
      }
      primary={
        <Button
          onClick={() => {
            signExam(id)
            onOpenChange(false)
            notify.success(t("savedTitle"), { description: t("savedText") })
          }}
        >
          <Icon name="tick-circle" size={20} />
          {t("confirm")}
        </Button>
      }
    >
      <dl>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start gap-3 border-b py-2.5 last:border-0">
            <dt className="w-[110px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
            <dd className="min-w-0 flex-1 text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </ResponsiveDialog>
  )
}
