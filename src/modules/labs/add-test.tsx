"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-media-query"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ANALYZERS, TUBES, type RefBand, type ResultType, type SampleType, type Section, type Sex, type TestDef, type TubeKey } from "./data"
import { ltrRun } from "./parts"
import { addCatalogTest, useCatalog } from "./store"
import { useLabText } from "./text"

/* ------------------------------------------------------------------ form model */

export type RangeGroup = "all" | "adults" | "children" | "infants"
export type RangeSex = "both" | Sex
export type RangeRow = { id: number; group: RangeGroup; sex: RangeSex; low: string; high: string }

export type AddTestForm = {
  nameEn: string
  nameAr: string
  code: string
  /** The user typed the code (stop following the section's next free code). */
  codeEdited: boolean
  section: Section
  type: "single" | "panel"
  tube: TubeKey | null
  volume: string
  analyzer: string
  sampleType: SampleType
  fasting: boolean
  tatRoutine: string
  tatStat: string
  price: string
  sbs: string
  unit: string
  resultType: ResultType
  decimals: string
  ranges: RangeRow[]
  critLow: string
  critHigh: string
  delta: string
  active: boolean
}

const SECTIONS: Section[] = ["chemistry", "hematology", "hormones", "microbiology", "urine"]
/** Codes are numbered per section: 1xxx hematology, 2xxx chemistry, 3xxx hormones, 4xxx microbiology, 5xxx urine. */
const SECTION_PREFIX: Record<Section, number> = { hematology: 1, chemistry: 2, hormones: 3, microbiology: 4, urine: 5 }
/** The designed tube chips: five on desktop / tablet, the first four on mobile (they wrap). */
const TUBE_ORDER: TubeKey[] = ["gold", "lav", "blue", "green", "red"]
const MOBILE_TUBES = 4
const SAMPLE_TYPES: SampleType[] = ["serum", "plasma", "wholeBlood", "urine"]
const RESULT_TYPES: ResultType[] = ["number", "text", "posneg"]
const DECIMALS = ["0", "1", "2", "3"]
/** Turnaround choices, hours. */
const TAT_HOURS = ["0.5", "1", "2", "3", "4", "6", "8", "12", "24", "48", "72", "120"]
const GROUPS: RangeGroup[] = ["all", "adults", "children", "infants"]
const SEXES: RangeSex[] = ["both", "male", "female"]
/** Age bands in months: adults 18 y+, children 1–17 y, infants under 1 y. */
const GROUP_MONTHS: Record<RangeGroup, [number, number]> = { all: [0, Infinity], adults: [216, Infinity], children: [12, 215], infants: [0, 11] }

/** The next free code in a section ("2091" after Ammonia 2090). */
export function nextCode(section: Section, catalog: TestDef[]) {
  const base = SECTION_PREFIX[section] * 1000
  const used = catalog.map((t) => Number(t.code)).filter((n) => n > base && n < base + 1000)
  return String(used.length ? Math.max(...used) + 1 : base + 1)
}

let rowId = 1
export const newRange = (r: Partial<RangeRow> = {}): RangeRow => ({ id: rowId++, group: "adults", sex: "both", low: "", high: "", ...r })

export function blankForm(catalog: TestDef[]): AddTestForm {
  return {
    nameEn: "",
    nameAr: "",
    code: nextCode("chemistry", catalog),
    codeEdited: false,
    section: "chemistry",
    type: "single",
    tube: null,
    volume: "",
    analyzer: ANALYZERS[0],
    sampleType: "serum",
    fasting: false,
    tatRoutine: "4",
    tatStat: "1",
    price: "",
    sbs: "",
    unit: "",
    resultType: "number",
    decimals: "1",
    ranges: [newRange()],
    critLow: "",
    critHigh: "",
    delta: "",
    active: true,
  }
}

/** The design's sample (Magnesium 2091) — preview stories. */
export function sampleForm(catalog: TestDef[]): AddTestForm {
  return {
    ...blankForm(catalog),
    nameEn: "Magnesium",
    nameAr: "المغنيسيوم",
    tube: "gold",
    volume: "0.5",
    price: "75",
    sbs: "66503-00-10",
    unit: "mg/dL",
    ranges: [newRange({ group: "adults", low: "1.7", high: "2.4" }), newRange({ group: "children", low: "1.7", high: "2.3" })],
    critLow: "1.0",
    critHigh: "4.7",
    delta: "25",
  }
}

/* ------------------------------------------------------------------ validation */

