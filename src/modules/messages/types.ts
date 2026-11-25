import type { Bi } from "@/lib/mock/bi"

/*
 * Messages module data model (design v8.0, brief §4). One place for every conversation the center has: mail (Microsoft 365 /
 * Google Workspace / IMAP, personal + shared mailboxes), staff chat, patient SMS / WhatsApp, and the partners directory.
 * Outside services (Microsoft Graph, Gmail API, IMAP, SMS gateway, WhatsApp Business, encryption, patient-data scan) sit
 * behind interfaces in ./services; these types are what the screens read.
 */

/* ------------------------------------------------------------------ people */

/** Staff key (Messages roster in ./data, mapped onto Medical records users where the same person exists there). */
export type StaffKey = string

/** What a person does, for role rules, chat channels and permissions. */
export type StaffRole = "doctor" | "nurse" | "reception" | "claims" | "billing" | "admin" | "privacy" | "it"

export type Presence = "online" | "away" | "offline"

export type Staff = {
  key: StaffKey
  initials: string
  name: Bi
  /** One line under the name: "Cardiologist", "Clinic nurse". */
  title: Bi
  role: StaffRole
  team?: Bi
  email?: string
  female?: boolean
  presence: Presence
  /** Medical records user key, when the person exists there (care teams are keyed by it). */
  recUser?: string
  branch: BranchKey
  /** Where they are now, when it matters for assigning ("In clinic until 14:00"). */
  availability?: Bi
}

export type BranchKey = "olaya" | "jeddah"

/* ------------------------------------------------------------------ mail: connections + mailboxes */

export type Provider = "m365" | "google" | "imap"

/**
 * A provider connection. Org-wide ones use admin consent, personal ones the user's consent (OAuth for Graph and Gmail;
 * IMAP/SMTP with an app password for others). Tokens are stored encrypted on the server — never a password in the app.
 */
export type Connection = {
  id: string
  provider: Provider
  scope: "org" | "personal"
  status: "connected" | "notConnected" | "error"
  /** alnoor.sa — org connections. */
  domain?: string
  /** The admin (org) or the owner (personal) who granted consent. */
  account?: string
  consent: "admin" | "user" | "appPassword"
  /** Push (Graph change notifications / Gmail watch) where possible, otherwise polled every minute. */
  sync: "push" | "poll"
  mailboxes: number
  lastSync?: string
  /** Opaque reference to the encrypted token on the server. */
  tokenRef?: string
}

/** SMS + WhatsApp Business account (the fourth connection card). */
export type SmsAccount = {
  status: "connected" | "notConnected"
  sender: string
  whatsappNumber: string
  approvedTemplates: number
}

export type MailboxKind = "personal" | "shared" | "linked"

export type Mailbox = {
  id: string
  address: string
  /** "cardiology@" on chips; the Arabic UI uses the mailbox's Arabic name instead of ending a line with "name@". */
  short: string
  name: Bi
  purpose?: Bi
  kind: MailboxKind
  provider: Provider
  connection: string
  owner?: StaffKey
  branch?: Bi
  signature?: string
  /** How access is granted (shared): the badge on Mail accounts. */
  grant?: "role" | "branch" | "named"
  /** Mail and its log are kept this long, even after a disconnect. */
  keepYears: number
  lastSync?: string
  /** Unread count for shared mailboxes the signed-in user can't read (Mail accounts shows it; their threads aren't loaded). */
  seedUnread?: number
}

/** Shared-mailbox access, lowest to highest. */
export type AccessLevel = "read" | "reply" | "sendAs" | "manage"
export const ACCESS_ORDER: AccessLevel[] = ["read", "reply", "sendAs", "manage"]
export const accessAtLeast = (have: AccessLevel | undefined, need: AccessLevel) => !!have && ACCESS_ORDER.indexOf(have) >= ACCESS_ORDER.indexOf(need)

/** How a person got access: a role rule, their branch, or added by someone (IT, an admin, you). */
export type GrantVia = { kind: "role"; rule: string } | { kind: "branch" } | { kind: "person"; by: StaffKey }

export type Membership = {
  mailbox: string
  staff: StaffKey
  level: AccessLevel
  via: GrantVia
  /** ISO date: access ends on its own. */
  until?: string
}

/** "Cardiology doctors → Send as": new staff in the role get it on their first day. */
export type RoleRule = {
  id: string
  mailbox: string
  who: Bi
  level: AccessLevel
  /** "only mail linked to a claim" */
  limit?: Bi
}

/* ------------------------------------------------------------------ mail: threads */

