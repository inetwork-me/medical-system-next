"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { DENTITION_ROWS, isUpper, toothType, type DentalChart, type Dentition, type Surface, type SurfaceState, type ToothRecord, type ToothType } from "./data"

/**
 * Dental / Tooth (Widgets · Specialties widgets): number row (+ plan dot), 28×40 glyph (roots up for the upper arch,
 * down for the lower) and the 5-surface ring. Upper: number · glyph · surfaces; lower: surfaces · glyph · number.
 * Anatomical — never mirrored in Arabic (callers render it inside dir="ltr").
 */

const GLYPH: Record<ToothType, string> = {
  incisor: "M8 18 L12.5 2 Q14 0 15.5 2 L20 18 L22 18 C23 26 23.5 33 21 38 Q14 41 7 38 C4.5 33 5 26 6 18 Z",
  canine: "M9 16 L13 1 Q14 0 15 1 L19 16 L22 18 C23 26 22 33 14 40 C6 33 5 26 6 18 Z",
  premolar: "M8 18 L10 3 Q11 1.5 12 3 L14 12 L16 3 Q17 1.5 18 3 L20 18 L23 19 C24 27 24 34 22 38 Q18 40.5 14 38.5 Q10 40.5 6 38 C4 34 4 27 5 19 Z",
  molar:
    "M5 19 L4 6 Q4.5 2 7 4 L10 13 L13 4 Q14 2 15 4 L18 13 L21 4 Q23.5 2 24 6 L23 19 L25 20 C26.5 28 26.5 35 24 38.5 Q21 40.5 18.5 38.5 Q14 41 9.5 38.5 Q7 40.5 4 38.5 C1.5 35 1.5 28 3 20 Z",
}
const CROWN = "M5 19 L23 19 C24 27 24 34 21.5 38.5 Q14 41 6.5 38.5 C4 34 4 27 5 19 Z"

/** Mirror a path vertically inside the 40-unit glyph box (lower teeth: roots point down). */
function flip(path: string, h = 40) {
  let i = 0
  return path.replace(/[A-Za-z]|-?\d*\.?\d+/g, (tk) => {
    if (/[A-Za-z]/.test(tk)) {
      i = 0
      return tk
    }
    const v = i++ % 2 === 1 ? h - parseFloat(tk) : parseFloat(tk)
    return String(Math.round(v * 100) / 100)
  })
}

/** Ring sector between two angles (degrees, 0 = right, clockwise) around (13, 13). */
function sector(a0: number, a1: number, R = 12.5, r = 5, n = 10) {
  const pt = (rad: number, a: number) => {
    const t = (a * Math.PI) / 180
    return `${(13 + rad * Math.cos(t)).toFixed(2)} ${(13 + rad * Math.sin(t)).toFixed(2)}`
  }
  const outer = Array.from({ length: n + 1 }, (_, k) => pt(R, a0 + ((a1 - a0) * k) / n))
  const inner = Array.from({ length: n + 1 }, (_, k) => pt(r, a1 - ((a1 - a0) * k) / n))
  return `M${[...outer, ...inner].join(" L")} Z`
}
export type Side = "top" | "right" | "bottom" | "left"
export const SECTORS: Record<Side, string> = {
  top: sector(227, 313),
  right: sector(-43, 43),
  bottom: sector(47, 133),
  left: sector(137, 223),
}

export const SURFACE_FILL: Record<SurfaceState, string> = {
  decay: "var(--destructive)",
  existing: "var(--primary)",
  done: "var(--success)",
}

/**
 * Where each FDI surface sits on the 2D ring: mesial always points to the midline (right for Q1/Q4 on the viewer's left half),
 * buccal faces out of the mouth (top for the upper arch), occlusal is the centre.
 */
export function surfaceSide(fdi: number): Record<Exclude<Surface, "O">, Side> {
  const q = Math.floor(fdi / 10) % 4 || 4 // 1…4 (baby teeth 5…8 map onto 1…4)
  const rightHalf = q === 1 || q === 4
  const up = isUpper(fdi)
  return { M: rightHalf ? "right" : "left", D: rightHalf ? "left" : "right", B: up ? "top" : "bottom", L: up ? "bottom" : "top" }
}

