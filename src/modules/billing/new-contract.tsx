"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { Combobox, DatePicker } from "@/components/ds/pickers"
import { toast } from "@/components/ds/toast"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  BILL_TODAY,
  CENTER,
  CLAUSES,
  PARTY_CANDIDATES,
  PRICING_OPTIONS,
  STAFF,
  TEMPLATES,
  type BillDocument,
  type Clause,
  type Contract,
  type ContractKind,
  type PartyCandidate,
  type Signer,
} from "./data"
import { CONTRACTS_HREF, contractHref } from "./href"
import { formatMoney } from "./money"
import { InitialsAvatar, InitialsTile, ltrRun, useSoon } from "./parts"
import { canDraft, type BillRole } from "./roles"
import { MAX_WEEK_HOURS, monthlyPay } from "./rules"
import { addContract, getContracts, useBillRole } from "./store"
import { Strip } from "./claim-dialogs"
import { useBillText } from "./text"

/* ------------------------------------------------------------------ form model */

type ClauseRow = { key: string; title: { en: string; ar: string }; on: boolean; custom?: boolean }

export type ContractForm = {
  kind: ContractKind
  partyId: string | null
  contactName: string
  mobile: string
  template: string
  start: string
  end: string
  autoRenew: boolean
  noticeDays: number
  // partner
  pricing: string
  payDays: number
  serviceLevel: string
  // staff
  jobTitle: string
  department: string
  basic: string
  housing: string
  transport: string
  allowance: string
  probationDays: number
  hours: string
  leaveDays: number
  // insurer
  discount: string
  copay: string
  cap: string
  preauthAbove: string
  imaging: boolean
  claimDays: number
  insurerPays: number
  clauses: ClauseRow[]
  papers: BillDocument[]
  /** Party signer first (by default), the center's signatory after; removable. */
  signers: ("party" | "center")[]
  nafath: boolean
}

