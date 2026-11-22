"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { useDates } from "@/i18n/dates"
import { isTabEnabled } from "@/lib/modules"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BILL_NOW, BILL_TODAY, OTHER_CLAIMS, type Claim } from "./data"
import { claimCounts } from "./counts"
import { invoiceHref } from "./href"
import { useMoney } from "./money"
import { nphies, toBundle } from "./nphies"
import { ClaimStatusBadge, InitialsAvatar, Latin, ltrRun } from "./parts"
import { billCan } from "./roles"
import { askPreauth, toFix } from "./rules"
import { getClaim, saveClaims, useBatchSent, useBillRole, useClaims } from "./store"
import { useBillText } from "./text"

const timeOf = (iso: string) => iso.slice(11, 16)

/* ------------------------------------------------------------------ summary */

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "destructive" | "success" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-muted p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
      <span className={cn("text-xs", tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "text-muted-foreground")}>{sub}</span>
    </div>
  )
}

/** Widget / Bill Claims · summary: "Claims through NPHIES" · ready to send, in review, rejected %, paid (2×2 below desktop). */
export function ClaimsSummary() {
  const t = useTranslations("billing.claims")
  const dates = useDates()
  const money = useMoney()
  const c = claimCounts(useClaims(), useBatchSent())
  const month = dates.monthLong(BILL_TODAY).replace(/\s*\d{4}$/, "")
  return (
    <section aria-labelledby="bill-claims-summary" className="@container/cs flex flex-col gap-4 rounded-xl border bg-card p-4 @3xl/cs:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="bill-claims-summary" className="text-lg font-semibold text-foreground">
          {t("summary")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("summaryText", { month, time: timeOf(BILL_NOW) })}</p>
      </header>
      <div className="grid grid-cols-2 gap-3 @4xl/cs:grid-cols-4">
        <Tile label={t("tile.ready")} value={String(c.ready)} sub={money(c.readyAmount, { whole: true })} />
        <Tile label={t("tile.review")} value={String(c.review)} sub={t("tile.reviewText", { amount: money(c.reviewAmount, { whole: true }), days: c.answerDays })} />
        <Tile label={t("tile.rejected")} value={String(c.rejected)} sub={t("tile.rejectedText", { pct: ltrRun(`${c.rejectedPct}%`) })} tone="destructive" />
        <Tile label={t("tile.paid")} value={money(c.paidAmount, { whole: true })} sub={t("tile.paidText", { n: OTHER_CLAIMS.paidInsurers })} tone="success" />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ list */

export type ClaimFilter = "all" | "toFix" | "ready" | "review" | "paid"
const FILTERS: ClaimFilter[] = ["all", "toFix", "ready", "review", "paid"]
const FILTERS_COMPACT: ClaimFilter[] = ["all", "toFix", "ready"]

const inFilter = (c: Claim, f: ClaimFilter) =>
  f === "all" || (f === "toFix" ? toFix(c) : f === "ready" ? c.status === "ready" : f === "review" ? c.status === "review" : !!c.paidAt)

/** "Rejected and held back first", then newest. */
const rank = (c: Claim) => (c.status === "rejected" ? 0 : c.status === "needsPreauth" ? 1 : 2)
const byPriority = (a: Claim, b: Claim) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt) || b.no.localeCompare(a.no)

/** The status detail under the badge: reason, sent / paid date, approved amount, held back. */
function useDetail() {
  const t = useTranslations("billing.claims.line")
  const { b, insurerShort } = useBillText()
  const dates = useDates()
  const money = useMoney()
  return (c: Claim) => {
    switch (c.status) {
      case "rejected":
        return c.reasonText ? b(c.reasonText) : ""
      case "review":
        return c.submittedAt ? t("review", { date: dates.dayMonth(c.submittedAt) }) : ""
      case "approved":
        return c.paidAt ? t("paid", { date: dates.dayMonth(c.paidAt) }) : c.answeredAt ? t("approved", { date: dates.dayMonth(c.answeredAt) }) : ""
      case "part":
        return t("part", { amount: money(c.approvedAmount ?? 0, { whole: true }) })
      case "needsPreauth":
        return c.preauthRequestedAt ? t("asked", { insurer: insurerShort(c.insurer), time: timeOf(c.preauthRequestedAt) }) : t("needsPreauth", { insurer: insurerShort(c.insurer) })
      default:
        return ""
    }
  }
}

/** Ask for approval (toast-only): a priorauth-request to NPHIES; the claim stays held back until the insurer answers. */
export function useAskPreauth() {
  const t = useTranslations("billing.claims")
  const { insurerShort } = useBillText()
  return async (no: string) => {
    const c = getClaim(no)
    if (!c) return
    saveClaims([askPreauth(c, BILL_NOW)])
    toast.success(t("preauthToast"), { description: t("preauthToastText", { insurer: insurerShort(c.insurer) }) })
    await nphies.requestPreauth(toBundle(c, "priorauth-request", BILL_NOW)).catch(() => undefined)
  }
}

function RowAction({ c, onFix, compact }: { c: Claim; onFix: (no: string) => void; compact?: boolean }) {
  const t = useTranslations("billing.claims")
  const role = useBillRole()
  const ask = useAskPreauth()
  const can = billCan(role, "claims")
  if (c.status === "rejected" && can)
    return (
      <Button size="sm" onClick={() => onFix(c.no)}>
        {t("fix")}
      </Button>
    )
  if (c.status === "needsPreauth" && can && !c.preauthRequestedAt && !compact)
    return (
      <Button size="sm" variant="outline" onClick={() => void ask(c.no)}>
        {t("ask")}
      </Button>
    )
  if (compact || !isTabEnabled("billing", "invoices")) return null
  return (
    <Button size="sm" variant="outline" asChild>
      <Link href={invoiceHref(c.invoiceNo)}>{t("view")}</Link>
    </Button>
  )
}

/**
 * Widget / Bill Claims · list: search + filter (All · To fix 8 · Ready 12 · In review 31 · Paid), table Claim ·
 * Patient · Insurer · Amount · Status (badge + reason / detail) · action. A rejected row is tinted destructive-soft →
 * Fix & resend; Needs pre-auth → Ask for approval; others → View (the claim's invoice). Compact: card list, 3 filters.
 * `?q=` (Invoice page → Open claims) prefills the search.
 */
export function ClaimsList({ onFix }: { onFix: (no: string) => void }) {
  const t = useTranslations("billing.claims")
  const { patient } = useBillText()
  const claims = useClaims()
  const params = useSearchParams()
  const [query, setQuery] = React.useState(() => params.get("q") ?? "")
  const [filter, setFilter] = React.useState<ClaimFilter>(() => (FILTERS as string[]).includes(params.get("filter") ?? "") ? (params.get("filter") as ClaimFilter) : "all")
  const c = claimCounts(claims, useBatchSent())
  const q = query.trim().toLowerCase()
  const matches = (x: Claim) => {
    if (!q) return true
    const p = patient(x.patient)
    return [x.no, x.invoiceNo, p.mrn, p.name.en].some((v) => v.toLowerCase().includes(q)) || p.name.ar.includes(query.trim())
  }
  const rows = claims.filter((x) => matches(x) && inFilter(x, filter)).sort(byPriority)
  const label = (f: ClaimFilter) => t(`filter.${f}`, { n: f === "toFix" ? c.toFix : f === "ready" ? c.ready : f === "review" ? c.review : 0 })

  return (
    <section aria-labelledby="bill-claims" className="@container/cl flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/cl:p-5">
      <header className="flex flex-col gap-1">
        <h2 id="bill-claims" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-col gap-2 @4xl/cl:flex-row @4xl/cl:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/cl:w-70"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/cl:ms-auto @4xl/cl:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: label(f) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "all"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/cl:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: label(f) }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="shield-tick"
          title={t("empty")}
          description={t("emptyText")}
          className="py-12"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setFilter("all")
              }}
            >
              {t("clear")}
            </Button>
          }
        />
      ) : (
        <>
          <ClaimsTable rows={rows} onFix={onFix} />
          <ClaimCards rows={rows} onFix={onFix} />
        </>
      )}
    </section>
  )
}

