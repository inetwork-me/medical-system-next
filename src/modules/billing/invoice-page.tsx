"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isTabEnabled } from "@/lib/modules"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { BILL_NOW, CENTER, insurerOf, type Invoice, type InvoiceEvent } from "./data"
import { claimsHref, INVOICES_HREF } from "./href"
import { useMoney } from "./money"
import { ClaimStatusBadge, InvoiceStatusBadge, Latin, ltrRun } from "./parts"
import { RecordPaymentDialog } from "./payment-dialog"
import { billCan } from "./roles"
import { canCollect, invoiceStatus, lineTotal, lineVat, lineNet, sendInvoice, totals } from "./rules"
import { getInvoice, saveInvoice, useBillRole, useClaim, useInvoice } from "./store"
import { useBillText } from "./text"

const timeOf = (iso: string) => iso.slice(11, 16)
/** "15%" as a Latin run, so it never reads "%15" inside Arabic. */
const pctRun = (n: number) => ltrRun(`${n}%`)
const pct = (rate: number) => pctRun(Math.round(rate * 100))

/* ------------------------------------------------------------------ paper */

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

function SumRow({ label, value, tone, last }: { label: string; value: string; tone?: "success" | "destructive"; last?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5", !last && "border-b")}>
      <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm tabular-nums", tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground")}>
        {value}
      </span>
    </div>
  )
}

/**
 * Widget / Bill Invoice — the tax-invoice paper (A4-like, 736; prints on A4). Letterhead (VAT no., CR, ZATCA QR),
 * "Tax invoice" + no. and issue time + status, patient / MRN / insurer + class / visit / doctor / claim, the lines
 * (item, qty, price, VAT, total — compact: item and total), the totals (subtotal, VAT, total, insurer share, patient
 * share, each payment, balance in red) and the footer (ZATCA reporting time + UUID, refund note).
 */
