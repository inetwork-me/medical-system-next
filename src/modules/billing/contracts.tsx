"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { Segmented } from "@/components/ds/segmented"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Contract, ContractKind } from "./data"
import { contractCounts } from "./counts"
import { contractHref } from "./href"
import { ContractStatusBadge, InitialsAvatar, KindChip, Latin, SignatureDots, ltrRun, useSoon } from "./parts"
import { billCan, DEMO_DOCTOR_KEY, type BillRole } from "./roles"
import { contractStatus, daysLeft, signedCount, toSign } from "./rules"
import { useBillRole, useContracts } from "./store"
import { useBillText } from "./text"

export type ContractFilter = "all" | ContractKind | "toSign"
const FILTERS: ContractFilter[] = ["all", "staff", "partner", "insurer", "toSign"]
const FILTERS_COMPACT: ContractFilter[] = ["all", "staff", "partner", "insurer"]
const PAGE_WIDE = 8
const PAGE_COMPACT = 6

/** Contracts a role may open: doctors only their own (party = their Doctors key); everyone else all. */
export function visibleContracts(list: Contract[], role: BillRole) {
  return role === "doctor" ? list.filter((c) => c.party.ref === DEMO_DOCTOR_KEY) : list
}

const inFilter = (c: Contract, f: ContractFilter) => f === "all" || (f === "toSign" ? toSign(contractStatus(c)) : c.kind === f)

/** Waiting for you first, then the other signing ones, ending, drafts, signed; newest start first. */
const RANK = { awaitingYou: 0, awaitingThem: 1, draft: 2, ending: 3, signed: 4, ended: 5 } as const
const byPriority = (a: Contract, b: Contract) => RANK[contractStatus(a)] - RANK[contractStatus(b)] || b.start.localeCompare(a.start)

/** The row's action: Sign (your turn, signatory) · Renew (ending) · Open. */
function RowAction({ c, onSign }: { c: Contract; onSign: (no: string) => void }) {
  const t = useTranslations("billing.contracts")
  const role = useBillRole()
  const soon = useSoon()
  const s = contractStatus(c)
  if (s === "awaitingYou" && billCan(role, "sign"))
    return (
      <Button size="sm" onClick={() => onSign(c.no)}>
        {t("sign")}
      </Button>
    )
  if (s === "ending" && (billCan(role, "draftInsurer") || billCan(role, "draftPartner") || billCan(role, "draftStaff")))
    return (
      <Button size="sm" variant="outline" onClick={soon}>
        {t("renew")}
      </Button>
    )
  return (
    <Button size="sm" variant="outline" asChild>
      <Link href={contractHref(c.no)}>{t("open")}</Link>
    </Button>
  )
}

/**
 * Widget / Bill Contracts: "Contracts" · "Staff, partners and insurers · signed with Nafath" · Templates; search +
 * filter (All 64 · Staff 38 · Partners 17 · Insurers 9 · To sign 4); table Contract · Party (avatar + role) · Type chip ·
 * Period · Signed (dots + "1 of 2") · Status · action (Sign / Open / Renew). "Waiting for you" rows are tinted warning.
 * Compact: card list, 4 filters, "Show 58 more".
 */
