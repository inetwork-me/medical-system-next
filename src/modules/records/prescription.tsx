"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { PageTitle } from "@/components/shell/page-title"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  CURRENT_MEDS,
  DRUGS,
  REC_NOW,
  RX_VALID_DAYS,
  USERS,
  drugLabel,
  drugOf,
  type Dose,
  type Frequency,
  type Prescription,
  type RecDocument,
  type RecPatient,
  type RxLine,
} from "./data"
import { checkMedicines, medicineChecks, type CheckResult, type Interaction } from "./checks"
import { NOTES_HREF, noteHref } from "./href"
import { patientOf } from "./lookup"
import { PatientBanner } from "./note-page"
import { pharmacyLink, type RxDispensing } from "./pharmacy"
import { Latin, Strip, useB } from "./parts"
import { recCan } from "./roles"
import { nextRxNo, qtyFor, rxProblems, sigOf } from "./rules"
import { ME } from "./session"
import { getNote, saveDocument, saveNote, savePrescription, useEncounter, useNotes, usePrescriptions, useRecRole } from "./store"

const DOSES: Dose[] = ["half", "one", "two"]
const FREQS: Frequency[] = ["morning", "night", "afterFood", "twice", "thrice", "asNeeded"]
const DAYS = [7, 14, 30, 60, 90]

/* ------------------------------------------------------------------ labels */

function useRxText() {
  const t = useTranslations("records.rx")
  const b = useB()
  const locale = useLocale()
  const capsule = (id: string) => drugOf(id)?.form.en === "capsule"
  return {
    dose: (l: Pick<RxLine, "drug" | "dose">) => t(`dose.${capsule(l.drug) ? "capsule" : "tablet"}.${l.dose}`),
    freq: (f: Frequency) => t(`freq.${f}`),
    days: (n: number) => t("days", { n }),
    drug: (id: string) => {
      const d = drugOf(id)
      return d ? drugLabel(d, locale) : id
    },
    brand: (id: string) => {
      const d = drugOf(id)
      return d ? t("brand", { brand: b(d.brand), form: b(d.form), route: b(d.route) }) : ""
    },
  }
}

/* ------------------------------------------------------------------ checks */

/**
 * Checks first: the allergy check (passed = green strip; a clash = red card, sending blocked) and one amber card per
 * interaction with "Add to the advice" → acknowledged (Added to the advice) → advice-added.
 */
