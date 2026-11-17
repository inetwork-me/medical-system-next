"use client"


import { asset } from "@/lib/static"
import { usePatientId } from "@/modules/patients/href"
import * as React from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-media-query"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { PCard } from "../profile/side"
import { useText } from "../profile/use-patient"
import { SURFACES, TOOTH_XRAYS, patientShare, toothName, type DentalRecord } from "./data"
import { DentalActions } from "./dental-actions"
import { useDentalRecord, useSelectedTooth } from "./dental-store"
import { useSarFn } from "./dental-tab"
import { DentalLegend } from "./tooth"
import { ToothPanel } from "./tooth-panel"
import { LiveJaw, type ViewerApi } from "./three/live"
import { Workspace } from "./workspace"

/**
 * Patients · Dental · 3D view (1440 / 768 / 390). Desktop: 3D viewport (view presets, tools, tooth callout, Gums / Roots /
 * Plan colours) + lower arch from above and the tooth's x-rays, Tooth Panel on the side. Tablet: viewport + Tooth Panel.
 * Phone (view-only): plain bar, viewport with three presets, tooth summary card, note, legend, bottom nav.
 * The scene is anatomical: the patient's left (tooth 36) sits on the viewer's right in both languages.
 */

type Preset = "front" | "right" | "left" | "upper" | "lower"
const PRESETS: Preset[] = ["front", "right", "left", "upper", "lower"]

export function Dental3dWorkspace() {
  const t = useTranslations("specialties.d3")
  const tc = useTranslations("specialties.chartWs")
  const id = usePatientId()
  const rec = useDentalRecord(id)
  const [selected, setSelected] = useSelectedTooth(id)
  const mobile = useIsMobile()
  const { b } = useText()
  return (
    <Workspace kind="dental" mode="3d" actions={rec && <DentalActions />} mobileTitle={t("mobileTitle")}>
      {!rec ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon="health" title={tc("emptyTitle")} description={tc("emptyText")} className="py-16" />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Viewport3d rec={rec} selected={selected} onSelect={setSelected} compact={mobile} className="h-[420px] md:h-[440px] xl:h-[640px] max-md:rounded-none" />
            <div className="grid grid-cols-3 gap-4 max-xl:hidden">
              <Thumb src={asset("/specialties/dent_occ_lower.png")} label={t("occlusal")} />
              {(selected != null ? (TOOTH_XRAYS[selected] ?? []) : []).map((x) => (
                <Thumb key={x.src} src={x.src} label={b(x.label)} />
              ))}
            </div>
          </div>
          {mobile ? (
            <div className="flex flex-col gap-4 px-4">
              {selected != null && <ToothSummary rec={rec} fdi={selected} />}
              <p className="flex items-start gap-2 rounded-[10px] bg-muted p-3 text-xs text-muted-foreground">
                <Icon name="info-circle" size={18} className="shrink-0" />
                {t("viewOnly")}
              </p>
              <DentalLegend />
            </div>
          ) : (
            <ToothPanel
              id={id}
              rec={rec}
              fdi={selected}
              onClose={() => setSelected(null)}
              className="xl:sticky xl:top-20 xl:max-h-[calc(100svh-6rem)] xl:overflow-y-auto"
            />
          )}
        </div>
      )}
    </Workspace>
  )
}

function Thumb({ src, label }: { src: string; label: string }) {
  return (
    <figure className="flex flex-col gap-2 rounded-[14px] border bg-card p-3">
      <a href={src} target="_blank" rel="noreferrer" className="relative block h-[150px] overflow-hidden rounded-[10px] bg-slate-900 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <Image src={src} alt={label} fill sizes="320px" className="object-cover" />
      </a>
      <figcaption className="text-xs font-medium">{label}</figcaption>
    </figure>
  )
}

/** Phone: the selected tooth as a read-only card (tags + what the patient pays for its planned work). */
function ToothSummary({ rec, fdi }: { rec: DentalRecord; fdi: number }) {
  const t = useTranslations("specialties.d3")
  const td = useTranslations("specialties.dental")
  const { b } = useText()
  const sar = useSarFn()
  const pays = rec.plan.filter((i) => i.teeth.includes(fdi) && i.status === "planned").reduce((s, i) => s + patientShare(i), 0)
  return (
    <PCard title={td("toothN", { n: fdi })} description={b(toothName(fdi))} className="p-4">
      <CalloutTags rec={rec} fdi={fdi} chips />
      <dl className="flex items-start gap-3 py-1">
        <dt className="w-[100px] shrink-0 pt-0.5 text-xs text-muted-foreground">{t("patientPays")}</dt>
        <dd className="text-sm font-medium tabular-nums">{sar(pays)}</dd>
      </dl>
    </PCard>
  )
}

