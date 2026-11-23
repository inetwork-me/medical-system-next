"use client"

import * as React from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { bi, type Bi } from "@/lib/mock/bi"
import { toast } from "@/components/ds/toast"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import type { ClaimStatus, ContractKind, ContractStatus, DocKind, DocStatus, InsurerStatus, InvoiceStatus, Signer, ZatcaStatus } from "./data"

/* Shared Billing atoms (Widgets page "Billing widgets · components"): status badges, type chip, initials tile, signature dots. */

/** Bilingual mock text for the current locale. */
export function useB() {
  const locale = useLocale()
  return (v: Bi) => bi(v, locale)
}

/** Latin text (invoice / claim / contract nos., VAT, CR, MRN, phones, emails) kept LTR inside Arabic. */
export function Latin({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  )
}

/** A Latin run inside a translated string: a Unicode left-to-right isolate, so it never reorders in Arabic. */
export const ltrRun = (s: string) => `⁦${s}⁩`

/** Known gaps (Templates, New invoice, Credit note, Export, Show more): a "coming soon" toast. */
export function useSoon() {
  const t = useTranslations("billing.soon")
  return () => toast.info(t("title"), { description: t("text") })
}

/**
 * Show more (Invoices, Contracts): the next 20 rows go below the ones already shown — the page doesn't move — and the
 * counter follows ("Showing 28 of 214"). Starts over when the filter or the search changes (`reset`). → `more-loaded`.
 */
export const SHOW_MORE_STEP = 20
export function useShowMore(reset: string) {
  const t = useTranslations("billing.showMore")
  const [extra, setExtra] = React.useState(0)
  const [key, setKey] = React.useState(reset)
  if (key !== reset) {
    setKey(reset)
    setExtra(0)
  }
  const more = (left: number) => {
    const n = Math.min(SHOW_MORE_STEP, left)
    if (n <= 0) return
    setExtra((e) => e + SHOW_MORE_STEP)
    toast.info(t("toast", { n }), { description: t("toastText") })
  }
  return { extra, more }
}

/* ------------------------------------------------------------------ status badges */

const INVOICE_TONE: Record<InvoiceStatus, StatusTone> = { unpaid: "destructive", part: "warning", paid: "success", refunded: "neutral" }
const CLAIM_TONE: Record<ClaimStatus, StatusTone> = { ready: "neutral", review: "info", approved: "success", part: "warning", rejected: "destructive", needsPreauth: "warning" }
const INSURER_TONE: Record<InsurerStatus, StatusTone> = { active: "success", ending: "warning", awaitingSignature: "info", ended: "neutral" }
// Contracts: "Ends in N days" is destructive in the list (the insurer card shows the same agreement as warning).
const CONTRACT_TONE: Record<ContractStatus, StatusTone> = { awaitingYou: "warning", awaitingThem: "info", draft: "neutral", signed: "success", ending: "destructive", ended: "neutral" }
const DOC_TONE: Record<DocStatus, StatusTone> = { valid: "success", renew: "warning", expired: "destructive", checking: "info" }

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const t = useTranslations("billing.status.invoice")
  return (
    <StatusBadge tone={INVOICE_TONE[status]} className={className}>
      {t(status)}
    </StatusBadge>
  )
}

/** "ZATCA reported" under the invoice badge — only once the API confirmed. */
export function ZatcaLine({ status, className }: { status: ZatcaStatus; className?: string }) {
  const t = useTranslations("billing.status.zatca")
  return <span className={cn("text-xs leading-4", status === "failed" ? "text-destructive" : "text-muted-foreground", className)}>{t(status)}</span>
}

export function ClaimStatusBadge({ status, className }: { status: ClaimStatus; className?: string }) {
  const t = useTranslations("billing.status.claim")
  return (
    <StatusBadge tone={CLAIM_TONE[status]} className={className}>
      {t(status)}
    </StatusBadge>
  )
}

export function InsurerStatusBadge({ status, days, className }: { status: InsurerStatus; days?: number; className?: string }) {
  const t = useTranslations("billing.status.insurer")
  return (
    <StatusBadge tone={INSURER_TONE[status]} className={className}>
      {t(status, { n: days ?? 0 })}
    </StatusBadge>
  )
}

