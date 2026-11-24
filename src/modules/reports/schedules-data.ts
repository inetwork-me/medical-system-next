import type { Bi } from "@/lib/mock/bi"
import { PEOPLE, type Recipient, type Schedule } from "./data"

/*
 * The design's six scheduled reports (Schedules tab). They are the one source for "when / to whom / as what": the
 * Library's Schedule column, the report's "Sent by email" card and the Schedule dialog's Edit all read these (and the
 * session's changes on top, store.ts). A failed send keeps the address that bounced so Fix can point at it.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })
const staff = (id: string): Recipient => {
  const p = PEOPLE.find((x) => x.id === id)!
  return { personId: id, email: p.email, name: p.name, role: p.role, initials: p.initials }
}
const other = (email: string, initials: string, name: Bi, role: Bi): Recipient => ({ email, initials, name, role })

const doctors: Recipient[] = [
  other("n.almutairi@clinic.sa", "NM", bi("Dr. Noura Al-Mutairi", "د. نورة المطيري"), bi("Internist", "طبيبة باطنية")),
  other("s.otaibi@clinic.sa", "SO", bi("Dr. Sami Al-Otaibi", "د. سامي العتيبي"), bi("Cardiologist", "أخصائي قلب")),
  other("a.zaki@clinic.sa", "AZ", bi("Dr. Ahmed Zaki", "د. أحمد زكي"), bi("Pediatrician", "طبيب أطفال")),
  other("h.nasser@clinic.sa", "HN", bi("Dr. Hala Nasser", "د. هالة ناصر"), bi("Dermatologist", "طبيبة جلدية")),
  other("l.alsaud@clinic.sa", "LS", bi("Dr. Lama Al-Saud", "د. لمى آل سعود"), bi("Dentist", "طبيبة أسنان")),
  other("f.alshehri@clinic.sa", "FS", bi("Dr. Faisal Al-Shehri", "د. فيصل الشهري"), bi("Family physician", "طبيب أسرة")),
  other("r.alharbi@clinic.sa", "RH", bi("Dr. Reem Al-Harbi", "د. ريم الحربي"), bi("Ophthalmologist", "طبيبة عيون")),
  other("m.aldosari@clinic.sa", "MD", bi("Dr. Majid Al-Dosari", "د. ماجد الدوسري"), bi("Family physician", "طبيب أسرة")),
]
const BOUNCED = "a.alzahrani@clinc.sa"

export const SCHEDULES: Schedule[] = [
  {
    id: "sch-no-shows-by-clinic",
    target: "no-shows-by-clinic",
    targetName: bi("No-shows by clinic", "عدم الحضور حسب العيادة"),
    frequency: "weekly",
    day: 0,
    time: "08:00",
    recipients: ["ghamdi", "fahad", "harthi"].map(staff),
    format: "pdf",
    skipUnchanged: false,
    status: "active",
  },
  {
    id: "sch-waiting-time-by-hour",
    target: "waiting-time-by-hour",
    targetName: bi("Waiting time by hour", "وقت الانتظار حسب الساعة"),
    frequency: "daily",
    day: 0,
    time: "07:00",
    recipients: [
      ...["fahad", "ghamdi", "harthi"].map(staff),
      other("frontdesk.olaya@clinic.sa", "FO", bi("Olaya front desk", "استقبال العليا"), bi("Shared inbox", "بريد مشترك")),
      other("ops@clinic.sa", "OP", bi("Operations team", "فريق التشغيل"), bi("Shared inbox", "بريد مشترك")),
    ],
    format: "pdf",
    skipUnchanged: true,
    status: "active",
  },
  {
    id: "sch-cash-collected-by-user",
    target: "cash-collected-by-user",
    targetName: bi("Cash collected by user", "الكاش المحصّل حسب الموظف"),
    frequency: "daily",
    day: 0,
    time: "23:00",
    recipients: [staff("sulami"), staff("qahtani")],
    format: "xlsx",
    skipUnchanged: false,
    status: "active",
  },
  {
    id: "sch-claim-rejections-by-insurer",
    target: "claim-rejections-by-insurer",
    targetName: bi("Claim rejections by insurer", "المطالبات المرفوضة حسب الشركة"),
    frequency: "monthly",
    day: 1,
    time: "09:00",
    recipients: [staff("sulami"), staff("qahtani"), other("finance@clinic.sa", "FT", bi("Finance team", "فريق المالية"), bi("Shared inbox", "بريد مشترك")), { email: BOUNCED }],
    format: "xlsx",
    skipUnchanged: false,
    status: "failed",
    failure: bi("Email bounced · 1 address", "إيميل رجع · عنوان واحد"),
    bounced: BOUNCED,
  },
  {
    id: "sch-notes-on-time",
    target: "notes-on-time",
    targetName: bi("Doctor notes signed on time", "ملاحظات الأطباء الموقّعة بوقتها"),
    frequency: "monthly",
    day: 1,
    time: "09:00",
    recipients: [staff("ghamdi"), staff("harthi"), staff("mansour"), staff("sahli"), ...doctors],
    format: "pdf",
    skipUnchanged: false,
    status: "active",
  },
  {
    id: "sch-antibiotic-prescribing",
    target: "antibiotic-prescribing",
    targetName: bi("Antibiotic prescribing", "وصف المضادات الحيوية"),
    frequency: "quarterly",
    day: 1,
    time: "09:00",
    recipients: [staff("ghamdi"), ...doctors.slice(0, 5)],
    format: "pdf",
    skipUnchanged: false,
    status: "paused",
  },
]
