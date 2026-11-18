import { setLocaleFrom } from "@/i18n/set-locale"
import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"

/** Module guard: when Doctors is hidden for this branch none of its routes are reachable. */
export default async function DoctorsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("doctors")) notFound()
  return children
}
