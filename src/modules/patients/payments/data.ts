import type { Bi } from "@/lib/mock/bi"
import { allPatients, type Patient } from "../data"

/**
 * Patients › Payments tab (mock). The design's 8 transactions first, then generated ones so the chips match the
 * design: 3,412 this month · paid 3,021 · pending 264 · refunded 38 (the rest partial) · insurance 1,108.
 */

export type TxStatus = "paid" | "pending" | "refunded" | "partial"
export type Method = "mada" | "cash" | "card" | "applePay" | "insurance"
export type Tx = { no: string; day: number; time: string; patient: Patient; service: Bi; method: Method; amount: number; status: TxStatus; doctor: Bi }

export const METHOD: Record<Method, Bi> = {
  mada: { en: "mada", ar: "مدى" },
  cash: { en: "Cash", ar: "كاش" },
  card: { en: "Card", ar: "بطاقة" },
  applePay: { en: "Apple Pay", ar: "Apple Pay" },
  insurance: { en: "Insurance", ar: "تأمين" },
}

const TX_DESIGN: [number, string, string, string, Bi, Method, number, TxStatus, Bi][] = [
  [15, "10:20", "INV-20481", "004812", { en: "Cardiology consult", ar: "استشارة قلب" }, "mada", 450, "paid", { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" }],
  [15, "09:55", "INV-20480", "004833", { en: "Echo + ECG", ar: "إيكو + تخطيط قلب" }, "insurance", 1200, "pending", { en: "Dr. Reem Alotaibi", ar: "د. ريم العتيبي" }],
  [14, "18:10", "INV-20472", "004891", { en: "Pediatrics visit", ar: "زيارة أطفال" }, "cash", 350, "paid", { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }],
  [14, "13:02", "INV-20466", "004880", { en: "Dental cleaning", ar: "تنظيف أسنان" }, "applePay", 520, "partial", { en: "Dr. Sami Odeh", ar: "د. سامي عودة" }],
  [13, "11:45", "INV-20451", "004870", { en: "Dermatology", ar: "جلدية" }, "card", 300, "refunded", { en: "Dr. Lama Nasser", ar: "د. لمى ناصر" }],
  [13, "09:30", "INV-20447", "004874", { en: "VIP check-up package", ar: "باقة فحص VIP" }, "mada", 2800, "paid", { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" }],
  [12, "16:40", "INV-20430", "004861", { en: "Lab · HbA1c, lipids", ar: "تحاليل · سكر تراكمي ودهون" }, "insurance", 640, "pending", { en: "Lab team", ar: "فريق المختبر" }],
  [12, "10:05", "INV-20422", "004857", { en: "Vaccination", ar: "تطعيم" }, "cash", 150, "paid", { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }],
]

const SERVICES: [Bi, number[], Bi][] = [
  [{ en: "Cardiology consult", ar: "استشارة قلب" }, [450, 650], { en: "Dr. Khaled Mansour", ar: "د. خالد منصور" }],
  [{ en: "Pediatrics visit", ar: "زيارة أطفال" }, [250, 350], { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }],
  [{ en: "Dental cleaning", ar: "تنظيف أسنان" }, [300, 520], { en: "Dr. Sami Odeh", ar: "د. سامي عودة" }],
  [{ en: "Lab · CBC", ar: "تحاليل · CBC" }, [120, 180, 280], { en: "Lab team", ar: "فريق المختبر" }],
  [{ en: "Dermatology", ar: "جلدية" }, [300, 450], { en: "Dr. Lama Nasser", ar: "د. لمى ناصر" }],
  [{ en: "Orthopedics consult", ar: "استشارة عظام" }, [400, 640], { en: "Dr. Huda Fares", ar: "د. هدى فارس" }],
  [{ en: "X-ray", ar: "أشعة" }, [220, 300], { en: "Radiology", ar: "الأشعة" }],
  [{ en: "Vaccination", ar: "تطعيم" }, [150], { en: "Dr. Ahmed Zaki", ar: "د. أحمد زكي" }],
]

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function bag<T>(counts: [T, number][], rand: () => number): T[] {
  const out = counts.flatMap(([v, n]) => Array<T>(Math.max(0, n)).fill(v))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
const pad = (n: number) => String(n).padStart(2, "0")

export const TX_TOTAL = 3412

let cache: Tx[] | null = null
export function transactions(): Tx[] {
  if (cache) return cache
  const r = mulberry32(3412)
  const byId = (id: string) => allPatients().find((p) => p.id === id)!
  const design: Tx[] = TX_DESIGN.map(([day, time, no, pid, service, method, amount, status, doctor]) => ({ no, day, time, patient: byId(pid), service, method, amount, status, doctor }))
  const n = TX_TOTAL - design.length
  // design rows: paid 4 · pending 2 · partial 1 · refunded 1 · insurance 2
  const statuses = bag<TxStatus>([["paid", 3017], ["pending", 262], ["refunded", 37], ["partial", n - 3017 - 262 - 37]], r)
  const methods = bag<Method>([["insurance", 1106], ["mada", 1180], ["cash", 520], ["card", 380], ["applePay", n - 1106 - 1180 - 520 - 380]], r)
  const people = allPatients().slice(12)
  const gen: Tx[] = statuses.map((status, i) => {
    const [service, prices, doctor] = SERVICES[Math.floor(r() * SERVICES.length)]
    const day = Math.max(1, 12 - Math.floor((i / n) * 12))
    return {
      no: `INV-${20421 - i}`,
      day,
      time: `${pad(8 + Math.floor(r() * 11))}:${pad(Math.floor(r() * 60))}`,
      patient: people[Math.floor(r() * people.length)],
      service,
      method: methods[i],
      amount: prices[Math.floor(r() * prices.length)],
      status,
      doctor,
    }
  })
  gen.sort((a, b) => b.day - a.day || b.time.localeCompare(a.time))
  cache = [...design, ...gen]
  return cache
}
