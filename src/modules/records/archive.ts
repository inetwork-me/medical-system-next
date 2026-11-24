import type { Bi } from "@/lib/mock/bi"
import type { AccessEvent, Encounter, RecDocument, RecPatient, RecordsRequest, UserKey, VisitNote } from "./data"

/*
 * Dr. Khaled's older signed notes this month (Visit notes "Showing 6 of 37" · Show more · "Show 31 more" on mobile).
 * Built from a fixed seed so every visit to the page shows the same rows; the design's rows stay in data.ts.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

const FIRST: [string, string, "m" | "f"][] = [
  ["Ahmed", "أحمد", "m"],
  ["Noura", "نورة", "f"],
  ["Saleh", "صالح", "m"],
  ["Hessa", "حصة", "f"],
  ["Majid", "ماجد", "m"],
  ["Latifa", "لطيفة", "f"],
  ["Bandar", "بندر", "m"],
  ["Amal", "أمل", "f"],
  ["Faisal", "فيصل", "m"],
  ["Rana", "رنا", "f"],
  ["Ibrahim", "إبراهيم", "m"],
]
const FAMILY: [string, string][] = [
  ["Al-Ghamdi", "الغامدي"],
  ["Al-Zahrani", "الزهراني"],
  ["Al-Anazi", "العنزي"],
  ["Al-Rashid", "الراشد"],
  ["Al-Shahrani", "الشهراني"],
  ["Al-Juhani", "الجهني"],
  ["Al-Malki", "المالكي"],
]
const KINDS: [Bi, string, Bi][] = [
  [bi("Follow-up", "متابعة"), "I10", bi("hypertension", "ضغط الدم")],
  [bi("Follow-up", "متابعة"), "I25.1", bi("coronary disease", "مرض الشريان التاجي")],
  [bi("Echo review", "مراجعة إيكو"), "I34.0", bi("echo review", "مراجعة إيكو")],
  [bi("New patient", "مريض جديد"), "R00.2", bi("palpitations", "خفقان")],
  [bi("Follow-up", "متابعة"), "I48", bi("atrial fibrillation", "رجفان أذيني")],
  [bi("Follow-up", "متابعة"), "E78.5", bi("lipids", "الدهون")],
]
const CARDIO = bi("Cardiology", "القلب")

export const ARCHIVE_PATIENTS: Record<string, RecPatient> = {}
export const ARCHIVE_ENCOUNTERS: Encounter[] = []
export const ARCHIVE_NOTES: VisitNote[] = []

// 31 notes, newest first: 21 Nov back to 2 Nov, two or so a day.
for (let i = 0; i < 31; i++) {
  const [fen, far, sex] = FIRST[i % FIRST.length]
  const [len, lar] = FAMILY[(i * 3) % FAMILY.length]
  const key = `arc${i + 1}`
  const mrn = `MRN-${String(10233 + i * 457).padStart(5, "0")}`
  ARCHIVE_PATIENTS[key] = {
    initials: `${fen[0]}${len.replace("Al-", "")[0]}`,
    name: bi(`${fen} ${len}`, `${far} ${lar}`),
    mrn,
    age: 34 + ((i * 7) % 41),
    sex,
    careTeam: ["khaled"],
    allergies: [],
  }
  const day = 21 - Math.floor(i / 1.6)
  const hour = 8 + ((i * 5) % 9)
  const at = `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${i % 2 ? "30" : "10"}`
  const [kind, code, reason] = KINDS[i % KINDS.length]
  const id = `V-2611-${String(1700 - i * 13).padStart(5, "0")}`
  ARCHIVE_ENCOUNTERS.push({ id, patient: key, doctor: "khaled", clinic: CARDIO, kind, reason, at })
  const signedAt = `${at.slice(0, 11)}${String(Math.min(hour + 2, 20)).padStart(2, "0")}:05`
  ARCHIVE_NOTES.push({
    id: `VN-2611-${1700 - i * 13}`,
    encounter: id,
    author: "khaled",
    createdAt: at,
    signedAt,
    subjective: bi("", ""),
    objective: bi("", ""),
    diagnoses: [{ code, type: "main" }],
    orders: [],
    medicines: [],
    advice: bi("", ""),
    addenda: [],
  })
}

/*
 * Older documents (Documents "Showing 7 of 48" · Show more): 18 prescriptions, 8 sick leaves, 9 reports
 * and 6 referrals, on the archive patients, newest first.
 */
