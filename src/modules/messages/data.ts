import type { Bi } from "@/lib/mock/bi"
import type {
  AuditEvent,
  ChatMessage,
  ChatRoom,
  Connection,
  Consent,
  Contact,
  Mailbox,
  Membership,
  Partner,
  PartnerType,
  PatientThread,
  Policies,
  RoleRule,
  Signature,
  SmsAccount,
  Staff,
  StaffKey,
  Template,
  Thread,
} from "./types"

/*
 * Messages sample data (design v8.0 · design-scripts/msg_widgets.py + _msg_body.py). Rows the design draws are here as
 * drawn; rows it only counts ("Unread · 7", "Mine · 3") are added so every count on screen comes from the data.
 * The signed-in user is Dr. Khaled Mansour, head of cardiology and Messages admin ("lead" demo role).
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

/** Messages demo clock: Wednesday 25 Nov 2026 (the design's "today"; mail from 24 Nov reads as yesterday). */
export const MSG_TODAY = "2026-11-25"
export const MSG_NOW = `${MSG_TODAY}T11:00`

export const ORG_DOMAIN = "alnoor.sa"
export const CENTER = bi("Al Noor Medical Center", "مجمع النور الطبي")

/* ------------------------------------------------------------------ staff */

const s = (key: StaffKey, initials: string, en: string, ar: string, title: Bi, role: Staff["role"], extra: Partial<Staff> = {}): Staff => ({
  key,
  initials,
  name: bi(en, ar),
  title,
  role,
  presence: "offline",
  branch: "olaya",
  ...extra,
})

const CLAIMS = bi("Claims", "المطالبات")
const RECEPTION = bi("Reception", "الاستقبال")
const BILLING = bi("Billing", "الفواتير")
const HR = bi("HR", "الموارد البشرية")

export const STAFF: Record<StaffKey, Staff> = {
  khaled: s("khaled", "KM", "Dr. Khaled Mansour", "د. خالد منصور", bi("Head of cardiology", "رئيس القلب"), "doctor", {
    email: "khaled.mansour@alnoor.sa",
    team: bi("Cardiology", "القلب"),
    presence: "online",
    recUser: "khaled",
  }),
  sami: s("sami", "SA", "Dr. Sami Al-Otaibi", "د. سامي العتيبي", bi("Cardiologist", "استشاري قلب"), "doctor", {
    email: "sami.otaibi@alnoor.sa",
    availability: bi("In clinic until 14:00", "في العيادة لين 14:00"),
    team: bi("Cardiology", "القلب"),
    presence: "online",
    recUser: "sami",
  }),
  lama: s("lama", "LH", "Dr. Lama Al-Harbi", "د. لمى الحربي", bi("Cardiologist", "استشارية قلب"), "doctor", {
    email: "lama.harbi@alnoor.sa",
    team: bi("Cardiology", "القلب"),
    female: true,
    presence: "online",
  }),
  amal: s("amal", "AM", "Nurse Amal Al-Zahrani", "الممرضة أمل الزهراني", bi("Clinic nurse", "ممرضة العيادة"), "nurse", {
    email: "amal.zahrani@alnoor.sa",
    team: bi("Clinic nurse", "ممرضة العيادة"),
    female: true,
    presence: "away",
  }),
  rawan: s("rawan", "RS", "Rawan Al-Saleh", "روان الصالح", bi("Claims", "المطالبات"), "claims", {
    email: "rawan.saleh@alnoor.sa",
    team: bi("Claims", "المطالبات"),
    female: true,
    presence: "online",
  }),
  nora: s("nora", "NF", "Nora Al-Fahad", "نورة الفهد", bi("Reception", "الاستقبال"), "reception", {
    email: "nora.fahad@alnoor.sa",
    team: bi("Reception", "الاستقبال"),
    female: true,
    presence: "online",
    recUser: "nora",
  }),
  hala: s("hala", "HN", "Dr. Hala Nasser", "د. هالة ناصر", bi("Dermatologist", "استشارية جلدية"), "doctor", {
    email: "hala.nasser@alnoor.sa",
    team: bi("Dermatology", "الجلدية"),
    female: true,
    recUser: "hala",
  }),
  fawaz: s("fawaz", "FS", "Dr. Fawaz Al-Shehri", "د. فواز الشهري", bi("Cardiology fellow", "زميل القلب"), "doctor", { team: bi("Cardiology", "القلب") }),
  huda: s("huda", "HM", "Nurse Huda Al-Mutairi", "الممرضة هدى المطيري", bi("Cardiology nurse", "ممرضة القلب"), "nurse", {
    team: bi("Cardiology", "القلب"),
    female: true,
    presence: "online",
  }),
  monaS: s("monaS", "MS", "Mona Al-Saeed", "منى السعيد", bi("Billing", "الفواتير"), "billing", { team: bi("Billing", "الفواتير"), female: true }),
  privacy: s("privacy", "PO", "Privacy officer", "مسؤول الخصوصية", bi("Privacy officer", "مسؤول الخصوصية"), "privacy"),
  it: s("it", "IT", "IT", "التقنية", bi("IT", "تقنية المعلومات"), "it"),
  // Teams the design only counts (people per shared mailbox on Mail accounts): claims, billing, reception, HR, referrals.
  aqahtani: s("aqahtani", "AQ", "Abdulrahman Al-Qahtani", "عبدالرحمن القحطاني", CLAIMS, "claims", { team: CLAIMS }),
  sharbi: s("sharbi", "SH", "Sultana Al-Harbi", "سلطانة الحربي", CLAIMS, "claims", { team: CLAIMS, female: true }),
  ndosari: s("ndosari", "ND", "Noura Al-Dosari", "نورة الدوسري", CLAIMS, "claims", { team: CLAIMS, female: true }),
  wghamdi: s("wghamdi", "WG", "Waleed Al-Ghamdi", "وليد الغامدي", CLAIMS, "claims", { team: CLAIMS, branch: "jeddah" }),
  bzahrani: s("bzahrani", "BZ", "Bandar Al-Zahrani", "بندر الزهراني", CLAIMS, "claims", { team: CLAIMS, branch: "jeddah" }),
  asubaie: s("asubaie", "AS", "Ahmed Al-Subaie", "أحمد السبيعي", CLAIMS, "claims", { team: CLAIMS, branch: "jeddah" }),
  hotaibi: s("hotaibi", "HO", "Hessa Al-Otaibi", "حصة العتيبي", BILLING, "billing", { team: BILLING, female: true }),
  ykhalid: s("ykhalid", "YK", "Yazeed Al-Khalid", "يزيد الخالد", BILLING, "billing", { team: BILLING }),
  lanazi: s("lanazi", "LA", "Lulwa Al-Anazi", "لولوة العنزي", RECEPTION, "reception", { team: RECEPTION, female: true }),
  mrashid: s("mrashid", "MR", "Maha Al-Rashid", "مها الراشد", RECEPTION, "reception", { team: RECEPTION, female: true }),
  sotaibi: s("sotaibi", "SO", "Saad Al-Otaibi", "سعد العتيبي", RECEPTION, "reception", { team: RECEPTION }),
  gharbi: s("gharbi", "GH", "Ghada Al-Harbi", "غادة الحربي", RECEPTION, "reception", { team: RECEPTION, female: true }),
  tmutlaq: s("tmutlaq", "TM", "Turki Al-Mutlaq", "تركي المطلق", RECEPTION, "reception", { team: RECEPTION }),
  fqarni: s("fqarni", "FQ", "Fatimah Al-Qarni", "فاطمة القرني", bi("Referral coordinator", "منسقة التحويلات"), "reception", { team: RECEPTION, female: true }),
  akhalaf: s("akhalaf", "AK", "Abeer Al-Khalaf", "عبير الخلف", bi("HR manager", "مديرة الموارد البشرية"), "admin", { team: HR, female: true }),
  yomari: s("yomari", "YO", "Yasser Al-Omari", "ياسر العمري", HR, "admin", { team: HR }),
  dmansour: s("dmansour", "DM", "Dana Al-Mansour", "دانة المنصور", HR, "admin", { team: HR, female: true }),
}

/** Groups a role rule or a new shared mailbox can grant access to. */
export type RoleGroup = { id: string; who: Bi; match: (x: Staff) => boolean }
export const ROLE_GROUPS: RoleGroup[] = [
  { id: "cardioDoctors", who: bi("Cardiology doctors", "أطباء القلب"), match: (x) => x.role === "doctor" && x.team?.en === "Cardiology" },
  { id: "cardioNurses", who: bi("Cardiology nurses", "ممرضات القلب"), match: (x) => x.role === "nurse" },
  { id: "claims", who: bi("Claims team", "فريق المطالبات"), match: (x) => x.role === "claims" },
  { id: "billing", who: bi("Billing team", "فريق الفواتير"), match: (x) => x.role === "billing" },
  { id: "reception", who: bi("Reception", "الاستقبال"), match: (x) => x.role === "reception" },
  { id: "doctors", who: bi("All doctors", "كل الأطباء"), match: (x) => x.role === "doctor" },
]

export const BRANCHES: { key: "olaya" | "jeddah"; name: Bi }[] = [
  { key: "olaya", name: bi("Olaya", "العليا") },
  { key: "jeddah", name: bi("Jeddah", "جدة") },
]

export const ME: StaffKey = "khaled"

/**
 * Clinic nurses count as part of their doctors' care teams (Medical records lists doctors only). The design needs it:
 * Nurse Amal assigns the Holter email linked to Fahad, so she can open it.
 */
export const CLINIC_NURSES: Record<string, StaffKey[]> = { khaled: ["amal", "huda"], sami: ["amal", "huda"] }

/* ------------------------------------------------------------------ connections + mailboxes */

export const CONNECTIONS: Connection[] = [
  {
    id: "c-m365",
    provider: "m365",
    scope: "org",
    status: "connected",
    domain: ORG_DOMAIN,
    account: "admin@alnoor.sa",
    consent: "admin",
    sync: "push",
    mailboxes: 142,
    lastSync: "2026-11-25T10:59",
    tokenRef: "kv://mail/m365/alnoor",
  },
  { id: "c-google", provider: "google", scope: "org", status: "notConnected", consent: "admin", sync: "push", mailboxes: 0 },
  // Personal links staff made (Gmail or Outlook), allowed for doctors and management.
  { id: "c-personal", provider: "google", scope: "personal", status: "connected", consent: "user", sync: "poll", mailboxes: 9 },
]

