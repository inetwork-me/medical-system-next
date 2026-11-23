import type { Bi } from "@/lib/mock/bi"
import { drugOf, type CurrentMed, type RecPatient } from "./data"

/*
 * Medicine checks (brief §4): before a prescription is sent, its medicines are checked against the patient's
 * allergies and current medicines (including ones from outside pharmacies). Behind an interface so a drug database
 * (e.g. SFDA / a commercial interaction service) replaces the stub without touching the screens.
 */

const bi = (en: string, ar: string): Bi => ({ en, ar })

export type Severity = "minor" | "moderate" | "major"
export type AllergyHit = { drug: string; allergy: Bi }
export type Interaction = { id: string; a: string; b: string; severity: Severity; text: Bi; advice: Bi }
export type CheckResult = { allergy: AllergyHit[]; interactions: Interaction[]; allergiesChecked: Bi[] }

export interface MedicineChecks {
  run(input: { patient: RecPatient; drugs: string[]; current: CurrentMed[] }): Promise<CheckResult>
}

/** Allergy groups → the drug groups they rule out. */
const ALLERGY_GROUPS: Record<string, string[]> = { penicillin: ["penicillin"], aspirin: ["antiplatelet", "nsaid"], nsaid: ["nsaid"] }
const allergyKey = (a: Bi) => a.en.toLowerCase().replace(/[^a-z]/g, "")

/** Known pairs (by drug group). */
const PAIRS: { g1: string; g2: string; severity: Severity; text: Bi; advice: Bi; id: string }[] = [
  {
    id: "aspirin+ibuprofen",
    g1: "antiplatelet",
    g2: "nsaid",
    severity: "moderate",
    text: bi("Ibuprofen can block aspirin's heart protection. Take aspirin at least 30 minutes before ibuprofen.", "الآيبوبروفين ممكن يضعف حماية الأسبرين للقلب. ياخذ الأسبرين قبل الآيبوبروفين بـ 30 دقيقة على الأقل."),
    advice: bi("Take aspirin 30 minutes before any ibuprofen.", "خذ الأسبرين قبل الآيبوبروفين بـ 30 دقيقة."),
  },
  {
    id: "betablocker+ccb",
    g1: "betablocker",
    g2: "ccb",
    severity: "minor",
    text: bi("Both lower the heart rate a little. Watch the pulse.", "الاثنين ينزّلون النبض شوي. انتبه للنبض."),
    advice: bi("Check your pulse at home; call us if it's under 55.", "قِس نبضك بالبيت، وكلّمنا إذا نزل تحت 55."),
  },
]

/** Pure check (also used by the stub and by the Sign dialog's "checked" line). */
export function checkMedicines(patient: RecPatient, drugs: string[], current: CurrentMed[]): CheckResult {
  const allergy: AllergyHit[] = []
  for (const id of drugs) {
    const d = drugOf(id)
    if (!d) continue
    for (const a of patient.allergies) {
      const groups = ALLERGY_GROUPS[allergyKey(a)] ?? [allergyKey(a)]
      if (d.groups.some((g) => groups.includes(g))) allergy.push({ drug: id, allergy: a })
    }
  }
  const all = [...new Set([...drugs, ...current.map((c) => c.drug)])]
  const interactions: Interaction[] = []
  for (const p of PAIRS) {
    const a = all.find((id) => drugOf(id)?.groups.includes(p.g1))
    const b = all.find((id) => drugOf(id)?.groups.includes(p.g2))
    // Only pairs the new prescription takes part in.
    if (a && b && (drugs.includes(a) || drugs.includes(b))) interactions.push({ id: p.id, a, b, severity: p.severity, text: p.text, advice: p.advice })
  }
  return { allergy, interactions, allergiesChecked: patient.allergies }
}

export const checksStub: MedicineChecks = {
  async run({ patient, drugs, current }) {
    await new Promise((r) => setTimeout(r, 250))
    return checkMedicines(patient, drugs, current)
  },
}

export const medicineChecks: MedicineChecks = checksStub
