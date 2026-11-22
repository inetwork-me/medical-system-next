import type { Bi } from "@/lib/mock/bi"
import { CENTER, type Clause, type Contract } from "./data"
import { formatMoney } from "./money"
import { monthlyPay } from "./rules"

/*
 * Contract templates: the clause text each kind of contract prints, filled from the contract's own terms. Only
 * CTR-26-031's clauses are drawn (they're stored as written); the others are built here so every contract page reads
 * as a full paper. Wording follows the drawn employment contract; partner and insurer wording is ours (reported gap).
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })
const sar = (n: number) => bi(formatMoney(n, "en", { whole: true }), formatMoney(n, "ar", { whole: true }))
const num = (n: number) => new Intl.NumberFormat("en-US").format(n)

function yearsBetween(start: string, end: string) {
  const m = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(end.slice(5, 7)) - Number(start.slice(5, 7))) + 1
  return { years: Math.round(m / 12), months: m }
}

const dateEn = (iso: string) => {
  const d = new Date(`${iso}T12:00`)
  return `${d.getDate()} ${new Intl.DateTimeFormat("en-US", { month: "short" }).format(d)} ${d.getFullYear()}`
}
const dateAr = (iso: string) =>
  new Intl.DateTimeFormat("ar", { day: "numeric", month: "long", year: "numeric", numberingSystem: "latn", calendar: "gregory" }).format(new Date(`${iso}T12:00`))

function termText(c: Contract): Bi {
  const { years, months } = yearsBetween(c.start, c.end)
  const en = years >= 1 && months % 12 === 0 ? `${years === 1 ? "1 year" : `${years} years`}` : `${months} months`
  const ar = years >= 1 && months % 12 === 0 ? (years === 1 ? "سنة" : years === 2 ? "سنتين" : `${years} سنوات`) : `${months} شهر`
  const renew = c.autoRenew
  return bi(
    `${en} from ${dateEn(c.start)}${c.terms.staff ? `, with a ${c.terms.staff.probationDays}-day probation` : ""}.${renew ? " Renews for the same term unless either side gives notice." : ""}`,
    `${ar} من ${dateAr(c.start)}${c.terms.staff ? `، وفترة تجربة ${c.terms.staff.probationDays} يوم` : ""}.${renew ? " يتجدد لنفس المدة إلا إذا أشعر أحد الطرفين." : ""}`
  )
}

function staffClauses(c: Contract): Clause[] {
  const s = c.terms.staff!
  const pay = monthlyPay(s)
  const extra = s.allowances.map((a) => ({ en: ` and ${a.label.en} ${num(a.amount)}`, ar: ` و${a.label.ar} ${num(a.amount)}` }))
  const dept = c.department ?? bi("the center", "المجمع")
  return [
    { key: "job", title: bi("The job", "الوظيفة"), text: bi(`${c.party.role.en} at ${dept.en}, reporting to the medical director.`, `${c.party.role.ar} في ${dept.ar}، ويرجع للمدير الطبي.`) },
    { key: "term", title: bi("Term", "المدة"), text: termText(c) },
    {
      key: "pay",
      title: bi("Pay", "الراتب"),
      text: bi(
        `${sar(pay).en} a month: basic ${num(s.basic)}, housing ${num(s.housing)}, transport ${num(s.transport)}${extra.map((x) => x.en).join("")}. Paid on the ${s.payDay}th.`,
        `${sar(pay).ar} بالشهر: أساسي ${num(s.basic)} وسكن ${num(s.housing)} ونقل ${num(s.transport)}${extra.map((x) => x.ar).join("")}. ينصرف يوم ${s.payDay}.`
      ),
    },
    {
      key: "hours",
      title: bi("Hours and leave", "الدوام والإجازات"),
      text: bi(`${s.hoursPerWeek} hours a week, ${s.leaveDays} days of annual leave and the official holidays.`, `${s.hoursPerWeek} ساعة بالأسبوع، و${s.leaveDays} يوم إجازة سنوية مع الإجازات الرسمية.`),
    },
    { key: "pdpl", title: bi("Patient data", "بيانات المرضى"), text: bi("Keeps patient information private under the PDPL and the center's policies.", "يحافظ على سرية بيانات المرضى حسب نظام حماية البيانات الشخصية وسياسات المجمع.") },
    {
      key: "end",
      title: bi("Ending the contract", "إنهاء العقد"),
      text: bi(`${c.noticeDays} days' written notice from either side, as the Labor Law sets out.`, `إشعار كتابي قبل ${c.noticeDays} يوم من أي طرف، حسب نظام العمل.`),
    },
  ]
}

const PARTNER_TEXT: Record<string, Bi> = {
  pdpl: bi("Patient data is shared only for the service, kept in the Kingdom and protected under the PDPL.", "بيانات المرضى ما تنشارك إلا للخدمة، وتنحفظ داخل المملكة حسب نظام حماية البيانات الشخصية."),
  confidentiality: bi("Neither side shares the other's prices, terms or records.", "ما يشارك أي طرف أسعار أو شروط أو سجلات الطرف الثاني."),
  accreditation: bi("The partner keeps a valid CBAHI or CAP accreditation and sends a copy when it renews.", "يحافظ الشريك على اعتماد سباهي أو CAP ساري ويرسل نسخة كل ما يتجدد."),
  liability: bi("The partner holds liability insurance for the whole term.", "عند الشريك تأمين مسؤولية طول مدة العقد."),
  nonCompete: bi("The partner doesn't offer the same service to competing centers in the same district.", "ما يقدم الشريك نفس الخدمة لمراكز منافسة في نفس الحي."),
}

function partnerClauses(c: Contract): Clause[] {
  const p = c.terms.partner!
  const base: Clause[] = [
    { key: "service", title: bi("The service", "الخدمة"), text: bi(`${c.party.role.en} for ${CENTER.name.en}.`, `${c.party.role.ar} لـ${CENTER.name.ar}.`) },
    { key: "term", title: bi("Term", "المدة"), text: termText(c) },
    {
      key: "price",
      title: bi("Prices and payment", "الأسعار والدفع"),
      text: bi(`${p.pricing.en}. We pay within ${p.paymentDays} days of their invoice.`, `${p.pricing.ar}. ندفع خلال ${p.paymentDays} يوم من فاتورتهم.`),
    },
    ...(p.serviceLevel ? [{ key: "sla", title: bi("Service level", "مستوى الخدمة"), text: bi(`Results within ${p.serviceLevel.en}.`, `النتائج خلال ${p.serviceLevel.ar}.`) }] : []),
  ]
  const picked = c.clauses.map((x) => ({ ...x, text: x.text.en ? x.text : (PARTNER_TEXT[x.key] ?? x.text) }))
  return [
    ...base,
    ...picked,
    { key: "end", title: bi("Ending the contract", "إنهاء العقد"), text: bi(`${c.noticeDays} days' written notice from either side.`, `إشعار كتابي قبل ${c.noticeDays} يوم من أي طرف.`) },
  ]
}

function insurerClauses(c: Contract): Clause[] {
  const t = c.terms.insurer!
  const pre =
    t.preauthAbove != null
      ? bi(`Needed above ${sar(t.preauthAbove).en}${t.preauthImaging ? ", and for all imaging" : ""}.`, `مطلوبة فوق ${sar(t.preauthAbove).ar}${t.preauthImaging ? "، ولكل الأشعة" : ""}.`)
      : bi("Not needed.", "ما تحتاج.")
  return [
    { key: "network", title: bi("The network", "الشبكة"), text: bi(`${CENTER.name.en} joins the insurer's provider network for all its branches.`, `ينضم ${CENTER.name.ar} لشبكة مقدمي الخدمة عند الشركة بكل فروعه.`) },
    { key: "term", title: bi("Term", "المدة"), text: termText(c) },
    { key: "discount", title: bi("Prices", "الأسعار"), text: bi(`${t.discountPct}% off the center's price list.`, `خصم ${t.discountPct}% على قائمة أسعار المجمع.`) },
    { key: "copay", title: bi("Patient co-pay", "نسبة تحمل المريض"), text: bi(`${t.copayPct}% of each visit, by the member's class.`, `${t.copayPct}% من كل زيارة حسب فئة المؤمَّن.`) },
    { key: "preauth", title: bi("Pre-authorization", "الموافقة المسبقة"), text: pre },
    {
      key: "claims",
      title: bi("Claims and payment", "المطالبات والدفع"),
      text: bi(`Claims go through NPHIES within ${t.claimDeadlineDays} days of the visit; the insurer pays within ${t.paymentDays} days of the claim.`, `المطالبات تنرسل عبر نفيس خلال ${t.claimDeadlineDays} يوم من الزيارة، والشركة تدفع خلال ${t.paymentDays} يوم من المطالبة.`),
    },
    { key: "end", title: bi("Ending the agreement", "إنهاء الاتفاقية"), text: bi(`${c.noticeDays} days' written notice from either side.`, `إشعار كتابي قبل ${c.noticeDays} يوم من أي طرف.`) },
  ]
}

/** The clauses the paper prints: as written when the contract carries full text, else from its template. */
export function clausesOf(c: Contract): Clause[] {
  if (c.clauses.length && c.clauses.every((x) => x.text.en)) return c.clauses
  if (c.kind === "staff" && c.terms.staff) return staffClauses(c)
  if (c.kind === "partner" && c.terms.partner) return partnerClauses(c)
  if (c.kind === "insurer" && c.terms.insurer) return insurerClauses(c)
  return c.clauses
}
