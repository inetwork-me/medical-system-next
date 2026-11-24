import type { Bi } from "@/lib/mock/bi"
import type { AreaId } from "./overview-data"
import type { MeasureId, SourceId } from "./measures"
import type { ReportFilters } from "./data"

/*
 * Saved reports (the Library) and what each one shows on the Report page. A saved report stores its source, measure,
 * grouping, filters, chart type, owner, folder and visibility (brief §4); the viewer reads the measure definition for
 * its About card and its colours. The design's seven are first; 35 more make the library's counts real
 * (All 42 · Mine 9 · Shared with me 12 · Scheduled 11).
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

/** One group (clinic, insurer, doctor…) of a report: this period, the period before, and the base it's out of. */
export type ReportRow = { key: string; label: Bi; now: number; before: number; base?: number; count?: number }

/** Where Open sends a row: the module list, where the normal permissions apply (never patient data in the report). */
export type DrillTo = "appointmentsNoShows" | "claims" | "completion" | "none"

export type ShareEntry = { kind: "role" | "person"; id: string; access: "view" | "edit" }

export type SavedReport = {
  id: string
  name: Bi
  desc: Bi
  area: AreaId
  owner: string
  source: SourceId
  measure: MeasureId
  groupBy: "clinic" | "insurer" | "doctor" | "hour" | "test" | "user"
  chart: "bars" | "line" | "table"
  folder: AreaId
  visibility: "me" | "team" | "everyone"
  lastRun: string
  /** Schedule line ("Every Sunday"), when it's sent by email. */
  schedule?: { freq: "daily" | "weekly" | "monthly"; day: number; time: string; format: "pdf" | "xlsx"; recipients: string[] }
  sharedWithMe?: boolean
  shares: ShareEntry[]
  rows: ReportRow[]
  /** Why the biggest change happened (written by the owner; shown under "Biggest change"). */
  cause?: Bi
  drill: DrillTo
  refresh: Bi
  /** Tile extras (missed visits of N booked, revenue missed). */
  extra?: { missed?: number; booked?: number; revenueMissed?: number }
  /** What the builder stores besides the fields above: the second grouping and the filter rows. */
  builder?: { thenBy: SavedReport["groupBy"] | "none"; filters: ReportFilters; dated: boolean; status: boolean }
}

const clinic = (key: string, en: string, ar: string, now: number, before: number, base?: number, count?: number): ReportRow => ({ key, label: bi(en, ar), now, before, base, count })