export type Folder = "inbox" | "sent" | "drafts" | "archive"

export type Party = { name: Bi; email: string; org?: Bi; staff?: StaffKey; partner?: string }

/** Record kinds a message can be linked to; MRN, PA, INV, CLM, REQ and CTR numbers found in mail link on their own. */
export type LinkKind = "patient" | "visit" | "invoice" | "claim" | "contract" | "request" | "preauth" | "referral"

export type RecordLink = {
  kind: LinkKind
  /** MRN-17654, V-2611-08412, PA-88213 … (a claim with no number yet uses an internal id). */
  ref: string
  /** Records patient key for patient links (care-team checks). */
  patient?: string
  label: Bi
  sub: Bi
  /** Linked automatically because the number appeared in the mail. */
  auto?: boolean
}

export type Attachment = {
  name: Bi
  meta: Bi
  kind: "pdf" | "image" | "doc"
  /** Taken from this patient's file (counts as patient data when it goes outside). */
  patient?: string
}

export type MailMessage = {
  id: string
  from: Party
  to: Party[]
  cc?: Party[]
  at: string
  /** Short line used when the message is collapsed ("Pre-auth request · 24-hour Holter …"). */
  summary: Bi
  /** Paragraphs. */
  body: Bi[]
  files?: Attachment[]
  encrypted?: boolean
}

export type Assignment = { to: StaffKey; by: StaffKey; at: string; note?: Bi; remindOn?: string }

/** Status of a conversation with a partner (Partner page): who has to answer next. */
export type ThreadStatus = "waitingUs" | "waitingThem" | "closed"

export type Thread = {
  id: string
  mailbox: string
  folder: Folder
  subject: Bi
  /** Sender shown on the inbox row: an organisation (logo initials) or a person (avatar). */
  sender: { name: Bi; initials: string; person?: boolean; tone?: LogoTone }
  /** One-line snippet under the subject. */
  snippet: Bi
  partner?: string
  unread: boolean
  flagged?: boolean
  assignee?: Assignment
  links: RecordLink[]
  status: ThreadStatus
  messages: MailMessage[]
  lastAt: string
  files: number
  /** Activity on this thread (received, auto-linked, assigned …). */
  events: { at: string; text: Bi }[]
  /** A reply started and not sent yet (the Reply card opens with it). */
  draft?: Bi
  /** New replies in this thread get the same links. */
  linkReplies?: boolean
  /** A draft's form (Drafts): opens in New message as it was left. */
  compose?: Compose
  /** What a partner conversation is about (Partner page filter). */
  topic?: "preauth" | "claims" | "contract" | "other"
}

/** New message form as saved in a draft. */
export type Compose = {
  to: Party[]
  cc: Party[]
  body: Bi
  signature?: string
  encrypt: boolean
  files: Attachment[]
}

/** Logo tile tones the design uses for organisations. */
export type LogoTone = "info" | "accent" | "success" | "warning" | "muted"

/* ------------------------------------------------------------------ staff chat */

export type ChatKind = "channel" | "group" | "direct" | "announcements"

export type ChatRoom = {
  id: string
  kind: ChatKind
  name: Bi
  /** Direct chats: the other person. */
  with?: StaffKey
  branch?: Bi
  members: StaffKey[]
  /** Total members when the room has more than the drawn ones (Cardiology team · 14). */
  memberCount: number
  unread: number
  last: { text: Bi; at: string }
  muted?: boolean
  /** Muted until (8 hours from Mute); urgent posts still come through. */
  mutedUntil?: string
  /** Notification settings for the signed-in user. */
  notify?: { mentionOnly: boolean; urgentBreaks: boolean }
  /** Who can post (Announcements: admins only). */
  postBy?: "all" | "admins"
  patientsAllowed: boolean
  pinned?: { name: Bi; meta: Bi; icon: string }[]
}

export type ChatMessage =
  | { id: string; room: string; kind: "text"; from: StaffKey; at: string; text: Bi; mentions?: StaffKey[]; seenBy?: number; urgent?: boolean }
  | { id: string; room: string; kind: "patient"; from: StaffKey; at: string; text: Bi; patient: string; seenBy?: number }
  | { id: string; room: string; kind: "file"; from: StaffKey; at: string; text: Bi; file: Attachment; seenBy?: number }
  /** Posted by another module (e.g. Lab: a critical value handled). */
  | { id: string; room: string; kind: "system"; at: string; text: Bi; tone: "destructive" | "info" }

/* ------------------------------------------------------------------ patient messages */

export type PatientChannel = "whatsapp" | "sms"

