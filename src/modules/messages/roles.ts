import { can, type PermAction } from "@/lib/permissions"

/**
 * Messages permissions (brief §4 · Permissions):
 * - everyone has chat, their own mailbox, Partners and Templates;
 * - shared-mailbox access follows the mailbox's grants (Read only < Reply < Send as < Manage);
 * - reception and nurses message patients;
 * - Mail accounts, rules and shared mailboxes are admin-only;
 * - the privacy officer sees the logs.
 * "lead" is the demo role (Dr. Khaled: head of cardiology and Messages admin): every permission, switchable in the dev stories.
 */
export type MsgRole = "lead" | "doctor" | "nurse" | "reception" | "claims" | "admin" | "privacy"

export const MSG_ROLES: MsgRole[] = ["lead", "doctor", "nurse", "reception", "claims", "admin", "privacy"]

export type MsgTab = "inbox" | "chat" | "patients" | "partners" | "templates" | "accounts"
export const MSG_TABS: MsgTab[] = ["inbox", "chat", "patients", "partners", "templates", "accounts"]

export type MsgAction =
  /** Message a patient by SMS / WhatsApp, read patient replies. */
  | "patientMessages"
  /** Connections, rules, shared mailboxes, mailbox access. */
  | "admin"
  /** Read and export the access log. */
  | "logs"
  /** Create and edit shared templates (everyone edits their own signature). */
  | "templates"
  /** Link a personal Gmail / Outlook (policy decides the roles; this is the default). */
  | "personalMailbox"

const MATRIX: Record<Exclude<MsgRole, "lead">, MsgAction[]> = {
  doctor: ["personalMailbox"],
  nurse: ["patientMessages"],
  reception: ["patientMessages"],
  claims: [],
  admin: ["admin", "logs", "templates", "personalMailbox"],
  privacy: ["logs"],
}

/** The permission-matrix action each messages action needs (Settings › Roles and access); the module role narrows it further. */
const PERM: Record<MsgAction, PermAction> = {
  patientMessages: "create",
  templates: "create",
  personalMailbox: "create",
  admin: "edit",
  logs: "export",
}

export function msgCan(role: MsgRole, action: MsgAction): boolean {
  if (!can("messages", PERM[action])) return false
  if (role === "lead") return true
  return MATRIX[role].includes(action)
}

/** Module tabs a role sees (branch-hidden tabs stay hidden on top of this). */
export function msgTabs(role: MsgRole): MsgTab[] {
  return MSG_TABS.filter((t) => (t === "patients" ? msgCan(role, "patientMessages") : t === "accounts" ? msgCan(role, "admin") : true))
}