function ClaimsTable({ rows, onFix }: { rows: Claim[]; onFix: (no: string) => void }) {
  const t = useTranslations("billing.claims")
  const { b, patient, payerName } = useBillText()
  const money = useMoney()
  const dates = useDates()
  const detail = useDetail()
  const invoicesOn = isTabEnabled("billing", "invoices")
  const th = "h-10 px-1.5 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/cl:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[160px]" />
          <col />
          <col className="w-[162px]" />
          <col className="w-[116px]" />
          <col className="w-[212px]" />
          <col className="w-[164px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.claim")}</th>
            <th className={th}>{t("col.patient")}</th>
            <th className={th}>{t("col.insurer")}</th>
            <th className={th}>{t("col.amount")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const p = patient(c.patient)
            const d = detail(c)
            const no = (
              <>
                <Latin className="text-foreground">{c.no}</Latin>
                <span className="text-muted-foreground">{dates.dayMonth(c.createdAt)}</span>
              </>
            )
            return (
              <tr key={c.no} className={cn("border-t", c.status === "rejected" && "bg-destructive-soft")}>
                <td className={td}>
                  {invoicesOn ? (
                    <Link href={invoiceHref(c.invoiceNo)} className="flex flex-col gap-0.5 rounded-sm text-xs outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {no}
                    </Link>
                  ) : (
                    <span className="flex flex-col gap-0.5 text-xs">{no}</span>
                  )}
                </td>
                <td className={td}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar initials={p.initials} />
                    <span className="truncate text-sm text-foreground">{b(p.name)}</span>
                  </div>
                </td>
                <td className={cn(td, "truncate text-muted-foreground")}>{payerName({ payer: c.insurer })}</td>
                <td className={cn(td, "whitespace-nowrap tabular-nums")}>{money(c.amount)}</td>
                <td className={td}>
                  <div className="flex flex-col items-start gap-[3px]">
                    <ClaimStatusBadge status={c.status} />
                    {d && <span className="text-xs text-muted-foreground">{d}</span>}
                  </div>
                </td>
                <td className={cn(td, "text-end")}>
                  <RowAction c={c} onFix={onFix} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ClaimCards({ rows, onFix }: { rows: Claim[]; onFix: (no: string) => void }) {
  const t = useTranslations("billing.claims")
  const { b, patient, payerName } = useBillText()
  const money = useMoney()
  const detail = useDetail()
  const invoicesOn = isTabEnabled("billing", "invoices")
  return (
    <ul className="flex flex-col @4xl/cl:hidden">
      {rows.map((c) => {
        const p = patient(c.patient)
        const d = detail(c)
        return (
          <li key={c.no} className="flex items-start gap-2.5 border-b py-3 last:border-b-0">
            <InitialsAvatar initials={p.initials} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm text-foreground">{b(p.name)}</span>
              <span className="text-xs text-muted-foreground">{t("sub", { no: ltrRun(c.no), insurer: payerName({ payer: c.insurer }), amount: money(c.amount) })}</span>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <ClaimStatusBadge status={c.status} />
                {d && <span className="text-xs text-muted-foreground">{d}</span>}
              </span>
              {c.status === "rejected" && (
                <div className="pt-1">
                  <RowAction c={c} onFix={onFix} compact />
                </div>
              )}
            </div>
            {invoicesOn && (
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href={invoiceHref(c.invoiceNo)} aria-label={t("open", { no: c.no })}>
                  <Icon name="arrow-right-1" size={24} />
                </Link>
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