/** Surface ring (26×26 units); `selected` surfaces get the primary outline (Tooth Panel picker). */
export function SurfaceRing({
  fdi,
  surfaces,
  selected,
  className,
}: {
  fdi: number
  surfaces?: ToothRecord["surfaces"]
  selected?: Surface[]
  className?: string
}) {
  const sides = surfaceSide(fdi)
  const bySide: Partial<Record<Side, Surface>> = {}
  for (const s of ["M", "D", "B", "L"] as const) bySide[sides[s]] = s
  const fill = (s: Surface) => (surfaces?.[s] ? SURFACE_FILL[surfaces[s]!] : "var(--card)")
  const stroke = (s: Surface) => (selected?.includes(s) ? { stroke: "var(--primary)", strokeWidth: 1.5 } : { stroke: "var(--muted-foreground)", strokeWidth: 0.75 })
  return (
    <svg viewBox="0 0 26 26" aria-hidden className={cn("size-[26px] shrink-0 overflow-visible", className)}>
      {(Object.keys(SECTORS) as Side[]).map((side) => (
        <path key={side} d={SECTORS[side]} fill={fill(bySide[side]!)} {...stroke(bySide[side]!)} />
      ))}
      <circle cx={13} cy={13} r={5} fill={fill("O")} {...stroke("O")} />
    </svg>
  )
}

function Glyph({ fdi, record }: { fdi: number; record?: ToothRecord }) {
  const up = isUpper(fdi)
  const path = up ? GLYPH[toothType(fdi)] : flip(GLYPH[toothType(fdi)])
  const missing = record?.state === "missing"
  const unerupted = record?.state === "unerupted"
  const marks = record?.marks ?? []
  return (
    <svg viewBox="0 0 28 40" width={28} height={40} aria-hidden className="shrink-0 overflow-visible">
      <path
        d={path}
        fill="var(--card)"
        stroke="var(--muted-foreground)"
        strokeWidth={1}
        strokeDasharray={unerupted ? "2 2" : undefined}
        opacity={missing ? 0.35 : unerupted ? 0.3 : 1}
      />
      {marks.includes("crown") && <path d={up ? CROWN : flip(CROWN)} fill="none" stroke="var(--warning)" strokeWidth={2} />}
      {marks.includes("rootCanal") && <path d={up ? "M14 3 L14 19" : "M14 21 L14 37"} fill="none" stroke="var(--warning)" strokeWidth={2} />}
      {missing && <path d="M3 4 L25 36 M25 4 L3 36" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />}
    </svg>
  )
}

