import { PATIENTS, type PatientKey, type RecPatient } from "./data"
import { ARCHIVE_PATIENTS } from "./archive"
import { VISIT_PATIENTS, generatedPatient } from "./visits-data"

/** A patient by key: the design's patients, an older file from the archive, or a patient of the Visits screens. */
export function patientOf(k: PatientKey): RecPatient {
  return (PATIENTS as Record<string, RecPatient>)[k] ?? ARCHIVE_PATIENTS[k] ?? VISIT_PATIENTS[k] ?? generatedPatient(k)!
}
