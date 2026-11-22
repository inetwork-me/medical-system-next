"use client"

import { useLocale } from "next-intl"

/**
 * Money (brief §4 · Arabic): "SAR 833.75" in English, "833.75 ر.س" in Arabic. Latin digits and "," grouping in both.
 * `whole` drops the halalas for headline figures ("SAR 24,860", "SAR 920"); tables and papers keep 2 decimals.
 */
export type MoneyOpts = { whole?: boolean; /** Negative amounts with a leading minus (refunds, credit notes). */ signed?: boolean }

const fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
/** "1,842" / "48.5" — plain Latin numbers for counts inside sentences. */
export const num = (n: number, digits = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n)

/** The number part alone: "1,150.00" / "24,860". */
export function amount(n: number, opts: MoneyOpts = {}) {
  const v = round2(Math.abs(n))
  // `whole` only drops ".00": an amount with halalas keeps them ("SAR 66.75" in a toast).
  const s = (opts.whole && Number.isInteger(v) ? fmt0 : fmt2).format(v)
  return n < 0 ? `-${s}` : s
}

export function formatMoney(n: number, locale: string, opts: MoneyOpts = {}) {
  const a = amount(n, opts)
  // The Arabic form is a number run then the Arabic unit: bidi keeps "833.75" whole and puts "ر.س" after it.
  return locale === "ar" ? `${a} ر.س` : `SAR ${a}`
}

/** money(833.75) → "SAR 833.75" | "833.75 ر.س"; money(24860, { whole: true }) → "SAR 24,860". */
export function useMoney() {
  const locale = useLocale()
  return (n: number, opts?: MoneyOpts) => formatMoney(n, locale, opts)
}

/** Round to halalas (VAT and shares are computed per line, then rounded). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
