import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"
import { PatientsStoreProvider } from "@/modules/patients/store"

/** Module guard: a module hidden for this branch has no reachable routes. Session store shared by all Patients pages. */
export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  if (!isModuleEnabled("patients")) notFound()
  return <PatientsStoreProvider>{children}</PatientsStoreProvider>
}
