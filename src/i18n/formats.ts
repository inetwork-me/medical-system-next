import type { Formats } from "next-intl";

/**
 * Number/date rules (brief §5.2, DS sheet 07):
 * - Latin digits in both languages  → numberingSystem "latn" on every format
 * - Gregorian calendar, Arabic month names in AR → calendar "gregory" (ar-SA would otherwise default to Hijri)
 * Use these named formats: format.dateTime(d, "short"), format.number(n, "integer"), t("x", {n}) with {n, number, integer}.
 */
const base = { numberingSystem: "latn" } as const;
const date = { ...base, calendar: "gregory" } as const;

export const formats = {
  number: {
    integer: { ...base, maximumFractionDigits: 0 },
    decimal: { ...base, maximumFractionDigits: 1 },
    percent: { ...base, style: "percent", maximumFractionDigits: 1 },
    delta: { ...base, style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" },
    sar: { ...base, style: "currency", currency: "SAR", maximumFractionDigits: 2 },
  },
  dateTime: {
    short: { ...date, day: "numeric", month: "short", year: "numeric" }, // 12 Mar 2011 · 12 مارس 2011
    long: { ...date, day: "numeric", month: "long", year: "numeric" },
    dayMonth: { ...date, day: "numeric", month: "short" }, // 28 Oct · 28 أكتوبر
    time: { ...date, hour: "numeric", minute: "2-digit" },
    weekday: { ...date, weekday: "long", day: "numeric", month: "long" },
  },
} satisfies Formats;
