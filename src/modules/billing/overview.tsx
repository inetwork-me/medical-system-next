"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isTabEnabled } from "@/lib/modules"
import { Icon, type IconName } from "@/components/ds/icon"
import { StatCard } from "@/components/ds/stat-card"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { BILL_TODAY, COLLECTED, MONEY_IN_DAYS, PATIENTS_PAID_SHARE, REJECTION_CODES, type Claim, type Contract, type Insurer } from "./data"
import { claimCounts, contractCounts, invoiceCounts } from "./counts"
import { contractHref, INVOICES_HREF } from "./href"
import { formatMoney, round2, useMoney } from "./money"
import { ltrRun, useSoon } from "./parts"
import { billCan } from "./roles"
import { contractStatus, daysLeft, insurerStatus, nextSigner } from "./rules"
import { useBatchSent, useBillRole, useClaims, useContracts, useInsurers, useInvoices } from "./store"
import { useBillText } from "./text"

/** Collected today = the day's takings before this session + the payments recorded in it today. */
function useCollectedToday() {
  const invoices = useInvoices()
  const session = invoices.flatMap((i) => i.payments).filter((p) => p.at.slice(0, 10) === BILL_TODAY)
  return round2(COLLECTED.today + session.reduce((s, p) => s + p.amount, 0))
}

/* ------------------------------------------------------------------ KPIs */

/** Phones: tighter cards (2 × 171 px) so "SAR 24,860" stays on one line, as drawn. */
const KPI = "max-md:gap-3 max-md:p-4 [&>div:nth-child(2)]:whitespace-nowrap max-md:[&>div:nth-child(2)]:text-xl"

/**
 * Overview KPIs: Collected today (+12% vs last Sunday), Unpaid by patients (9 invoices · 3 over 30 days), Claims in
 * review (31 claims · answer in 2.1 days), Contracts to act on (destructive when one waits for you). 4 across from
 * desktop, 2×2 on tablet and mobile.
 */