export function ContractsList({ onSign }: { onSign: (no: string) => void }) {
  const t = useTranslations("billing.contracts")
  const soon = useSoon()
  const role = useBillRole()
  const all = visibleContracts(useContracts(), role)
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<ContractFilter>("all")
  const c = contractCounts(all)
  const own = role === "doctor"
  const count = (f: ContractFilter) => (own ? all.filter((x) => inFilter(x, f)).length : f === "all" ? c.all : f === "toSign" ? c.toSign : c[f])
  const q = query.trim().toLowerCase()
  const matches = (x: Contract) => !q || [x.no, x.party.name.en, x.party.role.en].some((v) => v.toLowerCase().includes(q)) || [x.party.name.ar, x.party.role.ar].some((v) => v.includes(query.trim()))
  const rows = all.filter((x) => matches(x) && inFilter(x, filter)).sort(byPriority)
  const total = q ? rows.length : count(filter)
  const label = (f: ContractFilter) => t(`filter.${f}`, { n: count(f) })

  return (
    <section aria-labelledby="bill-contracts" className="@container/ct flex flex-col gap-4 rounded-xl border bg-card p-4 @4xl/ct:p-5">
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="bill-contracts" className="text-lg font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        {!own && (
          <Button variant="ghost" size="sm" onClick={soon}>
            <Icon name="note-2" size={24} />
            {t("templates")}
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-2 @4xl/ct:flex-row @4xl/ct:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          startIcon={<Icon name="search-normal-1" size={16} />}
          className="@4xl/ct:w-70"
        />
        <Segmented
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="hidden @4xl/ct:ms-auto @4xl/ct:flex *:h-6"
          options={FILTERS.map((f) => ({ value: f, label: label(f) }))}
        />
        <Segmented
          size="sm"
          value={FILTERS_COMPACT.includes(filter) ? filter : "all"}
          onValueChange={setFilter}
          aria-label={t("filter.label")}
          className="*:h-6 *:flex-1 @4xl/ct:hidden"
          options={FILTERS_COMPACT.map((f) => ({ value: f, label: label(f) }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="note-2"
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
          <ContractsTable rows={rows.slice(0, PAGE_WIDE)} onSign={onSign} />
          <ContractCards rows={rows.slice(0, PAGE_COMPACT)} />
          <footer className="hidden items-center gap-3 @4xl/ct:flex">
            <span className="flex-1 text-xs text-muted-foreground">{t("showing", { shown: Math.min(PAGE_WIDE, rows.length), total })}</span>
            {total > PAGE_WIDE && (
              <Button variant="outline" size="sm" onClick={soon}>
                {t("showMore")}
              </Button>
            )}
          </footer>
          {total > PAGE_COMPACT && (
            <Button variant="outline" size="sm" className="w-full @4xl/ct:hidden" onClick={soon}>
              {t("showMoreN", { n: total - Math.min(PAGE_COMPACT, rows.length) })}
            </Button>
          )}
        </>
      )}
    </section>
  )
}

function usePeriod() {
  const { date } = useBillText()
  return (c: Contract) => `${date(c.start)} – ${date(c.end)}`
}

function ContractsTable({ rows, onSign }: { rows: Contract[]; onSign: (no: string) => void }) {
  const t = useTranslations("billing.contracts")
  const { b } = useBillText()
  const period = usePeriod()
  const th = "h-10 px-1.5 text-start text-xs font-normal text-muted-foreground first:ps-4 last:pe-4"
  const td = "px-1.5 py-2.5 align-middle first:ps-4 last:pe-4"
  return (
    <div className="hidden overflow-hidden rounded-lg border @4xl/ct:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[140px]" />
          <col />
          <col className="w-[100px]" />
          <col className="w-[208px]" />
          <col className="w-[108px]" />
          <col className="w-[162px]" />
          <col className="w-[104px]" />
        </colgroup>
        <thead className="bg-muted">
          <tr>
            <th className={th}>{t("col.contract")}</th>
            <th className={th}>{t("col.party")}</th>
            <th className={th}>{t("col.type")}</th>
            <th className={th}>{t("col.period")}</th>
            <th className={th}>{t("col.signed")}</th>
            <th className={th}>{t("col.status")}</th>
            <th className={th}>
              <span className="sr-only">{t("col.action")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const s = contractStatus(c)
            return (
              <tr key={c.no} className={cn("border-t", s === "awaitingYou" && "bg-warning-soft")}>
                <td className={td}>
                  <Link href={contractHref(c.no)} className="rounded-sm text-xs text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <Latin>{c.no}</Latin>
                  </Link>
                </td>
                <td className={td}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <InitialsAvatar initials={c.party.initials} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-foreground">{b(c.party.name)}</span>
                      <span className="truncate text-xs text-muted-foreground">{b(c.party.role)}</span>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <KindChip kind={c.kind} />
                </td>
                <td className={cn(td, "text-xs whitespace-nowrap text-muted-foreground")}>{period(c)}</td>
                <td className={td}>
                  <SignatureDots signed={signedCount(c)} total={c.signers.length} />
                </td>
                <td className={td}>
                  <ContractStatusBadge status={s} days={daysLeft(c.end)} />
                </td>
                <td className={cn(td, "text-end")}>
                  <RowAction c={c} onSign={onSign} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ContractCards({ rows }: { rows: Contract[] }) {
  const t = useTranslations("billing.contracts")
  const tk = useTranslations("billing.kind")
  const { b } = useBillText()
  return (
    <ul className="flex flex-col @4xl/ct:hidden">
      {rows.map((c) => (
        <li key={c.no} className="border-b last:border-b-0">
          <Link
            href={contractHref(c.no)}
            aria-label={t("openLabel", { no: c.no })}
            className="flex items-center gap-2.5 rounded-sm py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <InitialsAvatar initials={c.party.initials} className="self-start" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm text-foreground">{b(c.party.name)}</span>
              <span className="text-xs text-muted-foreground">{t("sub", { no: ltrRun(c.no), type: tk(c.kind), role: b(c.party.role) })}</span>
              <span className="flex flex-wrap items-center gap-2">
                <ContractStatusBadge status={contractStatus(c)} days={daysLeft(c.end)} />
                <SignatureDots signed={signedCount(c)} total={c.signers.length} />
              </span>
            </div>
            <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center text-foreground">
              <Icon name="arrow-right-1" size={24} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
