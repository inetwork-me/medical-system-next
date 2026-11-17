"use client"

import * as React from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { notify } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useText } from "../profile/use-patient"
import { CONDITIONS, PROCEDURES, SURFACES, TOOTH_XRAYS, procedureBy, toothName, type DentalRecord, type Surface, type ToothRecord } from "./data"
import { applyDraft, draftFor, useToothNote, useToothUploads, type ToothDraft } from "./dental-store"
import { useSarFn } from "./dental-tab"
import { SECTORS, surfaceSide, type Side } from "./tooth"

/**
 * Widget / Tooth Panel: badge + name, status tags, surface picker (ring + M O D B L chips), condition chips, treatment
 * (CDT), status (Existing / Planned / Done), coverage note, notes, x-rays, Clear · Update plan.
 * Anatomical: the ring is never mirrored (mesial points to the midline). `readOnly` on phones (view-only).
 */
export function ToothPanel({
  id,
  rec,
  fdi,
  onClose,
  readOnly,
  className,
}: {
  id: string
  rec: DentalRecord
  fdi: number | null
  onClose: () => void
  readOnly?: boolean
  className?: string
}) {
  const t = useTranslations("specialties.tooth")
  if (fdi == null)
    return (
      <section className={cn("rounded-xl border bg-card", className)}>
        <EmptyState icon="health" title={t("noneTitle")} description={t("noneText")} className="py-12" />
      </section>
    )
  // Re-open with a fresh draft whenever the tooth (or its saved record) changes.
  return <PanelBody key={`${fdi}:${JSON.stringify(rec.chart.teeth[fdi] ?? {})}`} {...{ id, rec, fdi, onClose, readOnly, className }} />
}