export const ARCHIVE_DOCUMENTS: RecDocument[] = []
{
  const kinds: ["prescription" | "sickLeave" | "report" | "referral", number][] = [
    ["prescription", 18],
    ["sickLeave", 8],
    ["report", 9],
    ["referral", 6],
  ]
  const order: ("prescription" | "sickLeave" | "report" | "referral")[] = []
  const left = Object.fromEntries(kinds) as Record<string, number>
  while (order.length < 41) for (const [k] of kinds) if (left[k]-- > 0) order.push(k)
  const prefix = { prescription: "RX", sickLeave: "SL", report: "MR", referral: "RF" } as const
  const seq = { prescription: 340, sickLeave: 80, report: 50, referral: 20 }
  order.forEach((kind, i) => {
    const e = ARCHIVE_ENCOUNTERS[i % ARCHIVE_ENCOUNTERS.length]
    const no = `${prefix[kind]}-2611-${String(seq[kind]--).padStart(4, "0")}`
    // Older than the design's rows (the last one is 21 Oct): 1–20 Oct, newest first.
    const at = `2026-10-${String(20 - Math.floor(i / 2.2)).padStart(2, "0")}T${String(9 + (i % 8)).padStart(2, "0")}:15`
    const n = 1 + (i % 3)
    const details =
      kind === "prescription"
        ? bi(`${n === 1 ? "1 medicine" : `${n} medicines`} · picked up`, `${n === 1 ? "دواء واحد" : n === 2 ? "دوائين" : `${n} أدوية`} · استلمها`)
        : kind === "sickLeave"
          ? bi(`${n} ${n === 1 ? "day" : "days"} · Seha ref. ${4471800 + i}`, `${n === 1 ? "يوم" : n === 2 ? "يومين" : `${n} أيام`} · مرجع صحة ${4471800 + i}`)
          : kind === "report"
            ? bi("For the insurer · 1 page", "لشركة التأمين · صفحة وحدة")
            : bi("Echo lab · inside Al Noor", "معمل الإيكو · داخل النور")
    ARCHIVE_DOCUMENTS.push({
      no,
      kind,
      patient: e.patient,
      at,
      status: kind === "referral" ? "issued" : kind === "prescription" || kind === "report" ? "sent" : "issued",
      details,
      doctor: "khaled",
      signedAt: at,
      verifyCode: kind === "prescription" || kind === "referral" ? undefined : `${prefix[kind]}${i}-${no.slice(-3)}`,
      shares: [{ to: "patient", name: bi("Patient", "المريض"), via: "sms" }],
      history: [{ at, text: bi("Signed by Dr. Khaled Mansour", "وقّعه د. خالد منصور") }],
    })
  })
}

/*
 * Older requests for records (Requests "Released · 38", "Rejected · 3", "Showing 6 of 45"): 37 released and 2 rejected,
 * on the archive patients, newest first.
 */