export const LIBRARY: SavedReport[] = [
  {
    id: "no-shows-by-clinic",
    name: bi("No-shows by clinic", "عدم الحضور حسب العيادة"),
    desc: bi("Booked vs no-show, with last month", "المحجوز مقابل اللي ما حضروا، مع الشهر اللي فات"),
    area: "operations",
    owner: "fahad",
    source: "appointments",
    measure: "noShowRate",
    groupBy: "clinic",
    chart: "bars",
    folder: "operations",
    visibility: "team",
    lastRun: "2026-11-22T08:00",
    schedule: { freq: "weekly", day: 0, time: "08:00", format: "pdf", recipients: ["ghamdi", "fahad", "harthi"] },
    shares: [
      { kind: "role", id: "clinicManagers", access: "view" },
      { kind: "role", id: "frontOffice", access: "view" },
    ],
    rows: [
      clinic("dental", "Dental", "الأسنان", 13.6, 10.1, 1712, 233),
      clinic("dermatology", "Dermatology", "الجلدية", 10.9, 11.4, 1100, 120),
      clinic("eyes", "Eyes", "العيون", 9.4, 9.9, 1148, 108),
      clinic("family", "Family medicine", "طب الأسرة", 8.8, 9.6, 1954, 172),
      clinic("cardiology", "Cardiology", "القلب", 8.1, 8.7, 1317, 107),
      clinic("pediatrics", "Pediatrics", "الأطفال", 7.2, 8.0, 2069, 149),
    ],
    cause: bi("The reminder SMS moved from 24 h to 2 h before the visit on 3 Nov.", "رسالة التذكير صارت قبل الموعد بساعتين بدل 24 ساعة من 3 نوفمبر."),
    drill: "appointmentsNoShows",
    refresh: bi("Today 10:00 · every hour", "اليوم 10:00 · كل ساعة"),
    extra: { missed: 889, booked: 9300, revenueMissed: 182_000 },
  },
  {
    id: "claim-rejections-by-insurer",
    name: bi("Claim rejections by insurer", "المطالبات المرفوضة حسب الشركة"),
    desc: bi("Reasons, amounts, trend", "الأسباب والمبالغ والاتجاه"),
    area: "finance",
    owner: "sulami",
    source: "claims",
    measure: "claimRejections",
    groupBy: "insurer",
    chart: "bars",
    folder: "finance",
    visibility: "team",
    lastRun: "2026-11-21T07:00",
    schedule: { freq: "monthly", day: 1, time: "07:00", format: "xlsx", recipients: ["sulami", "qahtani"] },
    shares: [{ kind: "role", id: "financeTeam", access: "view" }],
    rows: [
      clinic("bupa", "Bupa Arabia", "بوبا العربية", 5.2, 4.1, 1640, 85),
      clinic("tawuniya", "Tawuniya", "التعاونية", 4.0, 3.6, 1010, 40),
      clinic("medgulf", "MedGulf", "ميدغلف", 3.9, 3.4, 790, 31),
      clinic("alrajhi", "Al Rajhi Takaful", "تكافل الراجحي", 2.4, 2.6, 690, 17),
    ],
    cause: bi("Bupa started rejecting physiotherapy without a pre-authorization on 5 Nov.", "بوبا صارت ترفض العلاج الطبيعي بدون موافقة مسبقة من 5 نوفمبر."),
    drill: "claims",
    refresh: bi("Today 07:00 · every day", "اليوم 07:00 · كل يوم"),
  },
  {
    id: "waiting-time-by-hour",
    name: bi("Waiting time by hour", "وقت الانتظار حسب الساعة"),
    desc: bi("Check-in to doctor, per clinic", "من التسجيل للطبيب، لكل عيادة"),
    area: "operations",
    owner: "fahad",
    source: "visits",
    measure: "avgWait",
    groupBy: "hour",
    chart: "bars",
    folder: "operations",
    visibility: "team",
    lastRun: "2026-11-22T08:00",
    schedule: { freq: "daily", day: 0, time: "08:00", format: "pdf", recipients: ["fahad"] },
    sharedWithMe: true,
    shares: [{ kind: "role", id: "frontOffice", access: "view" }],
    rows: [
      clinic("h08", "08:00–10:00", "08:00–10:00", 12, 13),
      clinic("h10", "10:00–12:00", "10:00–12:00", 21, 17),
      clinic("h12", "12:00–14:00", "12:00–14:00", 19, 18),
      clinic("h16", "16:00–18:00", "16:00–18:00", 23, 22),
      clinic("h18", "18:00–20:00", "18:00–20:00", 16, 17),
    ],
    cause: bi("Two doctors moved their clinic to the morning from 8 Nov.", "طبيبين نقلوا عيادتهم للصبح من 8 نوفمبر."),
    drill: "none",
    refresh: bi("Today 10:00 · every hour", "اليوم 10:00 · كل ساعة"),
  },
  {
    id: "antibiotic-prescribing",
    name: bi("Antibiotic prescribing", "وصف المضادات الحيوية"),
    desc: bi("By doctor and diagnosis", "حسب الطبيب والتشخيص"),
    area: "clinical",
    owner: "ghamdi",
    source: "prescriptions",
    measure: "antibiotics",
    groupBy: "doctor",
    chart: "bars",
    folder: "clinical",
    visibility: "everyone",
    lastRun: "2026-11-20T09:00",
    sharedWithMe: true,
    shares: [{ kind: "role", id: "doctors", access: "view" }],
    rows: [
      clinic("zaki", "Dr. Ahmed Zaki", "د. أحمد زكي", 18, 16),
      clinic("lama", "Dr. Lama Al-Saud", "د. لمى آل سعود", 15, 17),
      clinic("reem", "Dr. Reem Al-Otaibi", "د. ريم العتيبي", 9, 10),
      clinic("khaled", "Dr. Khaled Mansour", "د. خالد منصور", 7, 8),
    ],
    drill: "none",
    refresh: bi("20 Nov · when opened", "20 نوفمبر · لما ينفتح"),
  },
  {
    id: "notes-on-time",
    name: bi("Doctor notes signed on time", "ملاحظات الأطباء الموقّعة بوقتها"),
    desc: bi("From Medical records", "من الملفات الطبية"),
    area: "doctors",
    owner: "ghamdi",
    source: "visits",
    measure: "notesOnTime",
    groupBy: "doctor",
    chart: "bars",
    folder: "doctors",
    visibility: "everyone",
    lastRun: "2026-11-01T07:00",
    schedule: { freq: "monthly", day: 1, time: "07:00", format: "pdf", recipients: ["ghamdi"] },
    sharedWithMe: true,
    shares: [{ kind: "role", id: "doctors", access: "view" }],
    rows: [
      clinic("zaki", "Dr. Ahmed Zaki", "د. أحمد زكي", 98, 97),
      clinic("lama", "Dr. Lama Al-Saud", "د. لمى آل سعود", 97, 96),
      clinic("hala", "Dr. Hala Nasser", "د. هالة ناصر", 96, 95),
      clinic("khaled", "Dr. Khaled Mansour", "د. خالد منصور", 91, 93),
      clinic("sami", "Dr. Sami Al-Otaibi", "د. سامي العتيبي", 84, 90),
    ],
    cause: bi("Dr. Sami covered the ER nights in the second week.", "د. سامي غطّى مناوبات الطوارئ الليلية بالأسبوع الثاني."),
    drill: "completion",
    refresh: bi("1 Nov · every month", "1 نوفمبر · كل شهر"),
  },
  {
    id: "cash-collected-by-user",
    name: bi("Cash collected by user", "الكاش المحصّل حسب الموظف"),
    desc: bi("For the end-of-day close", "لإقفال آخر اليوم"),
    area: "finance",
    owner: "sulami",
    source: "invoices",
    measure: "revenue",
    groupBy: "user",
    chart: "table",
    folder: "finance",
    visibility: "team",
    lastRun: "2026-11-21T23:00",
    schedule: { freq: "daily", day: 0, time: "23:00", format: "xlsx", recipients: ["sulami"] },
    shares: [{ kind: "role", id: "financeTeam", access: "view" }],
    rows: [
      clinic("nora", "Nora Al-Fahad", "نورة الفهد", 18_400, 17_900),
      clinic("majed", "Majed Al-Sahli", "ماجد السهلي", 9_250, 10_100),
      clinic("hessa", "Hessa Al-Ghamdi", "حصة الغامدي", 7_600, 7_200),
    ],
    drill: "none",
    refresh: bi("Yesterday 23:00 · every day", "أمس 23:00 · كل يوم"),
  },
  {
    id: "lab-turnaround-by-test",
    name: bi("Lab turnaround by test", "وقت نتائج المختبر حسب التحليل"),
    desc: bi("Sample to result", "من العينة للنتيجة"),
    area: "clinical",
    owner: "sahli",
    source: "lab",
    measure: "labTurnaround",
    groupBy: "test",
    chart: "bars",
    folder: "clinical",
    visibility: "everyone",
    lastRun: "2026-11-18T12:00",
    sharedWithMe: true,
    shares: [{ kind: "role", id: "clinicManagers", access: "view" }],
    rows: [
      clinic("vitd", "Vitamin D", "فيتامين د", 6.5, 5.1),
      clinic("hba1c", "HbA1c", "HbA1c", 3.1, 3.3),
      clinic("kft", "Kidney function", "وظائف الكلى", 2.6, 2.7),
      clinic("cbc", "CBC", "CBC", 1.4, 1.5),
    ],
    cause: bi("Vitamin D is sent to the reference lab since 9 Nov.", "فيتامين د صار يرسل لمختبر مرجعي من 9 نوفمبر."),
    drill: "none",
    refresh: bi("18 Nov · when opened", "18 نوفمبر · لما ينفتح"),
  },
]

