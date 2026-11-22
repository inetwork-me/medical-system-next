"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { isTabEnabled } from "@/lib/modules"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import type { Insurer } from "./data"
import { insurerHref, newContractHref } from "./href"
import { useMoney } from "./money"
import { InitialsTile, InsurerStatusBadge, ltrRun, useSoon } from "./parts"
import { billCan } from "./roles"
import { daysLeft, insurerStatus } from "./rules"
import { useBillRole, useInsurers } from "./store"
import { useBillText } from "./text"

/** "96% of claims approved" bar: green from 90 %, amber below. */
export const APPROVAL_GOOD = 90

/** Label / value row (cards and side columns): 12 muted label (140) · 14 value, border between rows. */
export function FactRow({ label, children, last, tone }: { label: React.ReactNode; children: React.ReactNode; last?: boolean; tone?: "success" | "destructive" }) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5", !last && "border-b")}>
      <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 text-sm tabular-nums", tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground")}>{children}</span>
    </div>
  )
}

function InsurerCard({ ins }: { ins: Insurer }) {
  const t = useTranslations("billing.insurers")
  const { b, date } = useBillText()
  const money = useMoney()
  const status = insurerStatus(ins)
  const pct = ins.stats.approvedPct
  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex items-center gap-2.5">
        <InitialsTile initials={ins.initials} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-sm text-foreground">{b(ins.name)}</h3>
          <p className="truncate text-xs text-muted-foreground">
            <bdi>{t("agreement", { no: ltrRun(ins.agreementNo) })}</bdi>
          </p>
        </div>
      </header>
      <div>
        <InsurerStatusBadge status={status} days={ins.validTo ? daysLeft(ins.validTo) : undefined} />
      </div>
      <div className="flex flex-col">
        <FactRow label={t("validUntil")}>{ins.signed && ins.validTo ? date(ins.validTo) : "—"}</FactRow>
        <FactRow label={t("discount")}>
          <bdi>{ltrRun(`${ins.discountPct}%`)}</bdi>
        </FactRow>
        <FactRow label={t("paysWithin")}>{t("days", { n: ins.paymentDays })}</FactRow>
        <FactRow label={t("owed")} last>
          {money(ins.stats.owed, { whole: true })}
        </FactRow>
      </div>
      {pct != null && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-foreground">
            <bdi>{t("approved", { pct: ltrRun(`${pct}%`) })}</bdi>
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
            <div className={cn("h-full rounded-full", pct >= APPROVAL_GOOD ? "bg-success" : "bg-warning")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <Button variant="outline" size="sm" className="mt-auto w-full" asChild>
        <Link href={insurerHref(ins.id)}>{t("open")}</Link>
      </Button>
    </article>
  )
}

/** The dashed last tile → New contract with type Insurer (when Contracts is on and the role drafts insurer agreements). */
function AddInsurerTile() {
  const t = useTranslations("billing.insurers")
  const role = useBillRole()
  const soon = useSoon()
  if (!billCan(role, "draftInsurer") || !isTabEnabled("billing", "contracts")) return null
  const body = (
    <>
      <Icon name="add" size={24} className="text-primary" />
      <span className="text-sm font-medium text-foreground">{t("add")}</span>
      <span className="text-xs text-muted-foreground">{t("addText")}</span>
    </>
  )
  const cls =
    "flex min-h-40 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed bg-muted p-4 text-center outline-none transition-colors hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
  // New contract lands in step 6; until then the tile says so.
  return NEW_CONTRACT_READY ? (
    <Link href={newContractHref("insurer")} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={soon} className={cls}>
      {body}
    </button>
  )
}

/** Set once the New contract page exists. */
export const NEW_CONTRACT_READY = true

/**
 * Widget / Bill Insurers: "Insurance partners" · "5 provider agreements · SAR 162,150 owed to us"; a card per
 * insurer (initials tile — never a logo —, agreement no., status, valid until / discount / pays within / owed to us,
 * approval-rate bar, Open) and the dashed "Add an insurer" tile. 3 per row; one column on compact.
 */
export function InsurersGrid() {
  const t = useTranslations("billing.insurers")
  const money = useMoney()
  const insurers = useInsurers()
  const owed = insurers.reduce((s, i) => s + i.stats.owed, 0)
  return (
    <section aria-labelledby="bill-insurers" className="@container/ig flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/ig:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="bill-insurers" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle", { n: insurers.length, amount: money(owed, { whole: true }) })}</p>
      </header>
      <div className="grid gap-4 @4xl/ig:grid-cols-3">
        {insurers.map((i) => (
          <InsurerCard key={i.id} ins={i} />
        ))}
        <AddInsurerTile />
      </div>
    </section>
  )
}
