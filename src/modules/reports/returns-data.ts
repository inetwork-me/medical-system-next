import type { Bi } from "@/lib/mock/bi"
import type { ModuleId } from "@/config/modules"
import type { RepRole } from "./roles"

/*
 * Official returns (brief §2 "Official returns", "Return", §4): filled from the system, checked by rules (missing
 * fields, unusual change vs last period), fixed or explained, signed off by the named role with a PIN, then
 * submitted through the authority's portal client, which returns a reference; each submission is archived with its
 * file. Only aggregates go in — never patient names or IDs. The design draws the MOH November return; the others
 * follow the same shape.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

export type Authority = "MOH" | "HESN" | "CCHI" | "ZATCA"
export type ReturnStatus = "ready" | "draft" | "collecting" | "submitted"

export const FACILITY_CODE = "01-0442"

/** The authority chip and the portal each return goes through (the clients are stubs: portal.ts). */
export const AUTHORITY: Record<Authority, { name: Bi; portal: Bi; signer: RepRole }> = {
  MOH: { name: bi("MOH", "الوزارة"), portal: bi("MOH portal", "بوابة الوزارة"), signer: "director" },
  HESN: { name: bi("HESN", "حصن"), portal: bi("HESN portal", "بوابة حصن"), signer: "director" },
  CCHI: { name: bi("CCHI", "مجلس الضمان"), portal: bi("CCHI portal", "بوابة مجلس الضمان"), signer: "finance" },
  ZATCA: { name: bi("ZATCA", "الزكاة"), portal: bi("ZATCA portal", "بوابة الزكاة"), signer: "finance" },
}

/**
 * A rule's finding: fix it in the module list (`fix`) or explain it with a note that goes with the return. A check
 * with a visit-data `rule` (nationality · id · diagnosis) is counted live from Medical records › Visits for the
 * return's period and branch (it leaves the list when nothing is missing), and its button opens Visits · missing data.
 */
export type VisitRule = "nationality" | "id" | "diagnosis"
export type Check = { id: string; text: Bi; rule?: VisitRule; fix?: { href: string; label: Bi; module: ModuleId }; explain?: boolean }

/** A line of "What goes in": the value, its change vs last month, and whether a check flagged it. */
export type Section = { id: string; name: Bi; value: Bi; change?: string; vs?: Bi; warn?: boolean }

export type PastReturn = { period: Bi; submitted: string; ref: string }

export type OfficialReturn = {
  id: string
  /** Row name ("Monthly statistics") and the page title ("MOH monthly statistics · November 2026"). */
  name: Bi
  title: Bi
  /** Mobile page title ("MOH return"). */
  short: Bi
  authority: Authority
  /** "MOH · monthly statistics" under the side card's title. */
  kind: Bi
  period: Bi
  /** Period as the dialog prints it ("November 2026"). */
  periodLong: Bi
  due: string
  status: ReturnStatus
  /** Status detail on the tab ("3 cases", "2 warnings"). */
  detail?: Bi
  submitted?: { at: string; ref: string; by: string }
  collected?: string
  preparedBy: string
  signer: string
  scope: Bi
  /** The month "What goes in" compares with ("+6% vs Oct"). */
  vs?: Bi
  /** The period code the portal puts in the reference (MOH-2611-0442). */
  code: string
  /** Visit-data checks: the month ("2026-11") and the branch the return covers. */
  month?: string
  branch?: string
  checks: Check[]
  sections: Section[]
  past: PastReturn[]
}

const moh = (m: string) => `MOH-26${m}-${FACILITY_CODE.slice(3)}`

