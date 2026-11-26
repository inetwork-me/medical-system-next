/**
 * Hijri (Umm al-Qura) dates through the platform calendar (Intl "islamic-umalqura"). Days are plain {y, m, d} in either
 * calendar; Gregorian ISO strings are "YYYY-MM-DD". Used by the birth date picker (Patients · design v9.1), which stores
 * both values.
 */
export type Ymd = { y: number; m: number; d: number }

const DAY = 86_400_000
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12))
export const isoOf = (g: Ymd) => `${g.y}-${String(g.m).padStart(2, "0")}-${String(g.d).padStart(2, "0")}`
export const ymdOf = (iso: string): Ymd => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return { y, m, d }
}

const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" })

/** Gregorian → Hijri. */
export function toHijri(g: Ymd): Ymd {
  const parts = fmt.formatToParts(utc(g.y, g.m, g.d))
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value.replace(/\D/g, ""))
  return { y: n("year"), m: n("month"), d: n("day") }
}

const cmp = (a: Ymd, b: Ymd) => a.y - b.y || a.m - b.m || a.d - b.d

/** Hijri → Gregorian (search around the estimate; Umm al-Qura months are 29 or 30 days). Null when the day doesn't exist. */
export function fromHijri(h: Ymd): Ymd | null {
  // Hijri year ≈ 354.367 days; 1 Muharram 1 AH = 16 Jul 622.
  const approx = Date.UTC(622, 6, 16, 12) + ((h.y - 1) * 354.367 + (h.m - 1) * 29.53 + (h.d - 1)) * DAY
  for (let off = -45; off <= 45; off++) {
    const t = new Date(approx + off * DAY)
    const g = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
    if (cmp(toHijri(g), h) === 0) return g
  }
  return null
}

/** Days in a Hijri month (29 or 30). */
export function hijriMonthLength(y: number, m: number) {
  return fromHijri({ y, m, d: 30 }) ? 30 : 29
}

/** Days in a Gregorian month. */
export const monthLength = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Weekday (0 = Sunday) of a Gregorian day. */
export const weekdayOf = (g: Ymd) => utc(g.y, g.m, g.d).getUTCDay()

export const HIJRI_MONTHS = {
  en: ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhu al-Qadah", "Dhu al-Hijjah"],
  ar: ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"],
}
