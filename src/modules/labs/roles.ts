import type { LabRole } from "./data"

/**
 * Lab permissions (brief §4):
 * - phlebotomy collects (and can reject at the chair);
 * - lab techs receive, enter and submit results, reject samples, print labels;
 * - the clinical pathologist / lab specialist validates and releases (and sends the report);
 * - doctors view and order;
 * - patients see released results only, in the app.
 * Logging a critical call is open to the tech and the pathologist: whoever sees the value first phones it in.
 */
export type LabAction =
  | "view"
  | "order"
  | "collect"
  | "receive"
  | "reject"
  | "enter"
  | "submit"
  | "logCall"
  | "validate"
  | "release"
  | "send"
  | "print"
  | "catalog"

const STAFF_VIEW: LabAction[] = ["view"]

const MATRIX: Record<Exclude<LabRole, "lead">, LabAction[]> = {
  phlebotomy: [...STAFF_VIEW, "collect", "reject", "print"],
  tech: [...STAFF_VIEW, "receive", "reject", "enter", "submit", "logCall", "print"],
  pathologist: [...STAFF_VIEW, "reject", "logCall", "validate", "release", "send", "print", "catalog"],
  doctor: [...STAFF_VIEW, "order"],
  patient: [],
}

/** Can this role do that? "lead" (demo login) can do everything a lab role can, plus order. */
export function labCan(role: LabRole, action: LabAction): boolean {
  if (role === "lead") return true
  return MATRIX[role].includes(action)
}

/** Patients only ever see released panels (patient app report). */
export const seesUnreleased = (role: LabRole) => role !== "patient"
