import type { ReactNode } from "react"

import { branchConfig } from "@/config/branches"
import { MODULE_FALLBACKS, MODULES, type ModuleDef, type ModuleId, type ModuleTab } from "@/config/modules"
import { can } from "@/lib/permissions"

/** Is a module switched on for the active branch? */
export function isModuleEnabled(id: ModuleId) {
  return !branchConfig().hiddenModules.includes(id)
}

/** Enabled modules, in registry order. */
export function enabledModules(): ModuleDef[] {
  return MODULES.filter((m) => isModuleEnabled(m.id))
}

/**
 * Modules the signed-in user sees in the navigation: on for the branch and granted View in the permission matrix
 * (Settings › Roles and access). Dashboard is always there.
 */
export function visibleModules(): ModuleDef[] {
  return enabledModules().filter((m) => can(m.id, "view"))
}

/** Enabled tabs of a module ("patients.payments" can be hidden per branch). */
export function moduleTabs(m: ModuleDef): ModuleTab[] {
  const hidden = branchConfig().hiddenTabs
  return (m.tabs ?? []).filter((t) => !hidden.includes(`${m.id}.${t.key}`))
}

/** Where a module's nav item goes: its home tab, or the first tab left on when the home tab is off for the branch. */
export function moduleHome(m: ModuleDef): string {
  const tabs = moduleTabs(m)
  if (!m.tabs?.length || tabs.some((t) => t.href === m.href)) return m.href
  return tabs[0]?.href ?? m.href
}

/** Is a module tab or record tab ("patients.eyes") on for the active branch? Off with its module, too. */
export function isTabEnabled(id: ModuleId, key: string) {
  return isModuleEnabled(id) && !branchConfig().hiddenTabs.includes(`${id}.${key}`)
}

/** Renders children only when that tab is on — wrap every button that opens a specialty tab or workspace. */
export function IfTab({ module, tab, children, fallback = null }: { module: ModuleId; tab: string; children: ReactNode; fallback?: ReactNode }) {
  return <>{isTabEnabled(module, tab) && can(module, "view") ? children : fallback}</>
}

/**
 * Renders children only when the module is on — wrap every cross-module action with it,
 * e.g. <IfModule id="appointments"><Button>Book visit</Button></IfModule>.
 */
export function IfModule({ id, children, fallback = null }: { id: ModuleId; children: ReactNode; fallback?: ReactNode }) {
  // A control into a module the user may not view would lead to "no access": hide it like a branch-hidden module.
  return <>{isModuleEnabled(id) && can(id, "view") ? children : fallback}</>
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

/** Where links into an off module go instead: its declared replacement when that one is on and visible, else nowhere (hide). */
export function fallbackHref(id: ModuleId): string | undefined {
  const f = MODULE_FALLBACKS[id]
  if (!f.href || !f.via) return undefined
  return isModuleEnabled(f.via) && can(f.via, "view") ? f.href : undefined
}

/** The module tab a path belongs to, even when that tab is off for the branch (for the "not here" page). */
export function tabForPath(m: ModuleDef, pathname: string): ModuleTab | undefined {
  return (m.tabs ?? [])
    .filter((t) => pathname === t.href || (t.href !== m.href && pathname.startsWith(t.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]
}