const num = (v: string) => (v.trim() === "" ? null : Number(v.trim().replace(",", ".")))
const isNum = (v: string) => v.trim() !== "" && Number.isFinite(num(v))

export type Errors = Partial<Record<keyof AddTestForm | "rangesList", string>> & { range?: Record<number, { low?: string; high?: string; row?: string }> }

/** Step 1: names, code (unique), section, tube, volume, turnaround, price ≥ 0. */
export function validateDetails(f: AddTestForm, catalog: TestDef[], t: (k: string, v?: Record<string, string | number>) => string): Errors {
  const e: Errors = {}
  const req = (k: keyof AddTestForm, v: string) => {
    if (!v.trim()) e[k] = t("required")
  }
  req("nameEn", f.nameEn)
  req("nameAr", f.nameAr)
  req("code", f.code)
  if (f.code.trim() && catalog.some((x) => x.code === f.code.trim())) e.code = t("codeUsed", { code: f.code.trim() })
  if (!f.tube) e.tube = t("required")
  if (!f.volume.trim()) e.volume = t("required")
  else if (!isNum(f.volume)) e.volume = t("number")
  else if (num(f.volume)! < 0) e.volume = t("negative")
  if (!f.price.trim()) e.price = t("required")
  else if (!isNum(f.price)) e.price = t("number")
  else if (num(f.price)! < 0) e.price = t("negative")
  return e
}

/** Step 2: unit, ≥ 1 range, low < high, no age overlap for the same sex ("both" overlaps everything), critical limits outside every range. */
export function validateResults(f: AddTestForm, t: (k: string, v?: Record<string, string | number>) => string): Errors {
  const e: Errors = {}
  const range: NonNullable<Errors["range"]> = {}
  if (!f.unit.trim()) e.unit = t("required")
  if (f.ranges.length === 0) e.rangesList = t("noRange")
  for (const r of f.ranges) {
    const re: { low?: string; high?: string; row?: string } = {}
    if (!r.low.trim()) re.low = t("required")
    else if (!isNum(r.low)) re.low = t("number")
    if (!r.high.trim()) re.high = t("required")
    else if (!isNum(r.high)) re.high = t("number")
    if (!re.low && !re.high && num(r.low)! >= num(r.high)!) re.row = t("lowHigh")
    if (Object.keys(re).length) range[r.id] = re
  }
  // Age overlap for the same sex (Both counts as Male and Female).
  for (let i = 0; i < f.ranges.length; i++)
    for (let j = i + 1; j < f.ranges.length; j++) {
      const a = f.ranges[i]
      const b = f.ranges[j]
      const sameSex = a.sex === "both" || b.sex === "both" || a.sex === b.sex
      const [a0, a1] = GROUP_MONTHS[a.group]
      const [b0, b1] = GROUP_MONTHS[b.group]
      if (sameSex && a0 <= b1 && b0 <= a1) for (const r of [a, b]) range[r.id] = { ...range[r.id], row: range[r.id]?.row ?? t("overlap") }
    }
  if (Object.keys(range).length) e.range = range
  const lows = f.ranges.filter((r) => isNum(r.low)).map((r) => num(r.low)!)
  const highs = f.ranges.filter((r) => isNum(r.high)).map((r) => num(r.high)!)
  if (f.critLow.trim()) {
    if (!isNum(f.critLow)) e.critLow = t("number")
    else if (lows.length && num(f.critLow)! >= Math.min(...lows)) e.critLow = t("critLow", { low: Math.min(...lows) })
  }
  if (f.critHigh.trim()) {
    if (!isNum(f.critHigh)) e.critHigh = t("number")
    else if (highs.length && num(f.critHigh)! <= Math.max(...highs)) e.critHigh = t("critHigh", { high: Math.max(...highs) })
  }
  if (f.delta.trim()) {
    if (!isNum(f.delta)) e.delta = t("number")
    else if (num(f.delta)! < 0) e.delta = t("negative")
  }
  return e
}

const hasErrors = (e: Errors) => Object.keys(e).length > 0