/** `label` overrides the wording (the paper says "Waiting for your signature"); the tone stays the status's. */
export function ContractStatusBadge({ status, days, label, className }: { status: ContractStatus; days?: number; label?: string; className?: string }) {
  const t = useTranslations("billing.status.contract")
  return (
    <StatusBadge tone={CONTRACT_TONE[status]} className={className}>
      {label ?? t(status, { n: days ?? 0 })}
    </StatusBadge>
  )
}

/** Arabic agreement for a paper's status ("سارية" agreement / certificate / licence, "ساري" letter / annex / form). */
const DOC_FEMININE: Record<DocKind, boolean> = {
  agreement: true,
  priceList: false,
  networkLetter: false,
  cchiCertificate: true,
  bankForm: false,
  licence: true,
  offerLetter: false,
  accreditation: false,
  other: false,
}

export function DocStatusBadge({ status, kind, validTo, className }: { status: DocStatus; kind: DocKind; validTo?: string; className?: string }) {
  const t = useTranslations("billing.status.doc")
  const format = useFormatter()
  const month = validTo ? format.dateTime(new Date(`${validTo}T12:00`), { month: "short", numberingSystem: "latn", calendar: "gregory" }) : ""
  return (
    <StatusBadge tone={DOC_TONE[status]} className={className}>
      {t(status, { g: DOC_FEMININE[kind] ? "f" : "m", month })}
    </StatusBadge>
  )
}

/** Signer state in the Signatures list: Signed (success) · Your turn (warning) · Waiting (another signer's turn). */
export function SignerBadge({ signer, yourTurn, className }: { signer: Pick<Signer, "status" | "female">; yourTurn?: boolean; className?: string }) {
  const t = useTranslations("billing.status.signer")
  if (signer.status === "signed")
    return (
      <StatusBadge tone="success" className={className}>
        {t("signed", { g: signer.female ? "female" : "male" })}
      </StatusBadge>
    )
  return (
    <StatusBadge tone={yourTurn ? "warning" : "neutral"} className={className}>
      {t(yourTurn ? "yourTurn" : "waiting")}
    </StatusBadge>
  )
}

/* ------------------------------------------------------------------ chips, tiles, dots */

/** Contract type chip: pill 22, 12 Regular; Insurer in accent (primary text), Staff / Partner outlined. */
export function KindChip({ kind, className }: { kind: ContractKind; className?: string }) {
  const t = useTranslations("billing.kind")
  return (
    <span
      className={cn(
        "inline-flex h-[22px] w-fit shrink-0 items-center rounded-full px-2.5 text-xs leading-4 whitespace-nowrap",
        kind === "insurer" ? "bg-accent text-primary" : "border bg-card text-foreground",
        className
      )}
    >
      {t(kind)}
    </span>
  )
}

/** Insurer / company initials tile (no real logos): 40, radius 10, accent, 14 SemiBold primary. */
export function InitialsTile({ initials, size = 40, className }: { initials: string; size?: 40 | 48 | 56; className?: string }) {
  return (
    <span
      aria-hidden
      dir="ltr"
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-accent font-semibold text-primary",
        size === 40 ? "rounded-[10px] text-sm" : "rounded-xl text-base",
        className
      )}
    >
      {initials}
    </span>
  )
}

/** Person / party avatar: 32 circle, accent, 12 initials. */
export function InitialsAvatar({ initials, size = 32, className }: { initials: string; size?: 32 | 36 | 40; className?: string }) {
  return (
    <span
      aria-hidden
      dir="ltr"
      style={{ width: size, height: size }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground", className)}
    >
      {initials}
    </span>
  )
}

/** Signed column: one 8px dot per signer (signed = success, waiting = muted + border) and "1 of 2". */
export function SignatureDots({ signed, total, className }: { signed: number; total: number; className?: string }) {
  const t = useTranslations("billing")
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label={t("signedOfLabel", { n: signed, total })}>
      <span aria-hidden className="flex items-center gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("size-2 rounded-full", i < signed ? "bg-success" : "border bg-muted")} />
        ))}
      </span>
      <span aria-hidden className="text-xs leading-4 whitespace-nowrap text-muted-foreground">
        {t("signedOf", { n: signed, total })}
      </span>
    </span>
  )
}