export const SMS_ACCOUNT: SmsAccount = { status: "connected", sender: "AlNoor", whatsappNumber: "+966920000000", approvedTemplates: 12 }

const box = (m: Omit<Mailbox, "provider" | "connection" | "keepYears"> & Partial<Pick<Mailbox, "provider" | "connection" | "keepYears">>): Mailbox => ({
  provider: "m365",
  connection: "c-m365",
  keepYears: 10,
  lastSync: "2026-11-25T10:59",
  ...m,
})

export const MAILBOXES: Mailbox[] = [
  box({ id: "khaled", address: "khaled.mansour@alnoor.sa", short: "khaled@", name: bi("Your mailbox", "بريدك"), kind: "personal", owner: "khaled", signature: "sig-khaled" }),
  box({
    id: "cardiology",
    address: "cardiology@alnoor.sa",
    short: "cardiology@",
    name: bi("Cardiology clinic", "صندوق القلب"),
    purpose: bi("Cardiology clinic", "عيادة القلب"),
    kind: "shared",
    grant: "role",
    signature: "sig-cardiology",
  }),
  box({
    id: "referrals",
    address: "referrals@alnoor.sa",
    short: "referrals@",
    name: bi("Referrals", "صندوق التحويلات"),
    purpose: bi("Referrals in and out", "التحويلات من وإلى"),
    kind: "shared",
    grant: "role",
    seedUnread: 1,
  }),
  box({
    id: "claims",
    address: "claims@alnoor.sa",
    short: "claims@",
    name: bi("Claims", "صندوق المطالبات"),
    purpose: bi("Claims and pre-auth", "المطالبات والموافقات"),
    kind: "shared",
    grant: "role",
    seedUnread: 12,
  }),
  box({
    id: "billing",
    address: "billing@alnoor.sa",
    short: "billing@",
    name: bi("Billing", "صندوق الفواتير"),
    purpose: bi("Patient bills", "فواتير المرضى"),
    kind: "shared",
    grant: "role",
    seedUnread: 3,
  }),
  box({
    id: "reception-olaya",
    address: "reception.olaya@alnoor.sa",
    short: "reception.olaya@",
    name: bi("Olaya reception", "صندوق استقبال العليا"),
    purpose: bi("Olaya reception", "استقبال العليا"),
    kind: "shared",
    grant: "branch",
    branch: bi("Olaya", "العليا"),
    seedUnread: 9,
  }),
  box({
    id: "hr",
    address: "hr@alnoor.sa",
    short: "hr@",
    name: bi("HR", "صندوق الموارد البشرية"),
    purpose: bi("Staff contracts and HR", "عقود الموظفين والموارد البشرية"),
    kind: "shared",
    grant: "named",
    seedUnread: 0,
  }),
  box({
    id: "gmail-research",
    address: "khaled.research@gmail.com",
    short: "Gmail",
    name: bi("Gmail · research", "أبحاث · Gmail"),
    kind: "linked",
    provider: "google",
    connection: "c-personal",
    owner: "khaled",
    keepYears: 10,
  }),
]

/** People with access to each shared mailbox (cardiology@ as drawn; the others match the counts on Mail accounts). */
const m = (mailbox: string, staff: StaffKey, level: Membership["level"], via: Membership["via"], until?: string): Membership => ({ mailbox, staff, level, via, ...(until ? { until } : {}) })
const IT_ADDED = { kind: "person" as const, by: "it" }
export const MEMBERSHIPS: Membership[] = [
  m("cardiology", "khaled", "manage", IT_ADDED),
  m("cardiology", "sami", "sendAs", { kind: "role", rule: "rr-cardio-doctors" }),
  m("cardiology", "lama", "sendAs", { kind: "role", rule: "rr-cardio-doctors" }),
  m("cardiology", "amal", "reply", { kind: "role", rule: "rr-cardio-nurses" }),
  m("cardiology", "rawan", "reply", { kind: "role", rule: "rr-claims" }),
  m("cardiology", "nora", "read", { kind: "person", by: "khaled" }, "2026-12-31"),
  m("referrals", "fqarni", "manage", IT_ADDED),
  m("referrals", "khaled", "read", { kind: "role", rule: "rr-ref-heads" }),
  m("referrals", "nora", "reply", { kind: "role", rule: "rr-ref-reception" }),
  m("referrals", "lanazi", "reply", { kind: "role", rule: "rr-ref-reception" }),
  m("referrals", "mrashid", "read", { kind: "role", rule: "rr-ref-reception" }),
  m("claims", "rawan", "manage", IT_ADDED),
  ...["aqahtani", "sharbi", "ndosari", "wghamdi", "bzahrani", "asubaie"].map((k) => m("claims", k, "reply", { kind: "role", rule: "rr-claims-team" })),
  m("claims", "privacy", "read", IT_ADDED),
  m("billing", "monaS", "manage", IT_ADDED),
  m("billing", "hotaibi", "sendAs", { kind: "role", rule: "rr-billing-team" }),
  m("billing", "ykhalid", "sendAs", { kind: "role", rule: "rr-billing-team" }),
  m("billing", "aqahtani", "reply", { kind: "person", by: "monaS" }),
  m("reception-olaya", "nora", "manage", IT_ADDED),
  ...["lanazi", "mrashid", "sotaibi", "gharbi", "tmutlaq", "huda"].map((k) => m("reception-olaya", k, "sendAs", { kind: "branch" })),
  m("hr", "akhalaf", "manage", IT_ADDED),
  m("hr", "yomari", "sendAs", { kind: "person", by: "akhalaf" }),
  m("hr", "dmansour", "reply", { kind: "person", by: "akhalaf" }),
]

export const ROLE_RULES: RoleRule[] = [
  { id: "rr-cardio-doctors", mailbox: "cardiology", who: bi("Cardiology doctors", "أطباء القلب"), level: "sendAs" },
  { id: "rr-cardio-nurses", mailbox: "cardiology", who: bi("Cardiology nurses", "ممرضات القلب"), level: "reply" },
  { id: "rr-claims", mailbox: "cardiology", who: bi("Claims team", "فريق المطالبات"), level: "reply", limit: bi("only mail linked to a claim", "بس البريد المربوط بمطالبة") },
  { id: "rr-ref-heads", mailbox: "referrals", who: bi("Heads of department", "رؤساء الأقسام"), level: "read" },
  { id: "rr-ref-reception", mailbox: "referrals", who: bi("Reception", "الاستقبال"), level: "reply" },
  { id: "rr-claims-team", mailbox: "claims", who: bi("Claims team", "فريق المطالبات"), level: "reply" },
  { id: "rr-billing-team", mailbox: "billing", who: bi("Billing team", "فريق الفواتير"), level: "sendAs" },
]

/* ------------------------------------------------------------------ mail threads */

const KH = { name: STAFF.khaled.name, email: "khaled.mansour@alnoor.sa", staff: "khaled" as const }
const CARDIO = { name: bi("Cardiology clinic team", "فريق عيادة القلب"), email: "cardiology@alnoor.sa" }
const SARA = { name: bi("Sara Al-Ghamdi", "سارة الغامدي"), email: "preauth@bupa.example", org: bi("Bupa Arabia", "بوبا العربية"), partner: "bupa" }
const PA_FILE = { name: bi("PA-88213 approval", "خطاب الموافقة PA-88213"), meta: bi("PDF · 1 page", "PDF · صفحة"), kind: "pdf" as const }

export const FAHAD_LINKS = {
  patient: {
    kind: "patient" as const,
    ref: "MRN-17654",
    patient: "dosari",
    label: bi("Fahad Al-Dosari", "فهد الدوسري"),
    sub: bi("Patient · MRN-17654", "مريض · MRN-17654"),
    auto: true,
  },
  visit: { kind: "visit" as const, ref: "V-2611-08412", label: bi("Visit V-2611-08412", "الزيارة V-2611-08412"), sub: bi("23 Nov · cardiology", "23 نوفمبر · القلب"), auto: true },
  preauth: {
    kind: "preauth" as const,
    ref: "PA-88213",
    label: bi("Pre-auth PA-88213", "الموافقة PA-88213"),
    sub: bi("Holter 24 h · valid to 24 Dec", "هولتر 24 ساعة · صالحة لين 24 ديسمبر"),
    auto: true,
  },
}

