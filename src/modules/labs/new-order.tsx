"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { Combobox } from "@/components/ds/pickers"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { MobileActionBar, PageContainer } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useDoctors } from "@/modules/doctors/store"
import { allPatients, patientDetails } from "@/modules/patients/data"
import {
  ICD10,
  LAB_NOW,
  READY_PANELS,
  TESTS,
  TUBES,
  testOf,
  type CollectionPlace,
  type LabOrder,
  type LabPatient,
  type Priority,
  type TubeKey,
} from "./data"
import { bandFor, tubesFor } from "./machine"
import { KvRow } from "./order/call-dialog"
import { TubeDot, ltrRun, useSoon } from "./parts"
import { labCan } from "./roles"
import { addOrder, nextOrderNo, nextTicket, useLabOrders, useLabRole } from "./store"
import { LabCard } from "./samples"
import { useLabText } from "./text"

/** The ordering doctor: the signed-in user (design sample: Dr. Khaled Mansour). */
const ORDERING_DOCTOR = "mansour"
/** Insurer share when the patient has a payer (design sample: Bupa covers SAR 340 of 425). */
const PAYER_SHARE = 0.8

type PatientOption = { value: string; label: string; patient: LabPatient; diagnosis?: string }

/** Patients to order for: the lab's own (earlier orders) first, then the core patient files. */
function usePatientOptions(): PatientOption[] {
  const { b } = useLabText()
  const orders = useLabOrders()
  return React.useMemo(() => {
    const seen = new Set<string>()
    const lab: PatientOption[] = []
    for (const o of orders) {
      if (seen.has(o.patient.mrn)) continue
      seen.add(o.patient.mrn)
      lab.push({ value: `lab:${o.patient.mrn}`, label: `${b(o.patient.name)} · ${o.patient.mrn}`, patient: o.patient, diagnosis: o.diagnosisIcd10 })
    }
    const core: PatientOption[] = allPatients()
      .filter((p) => !lab.some((x) => x.patient.patientId === p.id))
      .map((p) => ({
        value: `core:${p.id}`,
        label: `${b(p.name)} · ${p.mrn}`,
        patient: { patientId: p.id, initials: p.initials, name: p.name, mrn: p.mrn, sex: p.gender === "female" ? "female" : "male", ageMonths: p.age * 12 },
      }))
    return [...lab, ...core]
  }, [orders, b])
}

const sar = (v: number) => Math.round(v)

/**
 * Lab · New lab order (Worklist → New order): Patient (selected card with ✕ to change, else a search), Tests (search,
 * ready panels as chips, the picked tests with tube dot, price and remove), Clinical details (Routine / STAT, ICD-10
 * diagnosis — required, fasting, note to the lab), Collection (Lab room / Clinic / Home visit). The Order summary side
 * card adds up tubes to draw, price, insurer share and what the patient pays. Create order puts it on the worklist
 * (and the collection queue for the lab room) with the "order-created" toast. Mobile: summary first, fixed action bar.
 */