export function OverviewKpis() {
  const t = useTranslations("billing.overview.kpi")
  const money = useMoney()
  const locale = useLocale()
  const today = useCollectedToday()
  const inv = invoiceCounts(useInvoices())
  const cl = claimCounts(useClaims(), useBatchSent())
  const ct = contractCounts(useContracts())
  const delta = Math.round((today / COLLECTED.lastSunday - 1) * 100)
  const day = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(`${BILL_TODAY}T12:00`))
  // A tab switched off for the branch takes its KPI with it (cash-only branch: no claims, no contracts).
  const on = (tab: string) => isTabEnabled("billing", tab)
  return (
    <div className="grid grid-cols-2 gap-4 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none xl:gap-6">
      <StatCard
        className={KPI}
        icon="wallet-money"
        tile="accent"
        label={t("collected")}
        value={money(today, { whole: true })}
        delta={<bdi>{ltrRun(`${delta >= 0 ? "+" : ""}${delta}%`)}</bdi>}
        deltaTone={delta >= 0 ? "success" : "destructive"}
        caption={t("vsLastSunday", { day })}
      />
      {on("invoices") && (
        <StatCard
          className={KPI}
          icon="receipt-2"
          tile="warning"
          label={t("unpaid")}
          value={money(inv.unpaidBalance, { whole: true })}
          delta={t("invoices", { n: inv.unpaid })}
          deltaTone="warning"
          caption={t("over30", { n: inv.over30 })}
        />
      )}
      {on("claims") && (
        <StatCard
          className={KPI}
          icon="shield-tick"
          tile="info"
          label={t("review")}
          value={money(cl.reviewAmount, { whole: true })}
          delta={t("claims", { n: cl.review })}
          deltaTone="info"
          caption={t("answerIn", { days: cl.answerDays })}
        />
      )}
      {on("contracts") && (
        <StatCard
          className={KPI}
          icon="note-2"
          tile={ct.awaitingYou ? "destructive" : "warning"}
          label={t("contracts")}
          value={String(ct.toAct)}
          delta={ct.awaitingYou ? t("forYou", { n: ct.awaitingYou }) : undefined}
          deltaTone="destructive"
          caption={t("toSignEnding", { sign: ct.toSign, ending: ct.ending })}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ money in */

const PAYER_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

/**
 * Widget / Bill Money In: bars for the last 2 working weeks (Sun–Thu, SAR thousands, today highlighted) and "Who paid
 * this month" by payer (bars scaled to the largest share). Wide: side by side; compact: stacked.
 */
export function MoneyIn() {
  const t = useTranslations("billing.overview.money")
  const { b, locale } = useBillText()
  const insurers = useInsurers()
  const today = useCollectedToday()
  const days = [...MONEY_IN_DAYS, { day: BILL_TODAY, value: round2(today / 1000) }]
  const max = 50
  const wd = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-US", { weekday: "narrow" })
  const payers = [
    { key: "patients", label: t("patients"), pct: PATIENTS_PAID_SHARE },
    ...insurers.filter((i) => i.paidShare > 0).map((i) => ({ key: i.id, label: b(i.name), pct: i.paidShare })),
  ].sort((a, z) => z.pct - a.pct)
  const top = Math.max(...payers.map((p) => p.pct))
  return (
    <section aria-labelledby="bill-money" className="@container/mi flex flex-col gap-4 rounded-xl border bg-card p-4 @xl/mi:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="bill-money" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("text")}</p>
      </header>
      <div className="flex flex-col gap-6 @2xl/mi:flex-row">
        <div className="flex min-w-0 flex-1 gap-3" role="img" aria-label={t("chartLabel")}>
          <div className="flex h-45 w-7 shrink-0 flex-col justify-between text-xs text-muted-foreground tabular-nums">
            {[50, 40, 30, 20, 10, 0].map((v) => (
              <span key={v} className="leading-4">
                {v}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="relative flex h-45 items-end">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} aria-hidden className="absolute inset-x-0 h-px bg-border" style={{ bottom: `${(i * 100) / 5}%` }} />
              ))}
              {days.map((d, i) => (
                <div key={d.day} className="relative flex h-full flex-1 items-end justify-center">
                  <span
                    className={cn("w-[18px] rounded-t-[4px]", i === days.length - 1 ? "bg-primary" : "bg-blue-200 dark:bg-blue-900")}
                    style={{ height: `${Math.min(100, (d.value / max) * 100)}%` }}
                    title={`${d.day} · ${formatMoney(d.value * 1000, locale, { whole: true })}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex text-xs text-muted-foreground">
              {days.map((d) => (
                <span key={d.day} className="flex-1 text-center">
                  {wd.format(new Date(`${d.day}T12:00`))}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 @2xl/mi:w-[300px] @2xl/mi:shrink-0">
          <p className="text-xs text-foreground">{t("who")}</p>
          <ul className="flex flex-col gap-3.5">
            {payers.map((p, i) => (
              <li key={p.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  <span className="tabular-nums">
                    <bdi>{ltrRun(`${p.pct}%`)}</bdi>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(p.pct / top) * 95}%`, background: PAYER_COLORS[i % PAYER_COLORS.length] }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ needs attention */

const lowerFirst = (s: string, locale: string) => (locale === "en" && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

type Item = {
  key: string
  icon: IconName
  tone: "destructive" | "warning" | "neutral" | "info"
  title: string
  text: string
  action: React.ReactNode
}

const TONE: Record<Item["tone"], string> = {
  destructive: "bg-destructive-soft text-destructive",
  warning: "bg-warning-soft text-warning-soft-foreground",
  neutral: "bg-muted text-foreground",
  info: "bg-info-soft text-info-soft-foreground",
}

/**
 * Widget / Bill Attention: rejected claims → Fix, your signature → Sign, an agreement ending → Renew, unpaid invoices →
 * View, a partner who hasn't signed → Open. Built from the live records; an item shows only when the role can act on it
 * and its tab is on for the branch.
 */
export function NeedsAttention({ onFix, onSign }: { onFix: (claimNo: string) => void; onSign: (contractNo: string) => void }) {
  const t = useTranslations("billing.overview.attention")
  const tk = useTranslations("billing.sign.kindShort")
  const { b, date, locale, patient, insurerShort } = useBillText()
  const role = useBillRole()
  const soon = useSoon()
  const claims = useClaims()
  const contracts = useContracts()
  const insurers = useInsurers()
  const inv = invoiceCounts(useInvoices())
  const dm = (iso: string) => date(iso).replace(/\s\d{4}$/, "")
  const items: Item[] = []
  const on = (tab: string) => isTabEnabled("billing", tab)

  if (on("claims") && billCan(role, "claims"))
    for (const c of claims.filter((x: Claim) => x.status === "rejected"))
      items.push({
        key: `claim-${c.no}`,
        icon: "danger",
        tone: "destructive",
        title: t("rejected", { name: b(patient(c.patient).name) }),
        text: t("rejectedText", {
          insurer: insurerShort(c.insurer),
          // Mid-sentence in English: "Bupa · pre-authorization missing · SAR 920".
          reason: lowerFirst(
            c.reasonText ? b(c.reasonText) : c.reasonCode ? b(REJECTION_CODES[c.reasonCode] ?? { en: c.reasonCode, ar: c.reasonCode }) : "",
            locale,
          ),
          amount: formatMoney(c.amount, locale, { whole: true }),
        }),
        action: (
          <Button size="sm" variant="outline" onClick={() => onFix(c.no)}>
            {t("fix")}
          </Button>
        ),
      })

  if (on("contracts") && billCan(role, "sign"))
    for (const c of contracts.filter((x: Contract) => contractStatus(x) === "awaitingYou")) {
      const other = c.signers.find((s) => s.side === "party" && s.status === "signed")
      items.push({
        key: `sign-${c.no}`,
        icon: "edit-2",
        tone: "warning",
        title: t("sign", { name: b(c.party.name) }),
        text: other?.signedAt
          ? t("signText", { kind: tk(c.kind), g: other.female ? "female" : "male", date: dm(other.signedAt) })
          : t("signTextNone", { kind: tk(c.kind) }),
        action: (
          <Button size="sm" variant="outline" onClick={() => onSign(c.no)}>
            {t("signBtn")}
          </Button>
        ),
      })
    }

  if (on("insurers") && (billCan(role, "insurers") || billCan(role, "draftInsurer")))
    for (const i of insurers.filter((x: Insurer) => insurerStatus(x) === "ending"))
      items.push({
        key: `ending-${i.id}`,
        icon: "timer-1",
        tone: "warning",
        title: t("ending", { insurer: insurerShort(i.id), n: daysLeft(i.validTo!) }),
        text: t("endingText", { date: date(i.validTo!) }),
        action: (
          <Button size="sm" variant="outline" onClick={soon}>
            {t("renew")}
          </Button>
        ),
      })

  if (on("invoices") && inv.unpaid > 0 && billCan(role, "viewMoney"))
    items.push({
      key: "unpaid",
      icon: "wallet-money",
      tone: "neutral",
      title: t("unpaid", { n: inv.unpaid }),
      text: t("unpaidText", { amount: formatMoney(inv.unpaidBalance, locale, { whole: true }), k: inv.over30 }),
      action: (
        <Button size="sm" variant="outline" asChild>
          <Link href={INVOICES_HREF}>{t("view")}</Link>
        </Button>
      ),
    })

  if (on("contracts") && billCan(role, "allContracts"))
    for (const c of contracts.filter((x: Contract) => contractStatus(x) === "awaitingThem" && x.sentAt)) {
      const next = nextSigner(c)
      items.push({
        key: `them-${c.no}`,
        icon: "clock",
        tone: "info",
        title: t("them", { name: b(c.party.short ?? c.party.name), g: c.party.kind === "company" ? "female" : next?.female ? "female" : "male" }),
        text: t("themText", { sent: dm(c.sentAt!), reminded: c.remindedAt ? dm(c.remindedAt) : "none" }),
        action: (
          <Button size="sm" variant="outline" asChild>
            <Link href={contractHref(c.no)}>{t("open")}</Link>
          </Button>
        ),
      })
    }

  return (
    <section aria-labelledby="bill-attention" className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="bill-attention" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("text", { n: items.length })}</p>
      </header>
      {items.length === 0 ? (
        <EmptyState icon="tick-circle" title={t("empty")} description={t("emptyText")} className="py-8" />
      ) : (
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-2.5 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0">
              <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center self-start rounded-[10px]", TONE[it.tone])}>
                <Icon name={it.icon} size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">{it.title}</span>
                <span className="text-xs text-muted-foreground">{it.text}</span>
              </div>
              {it.action}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