export const THREADS: Thread[] = [
  {
    id: "t-bupa-holter",
    topic: "preauth",
    mailbox: "cardiology",
    folder: "inbox",
    subject: bi("Pre-auth approved · Holter for Fahad Al-Dosari", "انوافق على الهولتر · فهد الدوسري"),
    sender: { name: bi("Bupa Arabia · pre-auth", "بوبا العربية · الموافقات"), initials: "BU", tone: "info" },
    snippet: bi("Approval PA-88213 is valid for 30 days.", "الموافقة صالحة 30 يوم · PA-88213"),
    partner: "bupa",
    unread: true,
    assignee: { to: "khaled", by: "amal", at: "2026-11-25T10:50" },
    links: [FAHAD_LINKS.patient, FAHAD_LINKS.visit, FAHAD_LINKS.preauth],
    status: "waitingUs",
    lastAt: "2026-11-25T10:42",
    files: 1,
    draft: bi(
      "Thank you Sara. Holter is booked for 25 Nov, we'll put PA-88213 on the claim.",
      "شكراً سارة. حجزنا الهولتر 25 نوفمبر، وبنكتب رقم الموافقة على المطالبة · PA-88213"
    ),
    messages: [
      {
        id: "m-holter-1",
        // The treating doctor asks for the pre-auth (Manage on cardiology@). Nora (Read only) can't send from it — design gap.
        from: { name: STAFF.khaled.name, email: "cardiology@alnoor.sa", staff: "khaled" },
        to: [SARA],
        at: "2026-11-24T14:05",
        summary: bi("Pre-auth request · 24-hour Holter · ECG and note attached", "طلب موافقة · هولتر 24 ساعة · مرفق التخطيط والملاحظة"),
        body: [bi("Pre-auth request · 24-hour Holter · ECG and note attached", "طلب موافقة · هولتر 24 ساعة · مرفق التخطيط والملاحظة")],
      },
      {
        id: "m-holter-2",
        from: { ...SARA, name: bi("Bupa", "بوبا") },
        to: [CARDIO],
        at: "2026-11-24T16:30",
        summary: bi("More info needed · symptoms and how often", "يبون معلومات زيادة · الأعراض وكم مرة"),
        body: [bi("More info needed · symptoms and how often", "يبون معلومات زيادة · الأعراض وكم مرة")],
      },
      {
        id: "m-holter-3",
        from: SARA,
        to: [CARDIO],
        at: "2026-11-25T10:42",
        summary: bi("Pre-auth approved · Holter for Fahad", "انوافق على الهولتر · فهد الدوسري"),
        body: [
          bi("Dear Dr. Khaled,", "د. خالد، هلا"),
          bi(
            "The 24-hour Holter for Fahad Al-Dosari is approved. Approval PA-88213 is valid for 30 days from today.",
            "الهولتر 24 ساعة لفهد الدوسري انوافق عليه، والموافقة صالحة 30 يوم · PA-88213"
          ),
          bi("Please quote the approval number on the claim.", "اكتبوا رقم الموافقة على المطالبة لو سمحتوا."),
        ],
        files: [PA_FILE],
      },
    ],
    events: [
      { at: "2026-11-25T10:42", text: bi("Received in cardiology@", "وصلت للصندوق المشترك · cardiology@alnoor.sa") },
      { at: "2026-11-25T10:43", text: bi("Linked to Fahad by PA number", "انربطت بفهد برقم الموافقة") },
      { at: "2026-11-25T10:50", text: bi("Nurse Amal assigned it to you", "الممرضة أمل عيّنتها لك") },
    ],
  },
  {
    id: "t-kfsh-referral",
    mailbox: "referrals",
    folder: "inbox",
    subject: bi("Referral accepted · Mona Al-Qahtani", "انقبل التحويل · منى القحطاني"),
    sender: { name: bi("King Faisal Specialist", "التخصصي"), initials: "KF", tone: "accent" },
    snippet: bi("Surgery clinic sees her on 2 Dec.", "عيادة الجراحة تشوفها 2 ديسمبر."),
    partner: "kfsh",
    unread: true,
    links: [{ kind: "referral", ref: "RF-2611-0024", label: bi("Referral RF-2611-0024", "التحويل RF-2611-0024"), sub: bi("Mona Al-Qahtani · surgery", "منى القحطاني · الجراحة"), auto: true }],
    status: "closed",
    lastAt: "2026-11-25T09:58",
    files: 0,
    messages: [
      {
        id: "m-kfsh-1",
        from: { name: bi("Referral office", "مكتب التحويلات"), email: "referrals@kfsh.example", org: bi("King Faisal Specialist", "مستشفى التخصصي"), partner: "kfsh" },
        to: [{ name: bi("Referrals", "صندوق التحويلات"), email: "referrals@alnoor.sa" }],
        at: "2026-11-25T09:58",
        summary: bi("Referral accepted · Mona Al-Qahtani", "انقبل التحويل · منى القحطاني"),
        body: [bi("Referral RF-2611-0024 is accepted. Surgery clinic sees her on 2 Dec.", "انقبل التحويل، وعيادة الجراحة تشوفها 2 ديسمبر · RF-2611-0024")],
      },
    ],
    events: [{ at: "2026-11-25T09:58", text: bi("Received in referrals@", "وصلت لصندوق التحويلات") }],
  },
  {
    id: "t-alborg-results",
    mailbox: "cardiology",
    folder: "inbox",
    subject: bi("Send-out results ready · 2 patients", "نتائج العينات الخارجية جاهزة · مريضين"),
    sender: { name: bi("Al Borg Laboratories", "مختبرات البرج"), initials: "AB", tone: "success" },
    snippet: bi("Both are on the portal now.", "الثنتين موجودة في البوابة الحين."),
    partner: "alborg",
    unread: true,
    links: [],
    status: "waitingUs",
    lastAt: "2026-11-25T09:15",
    files: 1,
    messages: [
      {
        id: "m-alborg-1",
        from: { name: bi("Send-out desk", "مكتب العينات الخارجية"), email: "sendout@alborg.example", org: bi("Al Borg Laboratories", "مختبرات البرج"), partner: "alborg" },
        to: [CARDIO],
        at: "2026-11-25T09:15",
        summary: bi("Send-out results ready · 2 patients", "نتائج العينات الخارجية جاهزة · مريضين"),
        body: [bi("Both are on the portal now.", "الثنتين موجودة في البوابة الحين.")],
        files: [{ name: bi("Send-out summary", "ملخص العينات الخارجية"), meta: bi("PDF · 2 pages", "PDF · صفحتين"), kind: "pdf" }],
      },
    ],
    events: [{ at: "2026-11-25T09:15", text: bi("Received in cardiology@", "وصلت للصندوق المشترك · cardiology@alnoor.sa") }],
  },
  {
    id: "t-nora-clinic3",
    mailbox: "khaled",
    folder: "inbox",
    subject: bi("Clinic 3 is closed this afternoon", "عيادة 3 مقفلة العصر"),
    sender: { name: STAFF.nora.name, initials: "NF", person: true },
    snippet: bi("AC repair · patients move to clinic 5.", "تصليح المكيف · المرضى ينقلون لعيادة 5."),
    unread: false,
    links: [],
    status: "closed",
    lastAt: "2026-11-25T08:40",
    files: 0,
    messages: [
      {
        id: "m-nora-1",
        from: { name: STAFF.nora.name, email: "nora.fahad@alnoor.sa", staff: "nora" },
        to: [KH],
        at: "2026-11-25T08:40",
        summary: bi("Clinic 3 is closed this afternoon", "عيادة 3 مقفلة العصر"),
        body: [bi("AC repair · patients move to clinic 5.", "تصليح المكيف · المرضى ينقلون لعيادة 5.")],
      },
    ],
    events: [],
  },
  {
    id: "t-sha-abstract",
    mailbox: "gmail-research",
    folder: "inbox",
    subject: bi("Your abstract was accepted", "انقبل ملخص بحثك"),
    sender: { name: bi("Saudi Heart Association", "جمعية القلب السعودية"), initials: "SH", tone: "warning" },
    snippet: bi("Poster session, 14 Feb in Jeddah.", "جلسة الملصقات 14 فبراير في جدة."),
    unread: false,
    links: [],
    status: "closed",
    lastAt: "2026-11-24T17:20",
    files: 0,
    messages: [
      {
        id: "m-sha-1",
        from: { name: bi("Saudi Heart Association", "جمعية القلب السعودية"), email: "abstracts@sha.example" },
        to: [{ name: STAFF.khaled.name, email: "khaled.research@gmail.com" }],
        at: "2026-11-24T17:20",
        summary: bi("Your abstract was accepted", "انقبل ملخص بحثك"),
        body: [bi("Poster session, 14 Feb in Jeddah.", "جلسة الملصقات 14 فبراير في جدة.")],
      },
    ],
    events: [],
  },
  {
    id: "t-tawuniya-claim",
    mailbox: "khaled",
    folder: "inbox",
    subject: bi("Question on claim CLM-26-01790", "سؤال عن المطالبة CLM-26-01790"),
    sender: { name: bi("Tawuniya · medical review", "التعاونية · المراجعة الطبية"), initials: "TA", tone: "info" },
    snippet: bi("Can you confirm the echo date?", "تقدر تأكد تاريخ الإيكو؟"),
    partner: "tawuniya",
    unread: false,
    flagged: true,
    links: [{ kind: "request", ref: "REQ-2611-014", label: bi("Request REQ-2611-014", "الطلب REQ-2611-014"), sub: bi("Tawuniya · medical review", "التعاونية · المراجعة الطبية"), auto: true }],
    status: "waitingUs",
    lastAt: "2026-11-22T13:10",
    files: 0,
    messages: [
      {
        id: "m-taw-1",
        from: { name: bi("Faisal Al-Qahtani", "فيصل القحطاني"), email: "review@tawuniya.example", org: bi("Tawuniya", "التعاونية"), partner: "tawuniya" },
        to: [KH],
        at: "2026-11-22T13:10",
        summary: bi("Question on claim CLM-26-01790", "سؤال عن المطالبة CLM-26-01790"),
        body: [bi("Can you confirm the echo date?", "تقدر تأكد تاريخ الإيكو؟")],
      },
    ],
    events: [],
  },
  // Not drawn on the first screen: the rest of "Unread · 7" and "Mine · 3".
  {
    id: "t-gulfmed-holter-service",
    mailbox: "cardiology",
    folder: "inbox",
    subject: bi("Holter recorders due for service", "أجهزة الهولتر عليها صيانة"),
    sender: { name: bi("Gulf Medical Supplies", "الخليج للمستلزمات الطبية"), initials: "GM", tone: "warning" },
    snippet: bi("Two recorders are due on 1 Dec. Can we collect them Sunday?", "جهازين صيانتهم 1 ديسمبر. نقدر ناخذهم الأحد؟"),
    partner: "gulfmed",
    unread: true,
    flagged: true,
    assignee: { to: "khaled", by: "amal", at: "2026-11-21T09:30" },
    links: [{ kind: "contract", ref: "CTR-26-022", label: bi("Contract CTR-26-022", "العقد CTR-26-022"), sub: bi("Gulf Medical Supplies · service", "الخليج للمستلزمات الطبية · الصيانة"), auto: true }],
    status: "waitingUs",
    lastAt: "2026-11-21T09:12",
    files: 0,
    messages: [
      {
        id: "m-gulf-1",
        from: { name: bi("Omar Haddad", "عمر حداد"), email: "service@gulfmed.example", org: bi("Gulf Medical Supplies", "الخليج للمستلزمات الطبية"), partner: "gulfmed" },
        to: [CARDIO],
        at: "2026-11-21T09:12",
        summary: bi("Holter recorders due for service", "أجهزة الهولتر عليها صيانة"),
        body: [bi("Two recorders are due on 1 Dec. Can we collect them Sunday?", "جهازين صيانتهم 1 ديسمبر. نقدر ناخذهم الأحد؟")],
      },
    ],
    events: [],
  },
  {
    id: "t-tawuniya-echo",
    mailbox: "cardiology",
    folder: "inbox",
    subject: bi("Pre-auth request received · echo for Nasser Al-Otaibi", "وصل طلب الموافقة · إيكو لناصر العتيبي"),
    sender: { name: bi("Tawuniya · pre-auth", "التعاونية · الموافقات"), initials: "TA", tone: "info" },
    snippet: bi("We'll reply within 2 working days.", "بنرد خلال يومين عمل."),
    partner: "tawuniya",
    unread: true,
    assignee: { to: "khaled", by: "rawan", at: "2026-11-20T15:00" },
    links: [
      {
        kind: "patient",
        ref: "MRN-24110",
        patient: "otaibi",
        label: bi("Nasser Al-Otaibi", "ناصر العتيبي"),
        sub: bi("Patient · MRN-24110", "مريض · MRN-24110"),
        auto: true,
      },
    ],
    status: "waitingThem",
    lastAt: "2026-11-20T14:40",
    files: 0,
    messages: [
      {
        id: "m-taw-echo-1",
        from: { name: bi("Tawuniya pre-auth", "موافقات التعاونية"), email: "preauth@tawuniya.example", org: bi("Tawuniya", "التعاونية"), partner: "tawuniya" },
        to: [CARDIO],
        at: "2026-11-20T14:40",
        summary: bi("Pre-auth request received · echo for Nasser Al-Otaibi", "وصل طلب الموافقة · إيكو لناصر العتيبي"),
        body: [bi("We'll reply within 2 working days.", "بنرد خلال يومين عمل.")],
      },
    ],
    events: [],
  },
  {
    id: "t-scfhs-cme",
    mailbox: "khaled",
    folder: "inbox",
    subject: bi("CME hours recorded", "انسجلت ساعات التعليم المستمر"),
    sender: { name: bi("Saudi Commission for Health Specialties", "الهيئة السعودية للتخصصات الصحية"), initials: "SC", tone: "muted" },
    snippet: bi("12 hours from the November cardiology day are on your record.", "12 ساعة من يوم القلب في نوفمبر انضافت لسجلك."),
    unread: true,
    links: [],
    status: "closed",
    lastAt: "2026-11-19T12:05",
    files: 0,
    messages: [
      {
        id: "m-scfhs-1",
        from: { name: bi("SCFHS", "الهيئة"), email: "cme@scfhs.example" },
        to: [KH],
        at: "2026-11-19T12:05",
        summary: bi("CME hours recorded", "انسجلت ساعات التعليم المستمر"),
        body: [bi("12 hours from the November cardiology day are on your record.", "12 ساعة من يوم القلب في نوفمبر انضافت لسجلك.")],
      },
    ],
    events: [],
  },
  {
    id: "t-esc-registration",
    mailbox: "gmail-research",
    folder: "inbox",
    subject: bi("Early registration closes Friday", "التسجيل المبكر يقفل الجمعة"),
    sender: { name: bi("Gulf Heart Congress", "مؤتمر الخليج للقلب"), initials: "GH", tone: "muted" },
    snippet: bi("Speakers get the member rate.", "المتحدثين ياخذون سعر الأعضاء."),
    unread: true,
    links: [],
    status: "closed",
    lastAt: "2026-11-18T08:20",
    files: 0,
    messages: [
      {
        id: "m-ghc-1",
        from: { name: bi("Gulf Heart Congress", "مؤتمر الخليج للقلب"), email: "register@ghc.example" },
        to: [{ name: STAFF.khaled.name, email: "khaled.research@gmail.com" }],
        at: "2026-11-18T08:20",
        summary: bi("Early registration closes Friday", "التسجيل المبكر يقفل الجمعة"),
        body: [bi("Speakers get the member rate.", "المتحدثين ياخذون سعر الأعضاء.")],
      },
    ],
    events: [],
  },
]