export const ARCHIVE_REQUESTS: RecordsRequest[] = []
{
  const froms: RecordsRequest["from"][] = ["patient", "insurer", "patient", "hospital", "insurer"]
  const insurers: [string, string][] = [["Bupa Arabia", "بوبا العربية"], ["Tawuniya", "التعاونية"], ["MedGulf", "ميدغلف"]]
  for (let i = 0; i < 39; i++) {
    const e = ARCHIVE_ENCOUNTERS[i % ARCHIVE_ENCOUNTERS.length]
    const day = 30 - Math.floor(i / 1.4)
    const month = day > 0 ? "10" : "09"
    const d = day > 0 ? day : day + 30
    const received = `2026-${month}-${String(d).padStart(2, "0")}T10:00`
    const from = froms[i % froms.length]
    const [ien, iar] = insurers[i % insurers.length]
    const who = from === "insurer" ? bi(ien, iar) : from === "hospital" ? bi("King Fahad Medical City", "مدينة الملك فهد الطبية") : bi("The patient", "المريض")
    const rejected = i === 11 || i === 27
    const no = `REQ-26${month}-${String(90 - i).padStart(3, "0")}`
    const st = (en: string, ar: string) => ({ at: received, text: bi(en, ar) })
    ARCHIVE_REQUESTS.push({
      no,
      from,
      patient: e.patient,
      requester: who,
      requesterShort: who,
      summary: from === "insurer" ? bi(`${ien} · claim review`, `${iar} · مراجعة مطالبة`) : from === "hospital" ? bi("King Fahad Medical City · referral", "مدينة الملك فهد الطبية · تحويل") : bi("Personal copy", "نسخة شخصية"),
      purpose: from === "insurer" ? bi("Claim review", "مراجعة مطالبة") : bi("Personal copy", "نسخة شخصية"),
      receivedAt: received,
      due: `2026-${month === "10" ? "11" : "10"}-${String(Math.min(d, 28)).padStart(2, "0")}`,
      steps: rejected
        ? { received: st("Received", "انستلم") }
        : {
            received: st("Received", "انستلم"),
            identity: st("Identity checked", "تأكدنا من الهوية"),
            consent: st("Signed with Nafath", "انوقّعت عبر نفاذ"),
            prepared: st("Prepared · Nora Al-Fahad", "تجهّز · نورة الفهد"),
            review: st("Reviewed · nothing removed", "انراجع · ما انشال شي"),
            released: st("Secure link", "رابط آمن"),
          },
      rejected: rejected ? { at: received, why: bi("No patient consent", "ما فيه موافقة المريض") } : undefined,
      asked: ["notes", "labs"],
      consentCovers: rejected ? [] : ["notes", "labs"],
      parts: rejected ? [] : ["notes", "labs"],
      pages: rejected ? undefined : { notes: 3 + (i % 5), labs: 2 + (i % 3) },
      release: rejected ? undefined : { at: received, via: "link", expiresDays: 7, passwordSms: true },
      papers: [],
    })
  }
}

/*
 * The rest of today's access log ("Today · 1,284", "Showing 5 of 1,284 today"): ordinary opens and prints by the
 * care teams, newest first from 08:45 back to midnight. All normal (the flagged ones are the design's rows).
 */
export const ARCHIVE_ACCESS: AccessEvent[] = []
{
  const who: UserKey[] = ["khaled", "sami", "amal", "zaki", "nora", "hala", "majed"]
  const why: Record<string, Bi> = {
    khaled: bi("Visit today", "زيارة اليوم"),
    sami: bi("Visit today", "زيارة اليوم"),
    zaki: bi("Visit today", "زيارة اليوم"),
    hala: bi("Visit today", "زيارة اليوم"),
    amal: bi("Vitals", "العلامات الحيوية"),
    nora: bi("Check-in", "تسجيل الحضور"),
    majed: bi("Prescription from the clinic", "وصفة من العيادة"),
  }
  const keys = Object.keys(ARCHIVE_PATIENTS)
  const N = 1280
  for (let i = 0; i < N; i++) {
    // Before the design's rows (the earliest is 08:47), back to just after midnight.
    const mins = 8 * 60 + 45 - Math.floor((i * (8 * 60 + 40)) / N)
    const at = `2026-11-23T${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
    const user = who[i % who.length]
    const print = user === "nora" && i % 3 === 0
    ARCHIVE_ACCESS.push({
      id: `ax-a${i}`,
      at,
      user,
      patient: keys[(i * 7) % keys.length],
      action: print ? "print" : "open",
      pages: print ? 1 + (i % 4) : undefined,
      why: why[user],
      flag: "normal",
    })
  }
}