/** Delivery state of the last message (list badge): sent → delivered → read → replied; or failed. */
export type Delivery = "sent" | "delivered" | "read" | "replied" | "failed"

export type PatientMessage = {
  id: string
  dir: "out" | "in"
  at: string
  text: Bi
  channel: PatientChannel
  /** Sent on its own by a rule (reminder 24 h before). */
  auto?: boolean
  template?: string
  state?: Delivery
  /** Went by SMS because WhatsApp wasn't delivered. */
  fallback?: boolean
  /** Who sent it (staff), for "10:20 · Nora · delivered". */
  by?: StaffKey
  /** Why it wasn't delivered. */
  reason?: "unreachable" | "noWhatsapp"
}

export type PatientThread = {
  id: string
  /** Records patient key. */
  patient: string
  channel: PatientChannel
  language: "ar" | "en"
  /** The list line + state badge. */
  last: { text: Bi; at: string; state: Delivery }
  /** A reply that still needs handling by reception (amber badge). */
  needsAction?: boolean
  messages: PatientMessage[]
  /** Appointment the conversation is about (Open appointment). */
  appointment?: { at: string; clinic: Bi; doctor: Bi; status: Bi; statusTone?: "warning" }
  hint?: Bi
}

export type Consent = {
  patient: string
  reminders: boolean
  whatsapp: boolean
  offers: boolean
  signed: string
  /** SMS goes out when WhatsApp isn't delivered. */
  smsFallback: boolean
}

/* ------------------------------------------------------------------ partners */

export type PartnerType = "insurer" | "lab" | "hospital" | "supplier" | "government"

export type Contact = {
  id: string
  partner: string
  initials: string
  name: Bi
  role: Bi
  email: string
  mobile?: string
  female?: boolean
  topics: ("preauth" | "claims" | "contracts")[]
  /** Suggested in To / Cc of every mailbox that writes to the partner (default yes). */
  suggest?: boolean
}

export type Partner = {
  id: string
  initials: string
  tone: LogoTone
  name: Bi
  type: PartnerType
  domains: string[]
  since: number
  /** Main contact line on the list: "Sara Al-Ghamdi · pre-auth". */
  mainContact: Bi
  /** Linked agreement / contract / referral line (Billing owns the records). */
  linked: Bi
  /** Billing insurer key, when the partner is an insurer Billing knows. */
  billingInsurer?: string
  /** Conversations still open with them across every mailbox (Partners list badge, Partner card). */
  openCount: number
  /** Last mail with them in any mailbox (Partners list). */
  lastAt: string
}

/* ------------------------------------------------------------------ templates + signatures */

export type TemplateChannel = "sms" | "whatsapp" | "email" | "chat"
export type Audience = "patients" | "partners" | "staff"

export type Template = {
  id: string
  name: Bi
  audience: Audience
  channels: TemplateChannel[]
  /** EN + AR text with {fields}. */
  text: Bi
  used: number
  /** WhatsApp templates need Meta's approval before use. */
  whatsapp?: { state: "approved" | "pending"; on?: string }
  /** When it's sent on its own ("24 hours before · auto"). */
  auto?: Bi
  replies?: Bi
}

export const TEMPLATE_FIELDS = ["{first_name}", "{clinic}", "{doctor}", "{date}", "{time}"] as const

export type Signature = {
  id: string
  kind: "user" | "mailbox" | "branch"
  owner: string
  title: Bi
  sub: Bi
  /** Lines, per language (Arabic mail uses the Arabic one). */
  lines: { en: string[]; ar: string[] }
  /** The branch footer is set by IT and added to all outside mail. */
  locked?: boolean
  logo?: boolean
  onReplies?: boolean
}

/* ------------------------------------------------------------------ rules + audit */

export type Policies = {
  encryptOutside: boolean
  blockPersonalForward: boolean
  chatCareTeamOnly: boolean
  logSharedOpens: boolean
  allowPersonal: boolean
  /** Roles that may link a personal Gmail / Outlook. */
  personalRoles: StaffRole[]
  personalSync: "mail" | "mailCalendar"
  neverForwardPatientMail: boolean
  keepYears: number
}

export type AuditKind = "accessChanged" | "ruleAdded" | "joined" | "exported" | "opened" | "linked" | "assigned" | "received" | "sentAsIs"

/** Every access change and every open of shared mail is logged; the privacy officer sees the log. */
export type AuditEvent = {
  id: string
  at: string
  kind: AuditKind
  actor: StaffKey | "it"
  mailbox?: string
  thread?: string
  text: Bi
}
