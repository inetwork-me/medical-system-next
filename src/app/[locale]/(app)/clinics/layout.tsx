import { setLocaleFrom } from "@/i18n/set-locale"
import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"

/** Module guard: when Clinics is hidden for this branch none of its routes are reachable. */
export default async function ClinicsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("clinics")) notFound()
  return children
}