function PanelBody({ id, rec, fdi, onClose, readOnly, className }: { id: string; rec: DentalRecord; fdi: number; onClose: () => void; readOnly?: boolean; className?: string }) {
  const t = useTranslations("specialties.tooth")
  const td = useTranslations("specialties.dental")
  const { b, locale } = useText()
  const sar = useSarFn()
  const note = useToothNote(id, fdi)
  const uploads = useToothUploads(id, fdi)
  const record = rec.chart.teeth[fdi]
  const [d, setD] = React.useState<ToothDraft>(() => draftFor(rec, fdi, note, locale === "ar" ? "ar" : "en"))
  const set = (patch: Partial<ToothDraft>) => setD((x) => ({ ...x, ...patch }))
  const toggleSurface = (s: Surface) => set({ surfaces: d.surfaces.includes(s) ? d.surfaces.filter((x) => x !== s) : [...d.surfaces, s] })
  const proc = d.treatment ? procedureBy(d.treatment) : undefined
  const xrays = [...(TOOTH_XRAYS[fdi] ?? []), ...uploads.list]
  const fileRef = React.useRef<HTMLInputElement>(null)
  const label = toothName(fdi)

  const update = () => {
    if (d.status !== "existing" && !d.treatment) {
      notify.error(t("needTreatment"), { description: t("needTreatmentText") })
      document.getElementById(`treatment-${fdi}`)?.focus()
      return
    }
    applyDraft(id, rec, fdi, d)
    notify.success(t("updated", { n: fdi }), { description: proc ? `${b(proc.name)} · ${t(`status.${d.status}`)}` : t(`status.${d.status}`) })
  }

  return (
    <section aria-label={t("panelLabel", { n: fdi })} className={cn("flex flex-col gap-[18px] rounded-xl border bg-card p-5", className)}>
      <header className="flex items-center gap-3">
        <span dir="ltr" className="flex size-[52px] shrink-0 items-center justify-center rounded-xl bg-accent text-xl font-semibold text-primary tabular-nums">
          {fdi}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-base font-semibold">{td("toothN", { n: fdi })}</h2>
          <p className="text-xs text-muted-foreground">{b(label)}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("close")}>
          <Icon name="close-circle" size={20} />
        </Button>
      </header>

      <ToothTags record={record} />

      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-medium">{t("surfaces")}</span>
        <div className="flex items-center gap-4">
          <SurfacePicker fdi={fdi} selected={d.surfaces} color={surfaceColor(d)} onToggle={readOnly ? undefined : toggleSurface} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("surfaces")}>
            {SURFACES.map((s) => (
              <Chip key={s} on={d.surfaces.includes(s)} onClick={readOnly ? undefined : () => toggleSurface(s)} className="w-9 justify-center" dir="ltr">
                {s}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-medium" id={`cond-${fdi}`}>
          {t("condition")}
        </span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={`cond-${fdi}`}>
          {CONDITIONS.map((c) => (
            <Chip key={c} on={d.condition === c} role="radio" onClick={readOnly ? undefined : () => set({ condition: d.condition === c ? null : c })}>
              {t(`cond.${c}`)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Field label={t("treatment")} required>
          {(control) => (
            <Select value={d.treatment ?? ""} onValueChange={(v) => set({ treatment: v, status: d.status === "existing" ? "planned" : d.status })} disabled={readOnly}>
              <SelectTrigger {...control} id={`treatment-${fdi}`} className="w-full">
                <SelectValue placeholder={t("treatmentPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {PROCEDURES.map((p) => (
                  <SelectItem key={p.cdt} value={p.cdt}>
                    <bdi dir="ltr">{p.cdt}</bdi> · {b(p.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <span className="text-xs font-medium" id={`status-${fdi}`}>
          {t("statusLabel")}
        </span>
        <div role="radiogroup" aria-labelledby={`status-${fdi}`} className="-mt-1.5 flex gap-0.5 rounded-lg bg-muted p-[3px]">
          {(["existing", "planned", "done"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={d.status === s}
              disabled={readOnly}
              onClick={() => set({ status: s })}
              className="h-7 flex-1 rounded-md text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-xs"
            >
              {t(`status.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {proc && (
        <div className="flex items-start gap-2.5 rounded-[10px] bg-info-soft p-3 text-info-soft-foreground">
          <Icon name="shield-tick" size={18} className="shrink-0" />
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-medium tabular-nums">
              {rec.insurance.insured
                ? t("covers", {
                    payer: b(rec.insurance.payerShort),
                    pct: proc.coveragePct,
                    pays: sar(Math.round((proc.fee * (100 - proc.coveragePct)) / 100)),
                  })
                : t("selfPay", { pays: sar(proc.fee) })}
            </span>
            {rec.insurance.insured && <span>{proc.preApproval ? t("needsApproval") : t("noApproval")}</span>}
          </div>
        </div>
      )}

      <Field label={t("notes")}>
        <Textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} readOnly={readOnly} rows={3} className="min-h-20" />
      </Field>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">{t("xrays", { count: xrays.length })}</span>
          {!readOnly && (
            <>
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <Icon name="document-upload" size={16} />
                {t("upload")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) {
                    uploads.add(e.target.files)
                    notify.success(t("uploaded"), { description: t("uploadedText", { count: e.target.files.length, n: fdi }) })
                  }
                  e.target.value = ""
                }}
              />
            </>
          )}
        </div>
        {xrays.length ? (
          <ul className="grid grid-cols-2 gap-2">
            {xrays.map((x) => (
              <li key={x.src} className="flex min-w-0 flex-col gap-1">
                <a href={x.src} target="_blank" rel="noreferrer" className="relative block h-24 overflow-hidden rounded-lg bg-slate-900 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <Image src={x.src} alt={b(x.label)} fill sizes="160px" className="object-cover" unoptimized={x.src.startsWith("blob:")} />
                </a>
                <span className="truncate text-xs text-muted-foreground">{b(x.label)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("noXrays")}</p>
        )}
      </div>

      {!readOnly && (
        <footer className="flex gap-2 *:flex-1">
          <Button variant="outline" onClick={() => setD({ surfaces: [], condition: null, treatment: null, status: "existing", notes: "" })}>
            {t("clear")}
          </Button>
          <Button onClick={update}>
            <Icon name="tick-circle" size={20} />
            {t("update")}
          </Button>
        </footer>
      )}
    </section>
  )
}

/** Colour the picked surfaces take: decay red, done green, existing blue, other planned work orange. */
function surfaceColor(d: ToothDraft) {
  if (d.condition === "decay" && d.status !== "done") return "var(--destructive)"
  return d.status === "done" ? "var(--success)" : d.status === "existing" ? "var(--primary)" : "var(--warning)"
}

/** Status tags under the header: "Decay · O, D", "Root canal + crown planned", "Missing"… */
function ToothTags({ record }: { record?: ToothRecord }) {
  const t = useTranslations("specialties.tooth")
  const td = useTranslations("specialties.dental")
  const tags: { label: string; tone: string }[] = []
  if (record?.state) tags.push({ label: td(`state.${record.state}`), tone: "bg-muted text-muted-foreground" })
  const s = record?.surfaces ?? {}
  const TONE = { decay: "bg-destructive-soft text-destructive-soft-foreground", existing: "bg-accent text-primary", done: "bg-success-soft text-success-soft-foreground" }
  for (const st of ["decay", "existing", "done"] as const) {
    const list = SURFACES.filter((k) => s[k] === st)
    if (list.length) tags.push({ label: `${td(`legend.${st}`)} · ${list.join(", ")}`, tone: TONE[st] })
  }
  const marks = (record?.marks ?? []).filter((m) => m !== "fracture")
  if (marks.length) tags.push({ label: t("plannedMarks", { what: marks.map((m) => t(`mark.${m}`)).join(" + ") }), tone: "bg-warning-soft text-warning-soft-foreground" })
  else if (record?.planned) tags.push({ label: td("legend.planned"), tone: "bg-warning-soft text-warning-soft-foreground" })
  if (!tags.length) tags.push({ label: t("healthy"), tone: "bg-success-soft text-success-soft-foreground" })
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((x) => (
        <span key={x.label} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", x.tone)}>
          <bdi>{x.label}</bdi>
        </span>
      ))}
    </div>
  )
}

function Chip({
  on,
  onClick,
  className,
  children,
  role,
  dir,
}: {
  on: boolean
  onClick?: () => void
  className?: string
  children: React.ReactNode
  role?: "radio"
  dir?: "ltr"
}) {
  return (
    <button
      type="button"
      role={role}
      aria-pressed={role ? undefined : on}
      aria-checked={role ? on : undefined}
      disabled={!onClick}
      dir={dir}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default",
        on ? "border-primary bg-accent text-primary" : "border-border bg-card text-foreground enabled:hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  )
}

/** 88px surface ring: tap a sector (or the centre) to pick that surface. Never mirrored. */
function SurfacePicker({ fdi, selected, color, onToggle }: { fdi: number; selected: Surface[]; color: string; onToggle?: (s: Surface) => void }) {
  const t = useTranslations("specialties.tooth")
  const sides = surfaceSide(fdi)
  const at: Record<Side, Surface> = { top: "B", right: "M", bottom: "L", left: "D" }
  for (const s of ["M", "D", "B", "L"] as const) at[sides[s]] = s
  const part = (s: Surface, shape: React.ReactNode) => {
    const on = selected.includes(s)
    return (
      <g
        key={s}
        role={onToggle ? "checkbox" : undefined}
        aria-checked={onToggle ? on : undefined}
        aria-label={onToggle ? t(`surface.${s}`) : undefined}
        tabIndex={onToggle ? 0 : undefined}
        onClick={onToggle ? () => onToggle(s) : undefined}
        onKeyDown={onToggle ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(s)) : undefined}
        className={cn(onToggle && "cursor-pointer outline-none [&:focus-visible>*]:stroke-ring")}
        fill={on ? color : "var(--card)"}
        stroke={on ? "var(--primary)" : "var(--muted-foreground)"}
        strokeWidth={on ? 1.2 : 0.5}
      >
        {shape}
      </g>
    )
  }
  return (
    <svg viewBox="-0.5 -0.5 27 27" className="size-[88px] shrink-0">
      {(Object.keys(SECTORS) as Side[]).map((side) => part(at[side], <path d={SECTORS[side]} />))}
      {part("O", <circle cx={13} cy={13} r={5} />)}
    </svg>
  )
}

