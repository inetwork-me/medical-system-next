import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"

/** Module guard: a module hidden for this branch has no reachable routes. */
export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  if (!isModuleEnabled("appointments")) notFound()
  return children
}
