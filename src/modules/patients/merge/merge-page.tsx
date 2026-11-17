"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { notify } from "@/components/ds/toast"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import type { Bi } from "@/lib/mock/bi"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { EmptyState } from "@/components/ds/states"
import { StatusBadge } from "@/components/ds/status-badge"
import { MobileActionBar, PageContainer } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { TODAY, type Patient, type Tag } from "../data"
import { applyForm } from "../edit/apply"
import { ageFrom, initialForm, optionLabel, toLocal, type EditForm } from "../edit/form"
import { patientRecord } from "../profile/record"
import { useText } from "../profile/use-patient"
import { usePatientsStore } from "../store"

/**
 * Patients · Merge patients (1440 / 768 / 390) + Merge confirmation + "Files merged" toast (Undo).
 * ?a = main file (kept), ?b = file closed into it. For each field the user picks which value stays;
 * matching values are shown as "Same"; visits, invoices and files from both files are always kept.
 *  · xl  compare (fill) · After merge + note (280)        · md  After merge on top, compare below
 *  · <md top bar (close · "Merge files"), compact rows, After merge, fixed "Merge files" bar
 */

type RowKey = "name" | "mobile" | "nationalId" | "birth" | "address" | "insurance" | "guardian"
const PICK_ROWS: RowKey[] = ["name", "mobile", "nationalId", "birth", "address", "insurance", "guardian"]

/** Fields carried over from the closed file when its value is chosen. */
const ROW_FIELDS: Record<RowKey, (keyof EditForm)[]> = {
  name: ["nameEn", "nameAr"],
  mobile: ["mobile", "whatsapp", "sameWhatsapp"],
  nationalId: ["idType", "idNumber"],
  birth: ["birthDate"],
  address: ["city", "district", "street", "postal"],
  insurance: ["insurer", "insuranceClass", "policy", "expiry", "selfPay"],
  guardian: ["guardianName", "guardianRelation", "guardianMobile", "guardianId"],
}

/** The design's closed sample file (MRN 004520) — values that differ from the generated record. */
function sampleOverrides(locale: string): Partial<EditForm> {
  const L = (v: Bi) => (locale === "ar" ? v.ar : v.en)
  return {
    birthDate: "2011-03-12",
    idNumber: "1102 334 551",
    city: "riyadh",
    district: L({ en: "Al Malqa", ar: "الملقا" }),
    street: L({ en: "Bldg 4", ar: "مبنى 4" }),
    insurer: "tawuniya",
    insuranceClass: "",
    policy: "TW-1180 2240",
    expiry: "2025-06-30",
    selfPay: false,
    guardianName: "",
    guardianRelation: "",
    guardianMobile: "",
    guardianId: "",
  }
}
const SAMPLE_COUNTS: Record<string, { invoices: number; files: number }> = { "004520": { invoices: 5, files: 3 } }

type Facts = { patient: Patient; form: EditForm; invoices: number; files: number }

function useFacts(p: Patient | undefined): Facts | null {
  const { savedForm } = usePatientsStore()
  const { locale } = useText()
  return React.useMemo(() => {
    if (!p) return null
    const saved = savedForm(p.id)
    const base = patientRecord(p)
    const record = saved ? applyForm(base, saved) : base
    const form = saved ?? { ...initialForm(p, record, locale), ...(p.id === "004520" ? sampleOverrides(locale) : {}) }
    const counts = SAMPLE_COUNTS[p.id] ?? { invoices: record.invoices.filter((i) => i.status !== "void").length, files: record.files.length }
    return { patient: p, form, ...counts }
  }, [p, savedForm, locale])
}

const groupId = (v: string) => {
  const d = v.replace(/\s/g, "")
  return /^\d{10}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : v
}

export function MergePatients({ a: aId, b: bId }: { a?: string; b?: string }) {
  const t = useTranslations("patients.merge")
  const { get } = usePatientsStore()
  const a = get(aId ?? "")
  const b = get(bId ?? "") ?? (a?.duplicateOf ? get(a.duplicateOf) : undefined)
  const keep = useFacts(a)
  const drop = useFacts(b)

  if (!keep || !drop || keep.patient.id === drop.patient.id) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="people"
            title={keep && drop ? t("sameFile") : t("missing.title")}
            description={t("missing.text")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href="/patients?chip=duplicate">{t("missing.action")}</Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }
  return <MergeView key={`${keep.patient.id}-${drop.patient.id}`} keep={keep} drop={drop} />
}

