"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { BILL_NOW, COMPANY_ACCOUNTS, OPEN_VISITS, PATIENTS, PRICE_LIST, type InsurerClass, type PatientKey } from "./data"
import { INVOICES_HREF, invoiceHref } from "./href"
import { useMoney } from "./money"
import { Latin, ltrRun } from "./parts"
import { billCan } from "./roles"
import { buildManualInvoice, copayRuleFor, lineNet, lineTotal, lineVat, manualClaim, nextClaimNo, nextInvoiceNo, totals, type ManualInvoiceInput, type ManualPayer } from "./rules"
import { Strip } from "./claim-dialogs"
import { getClaims, getInsurer, getInvoice, getInvoices, saveInvoice, saveInvoiceDraft, saveManualInvoice, useBillRole, useInsurers, useInvoiceDraft } from "./store"
import { useBillText } from "./text"
import { applyZatca, zatca, zatcaRequest } from "./zatca"

const n2 = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

/* ------------------------------------------------------------------ form model */

/** The form: ManualInvoiceInput with the patient not picked yet. */
export type NewInvoiceForm = Omit<ManualInvoiceInput, "patient" | "visit"> & { patient: PatientKey | null; visitId: string }

export const blankInvoiceForm = (): NewInvoiceForm => ({ patient: null, visitId: "", payer: "cash", lines: [], note: "", vatRule: "standard" })

/** Picking the patient fills "Who pays" from their file, and the visit with their latest unbilled visit. */
export function formForPatient(f: NewInvoiceForm, key: PatientKey): NewInvoiceForm {
  const file = PATIENTS[key].file
  const visit = OPEN_VISITS.filter((v) => v.patient === key).sort((a, b) => b.at.localeCompare(a.at))[0]
  return {
    ...f,
    patient: key,
    visitId: visit?.id ?? "",
    payer: file?.payer ?? "cash",
    insurer: file?.insurer,
    class: file?.class,
    policyNo: file?.policyNo ?? "",
    company: file?.company,
    vatRule: file?.vat ?? "standard",
  }
}

type ErrorKey = "patient" | "insurer" | "policyNo" | "company" | "lines"
type Errors = Partial<Record<ErrorKey, true>>

/** Issue needs a patient, the payer's details and at least one service; Save draft only needs the patient. */
export function validateInvoice(f: NewInvoiceForm): Errors {
  const e: Errors = {}
  if (!f.patient) e.patient = true
  if (f.payer === "insurance") {
    if (!f.insurer || !f.class) e.insurer = true
    if (!f.policyNo?.trim()) e.policyNo = true
  }
  if (f.payer === "company" && !f.company) e.company = true
  if (!f.lines.length) e.lines = true
  return e
}

const toInput = (f: NewInvoiceForm): ManualInvoiceInput | null =>
  f.patient ? { ...f, patient: f.patient, visit: OPEN_VISITS.find((v) => v.id === f.visitId), policyNo: f.policyNo?.trim() } : null

/** The invoice the form would issue (the summary previews it with the same rules). */
function usePreview(f: NewInvoiceForm) {
  const insurers = useInsurers()
  const ins = f.payer === "insurance" ? insurers.find((i) => i.id === f.insurer) : undefined
  const input = toInput(f) ?? { ...f, patient: "mutairi" as PatientKey, visit: undefined }
  return { ins, inv: buildManualInvoice(input, ins, { no: "", at: BILL_NOW, uuid: "preview" }) }
}

/* ------------------------------------------------------------------ building blocks */

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 @xl/ni:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  )
}

const Row = ({ children }: { children: React.ReactNode }) => <div className="grid gap-4 @xl/ni:grid-cols-2 @xl/ni:gap-3">{children}</div>

