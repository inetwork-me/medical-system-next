"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { pdfDocument } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { org } from "@/lib/org"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChoiceCard, ChoiceGroup } from "@/modules/messages/parts"
import { canEditSection } from "./access"
import { daysBetween, userCounts } from "./checks"
import { ADDONS, PAYMENT, PLAN, PLANS, SET_TODAY, SUB_INVOICES, USAGE_WARN, YEARLY_MONTHS, type AddonId, type PlanId, type SubInvoice } from "./data"
import { SettingsFrame } from "./frame"
import { IconChip, KvRows, Note, SetCard, useUserText } from "./parts"
import { savePlan, useBranches, usePlan, useUsers, writeAudit } from "./store"

const round100 = (n: number) => Math.round(n / 100) * 100
/** Invoices raised this session (the seeded ones stay in data). */
const sessionInvoices = (list: SubInvoice[]) => list.filter((i) => !SUB_INVOICES.some((s) => s.no === i.no))
/** Next subscription invoice number this month (SUB-2611-022 is the last; the design's next is SUB-2611-031). */
const nextSubNo = (list: SubInvoice[]) => {
  const top = list.filter((i) => i.no.startsWith("SUB-2611-")).reduce((m, i) => Math.max(m, Number(i.no.slice(-3))), 30)
  return `SUB-2611-${String(top + 1).padStart(3, "0")}`
}

/**
 * Settings · Plan and subscription: plan card (name, Yearly chip, price, renewal, Change plan), usage bars (users, branches,
 * SMS — amber over 80% —, WhatsApp, storage), add-ons (On chip or Add), payment and invoices (method, invoice email, VAT
 * number, subscription invoices with download). Header: Download invoices, Change plan.
 */