export function RxChecks({
  patient,
  result,
  acknowledged,
  onAck,
  error,
  readOnly,
}: {
  patient: RecPatient
  result: CheckResult | null
  acknowledged: string[]
  onAck: (i: Interaction) => void
  error?: boolean
  /** Sent: the acknowledgement can't change any more. */
  readOnly?: boolean
}) {
  const t = useTranslations("records.rx")
  const b = useB()
  const locale = useLocale()
  const x = useRxText()
  if (!result)
    return (
      <Strip tone="info" icon="timer-1">
        {t("checking")}
      </Strip>
    )
  const lower = (s: string) => s.toLocaleLowerCase(locale === "ar" ? "ar" : "en")
  // Arabic drops the article in the sentence ("ولا دواء فيه بنسلين").
  const allergies = patient.allergies.map((a) => (locale === "ar" ? b(a).replace(/^ال/, "") : lower(b(a)))).join(locale === "ar" ? " ولا " : " or ")
  return (
    <div className="flex flex-col gap-3">
      {result.allergy.length === 0 ? (
        <Strip tone="success" icon="tick-circle">
          {patient.allergies.length ? t("allergyOk", { allergy: allergies }) : t("noAllergies")}
        </Strip>
      ) : (
        result.allergy.map((h) => (
          <div
            key={h.drug}
            role="alert"
            className="flex flex-col gap-1 rounded-xl border border-destructive/40 bg-destructive-soft p-4 text-destructive-soft-foreground"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon name="danger" size={20} />
              {t("allergyHit", { allergy: b(h.allergy), drug: x.drug(h.drug) })}
            </span>
            <span className="text-xs">{t("allergyHitText", { drug: x.drug(h.drug), allergy: lower(b(h.allergy)) })}</span>
          </div>
        ))
      )}
      {result.interactions.map((i) => {
        const done = acknowledged.includes(i.id)
        const da = drugOf(i.a)
        const db = drugOf(i.b)
        return (
          <div
            key={i.id}
            role={error && !done ? "alert" : undefined}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-warning-soft p-4 text-warning-soft-foreground",
              error && !done ? "border-destructive" : "border-warning",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon name="info-circle" size={20} />
              {t("interaction", { a: da ? b(da.generic) : i.a, b: db ? lower(b(db.generic)) : i.b, severity: t(`severity.${i.severity}`) })}
            </span>
            <span className="text-xs">{b(i.text)}</span>
            <Button variant="outline" size="sm" className="self-end bg-card text-foreground" onClick={() => onAck(i)} aria-pressed={done} disabled={readOnly}>
              <Icon name={done ? "tick-circle" : "add"} size={20} />
              {t(done ? "acked" : "ack")}
            </Button>
            {error && !done && <span className="text-xs text-destructive">{t("ackError")}</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ medicines */

/** One medicine: generic + strength, brand · form · route, New chip, remove; Dose · How often · For · Qty. */
export function MedicineCard({
  line,
  onChange,
  onRemove,
  readOnly,
  invalid,
}: {
  line: RxLine
  onChange: (l: RxLine) => void
  onRemove: () => void
  readOnly?: boolean
  invalid?: boolean
}) {
  const t = useTranslations("records.rx")
  const x = useRxText()
  const [open, setOpen] = React.useState(false)
  const set = (patch: Partial<RxLine>) => {
    const next = { ...line, ...patch }
    onChange("qty" in patch ? next : { ...next, qty: qtyFor(next, line.qty) })
  }
  const summary = `${x.dose(line)} · ${x.freq(line.freq)} · ${x.days(line.days)} · ${t("qtyN", { n: line.qty })}`
  const fields = (
    <div className="grid grid-cols-2 gap-3 @xl/rx:grid-cols-4">
      <Field label={t("doseLabel")}>
        {(fp) => (
          <Select value={line.dose} onValueChange={(v) => set({ dose: v as Dose })} disabled={readOnly}>
            <SelectTrigger {...fp} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOSES.map((d) => (
                <SelectItem key={d} value={d}>
                  {x.dose({ drug: line.drug, dose: d })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("freqLabel")}>
        {(fp) => (
          <Select value={line.freq} onValueChange={(v) => set({ freq: v as Frequency })} disabled={readOnly}>
            <SelectTrigger
              {...fp}
              className="w-full py-1 text-start leading-tight whitespace-normal data-[size=default]:h-auto data-[size=default]:min-h-9 *:data-[slot=select-value]:block *:data-[slot=select-value]:line-clamp-2"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQS.map((f) => (
                <SelectItem key={f} value={f}>
                  {x.freq(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("daysLabel")}>
        {(fp) => (
          <Select value={String(line.days)} onValueChange={(v) => set({ days: Number(v) })} disabled={readOnly}>
            <SelectTrigger {...fp} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {x.days(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("qtyLabel")} error={invalid ? t("qtyError") : undefined}>
        <Input
          inputMode="numeric"
          dir="ltr"
          value={line.qty ? String(line.qty) : ""}
          onChange={(e) => set({ qty: Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0 })}
          disabled={readOnly}
        />
      </Field>
    </div>
  )
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3 @xl/rx:p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon name="health" size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">{x.drug(line.drug)}</span>
          <span className="text-xs text-muted-foreground">{x.brand(line.drug)}</span>
        </span>
        {line.isNew && <span className="inline-flex h-[22px] items-center rounded-full bg-accent px-2.5 text-xs text-primary">{t("new")}</span>}
        {!readOnly && (
          <Button variant="ghost" size="icon" className="size-8" onClick={onRemove} aria-label={t("remove", { name: x.drug(line.drug) })}>
            <Icon name="trash" size={22} />
          </Button>
        )}
      </div>
      {/* Sent: the one-line summary. Wide: the four fields; compact: the drawn one-line summary, which opens the fields. */}
      {readOnly ? (
        <p className="text-sm text-foreground">{summary}</p>
      ) : (
        <>
          <div className="hidden @xl/rx:block">{fields}</div>
          <div className="flex flex-col gap-3 @xl/rx:hidden">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              disabled={readOnly}
              className={cn(
                "flex items-center gap-2 rounded-sm text-start text-xs text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                invalid && "text-destructive",
              )}
            >
              <span className="min-w-0 flex-1">{summary}</span>
              {!readOnly && <Icon name={open ? "arrow-up-1" : "edit-2"} size={16} className="text-muted-foreground" />}
            </button>
            {open && fields}
          </div>
        </>
      )}
    </li>
  )
}

/** Dashed "Add a medicine · search by generic or brand name" → search box with matching medicines. */
function AddMedicine({ have, onAdd }: { have: string[]; onAdd: (id: string) => void }) {
  const t = useTranslations("records.rx")
  const b = useB()
  const x = useRxText()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const s = q.trim().toLowerCase()
  const results = DRUGS.filter((d) => !have.includes(d.id)).filter(
    (d) =>
      !s || d.generic.en.toLowerCase().includes(s) || d.brand.en.toLowerCase().includes(s) || d.generic.ar.includes(q.trim()) || d.brand.ar.includes(q.trim()),
  )
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed bg-muted px-4 py-2.5 text-start text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon name="add" size={18} className="text-primary" />
        {t("add")}
      </button>
    )
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted p-3">
      <Input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder={t("addPlaceholder")}
        aria-label={t("add")}
        startIcon={<Icon name="search-normal-1" size={18} />}
        end={
          <button type="button" onClick={() => setOpen(false)} aria-label={t("closeSearch")} className="text-muted-foreground hover:text-foreground">
            <Icon name="close" size={16} />
          </button>
        }
      />
      {results.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">{t("noMatch")}</p>
      ) : (
        <ul className="flex max-h-60 flex-col overflow-y-auto rounded-md border bg-card">
          {results.map((d) => (
            <li key={d.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onAdd(d.id)
                  setQ("")
                  setOpen(false)
                }}
                className="flex w-full flex-col px-3 py-2 text-start outline-none hover:bg-muted/60 focus-visible:bg-muted"
              >
                <span className="text-sm text-foreground">{x.drug(d.id)}</span>
                <span className="text-xs text-muted-foreground">{t("brand", { brand: b(d.brand), form: b(d.form), route: b(d.route) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ summary */

/**
 * Widget / Rec Prescription Summary (320): RX no · draft; patient, medicines "3 · 1 new", valid for, refills, sent by
 * SMS with a code, signed by; "Any pharmacy can scan the code. Once it's dispensed, it shows here." Once sent: the
 * code and the dispensing status from the pharmacy link.
 */
export function RxSummary({
  rx,
  patient,
  dispensing,
}: {
  rx: Pick<Prescription, "no" | "status" | "lines" | "refills" | "validDays" | "doctor" | "code" | "sentAt">
  patient: RecPatient
  dispensing?: RxDispensing | null
}) {
  const t = useTranslations("records.rx")
  const ts = useTranslations("records.status.rx")
  const b = useB()
  const fresh = rx.lines.filter((l) => l.isNew).length
  const dispensed = rx.status === "dispensed" || dispensing?.status === "dispensed"
  const rows: [string, React.ReactNode][] = [
    [t("sum.patient"), b(patient.name)],
    [t("sum.medicines"), rx.lines.length ? t("sum.medicinesValue", { n: rx.lines.length, fresh }) : t("sum.none")],
    [t("sum.valid"), t("days", { n: rx.validDays })],
    [t("sum.refills"), rx.refills ? t("sum.refillsValue", { n: rx.refills }) : t("sum.noRefills")],
    [t("sum.sentBy"), t("sum.sms")],
    [t("sum.signedBy"), b(USERS[rx.doctor].name)],
  ]
  if (rx.code) rows.push([t("sum.code"), <Latin key="c">{rx.code}</Latin>])
  return (
    <section aria-labelledby="rx-sum" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-1">
        <h2 id="rx-sum" className="text-lg font-semibold text-foreground">
          {t("sum.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          <Latin>{rx.no}</Latin> · {ts(dispensed ? "dispensed" : rx.status).toLocaleLowerCase()}
        </p>
      </header>
      <dl className="flex flex-col">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex items-start gap-3 border-b py-3.5 last:border-b-0">
            <dt className="w-[130px] shrink-0 pt-0.5 text-xs text-muted-foreground">{k}</dt>
            <dd className="min-w-0 flex-1 text-sm text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      {dispensed ? (
        <Strip tone="success" icon="tick-circle">
          {dispensing?.pharmacy ? t("sum.dispensedAt", { pharmacy: b(dispensing.pharmacy) }) : t("sum.dispensed")}
        </Strip>
      ) : rx.status === "sent" ? (
        <Strip tone="info" icon="timer-1">
          {t("sum.waiting")}
        </Strip>
      ) : (
        <Strip tone="info" icon="info-circle">
          {t("sum.info")}
        </Strip>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ page */

type Form = { lines: RxLine[]; note: string; acknowledged: string[] }

function MobileBar({ back }: { back: string }) {
  const t = useTranslations("records.rx")
  const router = useRouter()
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href={back} aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
      <ActionMenu
        title={t("mobileTitle")}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          [
            { key: "note", icon: "note-2", label: t("openNote"), onSelect: () => router.push(back) },
            { key: "print", icon: "printer", label: t("print"), onSelect: () => window.print() },
          ],
        ]}
      />
    </div>
  )
}

/**
 * New prescription (`/records/notes/prescription?visit=V-2611-2041`): header Back · "Medical records / Visit notes"
 * over "New prescription · Fahad Al-Dosari"; Save draft · Send prescription. Banner; the checks (allergy +
 * interactions, stub); Medicines (cards, Add a medicine); Note to the pharmacist; side summary (first under 1120 px).
 * Send → checks again → pharmacy link (stub: SMS code) → prescription-sent; the visit note's medicines and advice
 * follow; the dispensing status comes back on the summary.
 */
export function PrescriptionPage() {
  const t = useTranslations("records.rx")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.records")
  const b = useB()
  const locale = useLocale()
  const role = useRecRole()
  const params = useSearchParams()
  const visit = params.get("visit") ?? ""
  const askedNo = params.get("no") ?? ""
  const e = useEncounter(visit)
  const notes = useNotes()
  const all = usePrescriptions()
  const note = notes.find((n) => n.encounter === visit)
  const stored = all.find((r) => (askedNo ? r.no === askedNo : r.encounter === visit))
  const no = stored?.no ?? nextRxNo(all.map((r) => r.no))

  const init = (): Form => ({
    lines: stored?.lines ?? [],
    note: stored ? b(stored.pharmacistNote) : "",
    acknowledged: stored?.acknowledged ?? [],
  })
  const [form, setForm] = React.useState<Form>(init)
  const [key, setKey] = React.useState(`${visit}|${stored?.no ?? ""}|${stored?.status ?? ""}|${locale}`)
  const k = `${visit}|${stored?.no ?? ""}|${stored?.status ?? ""}|${locale}`
  if (k !== key) {
    setKey(k)
    setForm(init())
  }
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<CheckResult | null>(null)
  const [dispensing, setDispensing] = React.useState<RxDispensing | null>(null)

  const patientKey = e?.patient ?? ""
  const drugs = form.lines.map((l) => l.drug).join(",")
  // The checks run on every change of the medicines (stub; a drug database later).
  React.useEffect(() => {
    if (!patientKey) return
    let live = true
    void medicineChecks
      .run({ patient: patientOf(patientKey), drugs: drugs ? drugs.split(",") : [], current: CURRENT_MEDS[patientKey] ?? [] })
      .then((r) => live && setResult(r))
    return () => {
      live = false
    }
  }, [patientKey, drugs])

  // Once sent, ask the pharmacy link for the dispensing status until it's dispensed.
  const sent = stored?.status === "sent"
  React.useEffect(() => {
    if (!sent || !stored) return
    let live = true
    const ask = () =>
      void pharmacyLink.status(stored.no).then((s) => {
        if (!live) return
        setDispensing(s)
        if (s.status === "dispensed") {
          savePrescription({ ...stored, status: "dispensed", dispensedAt: REC_NOW })
          const doc = docFor({ ...stored, status: "dispensed" }, patientKey)
          saveDocument(doc)
        }
      })
    ask()
    const id = setInterval(ask, 5000)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [sent, stored, patientKey])

  if (!e || !note) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="health"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={NOTES_HREF}>
                  <Icon name="arrow-left" size={16} />
                  {t("backToList")}
                </Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }

  const p = patientOf(e.patient)
  const back = noteHref(note.id)
  const canWrite = recCan(role, "prescribe") && note.author === ME
  const readOnly = !canWrite || (!!stored && stored.status !== "draft")
  const current = (CURRENT_MEDS[e.patient] ?? []).map((m) => m.drug)
  const live = result ?? null
  const problems = rxProblems(
    form.lines,
    live ??
      checkMedicines(
        p,
        form.lines.map((l) => l.drug),
        CURRENT_MEDS[e.patient] ?? [],
      ),
    form.acknowledged,
  )
  const blocked = problems.empty || problems.qty || problems.allergy || problems.unacked.length > 0

  const build = (status: Prescription["status"], extra: Partial<Prescription> = {}): Prescription => ({
    no,
    encounter: visit,
    patient: e.patient,
    doctor: note.author,
    createdAt: stored?.createdAt ?? REC_NOW,
    status,
    lines: form.lines,
    pharmacistNote: { en: form.note, ar: form.note },
    refills: stored?.refills ?? 0,
    validDays: stored?.validDays ?? RX_VALID_DAYS,
    acknowledged: form.acknowledged,
    ...extra,
  })

  const setLines = (lines: RxLine[]) => setForm((f) => ({ ...f, lines }))
  const removeLine = (i: number) => {
    setLines(form.lines.filter((_, j) => j !== i))
    toast.info(t("removedToast"), { description: t("removedToastText") })
  }
  const addLine = (id: string) => {
    const l: RxLine = { drug: id, dose: "one", freq: "morning", days: 30, qty: 30, isNew: !current.includes(id) }
    setLines([...form.lines, l])
  }
  const ack = (i: Interaction) => {
    const on = form.acknowledged.includes(i.id)
    setForm((f) => ({ ...f, acknowledged: on ? f.acknowledged.filter((x) => x !== i.id) : [...f.acknowledged, i.id] }))
    if (on) return
    // The warning's advice goes on the visit note (it prints on the medicine sheet).
    const cur = getNote(note.id)
    if (cur && !cur.signedAt && !cur.advice.en.includes(i.advice.en) && !cur.advice.ar.includes(i.advice.ar)) {
      const join = (a: string, x: string) => (a.trim() ? `${a.trim()} ${x}` : x)
      saveNote({ ...cur, advice: { en: join(cur.advice.en, i.advice.en), ar: join(cur.advice.ar, i.advice.ar) } })
    }
    toast.success(t("adviceToast", { sex: p.sex }), { description: t("adviceToastText", { sex: p.sex }) })
  }

  const saveDraft = () => {
    savePrescription(build("draft"))
    saveDocument(docFor(build("draft"), e.patient))
    toast.success(t("draftToast"), { description: t("draftToastText") })
  }

  const send = async () => {
    setTried(true)
    if (blocked || busy || readOnly) return
    setBusy(true)
    try {
      // Checks run again right before sending (the drug list may have changed elsewhere).
      const again = await medicineChecks.run({ patient: p, drugs: form.lines.map((l) => l.drug), current: CURRENT_MEDS[e.patient] ?? [] })
      setResult(again)
      const pr = rxProblems(form.lines, again, form.acknowledged)
      if (pr.allergy || pr.unacked.length) return
      const res = await pharmacyLink.send({ no, mobile: p.mobile })
      const rx = build("sent", { sentAt: REC_NOW, code: res.code })
      savePrescription(rx)
      saveDocument(docFor(rx, e.patient))
      // The visit note shows what was prescribed.
      const cur = getNote(note.id)
      if (cur && !cur.signedAt)
        saveNote({
          ...cur,
          medicines: form.lines.map((l) => ({ drug: l.drug, sig: sigOf(l, drugOf(l.drug)?.form ?? { en: "tablet", ar: "حبوب" }), isNew: l.isNew })),
        })
      toast.success(t("sentToast"), { description: t("sentToastText", { name: b(p.name).split(" ")[0] }) })
    } catch {
      toast.error(t("failed"), { description: t("failedText"), retry: () => void send() })
    } finally {
      setBusy(false)
    }
  }

  const summaryRx = stored && stored.status !== "draft" ? stored : build("draft")
  const actions = !readOnly && (
    <>
      <Button variant="outline" onClick={saveDraft}>
        {t("save")}
      </Button>
      <Button onClick={() => void send()} disabled={busy}>
        <Icon name="send-2" size={20} />
        {busy ? t("sending") : t("send")}
      </Button>
    </>
  )

  return (
    <>
      <PageTitle
        title={t("title", { name: b(p.name) })}
        crumbs={[
          { label: tn("records"), href: "/records" },
          { label: tt("notes"), href: NOTES_HREF },
        ]}
        back={back}
      />
      <MobileBar back={back} />
      <PageContainer className={cn("@container/rxp", actions && "pb-28 md:pb-6")}>
        <PageHeader actions={actions ? <div className="hidden gap-2 md:flex">{actions}</div> : undefined} />
        <PatientBanner patientKey={e.patient} />
        <div className="grid gap-4 @[66rem]/rxp:grid-cols-[minmax(0,1fr)_320px] @[66rem]/rxp:items-start @[66rem]/rxp:gap-6">
          <div className="order-2 flex min-w-0 flex-col gap-4 @[66rem]/rxp:order-1">
            {tried && (problems.empty || problems.qty) && (
              <Strip tone="destructive" icon="warning-2">
                {problems.empty ? t("emptyError") : t("qtyErrorStrip")}
              </Strip>
            )}
            <RxChecks patient={p} result={live} acknowledged={form.acknowledged} onAck={ack} error={tried} readOnly={readOnly} />
            <section aria-labelledby="rx-meds" className="@container/rx flex flex-col gap-4 rounded-xl border bg-card p-4 @xl/rx:p-6">
              <header className="flex flex-col gap-1">
                <h2 id="rx-meds" className="text-lg font-semibold text-foreground">
                  {t("medicines")}
                </h2>
                <p className="text-xs text-muted-foreground">{t("medicinesText")}</p>
              </header>
              {form.lines.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {form.lines.map((l, i) => (
                    <MedicineCard
                      key={l.drug}
                      line={l}
                      readOnly={readOnly}
                      invalid={tried && !(l.qty > 0)}
                      onRemove={() => removeLine(i)}
                      onChange={(n) => setLines(form.lines.map((x, j) => (j === i ? n : x)))}
                    />
                  ))}
                </ul>
              )}
              {!readOnly && <AddMedicine have={form.lines.map((l) => l.drug)} onAdd={addLine} />}
            </section>
            <section aria-labelledby="rx-note" className="flex flex-col gap-4 rounded-xl border bg-card p-4 @xl/rx:p-6 md:p-6">
              <header className="flex flex-col gap-1">
                <h2 id="rx-note" className="text-lg font-semibold text-foreground">
                  {t("pharmacist")}
                </h2>
                <p className="text-xs text-muted-foreground">{t("optional")}</p>
              </header>
              {readOnly ? (
                <p className="text-sm whitespace-pre-wrap text-foreground">{form.note || "—"}</p>
              ) : (
                <Field label={t("note")}>
                  <Textarea rows={3} value={form.note} onChange={(ev) => setForm((f) => ({ ...f, note: ev.target.value }))} />
                </Field>
              )}
            </section>
          </div>
          <div className="order-1 @[66rem]/rxp:order-2">
            <RxSummary rx={summaryRx} patient={p} dispensing={dispensing} />
          </div>
        </div>
      </PageContainer>
      {actions && <MobileActionBar>{actions}</MobileActionBar>}
    </>
  )
}

/** The Documents row for a prescription ("3 medicines · SMS to the patient", status follows the prescription). */
function docFor(rx: Prescription, patient: string): RecDocument {
  const n = rx.lines.length
  const details =
    rx.status === "dispensed"
      ? { en: `${n === 1 ? "1 medicine" : `${n} medicines`} · picked up`, ar: `${n === 1 ? "دواء واحد" : n === 2 ? "دوائين" : `${n} أدوية`} · استلمها` }
      : {
          en: `${n === 1 ? "1 medicine" : `${n} medicines`} · SMS to the patient`,
          ar: `${n === 1 ? "دواء واحد" : n === 2 ? "دوائين" : `${n} أدوية`} · برسالة للمريض`,
        }
  return {
    no: rx.no,
    kind: "prescription",
    patient,
    at: rx.createdAt,
    status: rx.status === "draft" ? "draft" : rx.status === "expired" ? "expired" : "sent",
    details,
    encounter: rx.encounter,
    doctor: rx.doctor,
  }
}
