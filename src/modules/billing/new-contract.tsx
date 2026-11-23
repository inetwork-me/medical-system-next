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
import { DatePicker } from "@/components/ds/pickers"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { MobileActionBar, PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useClinics } from "@/modules/clinics/store"
import {
  BILL_TODAY,
  CENTER,
  CLASS_OPTIONS,
  CLAUSES,
  centerSigner,
  JOB_TITLES,
  PARTY_CANDIDATES,
  PREAUTH_RULES,
  PRICE_LISTS,
  PRICING_OPTIONS,
  STAFF,
  type BillDocument,
  type Clause,
  type Contract,
  type ContractKind,
  type PartyCandidate,
  type Signer,
} from "./data"
import { CONTRACTS_HREF, INSURERS_HREF, TEMPLATES_HREF, contractHref } from "./href"
import { formatMoney } from "./money"
import { InitialsAvatar, InitialsTile, ltrRun } from "./parts"
import { canDraft, type BillRole } from "./roles"
import { MAX_WEEK_HOURS, monthlyPay } from "./rules"
import { addContract, getContracts, useBillRole } from "./store"
import { currentUser, signatoryFor, useBillUser } from "./session"
import { Strip } from "./claim-dialogs"
import { AddClausesDialog, AddSignerDialog, ChoosePartyDialog, useOrdinal, usePartyLine, type AddedClause, type ExtraSigner } from "./contract-dialogs"
import { publishedTemplates, templateById, useTemplates } from "./templates-store"
import { useBillText } from "./text"

/* ------------------------------------------------------------------ form model */

/** A clause in the checklist: the type's optional clauses, library clauses (`lib-…`) and ones written by hand (`custom-…`). */
type ClauseRow = { key: string; title: { en: string; ar: string }; on: boolean; custom?: boolean; text?: { en: string; ar: string } }
export type Employment = "full" | "part" | "locum"

/**
 * One form for the three contract types. Fields the types share (dates, Nafath) keep their values when the type
 * switches; the party, terms, clauses, papers and the type-only fields reset to the new type's template.
 */
