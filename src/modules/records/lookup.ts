import { PATIENTS, type PatientKey, type RecPatient } from "./data"
import { ARCHIVE_PATIENTS } from "./archive"

/** A patient by key: the design's patients or an older file from the archive. */
export function patientOf(k: PatientKey): RecPatient {
  return (PATIENTS as Record<string, RecPatient>)[k] ?? ARCHIVE_PATIENTS[k]
}