/** One tooth cell. `as="button"` makes it selectable (chart workspace); in the tab it's display only. */
export function Tooth({
  fdi,
  record,
  selected,
  width = 44,
  onSelect,
  label,
}: {
  fdi: number
  record?: ToothRecord
  selected?: boolean
  width?: number
  onSelect?: (fdi: number) => void
  label?: string
}) {
  const up = isUpper(fdi)
  const faded = record?.state === "missing" ? 0.35 : record?.state === "unerupted" ? 0.3 : 1
  const number = (
    <span className="flex h-4 items-center gap-[3px]">
      <span className={cn("text-xs font-medium tabular-nums", selected ? "text-primary" : "text-muted-foreground")}>{fdi}</span>
      {record?.planned && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
    </span>
  )
  const ring = (
    <span style={{ opacity: faded }}>
      <SurfaceRing fdi={fdi} surfaces={record?.surfaces} />
    </span>
  )
  const body = (
    <>
      {up ? number : ring}
      <Glyph fdi={fdi} record={record} />
      {up ? ring : number}
    </>
  )
  const cls = cn(
    "flex shrink-0 flex-col items-center gap-1 rounded-lg border-[1.5px] border-transparent px-0.5 py-1.5",
    selected && "border-primary bg-accent",
  )
  if (onSelect)
    return (
      <button
        type="button"
        style={{ width }}
        aria-label={label}
        aria-pressed={selected}
        onClick={() => onSelect(fdi)}
        className={cn(cls, "outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50", selected && "hover:bg-accent")}
      >
        {body}
      </button>
    )
  return (
    <div style={{ width }} className={cls} role="img" aria-label={label}>
      {body}
    </div>
  )
}

/** Accessible tooth label, e.g. "Tooth 36 · decay O, D · planned". */
export function useToothLabel() {
  const t = useTranslations("specialties.dental")
  return (fdi: number, r?: ToothRecord) => {
    const parts = [t("toothN", { n: fdi })]
    if (r?.state) parts.push(t(`state.${r.state}`))
    const s = r?.surfaces ?? {}
    for (const st of ["decay", "existing", "done"] as const) {
      const list = (Object.keys(s) as Surface[]).filter((k) => s[k] === st)
      if (list.length) parts.push(`${t(`legend.${st}`)} ${list.join(", ")}`)
    }
    if (r?.planned) parts.push(t("legend.planned"))
    return parts.join(" · ")
  }
}

/** Chart layers (workspace toolbar): what each one keeps of a tooth record. */
export type Layer = "all" | "existing" | "planned" | "done"
export function layerOf(r: ToothRecord | undefined, layer: Layer): ToothRecord | undefined {
  if (!r || layer === "all") return r
  const keep: Record<Exclude<Layer, "all">, SurfaceState[]> = { existing: ["existing"], planned: ["decay"], done: ["done"] }
  const surfaces = Object.fromEntries(Object.entries(r.surfaces ?? {}).filter(([, v]) => keep[layer].includes(v!)))
  return {
    state: r.state,
    surfaces,
    ...(layer === "planned" && r.planned ? { planned: true as const } : {}),
    ...(layer === "planned" && r.marks ? { marks: r.marks } : {}),
  }
}

/**
 * Widget / Dental Chart. Sizes: Full (50px cells), Mini (44, tab on desktop), Tablet (40), Compact (38; four rows of 8, tab on tablet / mobile).
 * Always laid out as you face the patient: patient's right on the viewer's left, in both languages.
 */
export function DentalChartView({
  chart,
  size,
  selected = chart.selected,
  onSelect,
  dentition = "permanent",
  layer = "all",
  className,
}: {
  chart: DentalChart
  size: "full" | "mini" | "tablet" | "compact"
  selected?: number | null
  onSelect?: (fdi: number) => void
  dentition?: Dentition
  layer?: Layer
  className?: string
}) {
  const ROWS = DENTITION_ROWS[dentition]
  const t = useTranslations("specialties.dental")
  const label = useToothLabel()
  const cell = { full: 50, mini: 44, tablet: 40, compact: 38 }[size]
  const gap = { full: 4, mini: 2, tablet: 1, compact: 2 }[size]
  const tooth = (fdi: number) => (
    <Tooth
      key={fdi}
      fdi={fdi}
      record={layerOf(chart.teeth[fdi], layer)}
      selected={fdi === selected}
      width={cell}
      onSelect={onSelect}
      label={label(fdi, chart.teeth[fdi])}
    />
  )
  return (
    <div dir="ltr" className={cn("flex w-full flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{t("patientRight")}</span>
        {size !== "compact" && <span>{t("upperLower")}</span>}
        <span className="font-medium">{t("patientLeft")}</span>
      </div>
      {size === "compact" ? (
        (["upper", "lower"] as const).map((arch) => (
          <div key={arch} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground" dir="auto">
              {t(arch === "upper" ? "upperJaw" : "lowerJaw")}
            </span>
            {ROWS[arch].map((half) => (
              <div key={half[0]} className="flex justify-center rounded-lg bg-muted py-1" style={{ gap }}>
                {half.map(tooth)}
              </div>
            ))}
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center overflow-x-auto [scrollbar-width:thin]">
          {(["upper", "lower"] as const).map((arch) => (
            <React.Fragment key={arch}>
              <div className={cn("flex", arch === "upper" ? "items-end" : "items-start")}>
                <div className="flex" style={{ gap }}>
                  {ROWS[arch][0].map(tooth)}
                </div>
                <span aria-hidden className="mx-px h-24 w-px shrink-0 self-center bg-border" />
                <div className="flex" style={{ gap }}>
                  {ROWS[arch][1].map(tooth)}
                </div>
              </div>
              {arch === "upper" && <span aria-hidden className="my-2 h-px w-full bg-border" />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

/** Chart legend (tab + workspace). Wraps; Latin-free labels only. */
export function DentalLegend({ className }: { className?: string }) {
  const t = useTranslations("specialties.dental.legend")
  const items: [string, keyof typeof SWATCH][] = [
    [t("decay"), "decay"],
    [t("existing"), "existing"],
    [t("planned"), "planned"],
    [t("done"), "done"],
    [t("missing"), "missing"],
  ]
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {items.map(([label, k]) => (
        <li key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className={cn("shrink-0", SWATCH[k])} />
          {label}
        </li>
      ))}
    </ul>
  )
}
const SWATCH = {
  decay: "size-2.5 rounded-[3px] bg-destructive",
  existing: "size-2.5 rounded-[3px] bg-primary",
  planned: "size-2 rounded-full bg-warning",
  done: "size-2.5 rounded-[3px] bg-success",
  missing: "size-2.5 rounded-[3px] bg-muted-foreground",
}