export function PlanPage() {
  const x = useUserText()
  const { t, b, l, n, dates } = x
  const plan = usePlan()
  const users = useUsers()
  const branches = useBranches()
  const edit = canEditSection("plan")
  const [changing, setChanging] = React.useState(false)
  const [buying, setBuying] = React.useState<AddonId | null>(null)
  const sar = (v: number) => t("plan.sar", { v: n(v) })
  const active = userCounts(users).active
  const openBranches = branches.filter((y) => y.status === "open").length

  const download = async (list: SubInvoice[]) => {
    const ar = x.locale === "ar"
    const blob = await pdfDocument(
      [
        { kind: "brand", title: b(org().name), subtitle: t("plan.invoicesTitle") },
        { kind: "kv", rows: [[t("plan.vat"), org().vat], [t("plan.invoicesTo"), PAYMENT.email]] },
        {
          kind: "table",
          head: [t("plan.colNo"), t("plan.colDate"), t("plan.colWhat"), t("plan.colAmount")],
          rows: list.map((i) => [i.no, dates.short(i.date as string), b(i.what), sar(i.amount)]),
          endAlign: [3],
        },
      ],
      { dir: ar ? "rtl" : "ltr", title: t("plan.invoicesTitle") }
    )
    saveBlob(blob, list.length === 1 ? `${list[0].no}.pdf` : `subscription-invoices-${SET_TODAY}.pdf`)
    writeAudit({ kind: "export", what: { en: `Downloaded ${list.length} subscription invoice${list.length > 1 ? "s" : ""}`, ar: `حمّل ${list.length} من فواتير الاشتراك` }, where: "plan" })
    toast.info(t("toasts.pdf"), { description: t("toasts.pdfText", { n: list.length }) })
  }

  const bars: [string, number, number, string][] = [
    [t("plan.users"), active, plan.def.users, t("plan.of", { used: n(active), max: n(plan.def.users) })],
    [t("plan.branches"), openBranches, plan.def.branches ?? openBranches, plan.def.branches ? t("plan.of", { used: n(openBranches), max: n(plan.def.branches) }) : t("plan.ofAny", { used: n(openBranches) })],
    [t("plan.sms"), plan.sms.used, plan.sms.quota, t("plan.of", { used: n(plan.sms.used), max: n(plan.sms.quota) })],
    [t("plan.whatsapp"), plan.whatsapp.used, plan.whatsapp.quota, t("plan.of", { used: n(plan.whatsapp.used), max: n(plan.whatsapp.quota) })],
    [t("plan.storage"), plan.storageGb.used, plan.storageGb.quota, t("plan.storageOf", { used: n(plan.storageGb.used), max: n(plan.storageGb.quota / 1024) })],
  ]

  const actions = (
    <>
      <Button variant="outline" onClick={() => void download(plan.invoices)}>
        <Icon name="document-download" size={20} />
        {t("plan.download")}
      </Button>
      {edit && <Button onClick={() => setChanging(true)}>{t("plan.change")}</Button>}
    </>
  )

  return (
    <SettingsFrame section="plan" actions={actions}>
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Icon name="card" size={24} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">{b(plan.def.name)}</h2>
            <span className="inline-flex h-5 items-center rounded-full bg-info-soft px-2 text-xs text-info-soft-foreground">{t(`plan.${plan.billing}`)}</span>
          </span>
          <p className="text-xs text-muted-foreground">{t(plan.billing === "yearly" ? "plan.lineYearly" : "plan.lineMonthly", { price: sar(plan.def.monthly), date: l(dates.short(plan.renews).replace(/^0/, "")) })}</p>
        </div>
        {edit && (
          <Button onClick={() => setChanging(true)} className="max-md:hidden">
            {t("plan.change")}
          </Button>
        )}
      </section>

      <SetCard title={t("plan.usage")} sub={t("plan.usageSub")}>
        <div className="flex flex-col gap-4">
          {bars.map(([label, used, max, text]) => {
            const warn = used / max > USAGE_WARN && label === t("plan.sms")
            return (
              <div key={label} className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between gap-3 text-sm text-foreground">
                  {label}
                  <span className={cn("text-xs", warn ? "text-warning-soft-foreground" : "text-muted-foreground")}>{text}</span>
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemax={max}>
                  <span className={cn("block h-full rounded-full", warn ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, (used / max) * 100)}%` }} />
                </span>
              </div>
            )
          })}
        </div>
      </SetCard>

      <SetCard title={t("plan.addons")}>
        <ul className="flex flex-col divide-y">
          {ADDONS.map((a) => {
            const on = plan.addons.includes(a.id)
            return (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", on ? "bg-accent text-primary" : "bg-muted text-foreground")}>
                  <Icon name={a.icon} size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm text-foreground">{b(a.name)}</span>
                  <span className="text-xs text-muted-foreground">{t(`plan.addonPrice.${a.id}`, { price: sar(a.price) })}</span>
                </span>
                {on && a.per !== "once" ? (
                  <IconChip tone="success" icon="tick-circle">
                    {t("plan.on")}
                  </IconChip>
                ) : (
                  edit && (
                    <Button variant="outline" size="sm" onClick={() => setBuying(a.id)}>
                      {t("plan.add")}
                    </Button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      </SetCard>

      <SetCard title={t("plan.payment")} sub={t("plan.paymentSub")}>
        <KvRows
          rows={[
            [t("plan.paysBy"), b(PAYMENT.method)],
            [t("plan.invoicesTo"), l(PAYMENT.email)],
            [t("plan.vat"), l(org().vat)],
          ]}
        />
        <ul className="flex flex-col divide-y rounded-lg border px-3">
          {plan.invoices.map((i) => (
            <li key={i.no} className="flex items-center gap-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <Icon name="receipt-2" size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">
                  {l(i.no)} · {sar(i.amount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {l(dates.short(i.date as string).replace(/^0/, ""))} · {i.paid ? t("plan.paid") : t("plan.due")}
                </span>
              </span>
              <Button variant="ghost" size="icon" aria-label={t("plan.downloadOne", { no: i.no })} onClick={() => void download([i])}>
                <Icon name="document-download" size={20} />
              </Button>
            </li>
          ))}
        </ul>
      </SetCard>
      {changing && <ChangePlanDialog onOpenChange={setChanging} />}
      {buying && <AddonDialog id={buying} onOpenChange={(o) => !o && setBuying(null)} />}
    </SettingsFrame>
  )
}

/**
 * Overlay · Change plan (Change plan): plan radio cards (Basic / Pro · Current / Hospital), billing period, a note with the
 * prorated difference for the rest of the term. Upgrade (or Switch / Downgrade). → `plan-changed`.
 */
function ChangePlanDialog({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const x = useUserText()
  const { t, b, n } = x
  const plan = usePlan()
  const users = useUsers()
  const branches = useBranches()
  const [pick, setPick] = React.useState<PlanId>(plan.id === "hospital" ? "pro" : "hospital")
  const [billing, setBilling] = React.useState(plan.billing)
  const [tried, setTried] = React.useState(false)
  const target = PLANS[pick]
  const active = userCounts(users).active
  const open = branches.filter((y) => y.status === "open").length
  const fits = active <= target.users && (target.branches === null || open <= target.branches)
  const same = pick === plan.id && billing === plan.billing
  const sar = (v: number) => t("plan.sar", { v: n(v) })
  // Prorated difference until the renewal day (yearly bills 10 months of 12).
  const days = Math.max(0, daysBetween(SET_TODAY, plan.renews))
  const factor = billing === "yearly" ? (YEARLY_MONTHS * days) / 365 : days / 30 > 1 ? 1 : days / 30
  const diff = round100((target.monthly - plan.def.monthly) * factor)
  const up = target.monthly > plan.def.monthly
  const error = !fits ? t("plan.errFit", { users: n(active), branches: n(open) }) : same ? t("plan.errSame") : undefined

  const go = () => {
    setTried(true)
    if (error) return
    const no = nextSubNo(plan.invoices)
    const invoice: SubInvoice = { no, amount: diff, date: SET_TODAY, what: { en: `${target.name.en} · difference to ${plan.renews}`, ar: `${target.name.ar} · الفرق لين ${plan.renews}` }, paid: false }
    savePlan(diff > 0 ? { id: pick, billing, invoices: [invoice, ...sessionInvoices(plan.invoices)] } : { id: pick, billing })
    writeAudit({ what: { en: `Changed the plan from ${plan.def.name.en} to ${target.name.en} (${billing})${diff > 0 ? ` · invoice ${no}, SAR ${diff}` : ""}`, ar: `غيّر الباقة من ${plan.def.name.ar} إلى ${target.name.ar}` }, where: "plan" })
    toast.success(up ? t("toasts.upgraded", { plan: b(target.name) }) : t("toasts.planChanged", { plan: b(target.name) }), {
      description: diff > 0 ? t("toasts.planInvoice", { no: x.l(no) }) : t("toasts.planNext"),
    })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("plan.change")}
      description={t("plan.current", { plan: b(plan.def.name) })}
      icon="card"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={go}>{up ? t("plan.upgrade") : pick === plan.id ? t("plan.switch") : t("plan.downgrade")}</Button>}
    >
      {tried && error && <Note tone="destructive" icon="danger">{error}</Note>}
      <ChoiceGroup value={pick} onValueChange={(v) => setPick(v as PlanId)} aria-label={t("plan.change")}>
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id]
          return (
            <ChoiceCard
              key={id}
              value={id}
              title={
                <span className="flex items-center justify-between gap-2">
                  {b(p.name)}
                  {id === plan.id && <span className="rounded-full bg-info-soft px-2 text-xs text-info-soft-foreground">{t("plan.currentChip")}</span>}
                </span>
              }
              sub={t(p.inpatients ? "plan.optionHospital" : "plan.option", { price: sar(p.monthly), branches: p.branches ?? 0, users: n(p.users) })}
            />
          )
        })}
      </ChoiceGroup>
      <Field label={t("plan.billing")}>
        {(c) => (
          <Select value={billing} onValueChange={(v) => setBilling(v as "yearly" | "monthly")}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yearly">{t("plan.billingYearly")}</SelectItem>
              <SelectItem value="monthly">{t("plan.billingMonthly")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>
      {!error && <Note>{diff > 0 ? t("plan.prorated", { amount: sar(diff) }) : diff < 0 ? t("plan.credit", { amount: sar(-diff) }) : t("plan.noDiff")}</Note>}
    </ResponsiveDialog>
  )
}

/** Add-on purchase (Add): what it costs and how it's billed; the invoice goes to finance. → `plan-changed`. */
function AddonDialog({ id, onOpenChange }: { id: AddonId; onOpenChange: (o: boolean) => void }) {
  const x = useUserText()
  const { t, b, n } = x
  const plan = usePlan()
  const a = ADDONS.find((y) => y.id === id)!
  const sar = (v: number) => t("plan.sar", { v: n(v) })
  const go = () => {
    const no = nextSubNo(plan.invoices)
    const inv: SubInvoice = { no, amount: a.price, date: SET_TODAY, what: a.name, paid: false }
    const invoices = [inv, ...sessionInvoices(plan.invoices)]
    // An SMS bundle adds 10,000 to this month's quota; the others switch the add-on on.
    savePlan(id === "smsBundle" ? { invoices, smsExtra: plan.sms.quota - PLAN.sms.quota + 10000 } : { invoices, addons: [...plan.addons, id] })
    writeAudit({ what: { en: `Added ${a.name.en} · invoice ${no}, SAR ${a.price}`, ar: `أضاف ${a.name.ar} · فاتورة ${no}` }, where: "plan" })
    toast.success(t("toasts.addonAdded", { name: b(a.name) }), { description: t("toasts.planInvoice", { no: x.l(no) }) })
    onOpenChange(false)
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("plan.addTitle", { name: b(a.name) })}
      description={t(`plan.addonPrice.${id}`, { price: sar(a.price) })}
      icon={a.icon}
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={go}>{t("plan.add")}</Button>}
    >
      <Note>{t(`plan.addNote.${id}`, { email: x.l(PAYMENT.email) })}</Note>
    </ResponsiveDialog>
  )
}
