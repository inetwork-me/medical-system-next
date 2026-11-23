/**
 * Medical records permissions (brief §4):
 * - doctors write and sign their own notes and documents (prescriptions, sick leaves, referrals, reports);
 * - nurses enter vitals;
 * - the records office handles requests for records, completion reminders and merges;
 * - the privacy officer reviews access;
 * - nobody can delete a signed note or a log entry (there is no such action).
 * "lead" is the demo role: every permission (switchable in the dev stories).
 */
export type RecViewRole = "doctor" | "nurse" | "records" | "privacy" | "lead"

export const REC_ROLES: RecViewRole[] = ["lead", "doctor", "nurse", "records", "privacy"]

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

const MATRIX: Record<Exclude<RecViewRole, "lead">, RecAction[]> = {
  doctor: ["writeNote", "signNote", "prescribe", "documents"],
  nurse: ["vitals"],
  records: ["requests", "release", "remind", "merge"],
  privacy: ["reviewAccess", "exportLog"],
}

export function recCan(role: RecViewRole, action: RecAction): boolean {
  if (role === "lead") return true
  return MATRIX[role].includes(action)
}

/** Which module tabs a role sees (branch-hidden tabs stay hidden on top of this). */
export function recTabs(role: RecViewRole): string[] {
  switch (role) {
    case "doctor":
      return ["overview", "notes", "documents", "completion"]
    case "nurse":
      return ["notes"]
    case "records":
      return ["overview", "documents", "requests", "completion"]
    case "privacy":
      return ["overview", "access"]
    default:
      return ["overview", "notes", "documents", "requests", "completion", "access"]
  }
}