export const RETURNS: OfficialReturn[] = [
  {
    id: "hesn-weekly-47",
    code: "2647",
    name: bi("Notifiable diseases", "الأمراض المبلّغ عنها"),
    title: bi("HESN notifiable diseases · Week 47", "الأمراض المبلّغ عنها لحصن · الأسبوع 47"),
    short: bi("HESN return", "إقرار حصن"),
    authority: "HESN",
    kind: bi("HESN · notifiable diseases", "حصن · الأمراض المبلّغ عنها"),
    period: bi("Week 47", "الأسبوع 47"),
    periodLong: bi("Week 47 · 16–22 Nov 2026", "الأسبوع 47 · 16–22 نوفمبر 2026"),
    due: "2026-11-23",
    status: "ready",
    detail: bi("3 cases", "3 حالات"),
    collected: "2026-11-22T23:00",
    preparedBy: "fahad",
    signer: "ghamdi",
    scope: bi("16–22 Nov 2026 · Riyadh main branch", "16–22 نوفمبر 2026 · فرع الرياض الرئيسي"),
    checks: [],
    sections: [
      { id: "flu", name: bi("Influenza, lab-confirmed", "إنفلونزا مؤكدة مخبرياً"), value: bi("2", "2") },
      { id: "brucella", name: bi("Brucellosis", "الحمى المالطية"), value: bi("1", "1") },
      { id: "measles", name: bi("Measles", "الحصبة"), value: bi("0", "0") },
      { id: "total", name: bi("Cases this week", "حالات هالأسبوع"), value: bi("3", "3") },
    ],
    past: [
      { period: bi("Week 46", "الأسبوع 46"), submitted: "2026-11-16", ref: "HESN-2646-0442" },
      { period: bi("Week 45", "الأسبوع 45"), submitted: "2026-11-09", ref: "HESN-2645-0442" },
      { period: bi("Week 44", "الأسبوع 44"), submitted: "2026-11-02", ref: "HESN-2644-0442" },
    ],
  },
  {
    id: "moh-monthly-2611",
    code: "2611",
    name: bi("Monthly statistics", "الإحصائية الشهرية"),
    title: bi("MOH monthly statistics · November 2026", "إحصائية الوزارة الشهرية · نوفمبر 2026"),
    short: bi("MOH return", "إقرار الوزارة"),
    authority: "MOH",
    kind: bi("MOH · monthly statistics", "الوزارة · الإحصائية الشهرية"),
    period: bi("November", "نوفمبر"),
    periodLong: bi("November 2026", "نوفمبر 2026"),
    due: "2026-12-10",
    status: "draft",
    detail: bi("2 warnings", "تنبيهين"),
    collected: "2026-11-22T23:00",
    preparedBy: "fahad",
    signer: "ghamdi",
    scope: bi("November 2026 · Riyadh main branch", "نوفمبر 2026 · فرع الرياض الرئيسي"),
    month: "2026-11",
    branch: "riyadh-main",
    vs: bi("Oct", "أكتوبر"),
    checks: [
      {
        id: "nationality",
        rule: "nationality",
        text: bi("38 visits have no nationality", "38 زيارة ما فيها جنسية"),
        fix: { href: "/records/visits/missing", label: bi("Show visits", "اعرض الزيارات"), module: "records" },
        explain: true,
      },
      { id: "dental", text: bi("Dental procedures are 22% higher than October", "إجراءات الأسنان أعلى من أكتوبر بـ ⁦22%⁩"), explain: true },
    ],
    sections: [
      { id: "outpatient", name: bi("Outpatient visits", "زيارات العيادات الخارجية"), value: bi("8,412", "8,412"), change: "+6%" },
      { id: "new", name: bi("New patients", "المرضى الجدد"), value: bi("1,106", "1,106"), change: "+3%" },
      { id: "nationality", name: bi("Visits by nationality", "الزيارات حسب الجنسية"), value: bi("71% Saudi", "⁦71%⁩ سعوديين"), warn: true },
      { id: "urgent", name: bi("Urgent care visits", "زيارات الرعاية العاجلة"), value: bi("640", "640"), change: "−2%" },
      { id: "lab", name: bi("Lab tests", "التحاليل"), value: bi("21,480", "21,480"), change: "+5%" },
      { id: "radiology", name: bi("Radiology exams", "فحوصات الأشعة"), value: bi("1,912", "1,912"), change: "+1%" },
      { id: "dental", name: bi("Dental procedures", "إجراءات الأسنان"), value: bi("2,904", "2,904"), change: "+22%", warn: true },
      { id: "hesn", name: bi("Notifiable diseases sent to HESN", "أمراض انبلّغ عنها لحصن"), value: bi("3", "3") },
    ],
    past: [
      { period: bi("October 2026", "أكتوبر 2026"), submitted: "2026-11-08", ref: moh("10") },
      { period: bi("September 2026", "سبتمبر 2026"), submitted: "2026-10-09", ref: moh("09") },
      { period: bi("August 2026", "أغسطس 2026"), submitted: "2026-09-07", ref: moh("08") },
    ],
  },
  {
    id: "zatca-vat-q4",
    code: "2604",
    name: bi("VAT return", "إقرار ضريبة القيمة المضافة"),
    title: bi("ZATCA VAT return · Q4 2026", "إقرار ضريبة القيمة المضافة · الربع الرابع 2026"),
    short: bi("VAT return", "إقرار الضريبة"),
    authority: "ZATCA",
    kind: bi("ZATCA · VAT return", "الزكاة · ضريبة القيمة المضافة"),
    period: bi("Q4 · Oct to Dec", "الربع الرابع · أكتوبر لديسمبر"),
    periodLong: bi("Q4 2026 · Oct to Dec", "الربع الرابع 2026 · أكتوبر لديسمبر"),
    due: "2027-01-31",
    status: "collecting",
    preparedBy: "sulami",
    signer: "sulami",
    scope: bi("1 Oct–22 Nov 2026 so far · all branches", "1 أكتوبر–22 نوفمبر 2026 لين الحين · كل الفروع"),
    checks: [],
    sections: [
      { id: "sales", name: bi("Standard-rated sales", "المبيعات الخاضعة للنسبة الأساسية"), value: bi("SAR 3.12M", "3.12 مليون ر.س") },
      { id: "exempt", name: bi("Exempt medical services", "خدمات طبية معفاة"), value: bi("SAR 1.48M", "1.48 مليون ر.س") },
      { id: "vatSales", name: bi("VAT on sales", "ضريبة المبيعات"), value: bi("SAR 468k", "468 ألف ر.س") },
      { id: "vatBuy", name: bi("VAT on purchases", "ضريبة المشتريات"), value: bi("SAR 121k", "121 ألف ر.س") },
    ],
    past: [
      { period: bi("Q3 2026", "الربع الثالث 2026"), submitted: "2026-10-27", ref: "ZATCA-2603-0442" },
      { period: bi("Q2 2026", "الربع الثاني 2026"), submitted: "2026-07-28", ref: "ZATCA-2602-0442" },
    ],
  },
  {
    id: "cchi-claims-q3",
    code: "2603",
    name: bi("Claims summary", "ملخص المطالبات"),
    title: bi("CCHI claims summary · Q3 2026", "ملخص مطالبات مجلس الضمان · الربع الثالث 2026"),
    short: bi("CCHI return", "إقرار مجلس الضمان"),
    authority: "CCHI",
    kind: bi("CCHI · claims summary", "مجلس الضمان · ملخص المطالبات"),
    period: bi("Q3 · Jul to Sep", "الربع الثالث · يوليو لسبتمبر"),
    periodLong: bi("Q3 2026 · Jul to Sep", "الربع الثالث 2026 · يوليو لسبتمبر"),
    due: "2026-10-31",
    status: "submitted",
    submitted: { at: "2026-10-28T11:20", ref: "CCHI-2603-0442", by: "sulami" },
    collected: "2026-10-05T23:00",
    preparedBy: "sulami",
    signer: "sulami",
    scope: bi("Q3 2026 · all branches", "الربع الثالث 2026 · كل الفروع"),
    checks: [],
    sections: [
      { id: "claims", name: bi("Claims sent", "المطالبات المرسلة"), value: bi("11,940", "11,940") },
      { id: "paid", name: bi("Claims paid", "المطالبات المدفوعة"), value: bi("11,286", "11,286") },
      { id: "rejected", name: bi("Rejection rate", "نسبة الرفض"), value: bi("3.9%", "3.9%") },
    ],
    past: [{ period: bi("Q2 2026", "الربع الثاني 2026"), submitted: "2026-07-29", ref: "CCHI-2602-0442" }],
  },
  {
    id: "moh-monthly-2610",
    code: "2610",
    name: bi("Monthly statistics", "الإحصائية الشهرية"),
    title: bi("MOH monthly statistics · October 2026", "إحصائية الوزارة الشهرية · أكتوبر 2026"),
    short: bi("MOH return", "إقرار الوزارة"),
    authority: "MOH",
    kind: bi("MOH · monthly statistics", "الوزارة · الإحصائية الشهرية"),
    period: bi("October", "أكتوبر"),
    periodLong: bi("October 2026", "أكتوبر 2026"),
    due: "2026-11-10",
    status: "submitted",
    submitted: { at: "2026-11-08T10:05", ref: moh("10"), by: "ghamdi" },
    collected: "2026-11-01T23:00",
    preparedBy: "fahad",
    signer: "ghamdi",
    scope: bi("October 2026 · Riyadh main branch", "أكتوبر 2026 · فرع الرياض الرئيسي"),
    checks: [],
    sections: [
      { id: "outpatient", name: bi("Outpatient visits", "زيارات العيادات الخارجية"), value: bi("7,936", "7,936") },
      { id: "new", name: bi("New patients", "المرضى الجدد"), value: bi("1,074", "1,074") },
      { id: "dental", name: bi("Dental procedures", "إجراءات الأسنان"), value: bi("2,380", "2,380") },
    ],
    past: [
      { period: bi("September 2026", "سبتمبر 2026"), submitted: "2026-10-09", ref: moh("09") },
      { period: bi("August 2026", "أغسطس 2026"), submitted: "2026-09-07", ref: moh("08") },
    ],
  },
]

export const returnById = (id: string) => RETURNS.find((r) => r.id === id)