/** The catalog test the form describes (one analyte: the test's own result, with its ranges and critical limits). */
export function toTest(f: AddTestForm): TestDef {
  const code = f.code.trim()
  const name = { en: f.nameEn.trim(), ar: f.nameAr.trim() }
  const ref: RefBand[] = f.ranges.map((r) => {
    const [min, max] = GROUP_MONTHS[r.group]
    return {
      sex: r.sex === "both" ? undefined : r.sex,
      minMonths: min === 0 ? undefined : min,
      maxMonths: max === Infinity ? undefined : max,
      low: num(r.low) ?? undefined,
      high: num(r.high) ?? undefined,
    }
  })
  return {
    key: `t${code}`,
    code,
    name,
    section: f.section,
    tube: f.tube!,
    tatH: Number(f.tatRoutine),
    tatStatH: Number(f.tatStat),
    price: num(f.price) ?? 0,
    active: f.active,
    volumeMl: num(f.volume) ?? undefined,
    type: f.type,
    analyzer: f.analyzer,
    sampleType: f.sampleType,
    fasting: f.fasting,
    sbsCode: f.sbs.trim() || undefined,
    resultType: f.resultType,
    custom: true,
    analytes: [
      {
        key: `a${code}`,
        name,
        unit: f.unit.trim(),
        dp: Number(f.decimals),
        ref,
        critLow: num(f.critLow) ?? undefined,
        critHigh: num(f.critHigh) ?? undefined,
        deltaPct: num(f.delta) ?? undefined,
      },
    ],
  }
}

/* ------------------------------------------------------------------ dialog */

/**
 * Overlay · Add test (Test catalog → Add test; desktop dialog 760, mobile sheet). Two steps in one modal, the form kept
 * between them: 1 · Details (basics, sample, turnaround and price) → Next validates step 1; 2 · Results and limits
 * (unit, result type, decimals, reference ranges, critical below / above, delta %, "Doctors can order it now") → Add
 * test validates everything, adds the test to the catalog and swaps to the "test-added" toast.
 */
export function AddTestDialog({
  open,
  onOpenChange,
  initial,
  initialStep = 1,
  showErrors = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preview stories: start from this form / step, with the errors shown. */
  initial?: AddTestForm
  initialStep?: 1 | 2
  showErrors?: boolean
}) {
  const t = useTranslations("labs.addTest")
  const te = useTranslations("labs.addTest.err")
  const catalog = useCatalog()
  const { ar } = useLabText()
  const [f, setF] = React.useState<AddTestForm>(() => initial ?? blankForm(catalog))
  const [step, setStep] = React.useState<1 | 2>(initialStep)
  const [tried, setTried] = React.useState<{ 1: boolean; 2: boolean }>({ 1: showErrors, 2: showErrors && initialStep === 2 })
  const errT = (k: string, v?: Record<string, string | number>) => te(k as "required", v as never)
  const e1 = validateDetails(f, catalog, errT)
  const e2 = validateResults(f, errT)
  const errs: Errors = step === 1 ? (tried[1] ? e1 : {}) : tried[2] ? e2 : {}

  const set = <K extends keyof AddTestForm>(k: K, v: AddTestForm[K]) => setF((s) => ({ ...s, [k]: v }))
  const setSection = (section: Section) => setF((s) => ({ ...s, section, code: s.codeEdited ? s.code : nextCode(section, catalog) }))

  const next = () => {
    setTried((x) => ({ ...x, 1: true }))
    if (hasErrors(e1)) return focusFirstError()
    setStep(2)
  }
  const add = () => {
    setTried({ 1: true, 2: true })
    if (hasErrors(e1)) {
      setStep(1)
      return
    }
    if (hasErrors(e2)) return focusFirstError()
    const test = toTest(f)
    addCatalogTest(test)
    onOpenChange(false)
    toast.success(t("toast", { name: ar ? test.name.ar : test.name.en }), { description: <bdi>{t(test.active ? "toastOn" : "toastOff", { code: ltrRun(test.code) })}</bdi> })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={step === 1 ? t("step1Text") : t("step2Text")}
      icon="add"
      width="sm:max-w-190"
      secondary={
        step === 1 ? (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setStep(1)}>
            {t("back")}
          </Button>
        )
      }
      primary={step === 1 ? <Button onClick={next}>{t("next")}</Button> : <Button onClick={add}>{t("add")}</Button>}
    >
      <Stepper step={step} />
      {step === 1 ? <DetailsStep f={f} set={set} setSection={setSection} errs={errs} /> : <ResultsStep f={f} set={set} errs={errs} />}
    </ResponsiveDialog>
  )
}

/** Moves focus to the first invalid control after a refused Next / Add test. */
function focusFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>("[role=dialog] [aria-invalid=true]")
    el?.focus()
  })
}

/* ------------------------------------------------------------------ parts */

