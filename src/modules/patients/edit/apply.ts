import type { Bi } from "@/lib/mock/bi"
import type { PatientRecord } from "../profile/record"
import { optionLabel, type EditForm } from "./form"

/** Patient page record with the session's saved edit form applied (identity, address, insurance, allergies…). */
export function applyForm(r: PatientRecord, f: EditForm): PatientRecord {
  const insurer = optionLabel("insurer", f.insurer)
  const cls = optionLabel("insuranceClass", f.insuranceClass)
  const insurance: Bi | null =
    f.selfPay || !insurer ? null : { en: [insurer.en.replace(" Arabia", ""), cls?.en].filter(Boolean).join(" · "), ar: [insurer.ar.replace(" العربية", ""), cls?.ar].filter(Boolean).join(" · ") }
  const missing: PatientRecord["missing"] = []
  if (!f.idNumber.trim()) missing.push("nationalId")
  if (!f.street.trim()) missing.push("address")
  if (!f.mobile.trim()) missing.push("phone")
  const known = new Map(r.allergies.flatMap((a) => [[a.name.en, a] as const, [a.name.ar, a] as const]))
  return {
    ...r,
    missing,
    details: {
      ...r.details,
      nationalId: f.idNumber.replace(/\s/g, "") || null,
      birthDate: f.birthDate || r.details.birthDate,
      nationality: optionLabel("nationality", f.nationality) ?? r.details.nationality,
      district: f.district ? { en: f.district, ar: f.district } : null,
      insurance,
      classification: optionLabel("classification", f.classification) ?? r.details.classification,
      bloodType: f.bloodType || null,
    },
    allergies: f.allergies.map(
      (name) => known.get(name) ?? { name: { en: name, ar: name }, detail: { en: "Severity not recorded", ar: "الشدة مو مسجلة" }, severity: "moderate" as const }
    ),
  }
}