export function NewLabOrder() {
  const t = useTranslations("labs.newOrder")
  const tn = useTranslations("shell.nav")
  const { b, age } = useLabText()
  const router = useRouter()
  const role = useLabRole()
  const soon = useSoon()
  const doctors = useDoctors()
  const patients = usePatientOptions()

  const [patientKey, setPatientKey] = React.useState<string>("")
  const [tests, setTests] = React.useState<string[]>([])
  const [priority, setPriority] = React.useState<Priority>("routine")
  const [diagnosis, setDiagnosis] = React.useState<string>("")
  const [fasting, setFasting] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [place, setPlace] = React.useState<CollectionPlace>("room")
  const [tried, setTried] = React.useState(false)

  const picked = patients.find((p) => p.value === patientKey)
  const payer = React.useMemo(() => {
    if (!picked) return undefined
    if (picked.patient.payer) return picked.patient.payer
    const pid = picked.patient.patientId
    if (!pid) return undefined
    const core = allPatients().find((p) => p.id === pid)
    const ins = core ? patientDetails(core).insurance : null
    return ins ? { en: ins.en.split(" · ")[0], ar: ins.ar.split(" · ")[0] } : undefined
  }, [picked])

  const pickPatient = (v: string) => {
    setPatientKey(v)
    const p = patients.find((x) => x.value === v)
    if (p?.diagnosis && !diagnosis) setDiagnosis(p.diagnosis)
  }
  const addTest = (k: string) => setTests((s) => (s.includes(k) ? s : [...s, k]))
  const removeTest = (k: string) => setTests((s) => s.filter((x) => x !== k))
  const togglePanel = (key: string) => {
    const p = READY_PANELS.find((x) => x.key === key)!
    if (!p.tests.length) return soon()
    const all = p.tests.every((k) => tests.includes(k))
    setTests((s) => (all ? s.filter((k) => !p.tests.includes(k)) : [...s, ...p.tests.filter((k) => !s.includes(k))]))
  }

  const tubes = tubesFor(tests)
  const total = tests.reduce((s, k) => s + (testOf(k)?.price ?? 0), 0)
  const covers = payer ? sar(total * PAYER_SHARE) : 0
  const errors = { patient: !picked, tests: tests.length === 0, diagnosis: !diagnosis }
  const valid = !errors.patient && !errors.tests && !errors.diagnosis

  const create = () => {
    setTried(true)
    if (!valid || !picked) return
    const doc = doctors.find((d) => d.key === ORDERING_DOCTOR)
    const icd = ICD10.find((x) => x.code === diagnosis)
    const no = nextOrderNo()
    const order: LabOrder = {
      no,
      patient: { ...picked.patient, payer: payer ?? picked.patient.payer },
      doctorId: ORDERING_DOCTOR,
      clinicId: doc?.clinic ?? "",
      priority,
      tests,
      tubes,
      panels: tests.map((k) => ({
        test: k,
        state: "waiting" as const,
        results: (testOf(k)?.analytes ?? []).map((a) => {
          const band = bandFor(a, picked.patient)
          return { analyte: a.key, value: null, unit: a.unit, refLow: band?.low, refHigh: band?.high, flag: null }
        }),
      })),
      fasting,
      diagnosisIcd10: diagnosis,
      diagnosis: icd?.name,
      note: note.trim() ? { en: note.trim(), ar: note.trim() } : undefined,
      place,
      createdAt: LAB_NOW,
      ticket: place === "room" ? nextTicket() : undefined,
      queuedAt: place === "room" ? LAB_NOW : undefined,
      calls: [],
      events: [{ at: LAB_NOW, kind: "ordered", by: ORDERING_DOCTOR }],
      verifyCode: Math.random().toString(36).slice(2, 8).toUpperCase().replace(/(...)(...)/, "$1-$2"),
    }
    addOrder(order)
    toast.success(t("created"), { description: <bdi>{t(place === "room" ? "createdText" : "createdTextOther", { no: ltrRun(no), n: tests.length })}</bdi> })
    router.push("/lab")
  }

  const actions = (
    <>
      <Button variant="outline" asChild>
        <Link href="/lab">{t("cancel")}</Link>
      </Button>
      <Button onClick={create} disabled={!labCan(role, "order")}>
        <Icon name="tick-circle" size={24} />
        {t("create")}
      </Button>
    </>
  )

  const patientLine = picked
    ? [age(picked.patient), picked.patient.mrn, payer ? b(payer) : null, picked.diagnosis ? lowerFirst(b(ICD10.find((x) => x.code === picked.diagnosis)?.name ?? { en: "", ar: "" })) : null]
        .filter(Boolean)
        .join(" · ")
    : ""

  return (
    <>
    <PageTitle title={t("title")} crumbs={[{ label: tn("lab"), href: "/lab" }]} back="/lab" />
    <MobileBar title={t("title")} />
    <PageContainer className="max-md:pb-24">
      <div className="hidden justify-end gap-2 md:flex">{actions}</div>

      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        {/* Summary: first on mobile, beside the form from xl. */}
        <div className="xl:order-2">
          <Summary tests={tests} tubes={tubes} priority={priority} total={total} covers={covers} payer={payer ? b(payer) : null} place={place} />
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6 xl:order-1">
          <LabCard title={t("patient")} text={t("patientText")} className="md:p-6">
            {picked ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary bg-accent p-3">
                <Avatar>
                  <AvatarFallback>{picked.patient.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{b(picked.patient.name)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <bdi>{patientLine}</bdi>
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setPatientKey("")} aria-label={t("change")}>
                  <Icon name="close-circle" size={24} />
                </Button>
              </div>
            ) : (
              <Field label={t("patient")} required error={tried && errors.patient ? t("needPatient") : undefined} className="*:first:sr-only">
                {(p) => (
                  <Combobox
                    {...p}
                    options={patients.map((x) => ({ value: x.value, label: x.label }))}
                    value={patientKey}
                    onChange={pickPatient}
                    placeholder={t("patientPick")}
                    searchPlaceholder={t("patientSearch")}
                    emptyText={t("patientEmpty")}
                    aria-invalid={(tried && errors.patient) || undefined}
                  />
                )}
              </Field>
            )}
          </LabCard>

          <LabCard title={t("tests")} text={t("testsText")} className="md:p-6">
            <Combobox
              options={TESTS.filter((x) => x.active && !tests.includes(x.key)).map((x) => ({ value: x.key, label: `${b(x.name)} · ${x.code}` }))}
              value=""
              onChange={addTest}
              placeholder={t("testSearch")}
              searchPlaceholder={t("testSearch")}
              emptyText={t("testEmpty")}
              aria-invalid={(tried && errors.tests) || undefined}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">{t("panels")}</span>
              <div className="flex flex-wrap gap-1.5">
                {READY_PANELS.map((p) => {
                  const on = p.tests.length > 0 && p.tests.every((k) => tests.includes(k))
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePanel(p.key)}
                      className={cn(
                        "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        on ? "border-primary bg-accent text-primary" : "border-border bg-card text-foreground hover:bg-muted"
                      )}
                    >
                      {b(p.name)}
                    </button>
                  )
                })}
              </div>
            </div>
            {tests.length === 0 ? (
              <p className={cn("rounded-lg border border-dashed p-4 text-center text-xs", tried ? "border-destructive text-destructive" : "text-muted-foreground")}>
                {tried ? t("needTests") : t("noTests")}
              </p>
            ) : (
              <ul className="flex flex-col overflow-hidden rounded-lg border">
                {tests.map((k) => {
                  const x = testOf(k)!
                  return (
                    <li key={k} className="flex items-center gap-2.5 border-b px-3 py-2.5 last:border-b-0">
                      <TubeDot tube={x.tube} size={14} />
                      <span className="sr-only">{b(TUBES[x.tube].name)}</span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{b(x.name)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{x.price ? t("sar", { n: x.price }) : t("noPrice")}</span>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeTest(k)} aria-label={t("remove", { test: b(x.name) })}>
                        <Icon name="trash" size={22} />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </LabCard>

          <LabCard title={t("clinical")} text={t("clinicalText")} className="md:p-6">
            <div className="flex flex-col gap-1.5">
              <span id="lab-priority" className="text-xs font-medium text-foreground">
                {t("priority")}
              </span>
              <Segmented
                aria-labelledby="lab-priority"
                value={priority}
                onValueChange={setPriority}
                options={[
                  { value: "routine", label: t("routine") },
                  { value: "stat", label: t("stat") },
                ]}
              />
            </div>
            <Field label={t("diagnosis")} required error={tried && errors.diagnosis ? t("needDiagnosis") : undefined}>
              {(p) => (
                <Combobox
                  {...p}
                  options={ICD10.map((x) => ({ value: x.code, label: `${x.code} · ${b(x.name)}` }))}
                  value={diagnosis}
                  onChange={setDiagnosis}
                  placeholder={t("diagnosisPick")}
                  searchPlaceholder={t("diagnosisSearch")}
                  emptyText={t("diagnosisEmpty")}
                  aria-invalid={(tried && errors.diagnosis) || undefined}
                />
              )}
            </Field>
            <SwitchCard label={t("fasting")} checked={fasting} onCheckedChange={setFasting} />
            <Field label={t("note")}>{(p) => <Textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          </LabCard>

          <LabCard title={t("collection")} text={t("collectionText")} className="md:p-6">
            <Segmented
              aria-label={t("collection")}
              value={place}
              onValueChange={setPlace}
              options={(["room", "clinic", "home"] as CollectionPlace[]).map((p) => ({ value: p, label: t(`place.${p}`) }))}
            />
          </LabCard>
        </div>
      </div>
      <MobileActionBar>{actions}</MobileActionBar>
    </PageContainer>
    </>
  )
}

/** Widget / New Lab Order Summary: tests · priority, tubes to draw, price, insurer share, patient pays, info note. */
export function Summary({
  tests,
  tubes,
  priority,
  total,
  covers,
  payer,
  place,
}: {
  tests: string[]
  tubes: { no: number; type: TubeKey; volumeMl?: number }[]
  priority: Priority
  total: number
  covers: number
  payer: string | null
  place: CollectionPlace
}) {
  const t = useTranslations("labs.newOrder")
  const ts = useTranslations("labs.tubeShort")
  const tp = useTranslations("labs.priority")
  return (
    <LabCard title={t("summary")} text={t("summaryText", { n: tests.length, priority: tp(priority) })}>
      {tubes.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">{t("tubes")}</span>
          <ul className="flex flex-col gap-2">
            {tubes.map((x) => (
              <li key={x.no} className="flex items-center gap-2 text-xs text-foreground">
                <TubeDot tube={x.type} size={14} />
                {x.volumeMl && x.type !== "urine" && x.type !== "bottle" ? t("tubeLine", { n: 1, tube: ts(x.type), ml: x.volumeMl }) : t("tubeLineNoMl", { n: 1, tube: ts(x.type) })}
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="flex flex-col border-t pt-4">
        <KvRow label={t("total")}>{t("sar", { n: total })}</KvRow>
        {payer && <KvRow label={t("covers", { payer })}>{t("sar", { n: covers })}</KvRow>}
        <KvRow label={t("pays")}>{t("sar", { n: total - covers })}</KvRow>
      </dl>
      <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
        <Icon name="info-circle" size={18} className="shrink-0" />
        {t(place === "room" ? "infoRoom" : place === "clinic" ? "infoClinic" : "infoHome")}
      </p>
    </LabCard>
  )
}

function SwitchCard({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm font-medium">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function MobileBar({ title }: { title: string }) {
  const t = useTranslations("labs.order")
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/lab" aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
    </div>
  )
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)