function Note({ icon = "info-circle", tone = "info", children }: { icon?: "info-circle" | "warning-2"; tone?: "info" | "warning"; children: React.ReactNode }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-lg p-3 text-xs", tone === "info" ? "bg-info-soft text-info-soft-foreground" : "bg-warning-soft text-warning-soft-foreground")}>
      <Icon name={icon} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

/** Patient search (name or MRN): a field with the search icon; the list opens under it. */
function PatientPicker({ value, onPick, invalid, id }: { value: PatientKey | null; onPick: (k: PatientKey) => void; invalid?: boolean; id?: string }) {
  const t = useTranslations("billing.newInvoice")
  const { b } = useBillText()
  const [open, setOpen] = React.useState(false)
  const listId = React.useId()
  const p = value ? PATIENTS[value] : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-card px-3 text-start text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
        >
          <Icon name="search-normal-1" size={16} className="shrink-0 text-muted-foreground" />
          <span className={cn("min-w-0 flex-1 truncate", !p && "text-muted-foreground")}>
            {p ? (
              <bdi>
                {b(p.name)} · {ltrRun(p.mrn)}
              </bdi>
            ) : (
              t("patientPick")
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent id={listId} align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder={t("patientSearch")} />
          <CommandList>
            <CommandEmpty>{t("patientEmpty")}</CommandEmpty>
            <CommandGroup>
              {(Object.keys(PATIENTS) as PatientKey[]).map((k) => (
                <CommandItem
                  key={k}
                  value={`${PATIENTS[k].name.en} ${PATIENTS[k].name.ar} ${PATIENTS[k].mrn}`}
                  onSelect={() => {
                    onPick(k)
                    setOpen(false)
                  }}
                >
                  <span className="flex-1">{b(PATIENTS[k].name)}</span>
                  <Latin className="text-xs text-muted-foreground">{PATIENTS[k].mrn}</Latin>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** "Add a service · search the price list by name or code": the last row of the services table. */
function AddService({ onAdd, invalid }: { onAdd: (code: string) => void; invalid?: boolean }) {
  const t = useTranslations("billing.newInvoice")
  const { b } = useBillText()
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-invalid={invalid || undefined}
          className="flex min-h-10 w-full items-center gap-2 border-t px-3 py-2.5 text-start text-sm text-primary outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[invalid]:text-destructive"
        >
          <Icon name="add" size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">{t("addService")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder={t("serviceSearch")} />
          <CommandList>
            <CommandEmpty>{t("serviceEmpty")}</CommandEmpty>
            <CommandGroup>
              {PRICE_LIST.map((s) => (
                <CommandItem
                  key={s.code}
                  value={`${s.item.en} ${s.item.ar} ${s.code}`}
                  onSelect={() => {
                    onAdd(s.code)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1">
                    {b(s.item)} <Latin className="text-xs text-muted-foreground">· {s.code}</Latin>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{n2(s.price)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------------ the form */

/**
 * Widget / Bill New Invoice (Wide / Compact): Patient and visit (patient search, visit select) · Who pays (Insurance /
 * Cash / Company, filled from the patient's file; insurer + class and policy no.; the co-pay note from the agreement) ·
 * Services (service, qty, price, VAT, total, remove; "Add a service" searches the price list; compact: service + total)
 * · Note (printed on the invoice).
 */
export function NewInvoiceFormCards({ f, patch, errors }: { f: NewInvoiceForm; patch: (p: Partial<NewInvoiceForm>) => void; errors: Errors }) {
  const t = useTranslations("billing.newInvoice")
  const te = useTranslations("billing.newInvoice.error")
  const { b, doctorName, insurerShort } = useBillText()
  const dates = useDates()
  const insurers = useInsurers()
  const { inv } = usePreview(f)
  const visits = OPEN_VISITS.filter((v) => v.patient === f.patient)
  const ins = insurers.find((i) => i.id === f.insurer)
  const rule = ins ? copayRuleFor(ins, f.class) : undefined
  const remove = (i: number) => {
    patch({ lines: f.lines.filter((_, j) => j !== i) })
    toast.info(t("removedToast"), { description: t("removedToastText") })
  }
  const add = (code: string) => {
    const at = f.lines.findIndex((l) => l.code === code)
    patch({ lines: at >= 0 ? f.lines.map((l, j) => (j === at ? { ...l, qty: l.qty + 1 } : l)) : [...f.lines, { code, qty: 1 }] })
  }
  const setQty = (i: number, v: string) => patch({ lines: f.lines.map((l, j) => (j === i ? { ...l, qty: Math.max(1, Math.min(99, Number(v.replace(/\D/g, "")) || 1)) } : l)) })

  return (
    <div className="@container/ni flex flex-col gap-4 md:gap-6">
      <Card title={t("patientTitle")} description={t("patientText")}>
        <Row>
          <Field label={t("patient")} required error={errors.patient ? te("patient") : undefined}>
            {(fp) => <PatientPicker id={fp.id} value={f.patient} onPick={(k) => patch(formForPatient(f, k))} invalid={!!errors.patient} />}
          </Field>
          <Field label={t("visit")}>
            {(fp) => (
              <Select value={f.visitId || "none"} onValueChange={(v) => patch({ visitId: v === "none" ? "" : v })} disabled={!f.patient}>
                <SelectTrigger {...fp} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visits.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {t("visitValue", { date: dates.dayMonth(v.at), clinic: b(v.clinic), doctor: doctorName(v.doctor) })}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">{t("noVisit")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>
        </Row>
      </Card>

      <Card title={t("payerTitle")} description={t("payerText")}>
        <Field label={t("payer")} required>
          {(fp) => (
            <Segmented
              {...fp}
              value={f.payer}
              onValueChange={(v) => patch({ payer: v as ManualPayer })}
              aria-label={t("payer")}
              className="w-full *:flex-1"
              options={(["insurance", "cash", "company"] as ManualPayer[]).map((p) => ({ value: p, label: t(`payerValue.${p}`) }))}
            />
          )}
        </Field>
        {f.payer === "insurance" && (
          <>
            <Row>
              <Field label={t("insurer")} required error={errors.insurer ? te("insurer") : undefined}>
                {(fp) => (
                  <Select
                    value={f.insurer && f.class ? `${f.insurer}:${f.class}` : undefined}
                    onValueChange={(v) => {
                      const [id, cls] = v.split(":")
                      patch({ insurer: id, class: cls as InsurerClass })
                    }}
                  >
                    <SelectTrigger {...fp} className="w-full">
                      <SelectValue placeholder={t("insurerPick")} />
                    </SelectTrigger>
                    <SelectContent>
                      {insurers
                        .filter((i) => i.signed)
                        .flatMap((i) =>
                          i.classes.map((c) => (
                            <SelectItem key={`${i.id}:${c}`} value={`${i.id}:${c}`}>
                              {t("insurerValue", { name: b(i.name), cls: ltrRun(c) })}
                            </SelectItem>
                          ))
                        )}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field label={t("policyNo")} required error={errors.policyNo ? te("policyNo") : undefined}>
                <Input dir="ltr" value={f.policyNo ?? ""} onChange={(e) => patch({ policyNo: e.target.value })} className="rtl:text-end" />
              </Field>
            </Row>
            {ins && rule && (
              <Note>
                <bdi>
                  {rule.cap != null
                    ? t("copayCapped", { pct: ltrRun(`${rule.pct}%`), cap: ltrRun(String(rule.cap)), insurer: insurerShort(ins.id) })
                    : t("copay", { pct: ltrRun(`${rule.pct}%`), insurer: insurerShort(ins.id) })}
                </bdi>
              </Note>
            )}
          </>
        )}
        {f.payer === "cash" && <Note>{t("cashNote")}</Note>}
        {f.payer === "company" && (
          <>
            <Field label={t("company")} required error={errors.company ? te("company") : undefined}>
              {(fp) => (
                <Select value={f.company} onValueChange={(v) => patch({ company: v })}>
                  <SelectTrigger {...fp} className="w-full">
                    <SelectValue placeholder={t("companyPick")} />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_ACCOUNTS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {b(c.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Note>{t("companyNote")}</Note>
          </>
        )}
      </Card>

      <Card title={t("servicesTitle")} description={t("servicesText", { rate: ltrRun(`${Math.round((inv.lines[0]?.vatRate ?? (f.vatRule === "standard" ? 0.15 : 0)) * 100)}%`) })}>
        <div className={cn("overflow-hidden rounded-[10px] border", errors.lines && "border-destructive")}>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-normal">{t("line.service")}</th>
                <th className="hidden w-12 px-1.5 py-2 text-start font-normal @xl/ni:table-cell">{t("line.qty")}</th>
                <th className="hidden w-20 px-1.5 py-2 text-start font-normal @xl/ni:table-cell">{t("line.price")}</th>
                <th className="hidden w-[72px] px-1.5 py-2 text-start font-normal @xl/ni:table-cell">{t("line.vat")}</th>
                <th className="w-20 px-1.5 py-2 text-start font-normal">{t("line.total")}</th>
                <th className="w-10 px-1 py-2">
                  <span className="sr-only">{t("line.remove")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={l.serviceCode} className="border-t">
                  <td className="px-3 py-1.5 text-foreground">{b(l.item)}</td>
                  <td className="hidden px-1.5 py-1.5 @xl/ni:table-cell">
                    <Input
                      inputMode="numeric"
                      aria-label={t("line.qtyOf", { name: b(l.item) })}
                      value={String(l.qty)}
                      onChange={(e) => setQty(i, e.target.value)}
                      className="h-8 w-11 px-2 text-center tabular-nums"
                    />
                  </td>
                  <td className="hidden px-1.5 py-1.5 tabular-nums @xl/ni:table-cell">{n2(lineNet(l) / l.qty)}</td>
                  <td className="hidden px-1.5 py-1.5 tabular-nums @xl/ni:table-cell">{n2(lineVat(l))}</td>
                  <td className="px-1.5 py-1.5 tabular-nums">{n2(lineTotal(l))}</td>
                  <td className="px-1 py-1.5">
                    <Button variant="ghost" size="icon-sm" aria-label={t("line.removeNamed", { name: b(l.item) })} onClick={() => remove(i)}>
                      <Icon name="trash" size={20} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <AddService onAdd={add} invalid={!!errors.lines} />
        </div>
        {errors.lines && <p className="text-xs text-destructive">{te("lines")}</p>}
      </Card>

      <Card title={t("noteTitle")} description={t("noteText")}>
        <Field label={t("noteLabel")}>
          <Textarea value={f.note} onChange={(e) => patch({ note: e.target.value })} rows={3} />
        </Field>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ summary */

/**
 * Widget / Bill New Invoice Summary: subtotal, VAT, total, who pays the rest (insurer / company), what the patient pays
 * (co-pay with the visit cap: "Patient pays · cap" once the cap applies), and the ZATCA warning. Live.
 */
export function NewInvoiceSummary({ f, className }: { f: NewInvoiceForm; className?: string }) {
  const t = useTranslations("billing.newInvoice.summary")
  const { b, insurerShort } = useBillText()
  const money = useMoney()
  const { ins, inv } = usePreview(f)
  const tt = totals(inv)
  const rates = [...new Set(inv.lines.map((l) => l.vatRate))]
  const rate = rates.length === 1 ? rates[0] : f.vatRule === "standard" ? 0.15 : null
  const company = f.payer === "company" ? COMPANY_ACCOUNTS.find((c) => c.id === f.company) : undefined
  const rows: [string, string][] = [
    [t("subtotal"), money(tt.subtotal)],
    [rate == null ? t("vatMixed") : t("vat", { rate: ltrRun(`${Math.round(rate * 100)}%`) }), money(tt.vat)],
    [t("total"), money(tt.total)],
    ...(ins ? ([[t("insurerPays", { insurer: insurerShort(ins.id) }), money(tt.insurerShare)]] as [string, string][]) : []),
    ...(company ? ([[t("companyPays", { company: b(company.name) }), money(tt.total)]] as [string, string][]) : []),
    [
      ins ? (inv.copay.cap != null && tt.total > 0 && tt.patientShare === inv.copay.cap ? t("patientCap") : t("patientPct", { pct: ltrRun(`${inv.copay.pct}%`) })) : t("patient"),
      money(tt.patientShare),
    ],
  ]
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5", className)}>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("text")}</p>
      </header>
      <div className="flex flex-col">
        {rows.map(([k, v], i) => (
          <div key={k} className={cn("flex items-center gap-3 py-2.5", i < rows.length - 1 && "border-b")}>
            <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{k}</span>
            <span className="min-w-0 flex-1 text-sm text-foreground tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <Note icon="warning-2" tone="warning">
        {t("zatca")}
      </Note>
    </section>
  )
}

/* ------------------------------------------------------------------ page */

/**
 * New invoice (`/billing/invoices/new`, New invoice on the Invoices tab): for anything that didn't come from a visit.
 * Desktop: the form beside the summary (320); tablet and mobile: the summary on top, a fixed action bar on mobile.
 * Save draft keeps it in this session, not reported (`invoice-draft`). Issue invoice reports it to ZATCA and, for insured
 * patients, creates the claim (`invoice-issued`). Only billing staff and the finance manager can issue by hand.
 */
export function NewInvoicePage() {
  const t = useTranslations("billing.newInvoice")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const { insurerShort, ar } = useBillText()
  const router = useRouter()
  const role = useBillRole()
  const draft = useInvoiceDraft()
  const fromDraft = (d: ManualInvoiceInput): NewInvoiceForm => ({ ...blankInvoiceForm(), ...d, visitId: d.visit?.id ?? "" })
  // Opened from a link the session store is already loaded (start from the draft); on a fresh load it arrives after
  // hydration (picked up below).
  const [f, setF] = React.useState<NewInvoiceForm>(() => (draft ? fromDraft(draft) : blankInvoiceForm()))
  const [restored, setRestored] = React.useState(!!draft)
  const [seenDraft, setSeenDraft] = React.useState(draft)
  const [tried, setTried] = React.useState(false)
  const alertRef = React.useRef<HTMLDivElement>(null)
  const allowed = billCan(role, "newInvoice")
  const patch = React.useCallback((p: Partial<NewInvoiceForm>) => setF((x) => ({ ...x, ...p })), [])

  // A saved draft comes back when New invoice opens again (once the session store has loaded on the client).
  if (draft !== seenDraft) {
    setSeenDraft(draft)
    if (draft && !restored) {
      setRestored(true)
      setF(fromDraft(draft))
    }
  }

  const errors = tried ? validateInvoice(f) : {}
  const draftErrors: Errors = tried && !f.patient ? { patient: true } : {}

  const save = () => {
    const input = toInput(f)
    if (!input) {
      setTried(true)
      return
    }
    setRestored(true)
    saveInvoiceDraft(input)
    toast.success(t("draftToast"), { description: t("draftToastText") })
  }

  const issue = () => {
    setTried(true)
    const input = toInput(f)
    if (Object.keys(validateInvoice(f)).length || !input || !allowed) {
      // Form errors stay on the form (field errors + this alert), never in a toast.
      requestAnimationFrame(() => alertRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }))
      return
    }
    const ins = input.payer === "insurance" && input.insurer ? getInsurer(input.insurer) : undefined
    const no = nextInvoiceNo(getInvoices().map((x) => x.no), BILL_NOW)
    const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-inv`
    const inv = buildManualInvoice(input, ins, { no, at: BILL_NOW, uuid })
    const claim = ins && totals(inv).insurerShare > 0 ? manualClaim(inv, ins, { no: nextClaimNo(getClaims().map((c) => c.no), BILL_NOW), at: BILL_NOW }) : undefined
    saveManualInvoice(claim ? { ...inv, claimNo: claim.no } : inv, claim)
    router.push(invoiceHref(no))
    // ZATCA reports it; the toast says "reported" only once the API has confirmed.
    const toInsurer = ins ? (ar ? `ل${insurerShort(ins.id).replace(/^ال/, "ل")}` : insurerShort(ins.id)) : ""
    zatca
      .report(zatcaRequest(inv), inv.zatca.type)
      .then((res) => {
        const cur = getInvoice(no)
        if (cur) saveInvoice(applyZatca(cur, res, BILL_NOW))
        toast.success(t("issuedToast"), {
          description: (
            <bdi>
              {!claim
                ? t("issuedText", { no: ltrRun(no) })
                : claim.status === "needsPreauth"
                  ? t("issuedPreauth", { no: ltrRun(no), insurer: insurerShort(ins!.id), toInsurer })
                  : t("issuedClaim", { no: ltrRun(no), insurer: insurerShort(ins!.id), toInsurer })}
            </bdi>
          ),
        })
      })
      .catch(() => toast.warning(t("zatcaFailed"), { description: t("zatcaFailedText") }))
  }

  const actions = (
    <>
      <Button variant="outline" onClick={save} className="max-md:flex-1">
        {t("saveDraft")}
      </Button>
      <Button onClick={issue} disabled={!allowed} className="max-md:flex-1">
        {t("issue")}
      </Button>
    </>
  )
  const shown = Object.keys(errors).length ? errors : draftErrors

  return (
    <>
      <PageTitle
        title={t("title")}
        crumbs={[
          { label: tn("billing"), href: "/billing" },
          { label: tt("invoices"), href: INVOICES_HREF },
        ]}
        back={INVOICES_HREF}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={INVOICES_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("title")}</h1>
      </div>
      <PageContainer className="pb-24 md:pb-8">
        <PageHeader className="max-md:hidden" actions={actions} />
        <div className="grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <NewInvoiceSummary f={f} className="xl:sticky xl:top-20 xl:order-2" />
          <div className="flex flex-col gap-4 xl:order-1">
            {!allowed && <Strip tone="info" icon="info-circle">{t("onlyBilling")}</Strip>}
            {Object.keys(shown).length > 0 && (
              <div ref={alertRef}>
                <Strip tone="destructive" icon="warning-2">
                  {t("error.summary")}
                </Strip>
              </div>
            )}
            <NewInvoiceFormCards f={f} patch={patch} errors={shown} />
          </div>
        </div>
      </PageContainer>
      <MobileActionBar>{actions}</MobileActionBar>
    </>
  )
}