/** "Decay O, D · root canal + crown planned" — the callout line, or chips on the phone card. */
/** Tag wording for a tooth: state, surfaces per state, planned marks (callout + phone card). */
function useTagParts() {
  const td = useTranslations("specialties.dental")
  const tt = useTranslations("specialties.tooth")
  return (rec: DentalRecord, fdi: number) => {
    const r = rec.chart.teeth[fdi]
    const parts: { label: string; tone: string }[] = []
    if (r?.state) parts.push({ label: td(`state.${r.state}`), tone: "bg-muted text-muted-foreground" })
    const s = r?.surfaces ?? {}
    const TONE = { decay: "bg-destructive-soft text-destructive-soft-foreground", existing: "bg-accent text-primary", done: "bg-success-soft text-success-soft-foreground" }
    for (const st of ["decay", "existing", "done"] as const) {
      const list = SURFACES.filter((k) => s[k] === st)
      if (list.length) parts.push({ label: `${td(`legend.${st}`)} · ${list.join(", ")}`, tone: TONE[st] })
    }
    const marks = r?.marks ?? []
    if (marks.length) parts.push({ label: tt("plannedMarks", { what: marks.map((m) => tt(`mark.${m}`)).join(" + ") }), tone: "bg-warning-soft text-warning-soft-foreground" })
    if (!parts.length) parts.push({ label: tt("healthy"), tone: "bg-success-soft text-success-soft-foreground" })
    return parts
  }
}

function CalloutTags({ rec, fdi, chips }: { rec: DentalRecord; fdi: number; chips?: boolean }) {
  const parts = useTagParts()(rec, fdi)
  if (!chips) return <>{parts.map((p) => p.label).join(" · ")}</>
  return (
    <div className="flex flex-wrap gap-1.5">
      {parts.map((p) => (
        <span key={p.label} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", p.tone)}>
          <bdi>{p.label}</bdi>
        </span>
      ))}
    </div>
  )
}

/**
 * 3D viewport (still renders until the live viewer). Front and Lower have their own renders; Right, Left and Upper tilt
 * the front render as a preview. Gums / Roots / Plan colours are kept for the 3D viewer.
 */