/** Open assignments per person before this session (Assign dialog: "Claims · 4 assigned"). */
export const ASSIGN_LOAD: Record<string, number> = { rawan: 4, amal: 1, sami: 0, lama: 2, khaled: 0 }

THREADS.push({
  id: "d-holter-result",
  mailbox: "cardiology",
  folder: "drafts",
  subject: bi("Holter result · Fahad Al-Dosari · PA-88213", "نتيجة الهولتر · فهد الدوسري · PA-88213"),
  sender: { name: bi("Draft", "مسودة"), initials: "KM", person: true },
  snippet: bi("Hi Sara, the Holter for Fahad Al-Dosari is done…", "هلا سارة، خلص الهولتر لفهد الدوسري…"),
  partner: "bupa",
  unread: false,
  links: [FAHAD_LINKS.patient, FAHAD_LINKS.preauth],
  status: "waitingUs",
  lastAt: "2026-11-25T10:55",
  files: 1,
  messages: [],
  events: [],
  compose: {
    to: [SARA],
    cc: [{ name: bi("Nurse Amal", "الممرضة أمل"), email: "amal.zahrani@alnoor.sa", staff: "amal" }],
    body: bi(
      "Hi Sara, the Holter for Fahad Al-Dosari (MRN-17654) is done. The report is attached for the claim. Diagnosis: I47.1.",
      "هلا سارة، خلص الهولتر لفهد الدوسري والتقرير مرفق للمطالبة. التشخيص I47.1 · MRN-17654"
    ),
    signature: "sig-cardiology",
    encrypt: true,
    files: [{ name: bi("Holter report · 25 Nov", "تقرير الهولتر · 25 نوفمبر"), meta: bi("PDF · 4 pages · from his file", "PDF · 4 صفحات · من ملفه"), kind: "pdf", patient: "dosari" }],
  },
})

/**
 * What can be attached "from the patient's file" in New message: reports and results the center issued (Medical records
 * keeps prescriptions, leave and referrals; device reports and ECGs come from the clinic). Fahad's Holter report is today's.
 */
export const PATIENT_FILES: Record<string, { name: Bi; meta: Bi; at: string }[]> = {
  dosari: [
    { name: bi("Holter report · 25 Nov", "تقرير الهولتر · 25 نوفمبر"), meta: bi("PDF · 4 pages · from his file", "PDF · 4 صفحات · من ملفه"), at: "2026-11-25" },
    { name: bi("ECG · 23 Nov", "تخطيط القلب · 23 نوفمبر"), meta: bi("PDF · 1 page · from his file", "PDF · صفحة · من ملفه"), at: "2026-11-23" },
    { name: bi("Visit note V-2611-08412", "ملاحظة الزيارة V-2611-08412"), meta: bi("PDF · 2 pages · from his file", "PDF · صفحتين · من ملفه"), at: "2026-11-23" },
  ],
  otaibi: [{ name: bi("Echo request · 20 Nov", "طلب إيكو · 20 نوفمبر"), meta: bi("PDF · 1 page · from his file", "PDF · صفحة · من ملفه"), at: "2026-11-20" }],
  qahtani: [{ name: bi("Referral letter RF-2611-0024", "خطاب التحويل RF-2611-0024"), meta: bi("PDF · 2 pages · from her file", "PDF · صفحتين · من ملفها"), at: "2026-11-21" }],
}

/* ------------------------------------------------------------------ staff chat */

export const CHAT_ROOMS: ChatRoom[] = [
  {
    id: "cardiology-team",
    kind: "channel",
    name: bi("Cardiology team", "فريق القلب"),
    branch: bi("Olaya branch", "فرع العليا"),
    // The 14 people the card counts (drawn: Khaled, Sami, Amal, Nora). Fawaz and Huda aren't in it yet — Add people offers them.
    members: ["khaled", "sami", "amal", "nora", "lama", "rawan", "lanazi", "mrashid", "sotaibi", "gharbi", "tmutlaq", "aqahtani", "sharbi", "ndosari"],
    memberCount: 14,
    notify: { mentionOnly: false, urgentBreaks: true },
    // 2 (design row shows 3): the tab, the card ("5 unread") and the nav badge (7 + 5 = 12) all say 5 in total.
    unread: 2,
    last: { text: bi("Nora: Clinic 3 is closed…", "نورة: عيادة 3 مقفلة…"), at: "2026-11-25T10:05" },
    patientsAllowed: true,
    pinned: [
      { name: bi("December on-call rota", "جدول مناوبات ديسمبر"), meta: bi("Pinned by Dr. Khaled", "ثبّته د. خالد"), icon: "calendar" },
      { name: bi("Afternoon room changes", "تغييرات غرف العصر"), meta: bi("PDF · today", "PDF · اليوم"), icon: "document-text" },
    ],
  },
  {
    id: "olaya-reception",
    kind: "channel",
    name: bi("Olaya reception", "استقبال العليا"),
    branch: bi("Olaya branch", "فرع العليا"),
    members: ["nora", "huda", "khaled"],
    memberCount: 9,
    unread: 2,
    last: { text: bi("Huda: 2 walk-ins waiting", "هدى: فيه 2 بدون موعد"), at: "2026-11-25T09:50" },
    patientsAllowed: true,
  },
  {
    id: "lab-clinics",
    kind: "channel",
    name: bi("Lab and clinics", "المختبر والعيادات"),
    members: ["khaled", "sami"],
    memberCount: 22,
    unread: 0,
    last: { text: bi("Critical value handled", "انتعاملت القيمة الحرجة"), at: "2026-11-25T09:12" },
    patientsAllowed: true,
  },
  {
    id: "announcements",
    kind: "announcements",
    postBy: "admins",
    name: bi("Announcements", "الإعلانات"),
    members: ["khaled"],
    memberCount: 142,
    unread: 0,
    last: { text: bi("December rota is out", "طلع جدول ديسمبر"), at: "2026-11-24T16:00" },
    patientsAllowed: false,
  },
  {
    id: "dm-sami",
    kind: "direct",
    name: STAFF.sami.name,
    with: "sami",
    members: ["khaled", "sami"],
    memberCount: 2,
    unread: 0,
    last: { text: bi("I'll read the Holter tomorrow", "بقرأ الهولتر بكرة"), at: "2026-11-25T09:44" },
    patientsAllowed: true,
  },
  {
    id: "dm-lama",
    kind: "direct",
    name: STAFF.lama.name,
    with: "lama",
    members: ["khaled", "lama"],
    memberCount: 2,
    unread: 1,
    last: { text: bi("Can you cover Thursday?", "تقدر تغطي الخميس؟"), at: "2026-11-25T08:30" },
    patientsAllowed: true,
  },
  {
    id: "dm-amal",
    kind: "direct",
    name: STAFF.amal.name,
    with: "amal",
    members: ["khaled", "amal"],
    memberCount: 2,
    unread: 0,
    last: { text: bi("Vitals are in", "العلامات الحيوية جاهزة"), at: "2026-11-24T15:20" },
    patientsAllowed: true,
  },
]

