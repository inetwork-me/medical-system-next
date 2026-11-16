import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"

/** Module guard: a module hidden for this branch has no reachable routes. */
export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  if (!isModuleEnabled("patients")) notFound()
  return children
}