function Stepper({ step }: { step: 1 | 2 }) {
  const t = useTranslations("labs.addTest.steps")
  const done1 = step === 2
  const dot = (n: 1 | 2, done: boolean, now: boolean) => (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        done || now ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}
      aria-hidden
    >
      {done ? <Icon name="tick-circle" size={20} /> : n}
    </span>
  )
  return (
    <ol aria-label={t("label")} className="flex min-w-0 items-center gap-2 sm:gap-3">
      <li className="flex items-center gap-2" aria-current={step === 1 ? "step" : undefined}>
        {dot(1, done1, step === 1)}
        <span className="text-xs whitespace-nowrap text-foreground sm:text-sm">{done1 ? <>{t("details")}<span className="sr-only"> ✓</span></> : t("details")}</span>
      </li>
      <li aria-hidden className={cn("h-0.5 min-w-6 flex-1 rounded-full", done1 ? "bg-primary" : "bg-border")} />
      <li className="flex items-center gap-2" aria-current={step === 2 ? "step" : undefined}>
        {dot(2, false, step === 2)}
        <span className={cn("text-xs whitespace-nowrap sm:text-sm", step === 2 ? "text-foreground" : "text-muted-foreground")}>{t("results")}</span>
      </li>
    </ol>
  )
}

function Group({ icon, title, children, last }: { icon: IconName; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={cn("flex flex-col gap-4", !last && "border-b pb-5")}>
      <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon name={icon} size={20} className="text-primary" />
        {title}
      </h3>
      {children}
    </section>
  )
}

const latin = "tabular-nums rtl:text-right"

function Pick<V extends string>({
  value,
  onChange,
  options,
  p,
}: {
  value: V
  onChange: (v: V) => void
  options: { value: V; label: React.ReactNode }[]
  p: React.ComponentProps<"button">
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as V)}>
      <SelectTrigger {...p} className="w-full">
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
  )
}

function useTat() {
  const t = useTranslations("labs.addTest")
  const tc = useTranslations("labs.catalog")
  return (h: string) => (h === "0.5" ? t("tatHalf") : Number(h) >= 24 ? tc("tatD", { n: Number(h) / 24 }) : tc("tatH", { n: Number(h) }))
}

