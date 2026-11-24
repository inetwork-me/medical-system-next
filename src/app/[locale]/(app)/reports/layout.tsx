import { setLocaleFrom } from "@/i18n/set-locale"

import { isModuleEnabled } from "@/lib/modules"
import { ModuleUnavailable } from "@/components/shell/module-unavailable"

/** Module guard: when Reports is hidden for this branch, its deep links show "not available in this branch". */
export default async function ReportsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await setLocaleFrom(params)
  if (!isModuleEnabled("reports")) return <ModuleUnavailable id="reports" />
  return children
}