function MergeView({ keep, drop }: { keep: Facts; drop: Facts }) {
  const t = useTranslations("patients.merge")
  const { b, n } = useText()
  const dates = useDates()
  const router = useRouter()
  const { merge } = usePatientsStore()
  const [confirm, setConfirm] = React.useState(false)
  const minor = keep.patient.age < 18 || drop.patient.age < 18

  /** Display value of a row for one file (null = empty). */
  const show = (f: Facts, k: RowKey): string | null => {
    const x = f.form
    switch (k) {
      case "name":
        return b({ en: x.nameEn, ar: x.nameAr }) || null
      case "mobile":
        return toLocal(x.mobile)
      case "nationalId":
        return x.idNumber ? groupId(x.idNumber) : null
      case "birth":
        return x.birthDate ? dates.short(x.birthDate) : null
      case "address": {
        if (!x.street.trim()) return null
        const city = optionLabel("city", x.city)
        return [city && b(city), x.district, x.street].filter(Boolean).join(" · ")
      }
      case "insurance": {
        if (x.selfPay) return t("selfPay")
        const ins = optionLabel("insurer", x.insurer)
        if (!ins) return null
        const name = b({ en: ins.en.replace(" Arabia", ""), ar: ins.ar.replace(" العربية", "") })
        if (x.expiry && x.expiry < TODAY) return t("expired", { insurer: name, year: x.expiry.slice(0, 4) })
        const cls = optionLabel("insuranceClass", x.insuranceClass)
        return [name, cls && b(cls)].filter(Boolean).join(" · ")
      }
      case "guardian":
        return x.guardianName.trim() || null
    }
  }
  /** Comparison key (both languages for names, so "Al-Dosari" vs "Aldosari" counts as different). */
  const key = (f: Facts, k: RowKey) => (k === "name" ? `${f.form.nameEn}|${f.form.nameAr}` : (show(f, k) ?? ""))
  const rows = PICK_ROWS.filter((k) => k !== "guardian" || minor)
  const same = (k: RowKey) => key(keep, k) === key(drop, k)

  const [picks, setPicks] = React.useState<Record<RowKey, "keep" | "drop">>(() =>
    Object.fromEntries(PICK_ROWS.map((k) => [k, !show(keep, k) && show(drop, k) ? "drop" : "keep"])) as Record<RowKey, "keep" | "drop">
  )

  // Kept file after the merge.
  const merged: EditForm = { ...keep.form }
  for (const k of rows) if (!same(k) && picks[k] === "drop") for (const f of ROW_FIELDS[k]) Object.assign(merged, { [f]: drop.form[f] })
  const missing = [!merged.idNumber.trim(), !merged.street.trim(), !toLocal(merged.mobile)].filter(Boolean).length
  const completeness = Math.round(((10 - missing) / 10) * 100)
  const after = {
    visits: keep.patient.visits + drop.patient.visits,
    invoices: keep.invoices + drop.invoices,
    files: keep.files + drop.files,
  }

  const doMerge = () => {
    const tags: Tag[] = keep.patient.tags.filter((x) => x !== "duplicate" && (x !== "incomplete" || missing > 0))
    const fields: Partial<Patient> = {
      name: { en: merged.nameEn, ar: merged.nameAr },
      mobile: toLocal(merged.mobile),
      age: ageFrom(merged.birthDate) ?? keep.patient.age,
      visits: after.visits,
      tags,
      duplicateOf: undefined,
    }
    const undo = merge(keep.patient.id, drop.patient.id, fields, merged)
    setConfirm(false)
    const vars = { drop: drop.patient.mrn, keep: keep.patient.mrn }
    notify.success(t("toast.title"), {
      description: t("toast.text", vars),
      action: {
        label: t("toast.undo"),
        onClick: () => {
          undo()
          notify.info(t("toast.undone"), { description: t("toast.undoneText", vars) })
        },
      },
    })
    router.push(`/patients/${keep.patient.id}`)
  }

  return (
    <>
      {/* Mobile top bar */}
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" aria-label={t("cancel")} asChild>
          <Link href={`/patients/${keep.patient.id}`}>
            <Icon name="close-circle" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
      </div>

      <PageContainer className="gap-4 md:gap-6">
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href="/patients?chip=duplicate" aria-label={t("back")}>
                  <Icon name="arrow-left" size={20} />
                </Link>
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            </div>
            <Crumbs />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/patients/${keep.patient.id}`}>
                <Icon name="close-circle" size={20} />
                {t("cancel")}
              </Link>
            </Button>
            <Button onClick={() => setConfirm(true)}>
              <Icon name="people" size={20} />
              {t("merge")}
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section
            aria-labelledby="merge-title"
            className="@container/cmp order-2 flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 md:order-2 md:p-6 xl:order-1"
          >
            <header className="flex flex-col gap-1">
              <h2 id="merge-title" className="text-lg font-semibold">
                {t("choose")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("chooseText")}</p>
            </header>

            {/* File heads */}
            <div className="grid grid-cols-2 gap-3 @min-[40rem]/cmp:grid-cols-[150px_1fr_1fr]">
              <span className="hidden @min-[40rem]/cmp:block" />
              {[
                { f: keep, tone: "success" as const, label: t("mainFile") },
                { f: drop, tone: "warning" as const, label: t("closed") },
              ].map(({ f, tone, label }) => (
                <div key={f.patient.id} className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted p-3">
                  <div className="flex flex-col gap-1.5 @min-[40rem]/cmp:flex-row @min-[40rem]/cmp:items-center">
                    <bdi dir="ltr" className="flex-1 text-sm font-medium tabular-nums rtl:text-right">
                      MRN {f.patient.mrn}
                    </bdi>
                    <StatusBadge tone={tone}>{label}</StatusBadge>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("meta", { name: b(f.patient.name), age: t("years", { n: f.patient.age }) })}
                  </span>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="flex flex-col gap-4 @min-[40rem]/cmp:gap-2.5">
              {rows.map((k) => {
                const isSame = same(k)
                const label = t(`rows.${k}`)
                return (
                  <div
                    key={k}
                    role={isSame ? undefined : "radiogroup"}
                    aria-label={isSame ? undefined : label}
                    className="grid gap-1.5 @min-[40rem]/cmp:grid-cols-[150px_1fr_1fr] @min-[40rem]/cmp:items-center @min-[40rem]/cmp:gap-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="flex-1 text-xs font-medium @min-[40rem]/cmp:text-muted-foreground">{label}</span>
                      {isSame && (
                        <StatusBadge tone="success" className="@min-[40rem]/cmp:hidden">
                          {t("same")}
                        </StatusBadge>
                      )}
                    </div>
                    {isSame ? (
                      <>
                        <Static value={show(keep, k)} selected />
                        <div className="hidden @min-[40rem]/cmp:block">
                          <Static value={show(drop, k)} />
                        </div>
                      </>
                    ) : (
                      <>
                        <Choice value={show(keep, k)} on={picks[k] === "keep"} onPick={() => setPicks((p) => ({ ...p, [k]: "keep" }))} />
                        <Choice value={show(drop, k)} on={picks[k] === "drop"} onPick={() => setPicks((p) => ({ ...p, [k]: "drop" }))} />
                      </>
                    )}
                  </div>
                )
              })}
              {/* Always both */}
              {(
                [
                  ["visits", n(keep.patient.visits), n(drop.patient.visits)],
                  ["invoicesFiles", `${n(keep.invoices)} · ${n(keep.files)}`, `${n(drop.invoices)} · ${n(drop.files)}`],
                ] as const
              ).map(([k, va, vb]) => (
                <div key={k} className="grid gap-1.5 @min-[40rem]/cmp:grid-cols-[150px_1fr_1fr] @min-[40rem]/cmp:items-center @min-[40rem]/cmp:gap-3">
                  <span className="text-xs font-medium @min-[40rem]/cmp:text-muted-foreground">{t(`rows.${k}`)}</span>
                  <Static value={va} selected both />
                  <Static value={vb} selected both />
                </div>
              ))}
            </div>
          </section>

          <aside className="order-3 flex flex-col gap-4 md:order-1 xl:sticky xl:top-22 xl:order-2">
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="after-title">
              <div className="flex flex-col gap-0.5">
                <h2 id="after-title" className="text-lg font-semibold">
                  {t("after.title")}
                </h2>
                <bdi dir="ltr" className="text-xs text-muted-foreground tabular-nums rtl:text-right">
                  MRN {keep.patient.mrn}
                </bdi>
              </div>
              <dl className="flex flex-col gap-3 text-xs">
                {(
                  [
                    ["visits", n(after.visits)],
                    ["invoices", n(after.invoices)],
                    ["files", n(after.files)],
                    ["completeness", `${completeness}%`],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <dt className="flex-1 text-muted-foreground">{t(`after.${k}`)}</dt>
                    <dd className={cn("text-sm font-medium tabular-nums", k === "completeness" && (completeness === 100 ? "text-success" : "text-warning-soft-foreground"))}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="flex flex-col gap-1.5 rounded-xl bg-info-soft p-4 text-info-soft-foreground">
              <p className="text-sm font-medium">{t("note.title")}</p>
              <p className="text-xs">{t("note.text", { drop: drop.patient.mrn, keep: keep.patient.mrn })}</p>
            </div>
          </aside>
        </div>
      </PageContainer>

      <MobileActionBar>
        <Button size="lg" onClick={() => setConfirm(true)}>
          <Icon name="people" size={20} />
          {t("merge")}
        </Button>
      </MobileActionBar>

      <ResponsiveDialog
        open={confirm}
        onOpenChange={setConfirm}
        icon="people"
        tone="warning"
        title={t("confirm.title")}
        description={t("confirm.text", { drop: drop.patient.mrn, keep: keep.patient.mrn })}
        secondary={
          <Button variant="outline" onClick={() => setConfirm(false)}>
            {t("cancel")}
          </Button>
        }
        primary={
          <Button onClick={doMerge}>
            <Icon name="tick-circle" size={20} />
            {t("confirm.action")}
          </Button>
        }
      >
        <dl className="overflow-hidden rounded-lg bg-muted">
          {(
            [
              [t("confirm.visits"), n(drop.patient.visits)],
              [t("confirm.invoices"), n(drop.invoices)],
              [t("confirm.files"), n(drop.files)],
              [t("confirm.kept"), <bdi key="k" dir="ltr">{`MRN ${keep.patient.mrn}`}</bdi>],
            ] as [string, React.ReactNode][]
          ).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 border-b px-3 py-2.5 text-xs last:border-0">
              <dt className="flex-1 text-muted-foreground">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-center gap-2.5 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          {t("confirm.undoNote")}
        </p>
      </ResponsiveDialog>
    </>
  )
}

function Crumbs() {
  const t = useTranslations("patients")
  return (
    <nav aria-label={t("page.breadcrumb")}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        <li>
          <Link href="/patients" className="text-primary hover:underline">
            {t("title")}
          </Link>
        </li>
        <li aria-hidden className="text-muted-foreground">
          /
        </li>
        <li>
          <Link href="/patients?chip=duplicate" className="text-primary hover:underline">
            {t("merge.crumbDup")}
          </Link>
        </li>
        <li aria-hidden className="text-muted-foreground">
          /
        </li>
        <li aria-current="page" className="font-medium text-foreground">
          {t("merge.crumb")}
        </li>
      </ol>
    </nav>
  )
}

const optionBase = "flex min-h-10 w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-start text-sm"

/** Radio card for a value (design: radio dot, accent fill + primary border when chosen). */
function Choice({ value, on, onPick }: { value: string | null; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={cn(
        optionBase,
        "cursor-pointer outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
        on ? "border-primary bg-accent" : "bg-card hover:bg-muted"
      )}
    >
      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary" : "border-input")} aria-hidden>
        {on && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <Value v={value} />
    </button>
  )
}

/** Non-choice value: matching ("Same") or always kept ("both"). */
function Static({ value, selected, both }: { value: string | null; selected?: boolean; both?: boolean }) {
  return (
    <div className={cn(optionBase, selected ? "border-primary bg-accent" : "bg-card")}>
      <Icon name="tick-circle" size={16} className={cn("shrink-0", both ? "text-success" : "text-muted-foreground")} />
      <Value v={value} />
    </div>
  )
}

function Value({ v }: { v: string | null }) {
  if (!v) return <span className="text-muted-foreground">—</span>
  const latin = !/[؀-ۿ]/.test(v) && /\d/.test(v)
  return latin ? (
    <bdi dir="ltr" className="min-w-0 flex-1 tabular-nums rtl:text-right">
      {v}
    </bdi>
  ) : (
    <span className="min-w-0 flex-1 tabular-nums">{v}</span>
  )
}