function Viewport3d({
  rec,
  selected,
  onSelect,
  compact,
  className,
}: {
  rec: DentalRecord
  selected: number | null
  onSelect: (fdi: number) => void
  compact?: boolean
  className?: string
}) {
  const t = useTranslations("specialties.d3")
  const ts = useTranslations("specialties.eyes.sim.tools")
  const { b, locale } = useText()
  const [preset, setPreset] = React.useState<Preset>("front")
  const [zoom, setZoom] = React.useState(1)
  const [layers, setLayers] = React.useState({ gums: true, roots: false, plan: true })
  // Live 3D on top of the still (loading state + no-WebGL fallback).
  const [ready, setReady] = React.useState(false)
  const [api, setApi] = React.useState<ViewerApi | null>(null)
  const tagParts = useTagParts()
  const dir = locale === "ar" ? "rtl" : "ltr"
  const presets = compact ? PRESETS.slice(0, 3) : PRESETS
  const tilt: Record<Preset, string> = {
    front: "none",
    right: "perspective(1400px) rotateY(16deg)",
    left: "perspective(1400px) rotateY(-16deg)",
    upper: "perspective(1400px) rotateX(-14deg)",
    lower: "none",
  }
  const src = preset === "lower" ? asset("/specialties/dent_occ_lower.png") : null
  // Patient's left (Q2 / Q3) shows on the viewer's right.
  const onRight = selected != null && !([1, 4, 5, 8].includes(Math.floor(selected / 10)))
  const tools: { key: string; icon: IconName; label: string; onClick: (e: React.MouseEvent<HTMLElement>) => void }[] = [
    {
      key: "rotate",
      icon: "rotate-left",
      label: ts("rotate"),
      onClick: () => (api ? api.toggleRotate() : setPreset((p) => PRESETS[(PRESETS.indexOf(p) + 1) % PRESETS.length])),
    },
    { key: "in", icon: "search-zoom-in", label: ts("zoomIn"), onClick: () => (api ? api.zoomIn() : setZoom((z) => Math.min(2, z + 0.25))) },
    { key: "out", icon: "search-zoom-out", label: ts("zoomOut"), onClick: () => (api ? api.zoomOut() : setZoom((z) => Math.max(1, z - 0.25))) },
    {
      key: "reset",
      icon: "refresh",
      label: ts("reset"),
      onClick: () => {
        setZoom(1)
        setPreset("front")
        api?.reset()
      },
    },
    {
      key: "full",
      icon: "maximize-4",
      label: ts("fullscreen"),
      onClick: (e) => (document.fullscreenElement ? document.exitFullscreen() : e.currentTarget.closest<HTMLElement>("[data-viewport]")?.requestFullscreen?.()),
    },
  ]
  return (
    <div data-viewport className={cn("relative overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_50%_40%,#1e293b,#020617)]", className)}>
      <div
        className={cn("absolute inset-0 transition-[transform,opacity] duration-300", ready && "opacity-0")}
        style={{ transform: `${tilt[preset] === "none" ? "" : tilt[preset]} scale(${zoom})` }}
      >
        {src ? (
          <Image src={src} alt={t(`preset.${preset}`)} fill sizes="100vw" className="object-contain" />
        ) : (
          <>
            <Image src={asset("/specialties/dent_m.png")} alt={t("alt")} fill sizes="400px" className="object-cover md:hidden" priority />
            <Image src={asset("/specialties/dent_ws_t.png")} alt={t("alt")} fill sizes="720px" className="object-cover max-md:hidden xl:hidden" priority />
            <Image src={asset("/specialties/dent_ws_d.png")} alt={t("alt")} fill sizes="1032px" className="object-cover max-xl:hidden" priority />
          </>
        )}
      </div>
      <LiveJaw
        chart={rec.chart}
        selected={selected}
        onSelect={onSelect}
        preset={preset}
        layers={layers}
        callout={
          selected != null
            ? {
                title: `${selected} · ${b(toothName(selected))}`,
                text: tagParts(rec, selected)
                  .map((x) => x.label)
                  .join(" · "),
              }
            : null
        }
        onReady={() => setReady(true)}
        apiRef={setApi}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-3 *:pointer-events-auto md:p-4">
        <div role="radiogroup" aria-label={t("presetsLabel")} className="me-auto flex gap-0.5 rounded-[10px] bg-slate-900/80 p-[3px]">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={preset === p}
              onClick={() => setPreset(p)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 aria-checked:bg-[#2B6BFF] aria-checked:text-white"
            >
              {t(`preset.${p}`)}
            </button>
          ))}
        </div>
        {!compact && (
          <div dir="ltr" className="flex items-center gap-0.5 rounded-[10px] bg-slate-900/80 p-[3px]">
            {tools.map((x) => (
              <button
                key={x.key}
                type="button"
                aria-label={x.label}
                title={x.label}
                onClick={x.onClick}
                className="flex size-8 items-center justify-center rounded-lg text-slate-200 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Icon name={x.icon} size={18} mirror={false} />
              </button>
            ))}
          </div>
        )}
      </div>
      {!ready && selected != null && preset === "front" && (
        <div dir="ltr" className={cn("absolute inset-x-3 top-1/2 flex -translate-y-1/2 md:inset-x-6", onRight ? "justify-end" : "justify-start")}>
          <div dir={dir} className="flex max-w-72 flex-col gap-0.5 rounded-[10px] border border-[#2B6BFF] bg-slate-900/90 px-3 py-2 text-xs">
            <span className="font-medium text-[#93C5FD]">
              <bdi dir="ltr">{selected}</bdi> · {b(toothName(selected))}
            </span>
            <span className="text-slate-200">
              <CalloutTags rec={rec} fdi={selected} />
            </span>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 p-3 *:pointer-events-auto md:p-4">
        {(["gums", "roots", "plan"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={layers[k]}
            onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
            className={cn(
              "flex items-center gap-1.5 rounded-full border bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              layers[k] ? "border-[#2B6BFF]" : "border-white/20",
            )}
          >
            <span aria-hidden className={cn("size-2 rounded-full", layers[k] ? "bg-[#2B6BFF]" : "bg-slate-500")} />
            {t(`layer.${k}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