const addMonths = (iso: string, m: number) => {
  const [y, mo] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + m]
  return `${y + Math.floor(mo / 12)}-${String((mo % 12) + 1).padStart(2, "0")}-01`
}
const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T12:00`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
/** Contracts start on the 1st of next month by default (design: 01/12/2026 – 30/11/2027). */
const NEXT_MONTH = addMonths(BILL_TODAY, 1)

/** "Filled from the template": the terms each template starts with. */
function templateDefaults(kind: ContractKind, template: string, locale = "en"): Partial<ContractForm> {
  if (kind === "staff")
    return {
      start: NEXT_MONTH,
      end: dayBefore(addMonths(NEXT_MONTH, template === "staff-locum" ? 6 : 24)),
      autoRenew: template !== "staff-locum",
      noticeDays: 60,
      probationDays: template === "staff-locum" ? 0 : 90,
      hours: "48",
      leaveDays: 30,
    }
  if (kind === "insurer")
    return { start: NEXT_MONTH, end: dayBefore(addMonths(NEXT_MONTH, 24)), autoRenew: true, noticeDays: 90, discount: "10", copay: "10", cap: "", preauthAbove: "1000", imaging: true, claimDays: 30, insurerPays: 45 }
  return {
    start: NEXT_MONTH,
    end: dayBefore(addMonths(NEXT_MONTH, 12)),
    autoRenew: true,
    noticeDays: 60,
    pricing: template === "partner-services" ? "monthly" : template === "partner-dental-lab" ? "fixed" : "less10",
    payDays: 30,
    serviceLevel: template === "partner-reference-lab" ? (locale === "ar" ? "48 ساعة للتحاليل العادية" : "48 h for routine tests") : "",
  }
}

const clauseRows = (kind: ContractKind): ClauseRow[] =>
  CLAUSES[kind].map((c) => ({ key: c.key, title: { ...c.title }, on: !(kind === "partner" && c.key === "nonCompete") }))

export function blankForm(kind: ContractKind, locale = "en"): ContractForm {
  const template = TEMPLATES[kind][0].key
  return {
    kind,
    partyId: null,
    contactName: "",
    mobile: "",
    template,
    start: "",
    end: "",
    autoRenew: true,
    noticeDays: 60,
    pricing: "",
    payDays: 30,
    serviceLevel: "",
    jobTitle: "",
    department: "",
    basic: "",
    housing: "",
    transport: "",
    allowance: "",
    probationDays: 90,
    hours: "48",
    leaveDays: 30,
    discount: "",
    copay: "",
    cap: "",
    preauthAbove: "",
    imaging: true,
    claimDays: 30,
    insurerPays: 45,
    clauses: clauseRows(kind),
    papers: [],
    signers: ["center"],
    nafath: true,
    ...templateDefaults(kind, template, locale),
  }
}

const candidateOf = (f: Pick<ContractForm, "kind" | "partyId">): PartyCandidate | undefined => PARTY_CANDIDATES[f.kind].find((p) => p.id === f.partyId)
/** "Majed Al-Ghamdi · CEO": what the user typed, else the party's registered contact in the reader's language. */
export function contactText(f: Pick<ContractForm, "kind" | "partyId" | "contactName">, b: (v: { en: string; ar: string }) => string) {
  if (f.contactName.trim()) return f.contactName
  const c = candidateOf(f)?.contact
  return c ? `${b(c.name)} · ${b(c.role)}` : ""
}
/** "MG" for Majed Al-Ghamdi: first letters of the first and last name, without the "Al-" article. */
export const initialsOf = (name: string) => {
  const w = name.replace(/^(Dr\.|د\.)\s*/, "").split(/\s+/).filter(Boolean)
  const last = (w.at(-1) ?? "").replace(/^(Al-|ال)/, "")
  return `${w[0]?.[0] ?? ""}${w.length > 1 ? (last[0] ?? "") : ""}`.toUpperCase()
}
const toNum = (s: string) => Number(s.replace(/,/g, "")) || 0
const mobileOk = (s: string) => /^\+966\d{8,9}$/.test(s.replace(/\s/g, ""))

type Errors = Partial<Record<"party" | "contact" | "mobile" | "template" | "pricing" | "starts" | "ends" | "basic" | "hours" | "signers", true>>

/** Required fields and the Labor Law cap; Save draft needs only a type (and a party to name it). */
export function validate(f: ContractForm): Errors {
  const e: Errors = {}
  if (!f.partyId) e.party = true
  if (f.kind !== "staff" && !f.contactName.trim() && !candidateOf(f)?.contact) e.contact = true
  if (!mobileOk(f.mobile)) e.mobile = true
  if (!f.template) e.template = true
  if (f.kind === "partner" && !f.pricing) e.pricing = true
  if (!f.start) e.starts = true
  if (!f.end || (f.start && f.end <= f.start)) e.ends = true
  if (f.kind === "staff" && toNum(f.basic) <= 0) e.basic = true
  if (f.kind === "staff" && (toNum(f.hours) <= 0 || toNum(f.hours) > MAX_WEEK_HOURS)) e.hours = true
  if (!(f.signers.includes("party") && f.signers.includes("center"))) e.signers = true
  return e
}

/** The next free contract no. for the year (CTR-26-032 after CTR-26-031). */
export function nextContractNo(list: Contract[]) {
  const yy = BILL_TODAY.slice(2, 4)
  const max = Math.max(0, ...list.filter((c) => c.no.startsWith(`CTR-${yy}-`)).map((c) => Number(c.no.slice(-3))))
  return `CTR-${yy}-${String(max + 1).padStart(3, "0")}`
}

const faisalSigner = (order: number): Signer => ({
  order,
  initials: "FQ",
  name: STAFF.faisal.name,
  role: STAFF.faisal.role,
  side: "center",
  signatory: "faisal",
  mobile: "+966 50 100 2482",
  nationalId: "1029384482",
  status: "waiting",
  method: "nafath",
})

/** The form as a Contract (draft or sent). */
export function buildContract(f: ContractForm, no: string, sent: boolean): Contract {
  const p = candidateOf(f)!
  const kindDetail = {
    staff: f.template === "staff-locum" ? { en: "locum", ar: "تعاقد مؤقت" } : { en: "employment", ar: "عقد عمل" },
    partner: p.role,
    insurer: { en: "provider agreement", ar: "اتفاقية مقدم خدمة" },
  }[f.kind]
  const partySigner: Signer = {
    order: 0,
    initials: p.kind === "employee" ? p.initials : initialsOf(f.contactName.trim() ? f.contactName.split(" · ")[0] : (p.contact?.name.en ?? p.name.en)),
    name: p.kind === "employee" ? p.name : f.contactName.trim() ? { en: f.contactName.split(" · ")[0], ar: f.contactName.split(" · ")[0] } : (p.contact?.name ?? p.name),
    role: p.kind === "employee" ? { en: "Employee", ar: p.female ? "الموظفة" : "الموظف" } : { en: `${p.short?.en ?? p.name.en} · ${p.contact?.role.en ?? ""}`, ar: `${p.short?.ar ?? p.name.ar} · ${p.contact?.role.ar ?? ""}` },
    female: p.kind === "employee" ? p.female : p.contact?.female,
    side: "party",
    mobile: f.mobile,
    nationalId: p.contactNationalId,
    status: "waiting",
    method: "nafath",
  }
  const signers = f.signers.map((s, i) => (s === "party" ? { ...partySigner, order: i + 1 } : faisalSigner(i + 1)))
  const clauses: Clause[] = f.clauses.filter((c) => c.on && c.title.en.trim()).map((c) => ({ key: c.key, title: c.title, text: c.custom ? c.title : { en: "", ar: "" } }))
  return {
    no,
    kind: f.kind,
    kindDetail,
    party: { ...p, contact: p.contact ? { ...p.contact, mobile: f.mobile } : undefined },
    template: f.template,
    version: 1,
    draftedAt: BILL_TODAY,
    draftedBy: "nora",
    department: f.department ? { en: f.department, ar: f.department } : undefined,
    start: f.start,
    end: f.end,
    autoRenew: f.autoRenew,
    noticeDays: f.noticeDays,
    terms: {
      staff:
        f.kind === "staff"
          ? {
              basic: toNum(f.basic),
              housing: toNum(f.housing),
              transport: toNum(f.transport),
              allowances: toNum(f.allowance) ? [{ label: { en: "allowances", ar: "بدلات" }, amount: toNum(f.allowance) }] : [],
              probationDays: f.probationDays,
              hoursPerWeek: toNum(f.hours),
              leaveDays: f.leaveDays,
              payDay: 27,
            }
          : undefined,
      partner:
        f.kind === "partner"
          ? {
              pricing: PRICING_OPTIONS.find((o) => o.key === f.pricing)?.label ?? { en: f.pricing, ar: f.pricing },
              paymentDays: f.payDays,
              serviceLevel: f.serviceLevel ? { en: f.serviceLevel, ar: f.serviceLevel } : undefined,
            }
          : undefined,
      insurer:
        f.kind === "insurer"
          ? {
              discountPct: toNum(f.discount),
              copayPct: toNum(f.copay),
              capPerVisit: toNum(f.cap) || undefined,
              preauthAbove: toNum(f.preauthAbove) || undefined,
              preauthImaging: f.imaging,
              paymentDays: f.insurerPays,
              claimDeadlineDays: f.claimDays,
            }
          : undefined,
    },
    clauses,
    files: f.papers,
    signers,
    sent,
    sentAt: sent ? BILL_TODAY : undefined,
    locked: false,
    pages: 4,
    verifyCode: `CTR-${no.slice(-3)}X`,
    events: [{ at: BILL_TODAY, kind: "drafted", who: STAFF.nora.name }, ...(sent ? [{ at: BILL_TODAY, kind: "sent" as const, who: signers[0]?.name }] : [])],
  }
}

/* ------------------------------------------------------------------ sections */

function Card({ title, description, action, children, className }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 @xl/nc:p-6", className)}>
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

const Row = ({ children }: { children: React.ReactNode }) => <div className="grid gap-4 @xl/nc:grid-cols-2 @xl/nc:gap-3">{children}</div>

const KIND_ICON: Record<ContractKind, IconName> = { staff: "profile-2user", partner: "briefcase", insurer: "shield-tick" }

function TypeCards({ f, set, role }: { f: ContractForm; set: (k: ContractKind) => void; role: BillRole }) {
  const t = useTranslations("billing.newContract")
  return (
    <Card title={t("type")} description={t("typeText")}>
      <RadioGroupPrimitive.Root value={f.kind} onValueChange={(v) => set(v as ContractKind)} className="grid gap-2.5 @xl/nc:grid-cols-3" aria-label={t("type")}>
        {(["staff", "partner", "insurer"] as ContractKind[]).map((k) => (
          <RadioGroupPrimitive.Item
            key={k}
            value={k}
            disabled={!canDraft(role, k)}
            className="group/radio flex items-center gap-2.5 rounded-[10px] border bg-card p-3 text-start transition-colors outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-accent"
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]/radio:border-primary">
              <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
            </span>
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground group-data-[state=checked]/radio:bg-card group-data-[state=checked]/radio:text-primary">
              <Icon name={KIND_ICON[k]} size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm text-foreground">{t(`kind.${k}`)}</span>
              <span className="text-xs text-muted-foreground">{t(`kind.${k}Text`)}</span>
            </span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </Card>
  )
}

function PartySection({ f, patch, errors }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void; errors: Errors }) {
  const t = useTranslations("billing.newContract")
  const te = useTranslations("billing.newContract.error")
  const { b, date } = useBillText()
  const p = candidateOf(f)
  const pick = (id: string) => {
    const c = PARTY_CANDIDATES[f.kind].find((x) => x.id === id)
    if (!c) return
    patch({
      partyId: id,
      contactName: "",
      mobile: c.contact?.mobile ?? c.mobile,
      jobTitle: c.kind === "employee" ? b(c.role) : f.jobTitle,
      signers: f.signers.includes("party") ? f.signers : ["party", ...f.signers],
    })
  }
  return (
    <Card title={t(`party.${f.kind}`)} description={t(`partySearch.${f.kind}`)}>
      {p ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-primary bg-accent p-3">
          {p.kind === "company" ? <InitialsTile initials={p.initials} className="bg-card" /> : <InitialsAvatar initials={p.initials} size={40} className="bg-card" />}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm text-foreground">{b(p.name)}</span>
            <span className="text-xs text-muted-foreground">
              <bdi>
                {p.kind === "company"
                  ? t("companyLine", { role: b(p.role), cr: ltrRun(p.cr ?? "—"), city: p.city ? b(p.city) : "" })
                  : t("employeeLine", { role: b(p.role), licence: ltrRun(p.licence?.no ?? "—") })}
              </bdi>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("change", { name: b(p.name) })}
            onClick={() => patch({ partyId: null, contactName: "", mobile: "", signers: f.signers.filter((s) => s !== "party") })}
          >
            <Icon name="close-circle" size={24} />
          </Button>
        </div>
      ) : (
        <Field label={t(`party.${f.kind}`)} required error={errors.party ? te("party") : undefined}>
          {(fp) => (
            <Combobox
              {...fp}
              options={PARTY_CANDIDATES[f.kind].map((c) => ({ value: c.id, label: `${b(c.name)} · ${c.cr ?? c.nationalId ?? ""}` }))}
              value={undefined}
              onChange={pick}
              placeholder={t("partyPick")}
              searchPlaceholder={t(`partySearch.${f.kind}`)}
              emptyText={t("partyEmpty")}
              className="w-full"
            />
          )}
        </Field>
      )}
      <Row>
        {f.kind === "staff" ? (
          <Field label={t("licence")}>
            <Input readOnly value={p?.licence ? `${p.licence.no} · ${date(p.licence.validTo)}` : ""} dir="ltr" />
          </Field>
        ) : (
          <Field label={t("contact")} required error={errors.contact ? te("contact") : undefined}>
            <Input value={contactText(f, b)} onChange={(e) => patch({ contactName: e.target.value })} />
          </Field>
        )}
        <Field label={t("mobile")} required error={errors.mobile ? te("mobile") : undefined}>
          <Input dir="ltr" inputMode="tel" value={f.mobile} onChange={(e) => patch({ mobile: e.target.value })} startIcon={<Icon name="call" size={20} className="text-muted-foreground" />} />
        </Field>
      </Row>
    </Card>
  )
}

function SelectField({ label, value, onChange, options, required, error }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean; error?: string }) {
  return (
    <Field label={label} required={required} error={error}>
      {(fp) => (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger {...fp} className="w-full">
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
}

function NumberInput({ value, onChange, unit }: { value: string; onChange: (v: string) => void; unit?: string }) {
  return (
    <Input
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
      end={unit ? <span className="shrink-0 text-sm text-muted-foreground">{unit}</span> : undefined}
      className="tabular-nums"
    />
  )
}

function TermsSection({ f, patch, errors }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void; errors: Errors }) {
  const t = useTranslations("billing.newContract")
  const te = useTranslations("billing.newContract.error")
  const { b, ar, locale } = useBillText()
  const sar = ar ? "ر.س" : "SAR"
  const toDate = (iso: string) => (iso ? new Date(`${iso}T12:00`) : undefined)
  const fromDate = (d: Date | undefined) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : ""
  const days = (ns: number[], key: "payWithinValue" | "daysUnit") => ns.map((n) => ({ value: String(n), label: t(key, { n }) }))
  const pay = f.kind === "staff" ? monthlyPay({ basic: toNum(f.basic), housing: toNum(f.housing), transport: toNum(f.transport), allowances: [{ amount: toNum(f.allowance) }] }) : 0

  return (
    <Card title={t("terms")} description={t("termsText")}>
      <Row>
        <SelectField
          label={t("template")}
          required
          value={f.template}
          onChange={(v) => patch({ template: v, ...templateDefaults(f.kind, v, locale) })}
          options={TEMPLATES[f.kind].map((x) => ({ value: x.key, label: b(x.label) }))}
          error={errors.template ? te("template") : undefined}
        />
        {f.kind === "partner" && (
          <SelectField
            label={t("pricing")}
            required
            value={f.pricing}
            onChange={(v) => patch({ pricing: v })}
            options={PRICING_OPTIONS.map((x) => ({ value: x.key, label: b(x.label) }))}
            error={errors.pricing ? te("pricing") : undefined}
          />
        )}
        {f.kind === "staff" && (
          <Field label={t("jobTitle")}>
            <Input value={f.jobTitle} onChange={(e) => patch({ jobTitle: e.target.value })} />
          </Field>
        )}
        {f.kind === "insurer" && (
          <Field label={t("discount")}>
            <NumberInput value={f.discount} onChange={(v) => patch({ discount: v })} unit="%" />
          </Field>
        )}
      </Row>
      <Row>
        <Field label={t("starts")} required error={errors.starts ? te("starts") : undefined}>
          {(fp) => <DatePicker {...fp} value={toDate(f.start)} onChange={(d) => patch({ start: fromDate(d) })} placeholder={t("pickDate")} className="w-full" />}
        </Field>
        <Field label={t("ends")} required error={errors.ends ? te("ends") : undefined}>
          {(fp) => <DatePicker {...fp} value={toDate(f.end)} onChange={(d) => patch({ end: fromDate(d) })} placeholder={t("pickDate")} className="w-full" />}
        </Field>
      </Row>

      {f.kind === "partner" && (
        <Row>
          <SelectField label={t("payWithin")} value={String(f.payDays)} onChange={(v) => patch({ payDays: Number(v) })} options={days([30, 45, 60], "payWithinValue")} />
          <Field label={t("resultsWithin")}>
            <Input value={f.serviceLevel} onChange={(e) => patch({ serviceLevel: e.target.value })} />
          </Field>
        </Row>
      )}

      {f.kind === "staff" && (
        <>
          <Row>
            <Field label={t("department")}>
              <Input value={f.department} onChange={(e) => patch({ department: e.target.value })} />
            </Field>
            <SelectField label={t("probation")} value={String(f.probationDays)} onChange={(v) => patch({ probationDays: Number(v) })} options={days([0, 90, 180], "daysUnit")} />
          </Row>
          <Row>
            <Field label={t("basic")} required error={errors.basic ? te("basic") : undefined}>
              <NumberInput value={f.basic} onChange={(v) => patch({ basic: v })} unit={sar} />
            </Field>
            <Field label={t("housing")}>
              <NumberInput value={f.housing} onChange={(v) => patch({ housing: v })} unit={sar} />
            </Field>
          </Row>
          <Row>
            <Field label={t("transport")}>
              <NumberInput value={f.transport} onChange={(v) => patch({ transport: v })} unit={sar} />
            </Field>
            <Field label={t("allowance")} helper={pay ? t("monthly", { amount: formatMoney(pay, locale, { whole: true }) }) : undefined}>
              <NumberInput value={f.allowance} onChange={(v) => patch({ allowance: v })} unit={sar} />
            </Field>
          </Row>
          <Row>
            <Field label={t("hours")} required error={errors.hours ? te("hours") : undefined}>
              <NumberInput value={f.hours} onChange={(v) => patch({ hours: v })} />
            </Field>
            <SelectField label={t("leave")} value={String(f.leaveDays)} onChange={(v) => patch({ leaveDays: Number(v) })} options={days([21, 30], "daysUnit")} />
          </Row>
        </>
      )}

      {f.kind === "insurer" && (
        <>
          <Row>
            <Field label={t("copay")}>
              <NumberInput value={f.copay} onChange={(v) => patch({ copay: v })} unit="%" />
            </Field>
            <Field label={t("cap")}>
              <NumberInput value={f.cap} onChange={(v) => patch({ cap: v })} unit={sar} />
            </Field>
          </Row>
          <Row>
            <Field label={t("preauthAbove")}>
              <NumberInput value={f.preauthAbove} onChange={(v) => patch({ preauthAbove: v })} unit={sar} />
            </Field>
            <SelectField label={t("claimDays")} value={String(f.claimDays)} onChange={(v) => patch({ claimDays: Number(v) })} options={days([15, 30, 60], "daysUnit")} />
          </Row>
          <Row>
            <SelectField label={t("insurerPays")} value={String(f.insurerPays)} onChange={(v) => patch({ insurerPays: Number(v) })} options={days([30, 45, 60], "daysUnit")} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox checked={f.imaging} onCheckedChange={(v) => patch({ imaging: v === true })} />
              {t("imaging")}
            </label>
          </Row>
        </>
      )}

      <SwitchRow label={t("renews")} hint={t("renewsText", { n: f.noticeDays })} checked={f.autoRenew} onCheckedChange={(v) => patch({ autoRenew: v })} />
    </Card>
  )
}

function SwitchRow({ label, hint, checked, onCheckedChange }: { label: string; hint: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-3 rounded-[10px] border p-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function ClausesSection({ f, patch }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void }) {
  const t = useTranslations("billing.newContract")
  const { b } = useBillText()
  const on = f.clauses.filter((c) => c.on).length
  const set = (i: number, c: Partial<ClauseRow>) => patch({ clauses: f.clauses.map((x, j) => (j === i ? { ...x, ...c } : x)) })
  return (
    <Card
      title={t("clauses")}
      description={t("clausesText", { n: on, total: f.clauses.length })}
      action={
        <Button variant="ghost" size="sm" onClick={() => patch({ clauses: [...f.clauses, { key: `custom-${f.clauses.length}`, title: { en: "", ar: "" }, on: true, custom: true }] })}>
          <Icon name="add" size={20} />
          {t("addClause")}
        </Button>
      }
    >
      <ul className="flex flex-col gap-3">
        {f.clauses.map((c, i) => (
          <li key={c.key} className="flex items-center gap-2">
            <Checkbox checked={c.on} onCheckedChange={(v) => set(i, { on: v === true })} aria-label={c.custom ? t("newClause") : b(c.title)} id={`clause-${c.key}`} />
            {c.custom ? (
              <>
                <Input
                  autoFocus
                  value={c.title.en}
                  placeholder={t("newClause")}
                  onChange={(e) => set(i, { title: { en: e.target.value, ar: e.target.value } })}
                  className="h-8 flex-1"
                />
                <Button variant="ghost" size="icon-sm" aria-label={t("removeClause")} onClick={() => patch({ clauses: f.clauses.filter((_, j) => j !== i) })}>
                  <Icon name="trash" size={20} />
                </Button>
              </>
            ) : (
              <label htmlFor={`clause-${c.key}`} className="cursor-pointer text-sm text-foreground">
                {b(c.title)}
              </label>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

function PapersSection({ f, patch }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void }) {
  const t = useTranslations("billing.newContract")
  const { b, date } = useBillText()
  const input = React.useRef<HTMLInputElement>(null)
  const add = (files: FileList | null) => {
    if (!files?.length) return
    const docs: BillDocument[] = [...files].map((file, i) => {
      const ext = (file.name.split(".").pop() ?? "pdf").toUpperCase()
      const name = file.name.replace(/\.[^.]+$/, "")
      return {
        id: `new-${Date.now()}-${i}`,
        kind: "other",
        title: { en: name, ar: name },
        file: file.name,
        format: ext.startsWith("XLS") ? "XLSX" : ext.startsWith("DOC") ? "DOCX" : "PDF",
        detail: { en: kb(file.size), ar: kb(file.size) },
        status: "valid",
        version: 1,
      }
    })
    patch({ papers: [...f.papers, ...docs] })
  }
  return (
    <Card title={t("papers")} description={t("papersText")}>
      {f.papers.length > 0 && (
        <ul className="flex flex-col">
          {f.papers.map((d, i) => (
            <li key={d.id} className="flex items-center gap-3 border-b py-3 first:pt-0 last:border-b-0">
              <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon name="document-text" size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm text-foreground">{b(d.title)}</span>
                <span dir="ltr" className="text-xs text-muted-foreground rtl:text-end">
                  {[d.format, d.detail?.en, d.validTo ? date(d.validTo) : ""].filter(Boolean).join(" · ")}
                </span>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={t("removeFile", { name: b(d.title) })} onClick={() => patch({ papers: f.papers.filter((_, j) => j !== i) })}>
                <Icon name="trash" size={20} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          add(e.dataTransfer.files)
        }}
        className="flex h-12 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed bg-muted text-xs text-foreground outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon name="document-upload" size={20} className="text-primary" />
        {t("drop")}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ""
        }}
      />
    </Card>
  )
}

function SignersSection({ f, patch, errors }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void; errors: Errors }) {
  const t = useTranslations("billing.newContract")
  const te = useTranslations("billing.newContract.error")
  const { b } = useBillText()
  const soon = useSoon()
  const p = candidateOf(f)
  const addSigner = () => {
    // Re-add a removed default signer (the other side, then the center); anyone else needs the signer picker (gap).
    if (p && !f.signers.includes("party")) patch({ signers: ["party", ...f.signers] })
    else if (!f.signers.includes("center")) patch({ signers: [...f.signers, "center"] })
    else soon()
  }
  return (
    <Card
      title={t("signers")}
      description={t("signersText")}
      action={
        <Button variant="ghost" size="sm" onClick={addSigner}>
          <Icon name="user-add" size={24} />
          {t("addSigner")}
        </Button>
      }
    >
      <ol className="flex flex-col gap-3">
        {f.signers.map((s, i) => {
          const isParty = s === "party"
          if (isParty && !p) return null
          const contact = contactText(f, b)
          const name = isParty ? (p!.kind === "employee" ? b(p!.name) : contact.split(" · ")[0] || b(p!.name)) : b(STAFF.faisal.name)
          const initials = isParty ? (p!.kind === "employee" ? p!.initials : initialsOf(isParty && p!.contact && !f.contactName.trim() ? p!.contact.name.en : name)) : "FQ"
          return (
            <li key={s} className="flex items-center gap-2.5 rounded-[10px] border p-3">
              <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                {i + 1}
              </span>
              <InitialsAvatar initials={initials} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{name}</span>
                <span className="text-xs text-muted-foreground">
                  <bdi>
                    {isParty
                      ? t("signerLine", {
                          org: p!.kind === "employee" ? b(p!.role) : b(p!.short ?? p!.name),
                          role: p!.kind === "employee" ? t("party.staff") : (contact.split(" · ")[1] ?? b(p!.contact?.role ?? p!.role)),
                          mobile: ltrRun(f.mobile || "—"),
                        })
                      : t("signerYou", { org: b(CENTER.short), role: b(STAFF.faisal.role) })}
                  </bdi>
                </span>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={t("removeSigner", { name })} onClick={() => patch({ signers: f.signers.filter((x) => x !== s) })}>
                <Icon name="trash" size={20} />
              </Button>
            </li>
          )
        })}
      </ol>
      {errors.signers && <p className="text-xs text-destructive">{te("signers")}</p>}
      <SwitchRow label={t("nafath")} hint={t("nafathText")} checked={f.nafath} onCheckedChange={(v) => patch({ nafath: v })} />
    </Card>
  )
}

/* ------------------------------------------------------------------ summary */

/** Widget / New Contract Summary: "Before you send" — kind, party, term, pricing / pay / discount, clauses, papers, signers, who signs first. */
export function ContractSummary({ f, className }: { f: ContractForm; className?: string }) {
  const t = useTranslations("billing.newContract.summary")
  const { b, locale } = useBillText()
  const p = candidateOf(f)
  const months = f.start && f.end > f.start ? (Number(f.end.slice(0, 4)) - Number(f.start.slice(0, 4))) * 12 + (Number(f.end.slice(5, 7)) - Number(f.start.slice(5, 7))) + 1 : 0
  const renews = f.autoRenew ? "yes" : "no"
  const term = !months ? t("none") : months % 12 === 0 ? t("termValue", { n: months / 12, renews }) : t("termMonths", { n: months, renews })
  const money =
    f.kind === "partner"
      ? [t("pricing"), PRICING_OPTIONS.find((o) => o.key === f.pricing) ? b(PRICING_OPTIONS.find((o) => o.key === f.pricing)!.label).replace(/^Their price list/, "Their list").replace(/^قائمة أسعارهم/, "أسعارهم") : t("none")]
      : f.kind === "staff"
        ? [t("pay"), toNum(f.basic) ? formatMoney(monthlyPay({ basic: toNum(f.basic), housing: toNum(f.housing), transport: toNum(f.transport), allowances: [{ amount: toNum(f.allowance) }] }), locale, { whole: true }) : t("none")]
        : [t("discount"), f.discount ? ltrRun(`${f.discount}%`) : t("none")]
  const first = f.signers[0]
  const firstName = p && first === "party" ? (p.kind === "employee" ? b(p.short ?? p.name) : (contactText(f, b).split(" · ")[0] || b(p.name)).split(" ")[0]) : ""
  const firstFemale = p ? (p.kind === "employee" ? p.female : p.contact?.female) : false
  const rows: [string, React.ReactNode][] = [
    [t(`party.${f.kind}`), p ? b(p.name) : t("none")],
    [t("term"), term],
    [money[0], <bdi key="m">{money[1]}</bdi>],
    [t("clauses"), String(f.clauses.filter((c) => c.on && (!c.custom || c.title.en.trim())).length)],
    [t("papers"), t("papersValue", { n: f.papers.length })],
    [t("signers"), t("signersValue", { n: f.signers.length, nafath: f.nafath ? "yes" : "no" })],
  ]
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5", className)}>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t(`kind.${f.kind}`)}</p>
      </header>
      <div className="flex flex-col">
        {rows.map(([k, v], i) => (
          <div key={i} className={cn("flex items-start gap-3 py-2.5", i < rows.length - 1 && "border-b")}>
            <span className="w-[140px] shrink-0 pt-0.5 text-xs text-muted-foreground xl:w-[136px]">{k}</span>
            <span className="min-w-0 flex-1 text-sm text-foreground">{v}</span>
          </div>
        ))}
      </div>
      {p && f.signers.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          <span>
            {first === "party" ? t("first", { name: firstName, g: firstFemale ? "female" : "male" }) : t("firstYou", { name: b(p.kind === "employee" ? (p.short ?? p.name) : (p.contact?.name ?? p.name)) })}
          </span>
        </p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ page */

/** The New contract form state; `initial` prefills it (dev stories: the drawn Partner state). */
export function useContractForm(kind: ContractKind, initial?: Partial<ContractForm>) {
  const locale = useLocale()
  const [f, setF] = React.useState<ContractForm>(() => ({ ...blankForm(kind, locale), ...initial }))
  const patch = React.useCallback((p: Partial<ContractForm>) => setF((x) => ({ ...x, ...p })), [])
  const setKind = (k: ContractKind) => setF(blankForm(k, locale))
  return { f, patch, setKind }
}

/** The form's cards (type → party → terms → clauses → papers → who signs). */
export function ContractFormCards({ f, patch, setKind, errors, role }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void; setKind: (k: ContractKind) => void; errors: Errors; role: BillRole }) {
  return (
    <div className="@container/nc flex flex-col gap-4 md:gap-6">
      <TypeCards f={f} set={setKind} role={role} />
      <PartySection f={f} patch={patch} errors={errors} />
      <TermsSection f={f} patch={patch} errors={errors} />
      <ClausesSection f={f} patch={patch} />
      <PapersSection f={f} patch={patch} />
      <SignersSection f={f} patch={patch} errors={errors} />
    </div>
  )
}

/**
 * New contract (`/billing/contracts/new?kind=partner`): header Back · "Billing / Contracts" over "New contract"; actions
 * Save draft · Send for signature (mobile: a fixed action bar). The type radio cards drive the template list, the party
 * picker (employee vs company by CR) and the fields. Desktop: the form beside the "Before you send" card; tablet and
 * mobile: the card on top. Save draft → draft-saved toast; Send for signature → sent-for-signature toast and the
 * contract page.
 */
export function NewContractPage() {
  const t = useTranslations("billing.newContract")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const tc = useTranslations("billing.contracts")
  const { b } = useBillText()
  const router = useRouter()
  const role = useBillRole()
  const soon = useSoon()
  const params = useSearchParams()
  const asked = params.get("kind") as ContractKind | null
  const firstAllowed = (["partner", "staff", "insurer"] as ContractKind[]).find((k) => canDraft(role, k)) ?? "partner"
  const kind = asked && ["staff", "partner", "insurer"].includes(asked) && canDraft(role, asked) ? asked : firstAllowed
  const { f, patch, setKind } = useContractForm(kind)
  const [tried, setTried] = React.useState(false)
  const [draftNo, setDraftNo] = React.useState<string | null>(null)
  const errors = tried ? validate(f) : {}
  const alertRef = React.useRef<HTMLDivElement>(null)
  const allowed = canDraft(role, f.kind)

  const save = () => {
    if (!f.partyId) {
      setTried(true)
      return
    }
    const no = draftNo ?? nextContractNo(getContracts())
    addContract(buildContract(f, no, false))
    setDraftNo(no)
    toast.success(t("draftToast"), { description: t("draftToastText") })
  }
  const send = () => {
    setTried(true)
    const e = validate(f)
    if (Object.keys(e).length) {
      // Form errors stay on the form (field errors + this alert), never in a toast.
      requestAnimationFrame(() => alertRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }))
      return
    }
    const no = draftNo ?? nextContractNo(getContracts())
    const c = buildContract(f, no, true)
    addContract(c)
    toast.success(t("sentToast"), { description: t("sentToastText", { name: b(c.signers[0].name) }) })
    router.push(contractHref(no))
  }

  const actions = (
    <>
      <Button variant="outline" onClick={save} disabled={!allowed}>
        {t("saveDraft")}
      </Button>
      <Button onClick={send} disabled={!allowed}>
        <Icon name="send-2" size={24} />
        {t("send")}
      </Button>
    </>
  )

  return (
    <>
      <PageTitle
        title={t("title")}
        crumbs={[
          { label: tn("billing"), href: "/billing" },
          { label: tt("contracts"), href: CONTRACTS_HREF },
        ]}
        back={CONTRACTS_HREF}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={CONTRACTS_HREF} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("title")}</h1>
        <ActionMenu
          title={t("title")}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[[{ key: "templates", icon: "note-2", label: tc("templates"), onSelect: soon }]]}
        />
      </div>
      <PageContainer className="pb-24 md:pb-8">
        <PageHeader className="max-md:hidden" actions={actions} />
        <div className="grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
          <ContractSummary f={f} className="xl:sticky xl:top-20 xl:order-2" />
          <div className="flex flex-col gap-4 xl:order-1">
            {Object.keys(errors).length > 0 && (
              <div ref={alertRef}>
                <Strip tone="destructive" icon="warning-2">
                  {t("error.summary")}
                </Strip>
              </div>
            )}
            <ContractFormCards f={f} patch={patch} setKind={setKind} errors={errors} role={role} />
          </div>
        </div>
      </PageContainer>
      <MobileActionBar>{actions}</MobileActionBar>
    </>
  )
}
