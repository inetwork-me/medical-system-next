"use client"

import { isModuleEnabled, isTabEnabled } from "@/lib/modules"
import { useClinics } from "./store"

/**
 * Patient file Eyes / Dental tabs (Clinics · Settings · Specialty tools): a tab shows when the branch has it on and at
 * least one clinic switches its tool on. When the Clinics module is off for the branch, only the branch flag counts.
 */
export function useSpecialtyTabs(): { eyes: boolean; dental: boolean } {
  const clinics = useClinics()
  const eyes = isTabEnabled("patients", "eyes")
  const dental = isTabEnabled("patients", "dental")
  if (!isModuleEnabled("clinics")) return { eyes, dental }
  return {
    eyes: eyes && clinics.some((c) => c.specialtyTools.eyes),
    dental: dental && clinics.some((c) => c.specialtyTools.dental),
  }
}