export const CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "cm-1",
    room: "cardiology-team",
    kind: "patient",
    from: "amal",
    at: "2026-11-25T09:31",
    text: bi("Fahad Al-Dosari's vitals are in. BP 148/92, pulse 88.", "العلامات الحيوية لفهد الدوسري جاهزة. الضغط 148/92 والنبض 88."),
    patient: "dosari",
  },
  {
    id: "cm-2",
    room: "cardiology-team",
    kind: "text",
    from: "sami",
    at: "2026-11-25T09:44",
    text: bi("@Dr. Khaled I can read his Holter tomorrow if you want.", "@د. خالد أقدر أقرأ الهولتر حقه بكرة لو تبي."),
    mentions: ["khaled"],
  },
  { id: "cm-3", room: "cardiology-team", kind: "text", from: "khaled", at: "2026-11-25T09:46", text: bi("Thanks Sami. Booked for 25 Nov, Bupa approved it.", "مشكور سامي. حجزناه 25 نوفمبر وبوبا وافقت."), seenBy: 3 },
  {
    id: "cm-4",
    room: "cardiology-team",
    kind: "system",
    at: "2026-11-25T09:52",
    text: bi("Lab · critical potassium for Omar Al-Harbi · handled by Dr. Sami", "المختبر · بوتاسيوم حرج لعمر الحربي · تعامل معه د. سامي"),
    tone: "destructive",
  },
  {
    id: "cm-5",
    room: "cardiology-team",
    kind: "file",
    from: "nora",
    at: "2026-11-25T10:05",
    text: bi("Clinic 3 is closed this afternoon for the AC. Patients move to clinic 5.", "عيادة 3 مقفلة العصر عشان المكيف، والمرضى ينقلون لعيادة 5."),
    file: { name: bi("Afternoon room changes", "تغييرات غرف العصر"), meta: bi("PDF · 1 page", "PDF · صفحة"), kind: "pdf" },
  },
]

CHAT_MESSAGES.push(
  { id: "or-1", room: "olaya-reception", kind: "text", from: "nora", at: "2026-11-25T09:20", text: bi("Clinic 3 patients go to clinic 5 after 13:00.", "مرضى عيادة 3 ينقلون لعيادة 5 بعد الساعة 13:00.") },
  { id: "or-2", room: "olaya-reception", kind: "text", from: "huda", at: "2026-11-25T09:50", text: bi("2 walk-ins waiting for cardiology. Can someone check if Dr. Sami can see them?", "فيه 2 بدون موعد ينتظرون القلب. أحد يشوف لو د. سامي يقدر يشوفهم؟") },
  { id: "lc-1", room: "lab-clinics", kind: "system", at: "2026-11-25T08:58", text: bi("Lab · critical potassium for Omar Al-Harbi · called to Dr. Sami", "المختبر · بوتاسيوم حرج لعمر الحربي · انبلغ د. سامي"), tone: "destructive" },
  { id: "lc-2", room: "lab-clinics", kind: "text", from: "sami", at: "2026-11-25T09:12", text: bi("Critical value handled. Repeat potassium in 2 hours.", "انتعاملت القيمة الحرجة. نعيد البوتاسيوم بعد ساعتين.") },
  {
    id: "an-1",
    room: "announcements",
    kind: "file",
    from: "khaled",
    at: "2026-11-24T16:00",
    text: bi("December rota is out. Swaps through the Shift swap template, please.", "طلع جدول ديسمبر. التبديل عن طريق قالب تبديل المناوبة لو سمحتوا."),
    file: { name: bi("December on-call rota", "جدول مناوبات ديسمبر"), meta: bi("PDF · 3 pages", "PDF · 3 صفحات"), kind: "pdf" },
    seenBy: 96,
  },
  { id: "ds-1", room: "dm-sami", kind: "text", from: "khaled", at: "2026-11-25T09:40", text: bi("Can you read Fahad's Holter when it's back?", "تقدر تقرأ هولتر فهد لما يرجع؟"), seenBy: 1 },
  { id: "ds-2", room: "dm-sami", kind: "text", from: "sami", at: "2026-11-25T09:44", text: bi("I'll read the Holter tomorrow", "بقرأ الهولتر بكرة") },
  { id: "dl-1", room: "dm-lama", kind: "text", from: "lama", at: "2026-11-25T08:30", text: bi("Can you cover Thursday?", "تقدر تغطي الخميس؟") },
  { id: "da-1", room: "dm-amal", kind: "text", from: "khaled", at: "2026-11-24T15:05", text: bi("Please take Fahad's vitals before the Holter.", "خذي العلامات الحيوية لفهد قبل الهولتر لو سمحتي."), seenBy: 1 },
  { id: "da-2", room: "dm-amal", kind: "text", from: "amal", at: "2026-11-24T15:20", text: bi("Vitals are in", "العلامات الحيوية جاهزة") }
)

/** Patients shared in a room (care team only), newest first. */
export const SHARED_PATIENTS: Record<string, { patient: string; at: string }[]> = {
  "cardiology-team": [
    { patient: "dosari", at: "2026-11-25T09:31" },
    { patient: "harbi", at: "2026-11-25T09:52" },
  ],
}

/* ------------------------------------------------------------------ patient messages */

export const PATIENT_THREADS: PatientThread[] = [
  {
    id: "pt-reem",
    patient: "mutairi",
    channel: "whatsapp",
    language: "ar",
    last: { text: bi("Can I come at 12 instead?", "ممكن أجي الساعة 12 بدال؟"), at: "2026-11-25T10:12", state: "replied" },
    needsAction: true,
    messages: [
      {
        id: "pm-reem-1",
        dir: "out",
        at: "2026-11-24T18:00",
        channel: "whatsapp",
        auto: true,
        template: "tpl-reminder",
        state: "read",
        text: bi(
          // 26 Nov 2026 is a Thursday (the design says Wed).
          "Hi Reem, a reminder of your dermatology visit with Dr. Hala Nasser on Thu 26 Nov at 10:30. Reply 1 to confirm or 2 to change.",
          "هلا ريم، نذكّرك بموعدك في الجلدية مع د. هالة ناصر الخميس 26 نوفمبر الساعة 10:30. رد بـ 1 للتأكيد أو 2 للتغيير."
        ),
      },
      { id: "pm-reem-2", dir: "in", at: "2026-11-25T10:12", channel: "whatsapp", text: bi("Can I come at 12 instead?", "ممكن أجي الساعة 12 بدال؟") },
    ],
    appointment: {
      at: "2026-11-26T10:30",
      clinic: bi("Dermatology", "الجلدية"),
      doctor: bi("Dr. Hala Nasser", "د. هالة ناصر"),
      status: bi("Asked to move to 12:00", "تبي تغيّره للساعة 12:00"),
      statusTone: "warning",
    },
    hint: bi("Opening at 12:15 with Dr. Hala · reception can move it", "فيه موعد 12:15 مع د. هالة · الاستقبال يقدر ينقله"),
  },
  {
    id: "pt-huda",
    patient: "shehri",
    channel: "sms",
    language: "ar",
    last: { text: bi("Results ready · read", "النتائج جاهزة · انقرت"), at: "2026-11-25T09:30", state: "read" },
    messages: [
      {
        id: "pm-huda-1",
        dir: "out",
        at: "2026-11-25T09:30",
        channel: "sms",
        template: "tpl-results",
        state: "read",
        text: bi(
          "Hi Huda, your results are ready. Sign in with Nafath to see them: alnoor.sa/r",
          "هلا هدى، نتايجك جاهزة. ادخل بنفاذ عشان تشوفها: alnoor.sa/r"
        ),
      },
    ],
  },
  {
    id: "pt-omar",
    patient: "harbi",
    channel: "whatsapp",
    language: "ar",
    last: { text: bi("Reminder for 26 Nov", "تذكير بموعد 26 نوفمبر"), at: "2026-11-25T08:00", state: "delivered" },
    appointment: { at: "2026-11-26T09:00", clinic: bi("Cardiology", "القلب"), doctor: bi("Dr. Sami Al-Otaibi", "د. سامي العتيبي"), status: bi("Reminder delivered · no reply yet", "وصل التذكير · ما رد للحين") },
    messages: [
      {
        id: "pm-omar-1",
        dir: "out",
        at: "2026-11-25T08:00",
        channel: "whatsapp",
        auto: true,
        template: "tpl-reminder",
        state: "delivered",
        text: bi(
          "Hi Omar, a reminder of your cardiology visit with Dr. Sami Al-Otaibi on 26 Nov at 09:00. Reply 1 to confirm or 2 to change.",
          "هلا عمر، نذكّرك بموعدك في القلب مع د. سامي العتيبي 26 نوفمبر الساعة 09:00. رد بـ 1 للتأكيد أو 2 للتغيير."
        ),
      },
    ],
  },
  {
    id: "pt-yousef",
    patient: "amri",
    channel: "sms",
    language: "ar",
    last: { text: bi("Number not reachable", "الرقم ما يرد"), at: "2026-11-25T08:00", state: "failed" },
    appointment: { at: "2026-11-26T11:00", clinic: bi("Pediatrics", "الأطفال"), doctor: bi("Dr. Ahmed Zaki", "د. أحمد زكي"), status: bi("Reminder not delivered · call the father", "ما وصل التذكير · كلّم الأب"), statusTone: "warning" },
    hint: bi("The SMS gateway couldn't reach 0592330871 · check the number on his file", "بوابة الرسائل ما وصلت للرقم · راجع الرقم في ملفه · 0592330871"),
    needsAction: true,
    messages: [
      {
        id: "pm-yousef-1",
        dir: "out",
        at: "2026-11-25T08:00",
        channel: "sms",
        auto: true,
        template: "tpl-reminder",
        state: "failed",
        text: bi(
          "Hi Yousef, a reminder of your pediatrics visit on 26 Nov at 11:00. Reply 1 to confirm or 2 to change.",
          "هلا يوسف، نذكّرك بموعدك في الأطفال 26 نوفمبر الساعة 11:00. رد بـ 1 للتأكيد أو 2 للتغيير."
        ),
      },
    ],
  },
  {
    id: "pt-lina",
    patient: "haddad",
    channel: "whatsapp",
    language: "en",
    last: { text: bi("Thank you, see you Sunday", "مشكورين، أشوفكم الأحد"), at: "2026-11-24T19:10", state: "replied" },
    appointment: { at: "2026-11-29T08:00", clinic: bi("Pediatrics", "الأطفال"), doctor: bi("Dr. Ahmed Zaki", "د. أحمد زكي"), status: bi("Confirmed by the patient", "أكدها المريض") },
    messages: [
      {
        id: "pm-lina-1",
        dir: "out",
        at: "2026-11-24T18:00",
        channel: "whatsapp",
        auto: true,
        template: "tpl-reminder",
        state: "read",
        text: bi(
          "Hi Lina, a reminder of your pediatrics visit on Sun 29 Nov at 08:00. Reply 1 to confirm or 2 to change.",
          "هلا لينا، نذكّرك بموعدك في الأطفال الأحد 29 نوفمبر الساعة 08:00. رد بـ 1 للتأكيد أو 2 للتغيير."
        ),
      },
      { id: "pm-lina-2", dir: "in", at: "2026-11-24T19:10", channel: "whatsapp", text: bi("Thank you, see you Sunday", "مشكورين، أشوفكم الأحد") },
    ],
  },
  // Below the drawn rows: the third reply in "Replies · 3".
  {
    id: "pt-mona",
    patient: "qahtani",
    channel: "whatsapp",
    language: "ar",
    last: { text: bi("1", "1"), at: "2026-11-24T18:40", state: "replied" },
    // Replying "1" to a reminder confirms the appointment on its own: nothing left for reception.
    appointment: { at: "2026-11-26T12:30", clinic: bi("Cardiology", "القلب"), doctor: bi("Dr. Khaled Mansour", "د. خالد منصور"), status: bi("Confirmed by reply 1", "انأكد بالرد 1") },
    messages: [
      {
        id: "pm-mona-1",
        dir: "out",
        at: "2026-11-24T18:00",
        channel: "whatsapp",
        auto: true,
        template: "tpl-reminder",
        state: "read",
        text: bi(
          "Hi Mona, a reminder of your cardiology visit with Dr. Khaled Mansour on 26 Nov at 12:30. Reply 1 to confirm or 2 to change.",
          "هلا منى، نذكّرك بموعدك في القلب مع د. خالد منصور 26 نوفمبر الساعة 12:30. رد بـ 1 للتأكيد أو 2 للتغيير."
        ),
      },
      { id: "pm-mona-2", dir: "in", at: "2026-11-24T18:40", channel: "whatsapp", text: bi("1", "1") },
    ],
  },
]

