import { PATIENTS } from "@/modules/records/data"

/**
 * Outgoing-mail scan (brief §4 · Outbound rules). The server scans every email that leaves for an outside domain for patient
 * identifiers — a patient's name with their MRN, national ID or a diagnosis code — and for files taken from a patient's
 * file. This stub runs the same rules on the client so the form can warn before Send; the server check is the one that
 * counts.
 */
export type Finding = "name" | "mrn" | "nationalId" | "diagnosis" | "file"

export type ScanInput = {
  recipients: string[]
  subject: string
  body: string
  /** Files and the patient they were taken from. */
  files: { name: string; patient?: string }[]
  /** Patients the email is linked to. */
  patients: string[]
  orgDomain: string
}

export type ScanResult = {
  /** Outside domains the email goes to ("bupa.example"). */
  outside: string[]
  found: Finding[]
  /** Records patient keys whose data was found. */
  patients: string[]
  /** Needs Check before sending: patient data going outside. */
  needsCheck: boolean
}

const MRN = /\bMRN-\d{4,}\b/g
const NATIONAL_ID = /\b[12]\d{9}\b/g
/** ICD-10 code: a letter (not U), two digits, optional decimals ("I47.1", "E11.9"). */
const ICD10 = /\b[A-TV-Z]\d{2}(?:\.\d{1,2})?\b/g

type Pt = { name: { en: string; ar: string }; mrn: string }
const pts = PATIENTS as unknown as Record<string, Pt>

export interface PatientDataScan {
  scan(input: ScanInput): ScanResult
  /** "Remove patient details": names, MRNs, IDs and diagnosis codes replaced; the reference goes in instead. */
  redact(text: string, ref: string, patients: string[]): string
}

export const dlpStub: PatientDataScan = {
  scan(x) {
    const outside = [...new Set(x.recipients.map((r) => r.split("@")[1]?.toLowerCase()).filter((d): d is string => !!d && d !== x.orgDomain))]
    const text = `${x.subject}\n${x.body}`
    const found = new Set<Finding>()
    const patients = new Set<string>()
    for (const [key, p] of Object.entries(pts)) {
      if (text.includes(p.name.en) || text.includes(p.name.ar)) {
        found.add("name")
        patients.add(key)
      }
      if (text.includes(p.mrn)) patients.add(key)
    }
    if (text.match(MRN)) found.add("mrn")
    if (text.match(NATIONAL_ID)) found.add("nationalId")
    if (text.match(ICD10)) found.add("diagnosis")
    for (const f of x.files)
      if (f.patient) {
        found.add("file")
        patients.add(f.patient)
      }
    // A name alone (no identifier, no file) isn't patient data on its own; with a linked patient it is.
    const identifying = found.has("mrn") || found.has("nationalId") || found.has("diagnosis") || found.has("file") || (found.has("name") && x.patients.length > 0)
    return { outside, found: [...found], patients: [...patients], needsCheck: outside.length > 0 && identifying }
  },
  redact(text, ref, patients) {
    let out = text
    for (const k of patients) {
      const p = pts[k]
      if (!p) continue
      out = out.replaceAll(p.name.en, ref).replaceAll(p.name.ar, ref)
    }
    return out
      .replace(/\s*\(?\bMRN-\d{4,}\b\)?/g, "")
      .replace(NATIONAL_ID, "")
      .replace(/\s*(Diagnosis|التشخيص)\s*:?\s*[A-TV-Z]\d{2}(?:\.\d{1,2})?\.?/g, "")
      .replace(ICD10, "")
      .replace(/\s+·\s*$/gm, "")
      // The reference may already be there ("Holter result · Fahad · PA-88213"): keep it once.
      .replaceAll(`${ref} · ${ref}`, ref)
      .replace(/ {2,}/g, " ")
      .trim()
  },
}
