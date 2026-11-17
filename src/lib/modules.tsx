import type { ReactNode } from "react"

import { branchConfig } from "@/config/branches"
import { MODULES, type ModuleDef, type ModuleId, type ModuleTab } from "@/config/modules"

/** Is a module switched on for the active branch? */
export function isModuleEnabled(id: ModuleId) {
  return !branchConfig().hiddenModules.includes(id)
}

/** Enabled modules, in registry order. */
export function enabledModules(): ModuleDef[] {
  return MODULES.filter((m) => isModuleEnabled(m.id))
}

/** Enabled tabs of a module ("patients.payments" can be hidden per branch). */
export function moduleTabs(m: ModuleDef): ModuleTab[] {
  const hidden = branchConfig().hiddenTabs
  return (m.tabs ?? []).filter((t) => !hidden.includes(`${m.id}.${t.key}`))
}

/** Is a module tab or record tab ("patients.eyes") on for the active branch? Off with its module, too. */
export function isTabEnabled(id: ModuleId, key: string) {
  return isModuleEnabled(id) && !branchConfig().hiddenTabs.includes(`${id}.${key}`)
}

/** Renders children only when that tab is on — wrap every button that opens a specialty tab or workspace. */
export function IfTab({ module, tab, children, fallback = null }: { module: ModuleId; tab: string; children: ReactNode; fallback?: ReactNode }) {
  return <>{isTabEnabled(module, tab) ? children : fallback}</>
}

/**
 * Renders children only when the module is on — wrap every cross-module action with it,
 * e.g. <IfModule id="appointments"><Button>Book visit</Button></IfModule>.
 */
export function IfModule({ id, children, fallback = null }: { id: ModuleId; children: ReactNode; fallback?: ReactNode }) {
  return <>{isModuleEnabled(id) ? children : fallback}</>
}

/** Longest-prefix match of a pathname (without locale) against module hrefs. */
export function activeModule(pathname: string): ModuleDef | undefined {
  return MODULES.filter((m) => pathname === m.href || pathname.startsWith(m.href + "/")).sort(
    (a, b) => b.href.length - a.href.length
  )[0]
}

/** Active tab of a module: exact match first, else the longest matching prefix (detail pages stay on "list"). */
export function activeTab(m: ModuleDef, pathname: string): ModuleTab | undefined {
  const tabs = moduleTabs(m)
  return (
    tabs.find((t) => t.href === pathname) ??
    tabs
      .filter((t) => t.href !== m.href && pathname.startsWith(t.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0] ??
    tabs.find((t) => t.href === m.href)
  )
}