export function InvoicePaper({ inv, className }: { inv: Invoice; className?: string }) {
  const t = useTranslations("billing.invoice")
  const tm = useTranslations("billing")
  const { b, patient, payerName, insurerShort, doctorName, date } = useBillText()
  const dates = useDates()
  const money = useMoney()
  const p = patient(inv.patient)
  const tt = totals(inv)
  const ins = inv.payer === "cash" ? undefined : insurerOf(inv.payer)
  const vatLabel = (k: "line" | "sum") => (tt.vatRate == null ? t(`${k}.vatMixed`) : t(`${k}.vat`, { rate: pct(tt.vatRate) }))
  const n2 = (n: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  const uuid = `${inv.zatca.uuid.slice(0, 4)}…${inv.zatca.uuid.slice(-4)}`
  // "Paid · cash 19 Nov": common nouns lower-case inside the label, brand names (mada, Apple Pay) as they are.
  const methodWord = (m: Invoice["payments"][number]["method"]) => {
    const w = tm(`method.${m}`)
    return m === "cash" || m === "card" || m === "transfer" ? w.toLowerCase() : w
  }
  const z = inv.zatca

  return (
    <article data-bill-paper aria-label={t("taxInvoice")} className={cn("@container/paper rounded-lg border bg-card shadow-md", className)}>
      <div className="flex flex-col gap-5 p-4 @xl/paper:p-9">
        <header className="flex items-start gap-3">
          <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-accent text-primary">
            <Icon name="receipt-2" size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-lg font-semibold text-foreground">{b(CENTER.name)}</p>
            <p className="text-xs text-muted-foreground">
              <bdi>
                {t("seller", {
                  vat: ltrRun(CENTER.vatNo),
                  cr: ltrRun(CENTER.cr),
                  city: b(CENTER.city),
                })}
              </bdi>
            </p>
          </div>
          {/* ZATCA QR: the API's TLV payload (seller, VAT no., time, total, VAT); drawn as the design's placeholder tile. */}
          <div className="hidden flex-col items-center gap-0.5 @xl/paper:flex">
            <span
              role="img"
              aria-label={t("qr")}
              title={z.qr}
              className="inline-flex size-16 items-center justify-center rounded-md border bg-muted text-foreground"
            >
              <Icon name="scan-barcode" size={30} />
            </span>
            <span className="text-xs text-muted-foreground">{t("zatca")}</span>
          </div>
        </header>

        <div aria-hidden className="h-px bg-border" />

        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-xl font-semibold text-foreground">{t("taxInvoice")}</h2>
            <p className="text-xs text-muted-foreground">
              <bdi>
                {t("issued", {
                  no: ltrRun(inv.no),
                  date: date(inv.issuedAt),
                  time: timeOf(inv.issuedAt),
                })}
              </bdi>
            </p>
          </div>
          <InvoiceStatusBadge status={invoiceStatus(inv)} />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5 @xl/paper:grid-cols-3">
          <Info label={t("field.patient")}>{b(p.name)}</Info>
          <Info label={t("field.mrn")}>
            <Latin>{p.mrn}</Latin>
          </Info>
          <Info label={t("field.insurer")}>
            {ins
              ? t("insurerClass", {
                  name: b(ins.name),
                  cls: ltrRun(inv.class ?? "—"),
                })
              : payerName(inv)}
          </Info>
          <Info label={t("field.visit")}>
            {t("visit", {
              date: date(inv.visitAt),
              clinic: b(inv.clinic),
            })}
          </Info>
          <Info label={t("field.doctor")}>{doctorName(inv.doctor)}</Info>
          <Info label={t("field.claim")}>{inv.claimNo ? <Latin>{inv.claimNo}</Latin> : "—"}</Info>
        </div>

        <div className="overflow-hidden rounded-[10px] border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-normal">{t("line.item")}</th>
                <th className="hidden w-12 px-1.5 py-2 text-start font-normal @xl/paper:table-cell">{t("line.qty")}</th>
                <th className="hidden w-[88px] px-1.5 py-2 text-start font-normal @xl/paper:table-cell">{t("line.price")}</th>
                <th className="hidden w-[88px] px-1.5 py-2 text-start font-normal @xl/paper:table-cell">{vatLabel("line")}</th>
                <th className="w-[100px] px-3 py-2 text-start font-normal @xl/paper:w-[100px]">{t("line.total")}</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 text-foreground">{b(l.item)}</td>
                  <td className="hidden px-1.5 py-2 tabular-nums @xl/paper:table-cell">{l.qty}</td>
                  <td className="hidden px-1.5 py-2 tabular-nums @xl/paper:table-cell">{n2(lineNet(l) / l.qty)}</td>
                  <td className="hidden px-1.5 py-2 tabular-nums @xl/paper:table-cell">{n2(lineVat(l))}</td>
                  <td className="px-3 py-2 tabular-nums">{n2(lineTotal(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="flex w-full flex-col @xl/paper:w-80">
            <SumRow label={t("sum.subtotal")} value={money(tt.subtotal)} />
            <SumRow label={vatLabel("sum")} value={money(tt.vat)} />
            <SumRow label={t("sum.total")} value={money(tt.total)} />
            {ins && (
              <SumRow
                label={t("sum.insurerPays", {
                  insurer: insurerShort(ins.id),
                  pct: pctRun(inv.insurerPct),
                })}
                value={money(tt.insurerShare)}
              />
            )}
            <SumRow label={ins ? t("sum.patientPays", { pct: pctRun(100 - inv.insurerPct) }) : t("sum.patientPaysCash")} value={money(tt.patientShare)} />
            {inv.payments.map((pay, i) => (
              <SumRow
                key={i}
                label={t("sum.paid", {
                  method: methodWord(pay.method),
                  date: dates.dayMonth(pay.at),
                })}
                value={money(pay.amount)}
                tone="success"
              />
            ))}
            <SumRow label={t("sum.balance")} value={money(tt.balance)} tone={tt.balance > 0 ? "destructive" : undefined} last />
          </div>
        </div>

        <footer className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <p>
            <bdi>
              {z.status === "reported" || z.status === "cleared"
                ? t(`footer.${z.status}`, {
                    date: date(z.reportedAt ?? inv.issuedAt),
                    time: timeOf(z.reportedAt ?? inv.issuedAt),
                    uuid: ltrRun(uuid),
                  })
                : t(`footer.${z.status}`, { uuid: ltrRun(uuid) })}
            </bdi>
          </p>
          <p>
            <bdi>
              {inv.refunded && inv.creditNote
                ? t("footer.refunded", { cn: ltrRun(inv.creditNote) })
                : t("footer.refund", {
                    days: CENTER.refundDays,
                    email: ltrRun(CENTER.billingEmail),
                  })}
            </bdi>
          </p>
        </footer>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ side column */

function Card({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  )
}

/** A history line: the design's text, or the session's facts worded in the reader's language. */
function useEventText() {
  const t = useTranslations("billing.invoice.history")
  const tw = useTranslations("billing.invoice.who")
  const tm = useTranslations("billing")
  const { b } = useBillText()
  const money = useMoney()
  return (e: InvoiceEvent) => {
    if (e.text) return b(e.text)
    if (e.paid)
      return t("paid", {
        amount: money(e.paid.amount, { whole: true }),
        method: tm(`methodIn.${e.paid.method}`),
        name: b(e.paid.byName),
      })
    if (e.sent) return t("sent", { who: tw(e.sent.to) })
    return ""
  }
}

/**
 * Widget / Bill Invoice Side: Patient payment (co-pay rule, patient pays / paid / balance, Record payment),
 * Insurance claim (no., amount + sent time, status, Open claims — off with the Claims tab), History.
 */
export function InvoiceSide({ inv, onRecord }: { inv: Invoice; onRecord?: () => void }) {
  const t = useTranslations("billing.invoice")
  const { insurerShort } = useBillText()
  const dates = useDates()
  const money = useMoney()
  const role = useBillRole()
  const claim = useClaim(inv.claimNo ?? "")
  const eventText = useEventText()
  const tt = totals(inv)
  const events = [...inv.events].sort((a, z) => a.at.localeCompare(z.at))
  const sameDay = (iso: string) => iso.slice(0, 10) === inv.issuedAt.slice(0, 10)
  const claimsOn = isTabEnabled("billing", "claims")

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={t("pay.title")}
        description={
          inv.payer === "cash"
            ? t("pay.cash")
            : t("pay.copay", {
                pct: pctRun(100 - inv.insurerPct),
                insurer: insurerShort(inv.payer),
                cls: ltrRun(inv.class ?? "—"),
              })
        }
      >
        <div className="flex flex-col">
          <SumRow label={t("pay.patientPays")} value={money(tt.patientShare)} />
          <SumRow label={t("pay.paid")} value={money(tt.paid)} tone="success" />
          <SumRow label={t("pay.balance")} value={money(tt.balance)} tone={tt.balance > 0 ? "destructive" : undefined} last />
        </div>
        {onRecord && canCollect(inv) && billCan(role, "collect") && (
          <Button className="w-full" onClick={onRecord}>
            <Icon name="wallet-money" size={24} />
            {t("record")}
          </Button>
        )}
      </Card>

      {claim && claimsOn && (
        <Card
          title={t("claim.title")}
          description={
            claim.submittedAt ? t("claim.sent", { insurer: insurerShort(claim.insurer) }) : t("claim.notSent", { insurer: insurerShort(claim.insurer) })
          }
        >
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Latin className="text-sm text-foreground">{claim.no}</Latin>
              <span className="text-xs text-muted-foreground tabular-nums">
                {claim.submittedAt
                  ? t("claim.line", {
                      amount: money(claim.amount),
                      date: dates.dayMonth(claim.submittedAt),
                      time: timeOf(claim.submittedAt),
                    })
                  : money(claim.amount)}
              </span>
            </div>
            <ClaimStatusBadge status={claim.status} />
          </div>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={claimsHref({ q: claim.no })}>{t("claim.open")}</Link>
          </Button>
        </Card>
      )}

      {events.length > 0 && (
        <Card title={t("history.title")}>
          <ol className="flex flex-col gap-4">
            {events.map((e, i) => (
              <li key={i} className="flex gap-2.5 text-xs">
                <span className="w-10 shrink-0 text-muted-foreground tabular-nums">{sameDay(e.at) ? timeOf(e.at) : dates.dayMonth(e.at)}</span>
                <span className="min-w-0 flex-1 text-foreground">{eventText(e)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ page */

/** Send to patient (toast-only): SMS + email to the guardian for children, else the patient; logged in History. */
function useSendInvoice() {
  const t = useTranslations("billing.invoice")
  const { patient } = useBillText()
  return (no: string) => {
    const inv = getInvoice(no)
    if (!inv) return
    const to = patient(inv.patient).guardian ? "guardian" : "patient"
    saveInvoice(sendInvoice(inv, to, BILL_NOW))
    toast.success(t("sentToast"), {
      description: t(to === "guardian" ? "sentGuardian" : "sentPatient"),
    })
  }
}

function MobileBar({ inv }: { inv: Invoice }) {
  const t = useTranslations("billing.invoice")
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href={INVOICES_HREF} aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
      <ActionMenu
        title={inv.no}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          [
            {
              key: "print",
              icon: "printer",
              label: t("print"),
              onSelect: () => window.print(),
            },
          ],
        ]}
      />
    </div>
  )
}

/**
 * Invoice page (`/billing/invoices/invoice?no=INV-2611-0241`): header Back · "Billing / Invoices" over "INV-2611-0241 ·
 * Abdullah Al-Shammari"; actions Send to patient · Record payment; the paper beside the side column (stacked below
 * 1120 px of content). Mobile: Back · "Invoice" · ⋯ replaces the app bar. Printing prints the paper alone on A4.
 */
export function InvoicePage() {
  const t = useTranslations("billing.invoice")
  const tn = useTranslations("shell.nav")
  const tt = useTranslations("shell.tabs.billing")
  const { b, patient } = useBillText()
  const role = useBillRole()
  const inv = useInvoice(useSearchParams().get("no") ?? "")
  const send = useSendInvoice()
  const [paying, setPaying] = React.useState(false)

  if (!inv) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="receipt-2"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={INVOICES_HREF}>
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

  const collect = canCollect(inv) && billCan(role, "collect")
  return (
    <>
      <PageTitle
        title={t("title", { no: inv.no, name: b(patient(inv.patient).name) })}
        crumbs={[
          { label: tn("billing"), href: "/billing" },
          { label: tt("invoices"), href: INVOICES_HREF },
        ]}
        back={INVOICES_HREF}
      />
      <MobileBar inv={inv} />
      <PageContainer className="@container/ip">
        <PageHeader
          actions={
            <>
              {billCan(role, "sendInvoice") && (
                <Button variant="outline" onClick={() => send(inv.no)}>
                  <Icon name="send-2" size={24} />
                  {t("send")}
                </Button>
              )}
              {collect && (
                <Button onClick={() => setPaying(true)}>
                  <Icon name="wallet-money" size={24} />
                  {t("record")}
                </Button>
              )}
            </>
          }
        />
        <div className="grid gap-4 @[70rem]/ip:grid-cols-[minmax(0,1fr)_360px] @[70rem]/ip:items-start @[70rem]/ip:gap-6">
          <InvoicePaper inv={inv} />
          <InvoiceSide inv={inv} onRecord={() => setPaying(true)} />
        </div>
      </PageContainer>
      {paying && <RecordPaymentDialog invoiceNo={inv.no} onOpenChange={setPaying} />}
    </>
  )
}