function DetailsStep({
  f,
  set,
  setSection,
  errs,
}: {
  f: AddTestForm
  set: <K extends keyof AddTestForm>(k: K, v: AddTestForm[K]) => void
  setSection: (s: Section) => void
  errs: Errors
}) {
  const t = useTranslations("labs.addTest")
  const ts = useTranslations("labs.section")
  const { b, ar } = useLabText()
  const tat = useTat()
  const mobile = useIsMobile()
  return (
    <>
      <Group icon="document-text" title={t("basics")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("nameEn")} required error={errs.nameEn}>
            {(p) => <Input {...p} dir="ltr" value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} className="rtl:text-right" />}
          </Field>
          <Field label={t("nameAr")} required error={errs.nameAr}>
            {(p) => <Input {...p} dir="rtl" lang="ar" value={f.nameAr} onChange={(e) => set("nameAr", e.target.value)} />}
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("code")} required error={errs.code} helper={!errs.code ? t("codeHelp", { section: ts(f.section) }) : undefined}>
            {(p) => (
              <Input
                {...p}
                dir="ltr"
                inputMode="numeric"
                value={f.code}
                onChange={(e) => {
                  set("code", e.target.value.replace(/[^\dA-Za-z-]/g, ""))
                  set("codeEdited", true)
                }}
                className={latin}
              />
            )}
          </Field>
          <Field label={t("section")} required>
            {(p) => <Pick p={p} value={f.section} onChange={setSection} options={SECTIONS.map((s) => ({ value: s, label: ts(s) }))} />}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span id="add-test-type" className="flex items-center gap-2 text-xs font-medium text-foreground">
              {t("type")}
            </span>
            <Segmented
              aria-labelledby="add-test-type"
              value={f.type}
              onValueChange={(v) => set("type", v)}
              options={[
                { value: "single", label: t("typeOpt.single") },
                { value: "panel", label: t("typeOpt.panel") },
              ]}
            />
          </div>
        </div>
      </Group>

      <Group icon="drop" title={t("sample")}>
        <div className="flex flex-col gap-1.5">
          <span id="add-test-tube" className="flex items-center gap-2 text-xs font-medium text-foreground">
            {t("tube")}
            <span aria-hidden className="text-destructive">
              *
            </span>
          </span>
          <div role="radiogroup" aria-labelledby="add-test-tube" aria-invalid={!!errs.tube || undefined} className="flex flex-wrap gap-2">
            {TUBE_ORDER.slice(0, mobile ? MOBILE_TUBES : TUBE_ORDER.length).map((k) => {
              const on = f.tube === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-invalid={(!!errs.tube && k === TUBE_ORDER[0]) || undefined}
                  onClick={() => set("tube", k)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    on ? "border-primary bg-accent text-foreground" : errs.tube ? "border-destructive bg-card" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <span aria-hidden className="size-3.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: TUBES[k].hex }} />
                  {b(TUBES[k].full)}
                </button>
              )
            })}
          </div>
          {errs.tube && <p className="text-xs text-destructive">{errs.tube}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("volume")} required error={errs.volume}>
            {(p) => (
              <Input
                {...p}
                dir="ltr"
                inputMode="decimal"
                value={f.volume}
                onChange={(e) => set("volume", e.target.value.replace(/[^\d.,]/g, ""))}
                end={<span className="pe-3 text-sm text-muted-foreground">{t("ml")}</span>}
                className={latin}
              />
            )}
          </Field>
          <Field label={t("analyzer")}>
            {(p) => (
              <Pick
                p={p}
                value={f.analyzer}
                onChange={(v) => set("analyzer", v)}
                options={ANALYZERS.map((a) => ({ value: a, label: a === "manual" ? t("analyzerOpt.manual") : <bdi dir="ltr">{a}</bdi> }))}
              />
            )}
          </Field>
          <Field label={t("sampleType")}>
            {(p) => <Pick p={p} value={f.sampleType} onChange={(v) => set("sampleType", v)} options={SAMPLE_TYPES.map((s) => ({ value: s, label: t(`sampleOpt.${s}`) }))} />}
          </Field>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox checked={f.fasting} onCheckedChange={(v) => set("fasting", v === true)} />
          {t("fasting")}
        </label>
      </Group>

      <Group icon="timer-1" title={t("tatPrice")} last>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("tatRoutine")} required>
            {(p) => <Pick p={p} value={f.tatRoutine} onChange={(v) => set("tatRoutine", v)} options={TAT_HOURS.map((h) => ({ value: h, label: tat(h) }))} />}
          </Field>
          <Field label={t("tatStat")} required>
            {(p) => <Pick p={p} value={f.tatStat} onChange={(v) => set("tatStat", v)} options={TAT_HOURS.map((h) => ({ value: h, label: tat(h) }))} />}
          </Field>
          <Field label={t("price")} required error={errs.price}>
            {(p) =>
              ar ? (
                <Input
                  {...p}
                  dir="rtl"
                  inputMode="decimal"
                  value={f.price}
                  onChange={(e) => set("price", e.target.value.replace(/[^\d.,]/g, ""))}
                  end={<span className="pe-3 text-sm text-muted-foreground">{t("sar")}</span>}
                  className="tabular-nums"
                />
              ) : (
                <Input
                  {...p}
                  dir="ltr"
                  inputMode="decimal"
                  value={f.price}
                  onChange={(e) => set("price", e.target.value.replace(/[^\d.,]/g, ""))}
                  startIcon={<span className="text-sm text-muted-foreground">{t("sar")}</span>}
                  className="tabular-nums"
                />
              )
            }
          </Field>
          <Field label={t("sbs")}>{(p) => <Input {...p} dir="ltr" value={f.sbs} onChange={(e) => set("sbs", e.target.value)} className={latin} />}</Field>
        </div>
      </Group>
    </>
  )
}