export const CONSENTS: Consent[] = [
  { patient: "mutairi", reminders: true, whatsapp: true, offers: false, signed: "2026-03-03", smsFallback: true },
  { patient: "shehri", reminders: true, whatsapp: false, offers: false, signed: "2025-09-14", smsFallback: false },
  { patient: "harbi", reminders: true, whatsapp: true, offers: false, signed: "2026-01-12", smsFallback: true },
  { patient: "amri", reminders: true, whatsapp: false, offers: false, signed: "2025-06-02", smsFallback: false },
  { patient: "haddad", reminders: true, whatsapp: true, offers: true, signed: "2024-11-20", smsFallback: true },
  { patient: "qahtani", reminders: true, whatsapp: true, offers: false, signed: "2025-02-18", smsFallback: true },
]

/* ------------------------------------------------------------------ partners */

export const PARTNER_COUNTS: Record<PartnerType | "all", number> = { all: 24, insurer: 8, hospital: 5, lab: 3, supplier: 6, government: 2 }

export const PARTNERS: Partner[] = [
  {
    id: "bupa",
    lastAt: "2026-11-25T10:42",
    openCount: 3,
    initials: "BU",
    tone: "info",
    name: bi("Bupa Arabia", "بوبا العربية"),
    type: "insurer",
    domains: ["bupa.example"],
    since: 2021,
    mainContact: bi("Sara Al-Ghamdi · pre-auth", "سارة الغامدي · الموافقات"),
    linked: bi("Agreement BUP-2024-118", "الاتفاقية BUP-2024-118"),
    billingInsurer: "bupa",
  },
  {
    id: "tawuniya",
    lastAt: "2026-11-22T13:10",
    openCount: 1,
    initials: "TA",
    tone: "info",
    name: bi("Tawuniya", "التعاونية"),
    type: "insurer",
    domains: ["tawuniya.example"],
    since: 2019,
    mainContact: bi("Faisal Al-Qahtani · review", "فيصل القحطاني · المراجعة"),
    linked: bi("Agreement TAW-2023-342", "الاتفاقية TAW-2023-342"),
    billingInsurer: "tawuniya",
  },
  {
    id: "kfsh",
    lastAt: "2026-11-25T09:58",
    openCount: 2,
    initials: "KF",
    tone: "accent",
    name: bi("King Faisal Specialist", "مستشفى التخصصي"),
    type: "hospital",
    domains: ["kfsh.example"],
    since: 2018,
    mainContact: bi("Referral office", "مكتب التحويلات"),
    linked: bi("Referrals · 7 this year", "تحويلات · 7 هالسنة"),
  },
  {
    id: "alborg",
    lastAt: "2026-11-25T09:15",
    openCount: 1,
    initials: "AB",
    tone: "success",
    name: bi("Al Borg Laboratories", "مختبرات البرج"),
    type: "lab",
    domains: ["alborg.example"],
    since: 2020,
    mainContact: bi("Send-out desk", "مكتب العينات الخارجية"),
    linked: bi("Contract CTR-26-018", "العقد CTR-26-018"),
  },
  {
    id: "gulfmed",
    lastAt: "2026-11-24T14:10",
    openCount: 1,
    initials: "GM",
    tone: "warning",
    name: bi("Gulf Medical Supplies", "الخليج للمستلزمات الطبية"),
    type: "supplier",
    domains: ["gulfmed.example"],
    since: 2022,
    mainContact: bi("Omar Haddad · service", "عمر حداد · الصيانة"),
    linked: bi("Contract CTR-26-022", "العقد CTR-26-022"),
  },
  {
    id: "moh",
    lastAt: "2026-11-21T09:00",
    openCount: 0,
    initials: "MO",
    tone: "muted",
    name: bi("Ministry of Health", "وزارة الصحة"),
    type: "government",
    domains: ["moh.example"],
    since: 2015,
    mainContact: bi("Statistics department", "إدارة الإحصاء"),
    linked: bi("Monthly return", "الإقرار الشهري"),
  },
]

