import type { Bi } from "@/lib/mock/bi"

/**
 * Notification rules (Settings › Notification rules, design v9.0 · brief §4): event → recipients (a role, or the person the
 * event is about) → channels → escalation after N minutes to another role. Quiet hours hold non-urgent alerts until the
 * morning; urgent ones always go through (on-call staff first). Urgent rules are required: nobody can switch them off in My
 * account.
 */
const bi = (en: string, ar: string): Bi => ({ en, ar })

export type RecipientKey =
  | "orderingDoctor"
  | "nurseInCharge"
  | "headOfDept"
  | "privacyOfficer"
  | "medicalDirector"
  | "it"
  | "billingManager"
  | "claimsTeam"
  | "theDoctor"
  | "hr"
  | "clinicManager"
  | "reception"
  | "admin"

export const RECIPIENTS: Record<RecipientKey, Bi> = {
  orderingDoctor: bi("Ordering doctor", "الطبيب الطالب"),
  nurseInCharge: bi("Nurse in charge", "الممرضة المسؤولة"),
  headOfDept: bi("Head of department", "رئيس القسم"),
  privacyOfficer: bi("Privacy officer", "مسؤول الخصوصية"),
  medicalDirector: bi("Medical director", "المدير الطبي"),
  it: bi("IT", "التقنية"),
  billingManager: bi("Billing manager", "مدير الفواتير"),
  claimsTeam: bi("Claims team", "فريق المطالبات"),
  theDoctor: bi("The doctor", "الطبيب"),
  hr: bi("HR", "الموارد البشرية"),
  clinicManager: bi("Clinic manager", "مدير العيادة"),
  reception: bi("Reception", "الاستقبال"),
  admin: bi("Admin", "مشرف النظام"),
}

export type Channel = "app" | "sms" | "email"
export const CHANNELS: Channel[] = ["app", "sms", "email"]

/** Minutes before escalating (0 = no escalation). */
export const ESCALATE_AFTER = [0, 15, 30, 60, 120, 1440, 2880]
/** Days-before reminder plans (credentials). */
export const REMINDER_PLANS = ["30,7", "60,30,7", "14,3"]

export type Rule = {
  id: string
  event: Bi
  urgent?: boolean
  who: RecipientKey[]
  /** Who the rule may go to (the Edit rule checklist). */
  options: RecipientKey[]
  channels: Channel[]
  /** Escalation: after N minutes tell a role; or a reminder plan for things that expire. */
  escalateAfter?: number
  escalateTo?: RecipientKey
  reminder?: string
  ignoreQuiet?: boolean
}

export const RULES: Rule[] = [
  {
    id: "critical-lab", event: bi("Critical lab value", "قيمة تحليل حرجة"), urgent: true, who: ["orderingDoctor"], options: ["orderingDoctor", "nurseInCharge", "headOfDept"],
    channels: ["app", "sms"], escalateAfter: 15, escalateTo: "headOfDept", ignoreQuiet: true,
  },
  {
    id: "restricted-file", event: bi("Restricted file opened", "انفتح ملف محمي"), urgent: true, who: ["privacyOfficer"], options: ["privacyOfficer", "medicalDirector", "it"],
    channels: ["app", "email"], ignoreQuiet: true,
  },
  {
    id: "zatca-failed", event: bi("ZATCA invoice failed", "فاتورة ما انقبلت في زاتكا"), who: ["billingManager", "it"], options: ["billingManager", "it", "medicalDirector", "admin"],
    channels: ["app", "sms", "email"], escalateAfter: 60, escalateTo: "medicalDirector",
  },
  {
    id: "claim-rejected", event: bi("Claim rejected", "مطالبة مرفوضة"), who: ["claimsTeam"], options: ["claimsTeam", "billingManager", "theDoctor"],
    channels: ["app"], escalateAfter: 2880, escalateTo: "billingManager",
  },
  {
    id: "credential-expiring", event: bi("Credential expiring", "رخصة بتنتهي"), who: ["theDoctor", "hr"], options: ["theDoctor", "hr", "clinicManager", "medicalDirector"],
    channels: ["email"], reminder: "30,7",
  },
  {
    id: "no-shows", event: bi("3 no-shows in a day", "3 غيابات باليوم"), who: ["clinicManager"], options: ["clinicManager", "reception", "theDoctor"],
    channels: ["app"],
  },
  {
    id: "sms-balance", event: bi("SMS balance under 20%", "رصيد الرسائل أقل من 20%"), who: ["admin"], options: ["admin", "billingManager"],
    channels: ["email"],
  },
]

export type QuietHours = { on: boolean; from: string; to: string }
export const QUIET_DEFAULT: QuietHours = { on: true, from: "22:00", to: "07:00" }