function ResultsStep({ f, set, errs }: { f: AddTestForm; set: <K extends keyof AddTestForm>(k: K, v: AddTestForm[K]) => void; errs: Errors }) {
  const t = useTranslations("labs.addTest")
  const setRange = (id: number, patch: Partial<RangeRow>) => set("ranges", f.ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const sexOpts = SEXES.map((s) => ({ value: s, label: t(`sex.${s}`) }))
  const groupOpts = GROUPS.map((g) => ({ value: g, label: t(`group.${g}`) }))
  const numInput = (r: RangeRow, k: "low" | "high") => (
    <Input
      dir="ltr"
      inputMode="decimal"
      value={r[k]}
      onChange={(e) => setRange(r.id, { [k]: e.target.value.replace(/[^\d.,-]/g, "") })}
      aria-label={t(`col.${k}`)}
      aria-invalid={!!(errs.range?.[r.id]?.[k] || errs.range?.[r.id]?.row) || undefined}
      className={latin}
    />
  )
  const unitHelp = f.unit.trim() ? <bdi dir="ltr">{f.unit.trim()}</bdi> : undefined

  return (
    <Group icon="ruler" title={t("results")} last>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("unit")} required error={errs.unit}>
          {(p) => <Input {...p} dir="ltr" value={f.unit} onChange={(e) => set("unit", e.target.value)} className={latin} />}
        </Field>
        <Field label={t("resultType")}>
          {(p) => <Pick p={p} value={f.resultType} onChange={(v) => set("resultType", v)} options={RESULT_TYPES.map((r) => ({ value: r, label: t(`resultOpt.${r}`) }))} />}
        </Field>
        <Field label={t("decimals")}>{(p) => <Pick p={p} value={f.decimals} onChange={(v) => set("decimals", v)} options={DECIMALS.map((d) => ({ value: d, label: d }))} />}</Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id="add-test-ranges" className="flex items-center gap-2 text-xs font-medium text-foreground">
          {t("ranges")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </span>
        <div role="group" aria-labelledby="add-test-ranges" className={cn("overflow-hidden rounded-lg border", errs.rangesList && "border-destructive")}>
          <div className="hidden h-10 items-center gap-2 bg-muted px-3 text-xs font-medium text-muted-foreground sm:flex">
            <span className="flex-1 text-start">{t("col.group")}</span>
            <span className="w-26 text-start">{t("col.sex")}</span>
            <span className="w-18 text-start">{t("col.low")}</span>
            <span className="w-18 text-start">{t("col.high")}</span>
            <span className="w-8" />
          </div>
          <ul className="flex flex-col">
            {f.ranges.map((r) => {
              const re = errs.range?.[r.id]
              const msg = re?.row ?? re?.low ?? re?.high
              return (
                <li key={r.id} className="flex flex-col gap-1.5 border-b px-3 py-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="sm:flex-1">
                      <Pick p={{ "aria-label": t("col.group") }} value={r.group} onChange={(v) => setRange(r.id, { group: v })} options={groupOpts} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-26 shrink-0">
                        <Pick p={{ "aria-label": t("col.sex") }} value={r.sex} onChange={(v) => setRange(r.id, { sex: v })} options={sexOpts} />
                      </div>
                      <div className="w-18 shrink-0 max-sm:flex-1">{numInput(r, "low")}</div>
                      <span aria-hidden className="text-muted-foreground sm:hidden">
                        –
                      </span>
                      <div className="w-18 shrink-0 max-sm:flex-1">{numInput(r, "high")}</div>
                      <Button variant="ghost" size="icon-sm" onClick={() => set("ranges", f.ranges.filter((x) => x.id !== r.id))} aria-label={t("removeRange")}>
                        <Icon name="trash" size={22} />
                      </Button>
                    </div>
                  </div>
                  {msg && <p className="text-xs text-destructive">{msg}</p>}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => set("ranges", [...f.ranges, newRange({ group: "children" })])}
            className="flex w-full items-center gap-2 px-3 py-3 text-start text-xs font-medium text-primary outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Icon name="add" size={16} />
            {t("addRange")}
          </button>
        </div>
        {errs.rangesList && <p className="text-xs text-destructive">{errs.rangesList}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("critLow")} error={errs.critLow} helper={unitHelp}>
          {(p) => <Input {...p} dir="ltr" inputMode="decimal" value={f.critLow} onChange={(e) => set("critLow", e.target.value.replace(/[^\d.,-]/g, ""))} className={latin} />}
        </Field>
        <Field label={t("critHigh")} error={errs.critHigh} helper={unitHelp}>
          {(p) => <Input {...p} dir="ltr" inputMode="decimal" value={f.critHigh} onChange={(e) => set("critHigh", e.target.value.replace(/[^\d.,-]/g, ""))} className={latin} />}
        </Field>
        <Field label={t("delta")} error={errs.delta} helper={t("deltaHelp")}>
          {(p) => <Input {...p} dir="ltr" inputMode="decimal" value={f.delta} onChange={(e) => set("delta", e.target.value.replace(/[^\d.,]/g, ""))} className={latin} />}
        </Field>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs font-medium text-info-soft-foreground">
        <Icon name="info-circle" size={18} className="shrink-0" />
        {t("critInfo")}
      </p>

      <ActiveSwitch label={t("active")} hint={t("activeHelp")} checked={f.active} onCheckedChange={(v) => set("active", v)} />
    </Group>
  )
}

function ActiveSwitch({ label, hint, checked, onCheckedChange }: { label: string; hint: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