export type ContractForm = {
  kind: ContractKind
  partyId: string | null
  /** "" = the party's registered contact, worded in the reader's language. */
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
  clinic: string
  employment: Employment
  probationDays: number
  workingHours: string
  leaveDays: number
  basic: string
  housing: string
  transport: string
  gosi: boolean
  // insurer
  priceList: string
  discount: string
  insurerPays: number
  copay: string
  cap: string
  classes: string
  preauth: string
  nphies: boolean
  clauses: ClauseRow[]
  papers: BillDocument[]
  /** The signing order: the party, the center's signatory and anyone added (their ExtraSigner id); removable. */
  signers: string[]
  /** People added with Add a signer (signs / approves only / gets a copy — copies aren't in `signers`). */
  extras: ExtraSigner[]
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

/** The center's papers an insurer asks for before signing (attached by default to a new insurer agreement). */
const INSURER_PAPERS: BillDocument[] = [
  { id: "ctr-pl-2027", kind: "priceList", title: { en: "Our price list 2027", ar: "قائمة أسعارنا 2027" }, file: "AlNoor-price-list-2027.xlsx", format: "XLSX", detail: { en: "960 KB", ar: "960 KB" }, status: "valid", version: 1 },
  { id: "ctr-cbahi", kind: "accreditation", title: { en: "CBAHI accreditation", ar: "اعتماد سباهي" }, file: "CBAHI-accreditation.pdf", format: "PDF", detail: { en: "1.1 MB", ar: "1.1 MB" }, validTo: "2028-02-29", status: "valid", version: 1 },
]

/** "Filled from the template": the terms each template starts with (the drawn values). */
function templateDefaults(kind: ContractKind, template: string, locale = "en"): Partial<ContractForm> {
  const tpl = templateById(template)
  if (kind === "staff")
    return {
      autoRenew: false,
      noticeDays: 60,
      employment: tpl?.locum ? "locum" : "full",
      probationDays: tpl?.locum ? 0 : 90,
      workingHours: locale === "ar" ? "48 ساعة بالأسبوع · من الأحد للخميس" : "48 h a week · Sun to Thu",
      leaveDays: 30,
      gosi: true,
    }
  if (kind === "insurer")
    return { autoRenew: true, noticeDays: 90, priceList: "pl-2027", discount: "12", insurerPays: 45, copay: "20", cap: "100", classes: "all", preauth: "over500-dental", nphies: true }
  return {
    autoRenew: true,
    noticeDays: 60,
    pricing: template === "partner-services" ? "monthly" : template === "partner-supplies" ? "fixed" : "less10",
    payDays: 30,
    serviceLevel: template === "partner-reference-lab" ? (locale === "ar" ? "48 ساعة للتحاليل العادية" : "48 h for routine tests") : "",
  }
}

/** Default term length per type: staff and insurer agreements 2 years, partners 1 year. */
const termMonths = (kind: ContractKind) => (kind === "partner" ? 12 : 24)

const clauseRows = (kind: ContractKind): ClauseRow[] =>
  CLAUSES[kind].map((c) => ({ key: c.key, title: { ...c.title }, on: !["nonCompete", "pricesPrivate"].includes(c.key) }))

export function blankForm(kind: ContractKind, locale = "en", template?: string): ContractForm {
  const tpl = template && templateById(template)?.kind === kind ? template : publishedTemplates(kind)[0]?.id ?? ""
  return {
    kind,
    partyId: null,
    contactName: "",
    mobile: "",
    template: tpl,
    start: NEXT_MONTH,
    end: dayBefore(addMonths(NEXT_MONTH, termMonths(kind))),
    autoRenew: true,
    noticeDays: 60,
    pricing: "",
    payDays: 30,
    serviceLevel: "",
    jobTitle: "",
    clinic: "",
    employment: "full",
    probationDays: 90,
    workingHours: "",
    leaveDays: 30,
    basic: "",
    housing: "",
    transport: "",
    gosi: true,
    priceList: "",
    discount: "",
    insurerPays: 45,
    copay: "",
    cap: "",
    classes: "all",
    preauth: "",
    nphies: true,
    clauses: clauseRows(kind),
    papers: kind === "insurer" ? INSURER_PAPERS : [],
    signers: ["center"],
    extras: [],
    nafath: true,
    ...templateDefaults(kind, tpl, locale),
  }
}

/** Switch the type in place: the shared fields (dates, Nafath) stay, the rest starts from the new type's template. */
export function switchKind(f: ContractForm, kind: ContractKind, locale = "en"): ContractForm {
  if (f.kind === kind) return f
  return { ...blankForm(kind, locale), start: f.start, end: f.end, nafath: f.nafath }
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
/** "48 h a week · Sun to Thu" → 48 (the first number typed). */
const weeklyHours = (s: string) => Number(/(\d+(?:\.\d+)?)/.exec(s.replace(/,/g, ""))?.[1] ?? 0)
const staffPay = (f: Pick<ContractForm, "basic" | "housing" | "transport">) => monthlyPay({ basic: toNum(f.basic), housing: toNum(f.housing), transport: toNum(f.transport), allowances: [] })

type ErrorKey =
  | "party"
  | "contact"
  | "mobile"
  | "template"
  | "pricing"
  | "starts"
  | "ends"
  | "jobTitle"
  | "clinic"
  | "basic"
  | "hours"
  | "priceList"
  | "discount"
  | "copay"
  | "preauth"
  | "signers"
type Errors = Partial<Record<ErrorKey, true>>

/** Required fields per type and the Labor Law cap; Save draft needs only a party to name it. */
export function validate(f: ContractForm): Errors {
  const e: Errors = {}
  if (!f.partyId) e.party = true
  if (f.kind !== "staff" && !f.contactName.trim() && !candidateOf(f)?.contact) e.contact = true
  if (f.kind !== "staff" && !mobileOk(f.mobile)) e.mobile = true
  if (!f.template) e.template = true
  if (!f.start) e.starts = true
  if (!f.end || (f.start && f.end <= f.start)) e.ends = true
  if (f.kind === "partner" && !f.pricing) e.pricing = true
  if (f.kind === "staff") {
    if (!f.jobTitle) e.jobTitle = true
    if (!f.clinic) e.clinic = true
    if (toNum(f.basic) <= 0) e.basic = true
    const h = weeklyHours(f.workingHours)
    if (h <= 0 || h > MAX_WEEK_HOURS) e.hours = true
  }
  if (f.kind === "insurer") {
    if (!f.priceList) e.priceList = true
    if (f.discount === "" || toNum(f.discount) > 100) e.discount = true
    if (f.copay === "" || toNum(f.copay) > 100) e.copay = true
    if (!f.preauth) e.preauth = true
  }
  if (!(f.signers.includes("party") && f.signers.includes("center"))) e.signers = true
  return e
}

/** The next free contract no. for the year (CTR-26-032 after CTR-26-031). */
export function nextContractNo(list: Contract[]) {
  const yy = BILL_TODAY.slice(2, 4)
  const max = Math.max(0, ...list.filter((c) => c.no.startsWith(`CTR-${yy}-`)).map((c) => Number(c.no.slice(-3))))
  return `CTR-${yy}-${String(max + 1).padStart(3, "0")}`
}

/** Who signs for the other side: the employee, the partner's contact, or the insurer's signatory (network director). */
function partySignerOf(f: ContractForm): Omit<Signer, "order"> | undefined {
  const p = candidateOf(f)
  if (!p) return undefined
  if (p.kind === "employee")
    return {
      initials: p.initials,
      name: p.name,
      role: { en: "Employee", ar: p.female ? "الموظفة" : "الموظف" },
      female: p.female,
      side: "party",
      mobile: p.mobile,
      nationalId: p.contactNationalId,
      status: "waiting",
      method: "nafath",
    }
  if (p.signatory)
    return {
      initials: p.signatory.initials,
      name: p.signatory.name,
      role: { en: `${p.short?.en ?? p.name.en} · ${p.signatory.role.en}`, ar: `${p.short?.ar ?? p.name.ar} · ${p.signatory.role.ar}` },
      female: p.signatory.female,
      side: "party",
      mobile: p.signatory.mobile,
      nationalId: p.signatory.nationalId,
      status: "waiting",
      method: "nafath",
    }
  const typed = f.contactName.trim()
  const name = typed ? { en: typed.split(" · ")[0], ar: typed.split(" · ")[0] } : (p.contact?.name ?? p.name)
  return {
    initials: initialsOf(typed ? typed.split(" · ")[0] : (p.contact?.name.en ?? p.name.en)),
    name,
    role: { en: `${p.short?.en ?? p.name.en} · ${p.contact?.role.en ?? ""}`, ar: `${p.short?.ar ?? p.name.ar} · ${p.contact?.role.ar ?? ""}` },
    female: p.contact?.female,
    side: "party",
    mobile: f.mobile,
    nationalId: p.contactNationalId,
    status: "waiting",
    method: "nafath",
  }
}

/** Someone added with Add a signer, as a contract signer (their national ID comes from Nafath when they sign). */
function extraSigner(f: ContractForm, x: ExtraSigner, order: number): Signer {
  const p = candidateOf(f)
  const org = x.side === "center" ? CENTER.short : (p?.short ?? p?.name ?? { en: "", ar: "" })
  return {
    order,
    initials: initialsOf(x.name),
    name: { en: x.name, ar: x.name },
    role: { en: `${org.en} · ${x.role}`, ar: `${org.ar} · ${x.role}` },
    side: x.side,
    mobile: x.mobile,
    nationalId: "",
    status: "waiting",
    method: "nafath",
    ...(x.does === "approves" ? { does: "approves" as const } : {}),
  }
}

/** The form as a Contract (draft or sent): stores the template id + the published version it was made from. */
export function buildContract(f: ContractForm, no: string, sent: boolean, clinicName?: { en: string; ar: string }): Contract {
  const p = candidateOf(f)!
  const tpl = templateById(f.template)
  const published = tpl?.versions.find((v) => v.status === "published")?.version ?? 1
  const job = JOB_TITLES.find((j) => j.en === f.jobTitle) ?? { en: f.jobTitle, ar: f.jobTitle }
  const kindDetail = {
    staff:
      f.employment === "locum" ? { en: "locum", ar: "تعاقد مؤقت" } : f.employment === "part" ? { en: "part-time employment", ar: "دوام جزئي" } : { en: "employment", ar: "عقد عمل" },
    partner: p.role,
    insurer: { en: "provider agreement", ar: "اتفاقية مقدم خدمة" },
  }[f.kind]
  const ps = partySignerOf(f)!
  // The center signs through the signed-in user when they're an authorized signatory, else the center's signatory.
  const signers: Signer[] = f.signers.flatMap((s, i) => {
    if (s === "party") return [{ ...ps, order: i + 1 }]
    if (s === "center") return [centerSigner(signatoryFor(), i + 1)]
    const x = f.extras.find((e) => e.id === s)
    return x ? [extraSigner(f, x, i + 1)] : []
  })
  const copies = f.extras.filter((x) => x.does === "copy").map((x) => ({ name: { en: x.name, ar: x.name }, role: { en: x.role, ar: x.role }, mobile: x.mobile, side: x.side }))
  const clauses: Clause[] = f.clauses
    .filter((c) => c.on && c.title.en.trim())
    .map((c) => ({ key: c.key, title: c.title, text: c.text ?? (c.custom ? c.title : { en: "", ar: "" }) }))
  const rule = PREAUTH_RULES.find((r) => r.key === f.preauth)
  return {
    no,
    kind: f.kind,
    kindDetail,
    party: { ...p, role: f.kind === "staff" ? job : p.role, contact: p.contact ? { ...p.contact, mobile: f.mobile } : undefined },
    template: f.template,
    templateVersion: published,
    version: 1,
    draftedAt: BILL_TODAY,
    draftedBy: currentUser()?.key ?? "nora",
    department: f.kind === "staff" ? clinicName : undefined,
    start: f.start,
    end: f.end,
    autoRenew: f.autoRenew,
    noticeDays: f.noticeDays,
    terms: {
      staff:
        f.kind === "staff"
          ? {
              employment: f.employment,
              jobTitle: job,
              clinic: f.clinic,
              workingHours: f.workingHours,
              gosi: f.gosi,
              reminderDays: f.autoRenew ? undefined : 90,
              basic: toNum(f.basic),
              housing: toNum(f.housing),
              transport: toNum(f.transport),
              allowances: [],
              probationDays: f.probationDays,
              hoursPerWeek: weeklyHours(f.workingHours),
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
              classes: CLASS_OPTIONS.find((c) => c.key === f.classes)?.classes,
              preauthAbove: rule?.above,
              preauthImaging: rule?.imaging,
              preauthDental: rule?.dental,
              paymentDays: f.insurerPays,
              claimDeadlineDays: 30,
              priceList: f.priceList,
              nphies: f.nphies,
            }
          : undefined,
    },
    clauses,
    files: f.papers,
    signers,
    copies: copies.length ? copies : undefined,
    sent,
    sentAt: sent ? BILL_TODAY : undefined,
    locked: false,
    pages: 4,
    verifyCode: `CTR-${no.slice(-3)}X`,
    events: [{ at: BILL_TODAY, kind: "drafted", who: (currentUser() ?? STAFF.nora).name }, ...(sent ? [{ at: BILL_TODAY, kind: "sent" as const, who: signers[0]?.name }] : [])],
  }
}

/* ------------------------------------------------------------------ building blocks */

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

const Row = ({ children, three }: { children: React.ReactNode; three?: boolean }) => (
  <div className={cn("grid gap-4 @xl/nc:gap-3", three ? "@xl/nc:grid-cols-3" : "@xl/nc:grid-cols-2")}>{children}</div>
)

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  error,
  helper,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean
  error?: string
  helper?: string
}) {
  return (
    <Field label={label} required={required} error={error} helper={helper}>
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

/** A number field: bare value (percent fields carry the unit in the label), or with the currency inside ("SAR 24,000"). */
function NumberInput({ value, onChange, currency }: { value: string; onChange: (v: string) => void; currency?: boolean }) {
  const { ar } = useBillText()
  const unit = currency ? <span className="shrink-0 text-sm text-foreground ltr:-me-1 rtl:-ms-1">{ar ? "ر.س" : "SAR"}</span> : undefined
  return (
    <Input
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
      startIcon={!ar ? unit : undefined}
      end={ar ? unit : undefined}
      className="tabular-nums"
    />
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

function useDates() {
  const toDate = (iso: string) => (iso ? new Date(`${iso}T12:00`) : undefined)
  const fromDate = (d: Date | undefined) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "")
  return { toDate, fromDate }
}

/* ------------------------------------------------------------------ cards */

const KIND_ICON: Record<ContractKind, IconName> = { staff: "profile-2user", partner: "briefcase", insurer: "shield-tick" }

/** Contract type radio cards; types the signed-in role can't draft are hidden. */
function TypeCards({ f, set, role }: { f: ContractForm; set: (k: ContractKind) => void; role: BillRole }) {
  const t = useTranslations("billing.newContract")
  const kinds = (["staff", "partner", "insurer"] as ContractKind[]).filter((k) => canDraft(role, k))
  return (
    <Card title={t("type")} description={t("typeText")}>
      <RadioGroupPrimitive.Root value={f.kind} onValueChange={(v) => set(v as ContractKind)} className={cn("grid gap-2.5", kinds.length === 3 ? "@xl/nc:grid-cols-3" : "@xl/nc:grid-cols-2")} aria-label={t("type")}>
        {kinds.map((k) => (
          <RadioGroupPrimitive.Item
            key={k}
            value={k}
            className="group/radio flex items-center gap-2.5 rounded-[10px] border bg-card p-3 text-start transition-colors outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-accent"
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
  const { b } = useBillText()
  const clinics = useClinics()
  const line = usePartyLine()
  const [choosing, setChoosing] = React.useState(false)
  const p = candidateOf(f)
  // Swapping the party keeps the shared fields; the party's own details (contact, mobile, staff job + papers) follow it.
  const pick = (id: string) => {
    const c = PARTY_CANDIDATES[f.kind].find((x) => x.id === id)
    if (!c || id === f.partyId) return
    patch({
      partyId: id,
      contactName: "",
      mobile: c.contact?.mobile ?? c.mobile,
      ...(c.kind === "employee" ? { jobTitle: c.role.en, clinic: c.clinic ?? "", papers: c.papers ?? [] } : {}),
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
              <bdi>{line(p)}</bdi>
            </span>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={t("change", { name: b(p.name) })} onClick={() => setChoosing(true)}>
            <Icon name="close-circle" size={24} />
          </Button>
        </div>
      ) : (
        <Field label={t(`party.${f.kind}`)} required error={errors.party ? te("party") : undefined}>
          {(fp) => (
            <button
              type="button"
              {...fp}
              onClick={() => setChoosing(true)}
              className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-card px-3 text-start text-sm text-muted-foreground shadow-xs outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
            >
              <Icon name="search-normal-1" size={20} />
              <span className="min-w-0 flex-1 truncate">{t("partyPick")}</span>
            </button>
          )}
        </Field>
      )}
      {choosing && <ChoosePartyDialog kind={f.kind} current={f.partyId} onOpenChange={setChoosing} onPick={pick} />}
      {f.kind === "staff" ? (
        <>
          <Row>
            <SelectField
              label={t("jobTitle")}
              required
              value={f.jobTitle}
              onChange={(v) => patch({ jobTitle: v })}
              options={JOB_TITLES.map((j) => ({ value: j.en, label: b(j) }))}
              error={errors.jobTitle ? te("jobTitle") : undefined}
            />
            <SelectField
              label={t("clinic")}
              required
              value={f.clinic}
              onChange={(v) => patch({ clinic: v })}
              options={clinics.map((c) => ({ value: c.key, label: `${b(c.short)} · ${b(c.branch)}` }))}
              error={errors.clinic ? te("clinic") : undefined}
            />
          </Row>
          <Field label={t("employment")} required>
            {(fp) => (
              <Segmented
                {...fp}
                value={f.employment}
                onValueChange={(v) => patch({ employment: v })}
                aria-label={t("employment")}
                className="w-full *:flex-1"
                options={(["full", "part", "locum"] as Employment[]).map((e) => ({ value: e, label: t(`employmentType.${e}`) }))}
              />
            )}
          </Field>
        </>
      ) : (
        <Row>
          <Field label={t("contact")} required error={errors.contact ? te("contact") : undefined}>
            <Input value={contactText(f, b)} onChange={(e) => patch({ contactName: e.target.value })} />
          </Field>
          <Field label={t("mobile")} required error={errors.mobile ? te("mobile") : undefined}>
            <Input dir="ltr" inputMode="tel" value={f.mobile} onChange={(e) => patch({ mobile: e.target.value })} startIcon={<Icon name="call" size={20} className="text-muted-foreground" />} />
          </Field>
        </Row>
      )}
    </Card>
  )
}

function TermsSection({ f, patch, errors }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void; errors: Errors }) {
  const t = useTranslations("billing.newContract")
  const te = useTranslations("billing.newContract.error")
  const { b, locale } = useBillText()
  const { toDate, fromDate } = useDates()
  useTemplates()
  const tpl = templateById(f.template)
  const days = (ns: number[], key: "payWithinValue" | "daysUnit" | "claimValue") => ns.map((n) => ({ value: String(n), label: t(key, { n }) }))
  const templateOptions = publishedTemplates(f.kind).map((x) => ({ value: x.id, label: `${b(x.name)} · ${t("versionShort", { v: x.versions.find((v) => v.status === "published")?.version ?? 1 })}` }))
  const description = tpl?.basis ? t("termsBasis", { basis: b(tpl.basis) }) : t("termsText")
  const dates = (
    <Row>
      <Field label={t("starts")} required error={errors.starts ? te("starts") : undefined}>
        {(fp) => <DatePicker {...fp} value={toDate(f.start)} onChange={(d) => patch({ start: fromDate(d) })} placeholder={t("pickDate")} className="w-full" />}
      </Field>
      <Field label={t("ends")} required error={errors.ends ? te("ends") : undefined}>
        {(fp) => <DatePicker {...fp} value={toDate(f.end)} onChange={(d) => patch({ end: fromDate(d) })} placeholder={t("pickDate")} className="w-full" />}
      </Field>
    </Row>
  )
  const template = (
    <SelectField
      label={t("template")}
      required
      value={f.template}
      onChange={(v) => patch({ template: v, ...templateDefaults(f.kind, v, locale) })}
      options={templateOptions}
      error={errors.template ? te("template") : undefined}
    />
  )

  return (
    <Card title={t("terms")} description={description}>
      {f.kind === "partner" && (
        <>
          <Row>
            {template}
            <SelectField
              label={t("pricing")}
              required
              value={f.pricing}
              onChange={(v) => patch({ pricing: v })}
              options={PRICING_OPTIONS.map((x) => ({ value: x.key, label: b(x.label) }))}
              error={errors.pricing ? te("pricing") : undefined}
            />
          </Row>
          {dates}
          <Row>
            <SelectField label={t("payWithin")} value={String(f.payDays)} onChange={(v) => patch({ payDays: Number(v) })} options={days([30, 45, 60], "payWithinValue")} />
            <Field label={t("resultsWithin")}>
              <Input value={f.serviceLevel} onChange={(e) => patch({ serviceLevel: e.target.value })} />
            </Field>
          </Row>
          <SwitchRow label={t("renews")} hint={t("renewsText", { n: f.noticeDays })} checked={f.autoRenew} onCheckedChange={(v) => patch({ autoRenew: v })} />
        </>
      )}

      {f.kind === "staff" && (
        <>
          <Row>
            {template}
            <SelectField label={t("probation")} required value={String(f.probationDays)} onChange={(v) => patch({ probationDays: Number(v) })} options={days([0, 90, 180], "daysUnit")} />
          </Row>
          {dates}
          <Row>
            <Field label={t("workingHours")} error={errors.hours ? te("hours") : undefined}>
              <Input value={f.workingHours} onChange={(e) => patch({ workingHours: e.target.value })} />
            </Field>
            <SelectField label={t("leave")} value={String(f.leaveDays)} onChange={(v) => patch({ leaveDays: Number(v) })} options={days([21, 30], "daysUnit")} />
          </Row>
          <SwitchRow
            label={t("renews")}
            hint={f.autoRenew ? t("renewsText", { n: f.noticeDays }) : t("renewsOff", { n: 90 })}
            checked={f.autoRenew}
            onCheckedChange={(v) => patch({ autoRenew: v })}
          />
        </>
      )}

      {f.kind === "insurer" && (
        <>
          <Row>
            {template}
            <SelectField
              label={t("priceList")}
              required
              value={f.priceList}
              onChange={(v) => patch({ priceList: v })}
              options={PRICE_LISTS.map((x) => ({ value: x.key, label: b(x.label) }))}
              error={errors.priceList ? te("priceList") : undefined}
            />
          </Row>
          {dates}
          <Row>
            <Field label={t("discountPct")} required helper={t("discountHint")} error={errors.discount ? te("percent") : undefined}>
              <NumberInput value={f.discount} onChange={(v) => patch({ discount: v })} />
            </Field>
            <SelectField label={t("insurerPays")} required value={String(f.insurerPays)} onChange={(v) => patch({ insurerPays: Number(v) })} options={days([30, 45, 60], "claimValue")} />
          </Row>
          <SwitchRow label={t("renews")} hint={t("renewsText", { n: f.noticeDays })} checked={f.autoRenew} onCheckedChange={(v) => patch({ autoRenew: v })} />
        </>
      )}
    </Card>
  )
}

/** Staff · Monthly pay: basic, housing, transport → Total a month (live), Register with GOSI. */
function PaySection({ f, patch, errors }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void; errors: Errors }) {
  const t = useTranslations("billing.newContract")
  const te = useTranslations("billing.newContract.error")
  const { locale } = useBillText()
  return (
    <Card title={t("payTitle")} description={t("payText")}>
      <Row three>
        <Field label={t("basic")} required error={errors.basic ? te("basic") : undefined}>
          <NumberInput value={f.basic} onChange={(v) => patch({ basic: v })} currency />
        </Field>
        <Field label={t("housing")}>
          <NumberInput value={f.housing} onChange={(v) => patch({ housing: v })} currency />
        </Field>
        <Field label={t("transport")}>
          <NumberInput value={f.transport} onChange={(v) => patch({ transport: v })} currency />
        </Field>
      </Row>
      <div className="flex items-center gap-3 rounded-[10px] bg-muted px-3 py-3" aria-live="polite">
        <span className="min-w-0 flex-1 text-sm text-foreground">{t("totalMonth")}</span>
        <span className="text-lg font-semibold text-foreground tabular-nums">{formatMoney(staffPay(f), locale, { whole: true })}</span>
      </div>
      <SwitchRow label={t("gosi")} hint={t("gosiText")} checked={f.gosi} onCheckedChange={(v) => patch({ gosi: v })} />
    </Card>
  )
}

/** Insurer · Patient share and approvals: co-pay (%), cap a visit, classes covered, pre-authorization, NPHIES. */
function ShareSection({ f, patch, errors }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void; errors: Errors }) {
  const t = useTranslations("billing.newContract")
  const te = useTranslations("billing.newContract.error")
  const { b } = useBillText()
  const cls = CLASS_OPTIONS.find((c) => c.key === f.classes)
  return (
    <Card title={t("shareTitle")} description={t("shareText")}>
      <Row>
        <Field label={t("copayPct")} required error={errors.copay ? te("percent") : undefined}>
          <NumberInput value={f.copay} onChange={(v) => patch({ copay: v })} />
        </Field>
        <Field label={t("capVisit")}>
          <NumberInput value={f.cap} onChange={(v) => patch({ cap: v })} currency />
        </Field>
      </Row>
      <Row>
        <SelectField
          label={t("classes")}
          value={f.classes}
          onChange={(v) => patch({ classes: v })}
          options={CLASS_OPTIONS.map((c) => ({ value: c.key, label: b(c.label) }))}
          helper={cls ? cls.classes.join(", ") : undefined}
        />
        <SelectField
          label={t("preauth")}
          required
          value={f.preauth}
          onChange={(v) => patch({ preauth: v })}
          options={PREAUTH_RULES.map((r) => ({ value: r.key, label: b(r.label) }))}
          error={errors.preauth ? te("preauth") : undefined}
        />
      </Row>
      <SwitchRow label={t("nphies")} hint={t("nphiesText")} checked={f.nphies} onCheckedChange={(v) => patch({ nphies: v })} />
    </Card>
  )
}

function ClausesSection({ f, patch }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void }) {
  const t = useTranslations("billing.newContract")
  const { b } = useBillText()
  const [adding, setAdding] = React.useState(false)
  const remove = useRemove()
  const on = f.clauses.filter((c) => c.on).length
  const set = (i: number, c: Partial<ClauseRow>) => patch({ clauses: f.clauses.map((x, j) => (j === i ? { ...x, ...c } : x)) })
  const add = (list: AddedClause[]) => {
    patch({ clauses: [...f.clauses, ...list.map((c) => ({ key: c.key, title: c.title, text: c.text, on: true, custom: c.key.startsWith("custom-") }))] })
    toast.success(t("clausesAddedToast", { n: list.length }), { description: t("clausesAddedText") })
  }
  return (
    <Card
      title={t("clauses")}
      description={t("clausesText", { n: on, total: f.clauses.length })}
      action={
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
          <Icon name="add" size={20} />
          {t("addClause")}
        </Button>
      }
    >
      <ul className="flex flex-col gap-3">
        {f.clauses.map((c, i) => {
          // The type's own optional clauses are ticked on or off; added ones (library or written) can also be removed.
          const added = c.custom || c.key.startsWith("lib-")
          return (
            <li key={c.key} className="flex items-center gap-2">
              <Checkbox checked={c.on} onCheckedChange={(v) => set(i, { on: v === true })} id={`clause-${c.key}`} />
              <label htmlFor={`clause-${c.key}`} className="min-w-0 flex-1 cursor-pointer text-sm text-foreground">
                {b(c.title)}
              </label>
              {added && (
                <Button variant="ghost" size="icon-sm" aria-label={t("removeNamed", { name: b(c.title) })} onClick={() => remove(() => patch({ clauses: f.clauses.filter((_, j) => j !== i) }))}>
                  <Icon name="trash" size={20} />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {adding && <AddClausesDialog have={f.clauses.map((c) => c.key)} onOpenChange={setAdding} onAdd={add} />}
    </Card>
  )
}

/** Remove file / Remove signer / Remove clause: do it, then `item-removed` ("You can add it back any time"). */
function useRemove() {
  const t = useTranslations("billing.newContract")
  return (run: () => void) => {
    run()
    toast.info(t("removedToast"), { description: t("removedToastText") })
  }
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

function PapersSection({ f, patch }: { f: ContractForm; patch: (p: Partial<ContractForm>) => void }) {
  const t = useTranslations("billing.newContract")
  const { b, date } = useBillText()
  const input = React.useRef<HTMLInputElement>(null)
  const remove = useRemove()
  const p = candidateOf(f)
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
  // "ends Mar 2028" — the month and year an expiring paper (licence, certificate) runs out.
  const endsOn = (iso: string) => t("paperEnds", { date: date(iso).replace(/^\d+\s/, "") })
  const description = f.kind === "staff" ? t("papersStaff") : f.kind === "insurer" && p ? t("papersInsurer", { insurer: b(p.short ?? p.name) }) : t("papersText")
  return (
    <Card title={t("papers")} description={description}>
      {f.papers.length > 0 && (
        <ul className="flex flex-col">
          {f.papers.map((d, i) => (
            <li key={d.id} className="flex items-center gap-3 border-b py-3 first:pt-0 last:border-b-0">
              <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon name="document-text" size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm text-foreground">{b(d.title)}</span>
                <span className="text-xs text-muted-foreground">
                  <bdi>{[ltrRun(d.format), d.detail ? ltrRun(b(d.detail)) : "", d.validTo ? endsOn(d.validTo) : ""].filter(Boolean).join(" · ")}</bdi>
                </span>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={t("removeFile", { name: b(d.title) })} onClick={() => remove(() => patch({ papers: f.papers.filter((_, j) => j !== i) }))}>
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
  const remove = useRemove()
  const ord = useOrdinal()
  const [adding, setAdding] = React.useState(false)
  const p = candidateOf(f)
  const me = useBillUser()
  const signer = STAFF[signatoryFor()]
  const party = partySignerOf(f)
  const nameOf = (s: string) => (s === "party" ? (party ? b(party.name) : "") : s === "center" ? b(signer.name) : (f.extras.find((x) => x.id === s)?.name ?? ""))
  const order = f.signers.filter((s) => s !== "party" || party)
  const addSigner = (x: ExtraSigner, at: number) => {
    const signers = x.does === "copy" ? f.signers : [...f.signers.slice(0, at), x.id, ...f.signers.slice(at)]
    patch({ extras: [...f.extras, x], signers })
    const n = signers.indexOf(x.id) + 1
    toast.success(t("signerAddedToast"), {
      description: x.does === "copy" ? t("signerAddedCopy", { name: x.name }) : t(x.does === "approves" ? "signerAddedApproves" : "signerAddedText", { name: x.name, n: ord.word(n) }),
    })
  }
  const dropExtra = (id: string) => patch({ extras: f.extras.filter((x) => x.id !== id), signers: f.signers.filter((s) => s !== id) })
  const extraLine = (x: ExtraSigner) =>
    [x.side === "center" ? b(CENTER.short) : p ? b(p.short ?? p.name) : t("otherSide"), x.role, ltrRun(x.mobile), x.does !== "signs" ? t(`signerDialog.doesValue.${x.does}`) : ""]
      .filter(Boolean)
      .join(" · ")
  const copies = f.extras.filter((x) => x.does === "copy")
  return (
    <Card
      title={t("signers")}
      description={t("signersText")}
      action={
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
          <Icon name="user-add" size={24} />
          {t("addSigner")}
        </Button>
      }
    >
      <ol className="flex flex-col gap-3">
        {order.map((s, i) => {
          const isParty = s === "party"
          const x = !isParty && s !== "center" ? f.extras.find((e) => e.id === s) : undefined
          const name = nameOf(s)
          const initials = isParty ? party!.initials : x ? initialsOf(x.name) : signer.initials
          const line = x
            ? extraLine(x)
            : isParty
              ? p!.kind === "employee"
                ? t("employeeSigner", { role: b(party!.role), mobile: ltrRun(party!.mobile || "—") })
                : t("signerLine", {
                    org: b(p!.short ?? p!.name),
                    role: p!.signatory ? b(p!.signatory.role) : (contactText(f, b).split(" · ")[1] ?? b(p!.contact?.role ?? p!.role)),
                    mobile: ltrRun(party!.mobile || "—"),
                  })
              : signer.id === me?.id
                ? t("signerYou", { org: b(CENTER.short), role: b(signer.role) })
                : t("signerLine", { org: b(CENTER.short), role: b(signer.role), mobile: ltrRun(signer.mobile) })
          return (
            <li key={s} className="flex items-center gap-2.5 rounded-[10px] border p-3">
              <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                {i + 1}
              </span>
              <InitialsAvatar initials={initials} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{name}</span>
                <span className="text-xs text-muted-foreground">
                  <bdi>{line}</bdi>
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("removeSigner", { name })}
                onClick={() => remove(() => (x ? dropExtra(x.id) : patch({ signers: f.signers.filter((y) => y !== s) })))}
              >
                <Icon name="trash" size={20} />
              </Button>
            </li>
          )
        })}
      </ol>
      {copies.length > 0 && (
        <ul className="flex flex-col gap-3">
          {copies.map((x) => (
            <li key={x.id} className="flex items-center gap-2.5 rounded-[10px] border border-dashed p-3">
              <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon name="sms" size={14} />
              </span>
              <InitialsAvatar initials={initialsOf(x.name)} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{x.name}</span>
                <span className="text-xs text-muted-foreground">
                  <bdi>{extraLine(x)}</bdi>
                </span>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={t("removeSigner", { name: x.name })} onClick={() => remove(() => dropExtra(x.id))}>
                <Icon name="trash" size={20} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddSignerDialog order={order.map(nameOf)} partyName={p ? b(p.name) : undefined} onOpenChange={setAdding} onAdd={addSigner} />}
      {errors.signers && <p className="text-xs text-destructive">{te("signers")}</p>}
      <SwitchRow label={t("nafath")} hint={t("nafathText")} checked={f.nafath} onCheckedChange={(v) => patch({ nafath: v })} />
    </Card>
  )
}

/* ------------------------------------------------------------------ summary */

/**
 * Widget / New Contract Summary: "Before you send", rows per type —
 * Staff: employee, job, term + probation, pay, clauses, papers, signers;
 * Partner: partner, term, pricing, clauses, papers, signers;
 * Insurer: insurer, term, discount, co-pay + cap, pre-authorization, pay within, signers.
 */
export function ContractSummary({ f, className }: { f: ContractForm; className?: string }) {
  const t = useTranslations("billing.newContract.summary")
  const tn = useTranslations("billing.newContract")
  const { b, locale } = useBillText()
  const p = candidateOf(f)
  const none = t("none")
  const months = f.start && f.end > f.start ? (Number(f.end.slice(0, 4)) - Number(f.start.slice(0, 4))) * 12 + (Number(f.end.slice(5, 7)) - Number(f.start.slice(5, 7))) + 1 : 0
  const renews = f.autoRenew ? "yes" : "no"
  const length = !months ? none : months % 12 === 0 ? t("years", { n: months / 12 }) : t("months", { n: months })
  const term =
    !months ? none : f.kind === "staff" ? (f.probationDays ? t("termProbation", { length, n: f.probationDays }) : length) : months % 12 === 0 ? t("termValue", { n: months / 12, renews }) : t("termMonths", { n: months, renews })
  const job = JOB_TITLES.find((j) => j.en === f.jobTitle)
  const rule = PREAUTH_RULES.find((r) => r.key === f.preauth)
  const signers = t("signersValue", { n: f.signers.length, nafath: f.nafath ? "yes" : "no" })
  const clauses = String(f.clauses.filter((c) => c.on && (!c.custom || c.title.en.trim())).length)
  const papers = t("papersValue", { n: f.papers.length })

  const rows: [string, React.ReactNode][] =
    f.kind === "staff"
      ? [
          [t("party.staff"), p ? b(p.name) : none],
          [t("job"), job ? t("jobValue", { job: b(job), employment: tn(`employmentLower.${f.employment}`) }) : none],
          [t("term"), term],
          [t("pay"), toNum(f.basic) ? t("payValue", { amount: formatMoney(staffPay(f), locale, { whole: true }) }) : none],
          [t("clauses"), clauses],
          [t("papers"), papers],
          [t("signers"), signers],
        ]
      : f.kind === "insurer"
        ? [
            [t("party.insurer"), p ? b(p.name) : none],
            [t("term"), term],
            [t("discount"), f.discount ? <bdi key="d">{t("discountValue", { pct: ltrRun(`${toNum(f.discount)}%`) })}</bdi> : none],
            [
              t("copay"),
              f.copay ? (
                <bdi key="c">
                  {toNum(f.cap)
                    ? t("copayCapped", { pct: ltrRun(`${toNum(f.copay)}%`), cap: formatMoney(toNum(f.cap), locale, { whole: true }) })
                    : ltrRun(`${toNum(f.copay)}%`)}
                </bdi>
              ) : (
                none
              ),
            ],
            [t("preauth"), rule ? b(rule.label) : none],
            [t("payWithin"), t("days", { n: f.insurerPays })],
            [t("signers"), signers],
          ]
        : [
            [t("party.partner"), p ? b(p.name) : none],
            [t("term"), term],
            [
              t("pricing"),
              <bdi key="m">
                {PRICING_OPTIONS.find((o) => o.key === f.pricing)
                  ? b(PRICING_OPTIONS.find((o) => o.key === f.pricing)!.label)
                      .replace(/^Their price list/, "Their list")
                      .replace(/^قائمة أسعارهم/, "أسعارهم")
                  : none}
              </bdi>,
            ],
            [t("clauses"), clauses],
            [t("papers"), papers],
            [t("signers"), signers],
          ]

  const party = partySignerOf(f)
  const first = f.signers[0]
  const firstName = (n: string) => (/^(Dr\.|د\.)/.test(n) ? n.split(" ").slice(0, 2).join(" ") : n.split(" ")[0])
  const note = (() => {
    if (!p || !f.signers.length) return null
    const extra = f.extras.find((x) => x.id === first)
    if (extra) return t("first", { name: extra.name, g: "male" })
    if (first === "party" && party) {
      const name = firstName(b(party.name))
      const g = party.female ? "female" : "male"
      if (f.kind === "staff") return t("firstStaff", { name, g })
      if (f.kind === "insurer") return t("firstInsurer", { name, insurer: b(p.short ?? p.name) })
      return t("first", { name, g })
    }
    return STAFF[signatoryFor()].id === currentUser()?.id
      ? t("firstYou", { name: party ? b(party.name) : b(p.name) })
      : t("first", { name: firstName(b(STAFF[signatoryFor()].name)), g: "male" })
  })()

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
      {note && (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info-soft-foreground">
          <Icon name="info-circle" size={18} className="shrink-0" />
          <span>{note}</span>
        </p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ page */

/** The New contract form state; `initial` prefills it (dev stories: the drawn states). */
export function useContractForm(kind: ContractKind, initial?: Partial<ContractForm>, template?: string) {
  const locale = useLocale()
  const [f, setF] = React.useState<ContractForm>(() => ({ ...blankForm(kind, locale, template), ...initial }))
  const patch = React.useCallback((p: Partial<ContractForm>) => setF((x) => ({ ...x, ...p })), [])
  const setKind = (k: ContractKind) => setF((x) => switchKind(x, k, locale))
  return { f, patch, setKind }
}

/** The form's cards: type → party → terms → (staff: monthly pay · insurer: patient share) → clauses → papers → who signs. */
export function ContractFormCards({
  f,
  patch,
  setKind,
  errors,
  role,
}: {
  f: ContractForm
  patch: (p: Partial<ContractForm>) => void
  setKind: (k: ContractKind) => void
  errors: Errors
  role: BillRole
}) {
  return (
    <div className="@container/nc flex flex-col gap-4 md:gap-6">
      <TypeCards f={f} set={setKind} role={role} />
      <PartySection f={f} patch={patch} errors={errors} />
      <TermsSection f={f} patch={patch} errors={errors} />
      {f.kind === "staff" && <PaySection f={f} patch={patch} errors={errors} />}
      {f.kind === "insurer" && <ShareSection f={f} patch={patch} errors={errors} />}
      <ClausesSection f={f} patch={patch} />
      <PapersSection f={f} patch={patch} />
      <SignersSection f={f} patch={patch} errors={errors} />
    </div>
  )
}

const KINDS: ContractKind[] = ["staff", "partner", "insurer"]

/**
 * New contract (`/billing/contracts/new?type=staff|partner|insurer[&template=…]`): one page and one form; the type cards
 * switch the type in place (and the URL). Header Back · "Billing / Contracts" — Insurer: "Billing / Insurers", Back to
 * Insurers. Actions Save draft · Send for signature (mobile: a fixed action bar). Desktop: the form beside "Before you
 * send"; tablet and mobile: the card on top. Send names the first signer (sent-staff / sent-for-signature /
 * sent-insurer) and opens the new contract.
 */
export function NewContractPage() {
  const t = useTranslations("billing.newContract")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const tc = useTranslations("billing.contracts")
  const { b } = useBillText()
  const router = useRouter()
  const role = useBillRole()
  const clinics = useClinics()
  const params = useSearchParams()
  const asked = (params.get("type") ?? params.get("kind")) as ContractKind | null
  const firstAllowed = (["partner", "staff", "insurer"] as ContractKind[]).find((k) => canDraft(role, k)) ?? "partner"
  const kind = asked && KINDS.includes(asked) && canDraft(role, asked) ? asked : firstAllowed
  const { f, patch, setKind } = useContractForm(kind, undefined, params.get("template") ?? undefined)
  const [tried, setTried] = React.useState(false)
  const [draftNo, setDraftNo] = React.useState<string | null>(null)
  const errors = tried ? validate(f) : {}
  const alertRef = React.useRef<HTMLDivElement>(null)
  const allowed = canDraft(role, f.kind)

  // The type lives in the URL too (?type=…), so a reload or a shared link opens the same type.
  const changeKind = (k: ContractKind) => {
    setKind(k)
    const q = new URLSearchParams(params.toString())
    q.set("type", k)
    q.delete("kind")
    q.delete("template")
    router.replace(`/billing/contracts/new?${q}`, { scroll: false })
  }

  const clinicName = (key: string) => {
    const c = clinics.find((x) => x.key === key)
    return c ? { en: `${c.short.en} · ${c.branch.en}`, ar: `${c.short.ar} · ${c.branch.ar}` } : undefined
  }

  const save = () => {
    if (!f.partyId) {
      setTried(true)
      return
    }
    const no = draftNo ?? nextContractNo(getContracts())
    addContract(buildContract(f, no, false, clinicName(f.clinic)))
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
    const c = buildContract(f, no, true, clinicName(f.clinic))
    addContract(c)
    const first = b(c.signers[0].name)
    if (f.kind === "insurer") toast.success(t("sentInsurerToast", { insurer: b(c.party.short ?? c.party.name) }), { description: t("sentToastText", { name: first }) })
    else toast.success(t("sentToast"), { description: t("sentToastText", { name: first }) })
    router.push(contractHref(no))
  }

  const backHref = f.kind === "insurer" ? INSURERS_HREF : CONTRACTS_HREF
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
          { label: tt(f.kind === "insurer" ? "insurers" : "contracts"), href: backHref },
        ]}
        back={backHref}
      />
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={backHref} aria-label={t(f.kind === "insurer" ? "backInsurers" : "back")}>
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
          groups={[[{ key: "templates", icon: "note-2", label: tc("templates"), href: TEMPLATES_HREF }]]}
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
            <ContractFormCards f={f} patch={patch} setKind={changeKind} errors={errors} role={role} />
          </div>
        </div>
      </PageContainer>
      <MobileActionBar>{actions}</MobileActionBar>
    </>
  )
}