/** The rest of the 24 partners (the list shows 6, Show more the others). Insurers with an agreement in Billing link to it. */
const more = (id: string, initials: string, en: string, ar: string, type: PartnerType, domain: string, contact: Bi, linked: Bi, lastAt: string, extra: Partial<Partner> = {}): Partner => ({
  id,
  initials,
  tone: type === "insurer" ? "info" : type === "lab" ? "success" : type === "supplier" ? "warning" : type === "hospital" ? "accent" : "muted",
  name: bi(en, ar),
  type,
  domains: [domain],
  since: 2020,
  mainContact: contact,
  linked,
  openCount: 0,
  lastAt,
  ...extra,
})
PARTNERS.push(
  more("medgulf", "MG", "MedGulf", "ميدغلف", "insurer", "medgulf.example", bi("Claims desk", "مكتب المطالبات"), bi("Agreement MDG-2022-077", "الاتفاقية MDG-2022-077"), "2026-11-19T11:20", { billingInsurer: "medgulf", since: 2022 }),
  more("alrajhi", "AR", "Al Rajhi Takaful", "تكافل الراجحي", "insurer", "alrajhitakaful.example", bi("Provider relations", "علاقات مقدمي الخدمة"), bi("Agreement ART-2025-019", "الاتفاقية ART-2025-019"), "2026-11-18T10:05", { billingInsurer: "alrajhi", since: 2025 }),
  more("malath", "ML", "Malath", "ملاذ", "insurer", "malath.example", bi("Pre-auth desk", "مكتب الموافقات"), bi("Agreement MLT-2026-004", "الاتفاقية MLT-2026-004"), "2026-11-12T09:30", { billingInsurer: "malath", since: 2026 }),
  more("gig", "GI", "GIG Saudi", "جي آي جي السعودية", "insurer", "gig.example", bi("Network team", "فريق الشبكة"), bi("No agreement yet", "ما فيه اتفاقية للحين"), "2026-10-28T13:00"),
  more("walaa", "WA", "Walaa", "ولاء", "insurer", "walaa.example", bi("Claims desk", "مكتب المطالبات"), bi("No agreement yet", "ما فيه اتفاقية للحين"), "2026-10-14T08:45"),
  more("arabia", "AI", "Arabia Insurance", "العربية للتأمين", "insurer", "arabia.example", bi("Network team", "فريق الشبكة"), bi("No agreement yet", "ما فيه اتفاقية للحين"), "2026-09-30T12:10"),
  more("kfmc", "KM", "King Fahad Medical City", "مدينة الملك فهد الطبية", "hospital", "kfmc.example", bi("Referral office", "مكتب التحويلات"), bi("Referrals · 3 this year", "تحويلات · 3 هالسنة"), "2026-11-16T10:30"),
  more("habib", "HB", "Dr. Sulaiman Al Habib", "د. سليمان الحبيب", "hospital", "hmg.example", bi("Referral office", "مكتب التحويلات"), bi("Referrals · 5 this year", "تحويلات · 5 هالسنة"), "2026-11-10T15:00"),
  more("sgh", "SG", "Saudi German Hospital", "المستشفى السعودي الألماني", "hospital", "sgh.example", bi("Cath lab", "مختبر القسطرة"), bi("Referrals · 2 this year", "تحويلات · 2 هالسنة"), "2026-10-22T09:15"),
  more("mouwasat", "MW", "Mouwasat Hospital", "مستشفى المواساة", "hospital", "mouwasat.example", bi("Referral office", "مكتب التحويلات"), bi("Referrals · 1 this year", "تحويلات · 1 هالسنة"), "2026-09-08T11:40"),
  more("mokhtabar", "MK", "Al Mokhtabar", "المختبر", "lab", "mokhtabar.example", bi("Send-out desk", "مكتب العينات الخارجية"), bi("Contract CTR-25-041", "العقد CTR-25-041"), "2026-11-20T08:50"),
  more("delta", "DL", "Delta Medical Labs", "مختبرات دلتا الطبية", "lab", "deltalabs.example", bi("Customer service", "خدمة العملاء"), bi("Price list only", "قائمة أسعار بس"), "2026-10-05T10:00"),
  more("nahdi", "NH", "Nahdi Medical", "النهدي الطبية", "supplier", "nahdi.example", bi("Corporate sales", "مبيعات الشركات"), bi("Contract CTR-26-009", "العقد CTR-26-009"), "2026-11-17T14:20"),
  more("faisaliah", "FM", "Al Faisaliah Medical Systems", "الفيصلية للأنظمة الطبية", "supplier", "faisaliah.example", bi("Service desk", "مكتب الصيانة"), bi("Contract CTR-25-033", "العقد CTR-25-033"), "2026-11-03T09:00"),
  more("medtronic", "MD", "Medtronic Saudi", "مدترونك السعودية", "supplier", "medtronic.example", bi("Cardiac rhythm team", "فريق نظم القلب"), bi("Contract CTR-26-015", "العقد CTR-26-015"), "2026-10-26T13:30"),
  more("tamer", "TG", "Tamer Group", "مجموعة تامر", "supplier", "tamer.example", bi("Pharma orders", "طلبات الأدوية"), bi("Price list 2026", "قائمة أسعار 2026"), "2026-10-12T10:10"),
  more("spimaco", "SP", "SPIMACO", "الدوائية", "supplier", "spimaco.example", bi("Hospital sales", "مبيعات المستشفيات"), bi("Price list 2026", "قائمة أسعار 2026"), "2026-09-19T12:00"),
  more("cchi", "CH", "Council of Health Insurance", "مجلس الضمان الصحي", "government", "cchi.example", bi("Provider affairs", "شؤون مقدمي الخدمة"), bi("Accreditation · valid to Jun 2027", "الاعتماد · صالح لين يونيو 2027"), "2026-11-02T08:30", { openCount: 1 })
)

/** Bupa conversations in the mailboxes the design draws (claims@, billing@, reception) and the older ones behind "18 this year". */
const pt = (id: string, mailbox: string, topic: Thread["topic"], subject: Bi, from: Bi, at: string, status: Thread["status"], extra: Partial<Thread> = {}): Thread => ({
  id,
  mailbox,
  folder: status === "closed" ? "archive" : "inbox",
  topic,
  subject,
  sender: { name: from, initials: "BU", tone: "info" },
  snippet: subject,
  partner: "bupa",
  unread: false,
  links: [],
  status,
  lastAt: at,
  files: 0,
  messages: [
    {
      id: `${id}-1`,
      from: { name: from, email: "claims@bupa.example", org: bi("Bupa Arabia", "بوبا العربية"), partner: "bupa" },
      to: [{ name: bi("Al Noor", "النور"), email: `${mailbox === "reception-olaya" ? "reception.olaya" : mailbox}@alnoor.sa` }],
      at,
      summary: subject,
      body: [subject],
    },
  ],
  events: [],
  ...extra,
})
const SHAMMARI = { kind: "patient" as const, ref: "MRN-15530", patient: "shammari", label: bi("Abdullah Al-Shammari", "عبدالله الشمري"), sub: bi("Patient · MRN-15530", "مريض · MRN-15530"), auto: true }
const OLD: [string, NonNullable<Thread["topic"]>, string, string][] = [
  ["10-28", "preauth", "Pre-auth · echo", "موافقة · إيكو"],
  ["10-21", "preauth", "Pre-auth · stress test", "موافقة · جهد"],
  ["10-14", "preauth", "Pre-auth · Holter", "موافقة · هولتر"],
  ["10-06", "preauth", "Pre-auth · CT angiography", "موافقة · أشعة مقطعية للشرايين"],
  ["09-24", "preauth", "Pre-auth · cardiac MRI", "موافقة · رنين للقلب"],
  ["09-11", "preauth", "Pre-auth · sleep study", "موافقة · دراسة نوم"],
  ["08-30", "preauth", "Pre-auth · ambulatory BP", "موافقة · قياس ضغط 24 ساعة"],
  ["10-30", "claims", "Claim query · batch NPH-2610-05", "استفسار مطالبة · الدفعة NPH-2610-05"],
  ["10-09", "claims", "Resubmission · batch NPH-2609-11", "إعادة رفع · الدفعة NPH-2609-11"],
  ["09-17", "claims", "Payment advice · September", "إشعار دفع · سبتمبر"],
  ["08-27", "claims", "Rejected lines · batch NPH-2608-03", "بنود مرفوضة · الدفعة NPH-2608-03"],
  ["08-12", "claims", "Payment advice · July", "إشعار دفع · يوليو"],
  ["09-02", "other", "Network directory update", "تحديث دليل الشبكة"],
]
THREADS.push(
  pt("t-bupa-rejected", "claims", "claims", bi("Rejected lines · batch NPH-2611-07", "بنود مرفوضة · الدفعة NPH-2611-07"), bi("Bupa claims", "مطالبات بوبا"), "2026-11-23T11:30", "waitingUs"),
  // Sent by Billing (Mona manages billing@); the design says "You", but Dr. Khaled has no access to billing@.
  pt("t-bupa-prices", "billing", "contract", bi("2027 price list draft", "مسودة أسعار 2027"), bi("Mona Al-Saeed", "منى السعيد"), "2026-11-20T12:15", "waitingThem", {
    messages: [
      {
        id: "t-bupa-prices-1",
        from: { name: bi("Mona Al-Saeed", "منى السعيد"), email: "billing@alnoor.sa", staff: "monaS" },
        to: [{ name: bi("Rania Aziz", "رانيا عزيز"), email: "providers@bupa.example", partner: "bupa" }],
        at: "2026-11-20T12:15",
        summary: bi("2027 price list draft", "مسودة أسعار 2027"),
        body: [bi("2027 price list draft", "مسودة أسعار 2027")],
      },
    ],
  }),
  // Bupa covers Abdullah and Fahad in Billing (Reem is Al Rajhi, Omar pays cash), so the drawn patients move to them.
  pt("t-bupa-mri", "claims", "preauth", bi("Pre-auth · MRI for Abdullah Al-Shammari", "موافقة · رنين لعبدالله الشمري"), bi("Bupa pre-auth", "موافقات بوبا"), "2026-11-18T09:40", "closed", { links: [SHAMMARI] }),
  pt("t-bupa-card", "reception-olaya", "other", bi("Member card question · Fahad Al-Dosari", "سؤال عن بطاقة · فهد الدوسري"), bi("Reception", "الاستقبال"), "2026-11-15T10:20", "closed", { links: [FAHAD_LINKS.patient] }),
  ...OLD.map(([d, topic, en, ar], i) =>
    pt(`t-bupa-old-${i + 1}`, topic === "other" ? "billing" : "claims", topic, bi(en, ar), topic === "preauth" ? bi("Bupa pre-auth", "موافقات بوبا") : bi("Bupa claims", "مطالبات بوبا"), `2026-${d}T10:00`, "closed")
  )
)

/** Partners tiles (Partners tab). */
export const PARTNER_TILES = { open: 9, openMine: 3, waitingThem: 4, oldestWaitingDays: 3, renewing: 2, renewBefore: "2027-03-31" }

export const CONTACTS: Contact[] = [
  // One main contact for each of the other drawn partners (their list line); Bupa's four are drawn on its page.
  { id: "ct-faisal", partner: "tawuniya", initials: "FQ", name: bi("Faisal Al-Qahtani", "فيصل القحطاني"), role: bi("Medical review", "المراجعة الطبية"), email: "review@tawuniya.example", topics: ["claims"] },
  { id: "ct-kfsh", partner: "kfsh", initials: "RO", name: bi("Referral office", "مكتب التحويلات"), role: bi("Referrals in", "استقبال التحويلات"), email: "referrals@kfsh.example", topics: [] },
  { id: "ct-alborg", partner: "alborg", initials: "SD", name: bi("Send-out desk", "مكتب العينات الخارجية"), role: bi("Send-out tests", "التحاليل الخارجية"), email: "sendout@alborg.example", topics: ["contracts"] },
  { id: "ct-omar", partner: "gulfmed", initials: "OH", name: bi("Omar Haddad", "عمر حداد"), role: bi("Service engineer", "مهندس الصيانة"), email: "service@gulfmed.example", mobile: "0507761204", topics: ["contracts"] },
  { id: "ct-moh", partner: "moh", initials: "SD", name: bi("Statistics department", "إدارة الإحصاء"), role: bi("Monthly returns", "الإقرارات الشهرية"), email: "stats@moh.example", topics: [] },
  { id: "ct-sara", partner: "bupa", initials: "SG", name: bi("Sara Al-Ghamdi", "سارة الغامدي"), role: bi("Pre-auth desk", "مكتب الموافقات"), email: "preauth@bupa.example", mobile: "0551124410", female: true, topics: ["preauth"] },
  { id: "ct-majed", partner: "bupa", initials: "MK", name: bi("Majed Al-Kathiri", "ماجد الكثيري"), role: bi("Claims manager", "مدير المطالبات"), email: "claims@bupa.example", topics: ["claims"] },
  { id: "ct-rania", partner: "bupa", initials: "RA", name: bi("Rania Aziz", "رانيا عزيز"), role: bi("Provider relations", "علاقات مقدمي الخدمة"), email: "providers@bupa.example", female: true, topics: ["contracts"] },
  { id: "ct-hamad", partner: "bupa", initials: "HQ", name: bi("Hamad Al-Qahtani", "حمد القحطاني"), role: bi("Account manager", "مدير الحساب"), email: "h.alqahtani@bupa.example", topics: ["contracts"] },
]

