import { can, type PermAction } from "@/lib/permissions"

/**
 * Medical records permissions (brief §4):
 * - doctors write and sign their own notes and documents (prescriptions, sick leaves, referrals, reports);
 * - nurses enter vitals;
 * - the records office handles requests for records, completion reminders and merges;
 * - the privacy officer reviews access;
 * - reception and the records office add a patient's nationality and ID (Visits · missing data);
 * - doctors see the Visits tab for their own clinic;
 * - nobody can delete a signed note or a log entry (there is no such action).
 * "lead" is the demo role: every permission (switchable in the dev stories).
 */
export type RecViewRole = "doctor" | "nurse" | "records" | "privacy" | "reception" | "lead"

export const REC_ROLES: RecViewRole[] = ["lead", "doctor", "nurse", "records", "privacy", "reception"]

export type RecAction =
  | "writeNote"
  | "signNote"
  | "vitals"
  | "prescribe"
  | "documents"
  | "requests"
  | "release"
  | "remind"
  | "merge"
  | "reviewAccess"
  | "exportLog"
  | "patientIds"
  | "allClinics"

const MATRIX: Record<Exclude<RecViewRole, "lead">, RecAction[]> = {
  doctor: ["writeNote", "signNote", "prescribe", "documents"],
  nurse: ["vitals"],
  records: ["requests", "release", "remind", "merge", "patientIds", "allClinics"],
  privacy: ["reviewAccess", "exportLog"],
  reception: ["patientIds", "allClinics"],
}

/** The permission-matrix action each records action needs (Settings › Roles and access); the module role narrows it further. */
const PERM: Record<RecAction, PermAction> = {
  allClinics: "view",
  writeNote: "create",
  vitals: "create",
  prescribe: "create",
  documents: "create",
  requests: "edit",
  remind: "edit",
  merge: "edit",
  patientIds: "edit",
  signNote: "approve",
  release: "approve",
  reviewAccess: "approve",
  exportLog: "export",
}

export function recCan(role: RecViewRole, action: RecAction): boolean {
  if (!can("records", PERM[action])) return false
  if (role === "lead") return true
  return MATRIX[role].includes(action)
}

/** Which module tabs a role sees (branch-hidden tabs stay hidden on top of this). */
export function recTabs(role: RecViewRole): string[] {
  switch (role) {
    case "doctor":
      return ["overview", "visits", "notes", "documents", "completion"]
    case "nurse":
      return ["notes"]
    case "records":
      return ["overview", "visits", "documents", "requests", "completion"]
    case "privacy":
      return ["overview", "access"]
    case "reception":
      return ["visits"]
    default:
      return ["overview", "visits", "notes", "documents", "requests", "completion", "access"]
  }
}