/* The rest of the library (seeded so the counts and Show more are real rows). */
{
  const topics: [string, string, AreaId, SourceId, MeasureId][] = [
    ["New patients by source", "المرضى الجدد حسب المصدر", "operations", "visits", "newPatients"],
    ["Room use by hour", "استخدام الغرف حسب الساعة", "operations", "appointments", "roomsInUse"],
    ["Revenue by service", "الإيرادات حسب الخدمة", "finance", "invoices", "revenue"],
    ["Claims waiting by insurer", "المطالبات بالانتظار حسب الشركة", "finance", "claims", "claimRejections"],
    ["Top diagnoses by clinic", "أكثر التشخيصات حسب العيادة", "clinical", "visits", "visits"],
    ["Visit length by doctor", "مدة الزيارة حسب الطبيب", "doctors", "visits", "avgVisit"],
    ["Patient rating by clinic", "تقييم المرضى حسب العيادة", "doctors", "visits", "rating"],
  ]
  const owners = ["fahad", "sulami", "ghamdi", "sahli", "mansour"]
  for (let i = 0; i < 35; i++) {
    const [en, ar, area, source, measure] = topics[i % topics.length]
    const n = Math.floor(i / topics.length) + 2
    // 9 of the library are the signed-in doctor's own (Mine · 9).
    const owner = i < 9 ? "mansour" : owners[i % 4]
    const day = String(19 - (i % 18)).padStart(2, "0")
    LIBRARY.push({
      id: `rep-${i + 1}`,
      name: bi(`${en} · ${n}`, `${ar} · ${n}`),
      desc: bi("Saved from the builder", "محفوظ من منشئ التقارير"),
      area,
      owner,
      source,
      measure,
      groupBy: "clinic",
      chart: i % 3 === 0 ? "table" : "bars",
      folder: area,
      visibility: i < 9 ? "me" : "team",
      lastRun: `2026-11-${day}T09:00`,
      // 6 more are scheduled (Scheduled · 11) and 8 more are shared with the signed-in user (Shared with me · 12).
      schedule: i >= 10 && i < 16 ? { freq: "weekly", day: 1, time: "07:00", format: "pdf", recipients: [owner] } : undefined,
      sharedWithMe: i >= 16 && i < 24,
      shares: [],
      rows: [
        clinic("pediatrics", "Pediatrics", "الأطفال", 40 + (i % 7), 38 + (i % 5)),
        clinic("dental", "Dental", "الأسنان", 31 + (i % 4), 33),
        clinic("cardiology", "Cardiology", "القلب", 27, 25 + (i % 3)),
      ],
      drill: "none",
      refresh: bi("When opened", "لما ينفتح"),
    })
  }
}

export const reportById = (id: string) => LIBRARY.find((r) => r.id === id)

/** Roles a report can be shared with (each person still sees only their own branches). */
export const SHARE_ROLES: { id: string; initials: string; name: Bi; people: number }[] = [
  { id: "clinicManagers", initials: "CM", name: bi("Clinic managers", "مدراء العيادات"), people: 6 },
  { id: "frontOffice", initials: "FO", name: bi("Front office", "الاستقبال"), people: 5 },
  { id: "financeTeam", initials: "FT", name: bi("Finance team", "فريق المالية"), people: 4 },
  { id: "doctors", initials: "DR", name: bi("Doctors", "الأطباء"), people: 46 },
]
