import { notFound } from "next/navigation"

import { isModuleEnabled } from "@/lib/modules"
import { AppointmentsStoreProvider } from "@/modules/appointments/store"

/** Module guard: a module hidden for this branch has no reachable routes. Session store shared by all Appointments pages. */
export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  if (!isModuleEnabled("appointments")) notFound()
  return <AppointmentsStoreProvider>{children}</AppointmentsStoreProvider>
}