/* ------------------------------------------------------------------ templates + signatures */

export const TEMPLATES: Template[] = [
  {
    id: "tpl-reminder",
    name: bi("Appointment reminder", "تذكير بالموعد"),
    audience: "patients",
    channels: ["sms", "whatsapp"],
    text: bi(
      "Hi {first_name}, a reminder of your {clinic} visit with {doctor} on {date} at {time}. Reply 1 to confirm or 2 to change.",
      "هلا {first_name}، نذكّرك بموعدك في {clinic} مع {doctor} يوم {date} الساعة {time}. رد بـ 1 للتأكيد أو 2 للتغيير."
    ),
    used: 1204,
    whatsapp: { state: "approved", on: "2026-11-12" },
    auto: bi("24 hours before · auto", "قبل 24 ساعة · تلقائي"),
    replies: bi("Go to reception's inbox", "توصل لصندوق الاستقبال"),
  },
  {
    id: "tpl-results",
    name: bi("Results ready", "النتائج جاهزة"),
    audience: "patients",
    channels: ["sms", "whatsapp"],
    text: bi("Hi {first_name}, your results are ready. Sign in with Nafath to see them.", "هلا {first_name}، نتايجك جاهزة. ادخل بنفاذ عشان تشوفها."),
    used: 386,
    whatsapp: { state: "approved", on: "2026-10-02" },
  },
  {
    id: "tpl-late",
    name: bi("Doctor running late", "الطبيب متأخر"),
    audience: "patients",
    channels: ["sms"],
    text: bi(
      "Hi {first_name}, {doctor} is running about 20 minutes late today. Sorry for the wait.",
      "هلا {first_name}، {doctor} متأخر تقريباً 20 دقيقة اليوم. نعتذر على الانتظار."
    ),
    used: 41,
  },
  {
    id: "tpl-directions",
    name: bi("Directions", "الموقع"),
    audience: "patients",
    channels: ["sms", "whatsapp"],
    text: bi(
      "Hi {first_name}, Al Noor Medical Center Olaya: maps.app/alnoor-olaya · parking at the back entrance.",
      "هلا {first_name}، مجمع النور الطبي بالعليا: maps.app/alnoor-olaya · المواقف عند المدخل الخلفي."
    ),
    used: 96,
    whatsapp: { state: "approved", on: "2026-09-14" },
  },
  {
    id: "tpl-preauth",
    name: bi("Pre-auth request", "طلب موافقة مسبقة"),
    audience: "partners",
    channels: ["email"],
    text: bi("Pre-auth request for {first_name} · please find the clinical note attached.", "طلب موافقة مسبقة لـ {first_name} · مرفق الملاحظة السريرية."),
    used: 212,
  },
  {
    id: "tpl-claim-result",
    name: bi("Result for a claim", "نتيجة لمطالبة"),
    audience: "partners",
    channels: ["email"],
    text: bi(
      "Hi {first_name}, the result is ready and attached for the claim. Please let us know if you need anything else.",
      "هلا {first_name}، النتيجة جاهزة ومرفقة للمطالبة. لو تحتاجون شي ثاني بلغونا."
    ),
    used: 164,
  },
  {
    id: "tpl-records-reply",
    name: bi("Records request reply", "رد على طلب ملف"),
    audience: "partners",
    channels: ["email"],
    text: bi("The records you asked for are ready and sent encrypted.", "الملف اللي طلبتوه جاهز وانرسل مشفّر."),
    used: 38,
  },
  {
    id: "tpl-shift-swap",
    name: bi("Shift swap", "تبديل مناوبة"),
    audience: "staff",
    channels: ["chat"],
    text: bi("Can you swap {date} with me?", "تقدر تبدّل معي يوم {date}؟"),
    used: 57,
  },
]

/** The rest of the 14 the design counts (Patients 6 · Partners 5 · Staff 3). */
TEMPLATES.push(
  {
    id: "tpl-booked",
    name: bi("Appointment booked", "انحجز الموعد"),
    audience: "patients",
    channels: ["sms", "whatsapp"],
    text: bi(
      "Hi {first_name}, your {clinic} visit with {doctor} is booked for {date} at {time}. Please come 15 minutes early.",
      "هلا {first_name}، انحجز موعدك في {clinic} مع {doctor} يوم {date} الساعة {time}. تعال قبلها بربع ساعة لو سمحت."
    ),
    used: 2310,
    whatsapp: { state: "approved", on: "2026-08-03" },
    auto: bi("When it's booked · auto", "وقت الحجز · تلقائي"),
    replies: bi("Go to reception's inbox", "توصل لصندوق الاستقبال"),
  },
  {
    id: "tpl-fasting",
    name: bi("Lab test preparation", "التجهيز للتحليل"),
    audience: "patients",
    channels: ["sms"],
    text: bi(
      "Hi {first_name}, for your test on {date} at {time}, please don't eat for 8 hours before. Water is fine.",
      "هلا {first_name}، تحليلك يوم {date} الساعة {time}، لا تاكل شي قبلها بـ8 ساعات. الموية عادي."
    ),
    used: 174,
  },
  {
    id: "tpl-referral",
    name: bi("Referral letter", "خطاب تحويل"),
    audience: "partners",
    channels: ["email"],
    text: bi("Please find the referral letter attached. Our {clinic} team is available for any questions.", "مرفق خطاب التحويل، وفريق {clinic} عندنا جاهز لأي سؤال."),
    used: 64,
  },
  {
    id: "tpl-appeal",
    name: bi("Claim appeal", "اعتراض على مطالبة"),
    audience: "partners",
    channels: ["email"],
    text: bi("We'd like to appeal the rejected lines on this claim. The clinical note and the approval are attached.", "نبي نعترض على البنود المرفوضة في هالمطالبة، ومرفق الملاحظة السريرية والموافقة."),
    used: 29,
  },
  {
    id: "tpl-closed",
    name: bi("Clinic closed", "العيادة مقفلة"),
    audience: "staff",
    channels: ["chat"],
    text: bi("{clinic} is closed on {date}. Patients move to the next free room.", "{clinic} مقفلة يوم {date}، والمرضى ينقلون لأقرب غرفة فاضية."),
    used: 18,
  },
  {
    id: "tpl-cover",
    name: bi("Cover needed", "نحتاج تغطية"),
    audience: "staff",
    channels: ["chat"],
    text: bi("Can someone cover {clinic} on {date} at {time}?", "أحد يقدر يغطي {clinic} يوم {date} الساعة {time}؟"),
    used: 33,
  }
)

export const TEMPLATE_COUNTS = { all: 14, patients: 6, partners: 5, staff: 3 }

export const SIGNATURES: Signature[] = [
  {
    id: "sig-khaled",
    kind: "user",
    owner: "khaled",
    title: bi("Your signature", "توقيعك"),
    sub: bi("khaled.mansour@alnoor.sa", "khaled.mansour@alnoor.sa"),
    lines: {
      en: ["Dr. Khaled Mansour", "Consultant cardiologist · Head of cardiology", "Al Noor Medical Center · Olaya"],
      ar: ["د. خالد منصور", "استشاري قلب · رئيس قسم القلب", "مجمع النور الطبي · العليا"],
    },
    logo: true,
    onReplies: true,
  },
  {
    id: "sig-cardiology",
    kind: "mailbox",
    owner: "cardiology",
    title: bi("Cardiology clinic team", "فريق عيادة القلب"),
    sub: bi("cardiology@alnoor.sa · you manage it", "cardiology@alnoor.sa · أنت تديره"),
    lines: { en: ["Cardiology clinic team", "Al Noor Medical Center · 920000000"], ar: ["فريق عيادة القلب", "مجمع النور الطبي · 920000000"] },
    onReplies: true,
  },
  {
    id: "sig-branch",
    kind: "branch",
    owner: "olaya",
    title: bi("Branch footer", "تذييل الفرع"),
    sub: bi("Set by IT · added to all outside mail", "من تقنية المعلومات · ينضاف لكل بريد خارجي"),
    lines: {
      en: ["This email may contain patient information. If it reached you by mistake, delete it and tell us."],
      ar: ["هالإيميل ممكن فيه معلومات مرضى. لو وصلك بالغلط احذفه وبلّغنا."],
    },
    locked: true,
  },
]

/* ------------------------------------------------------------------ rules + audit */

export const POLICIES: Policies = {
  encryptOutside: true,
  blockPersonalForward: true,
  chatCareTeamOnly: true,
  logSharedOpens: true,
  allowPersonal: true,
  personalRoles: ["doctor", "admin"],
  personalSync: "mail",
  neverForwardPatientMail: true,
  keepYears: 10,
}

export const AUDIT: AuditEvent[] = [
  { id: "a-1", at: "2026-11-24T12:20", kind: "accessChanged", actor: "khaled", mailbox: "cardiology", text: bi("You gave Nora read only until 31 Dec", "أعطيت نورة قراءة بس لين 31 ديسمبر") },
  { id: "a-2", at: "2026-11-20T09:00", kind: "ruleAdded", actor: "khaled", mailbox: "cardiology", text: bi("Rule added: claims team → reply", "انضافت قاعدة: فريق المطالبات ← رد") },
  { id: "a-3", at: "2026-11-18T13:40", kind: "exported", actor: "rawan", mailbox: "cardiology", text: bi("Rawan exported 3 emails", "روان صدّرت 3 إيميلات") },
  { id: "a-4", at: "2026-11-02T08:00", kind: "joined", actor: "it", mailbox: "cardiology", text: bi("Dr. Lama joined by role", "د. لمى انضافت حسب الدور") },
]
