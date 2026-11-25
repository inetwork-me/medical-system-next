"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { setBranchGate } from "@/config/branches"
import { MODULES, moduleById, type ModuleId } from "@/config/modules"
import { can, readSignedIn, setGate, subscribeSignedIn, type Access, type PermAction, type PermModule } from "@/lib/permissions"
import { setFormatsGate } from "@/lib/numbering"
import { setOrgGate } from "@/lib/org"
import { fallbackHref, isModuleEnabled, isTabEnabled, moduleHome, tabForPath } from "@/lib/modules"
import { Link, usePathname } from "@/i18n/navigation"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { accessFor } from "@/modules/settings/access"
import type { BranchKey } from "@/modules/settings/data"
import { readBranchModules, readFormats, readOrg, subscribeSettings, WORK_BRANCH } from "@/modules/settings/store"
import { ME_USER, USERS } from "@/modules/settings/users-data"
import { PageContainer } from "./page"

/** Before the first sign-in of the session: the demo user's roles with the default matrix. */
const DEMO_ACCESS: Access = accessFor(USERS.find((u) => u.id === ME_USER)?.roles ?? [])

const serverSnap = () => null

/**
 * Applies the signed-in permission snapshot to the whole app (lib/permissions gate). The server render and the first client
 * render use the demo user's access (Dr. Khaled: full), so hydration matches; when the session's snapshot differs (the dev
 * page signed in with other roles) the app subtree remounts under the new gate, so every `can()` check — nav, guards,
 * module actions — reads it.
 */
export function PermissionsGate({ children }: { children: React.ReactNode }) {
  const signed = React.useSyncExternalStore(subscribeSignedIn, readSignedIn, serverSnap)
  const access = signed?.access ?? DEMO_ACCESS
  // Modules per branch: the working branch's switches as saved in Settings (the server keeps the static branch config).
  const branch = (signed?.branch as BranchKey | undefined) ?? WORK_BRANCH
  const modules = React.useSyncExternalStore(
    subscribeSettings,
    () => readBranchModules(branch),
    () => null
  )
  const config = modules ? { hiddenModules: modules.hiddenModules as ModuleId[], hiddenTabs: modules.hiddenTabs } : null
  // General (the center's identity on printed documents) and Numbering (next invoice / credit note numbers), as saved.
  const orgSaved = React.useSyncExternalStore(subscribeSettings, readOrg, () => null)
  const formats = React.useSyncExternalStore(subscribeSettings, readFormats, () => null)
  const sig = JSON.stringify([access, config, orgSaved, formats])
  setGate(access)
  setBranchGate(config)
  setOrgGate(orgSaved)
  setFormatsGate(formats)
  return <React.Fragment key={sig}>{children}</React.Fragment>
}

/** Renders children only when the signed-in user has that permission (create / export buttons, approve actions). */
export function IfCan({ module, action, children, fallback = null }: { module: PermModule; action: PermAction; children: React.ReactNode; fallback?: React.ReactNode }) {
  return <>{can(module, action) ? children : fallback}</>
}

/** Module guard (each module layout): no View permission → "You don't have access to …" instead of the module. */
export function ModuleAccess({ id, children }: { id: Exclude<PermModule, "settings">; children: React.ReactNode }) {
  const pathname = usePathname()
  if (!isModuleEnabled(id)) return <ModuleOff id={id} />
  const tab = tabForPath(moduleById(id), pathname)
  if (tab && !isTabEnabled(id, tab.key)) return <ModuleOff id={id} tab={tab.key} />
  if (can(id, "view")) return children
  return <AccessDenied module={id} />
}

/**
 * A module (or tab) that's off at this branch, reached by a deep link or bookmark: what replaces it here, and a way on —
 * the replacement (Doctors ↔ Clinics, Lab and Records → patient files), the module's home for a tab, or Dashboard.
 * No dead link, no empty page (brief §4 · Modules per branch).
 */
function ModuleOff({ id, tab }: { id: Exclude<PermModule, "settings">; tab?: string }) {
  const t = useTranslations("shell")
  const m = moduleById(id)
  const name = t(`nav.${m.labelKey}` as "nav.lab")
  const to = tab ? moduleHome(m) : fallbackHref(id)
  const toModule = !tab && to ? MODULES.find((x) => x.href === to) : undefined
  return (
    <PageContainer>
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={m.icon}
          title={t("unavailable.title", { module: tab ? t(`tabs.${id}.${tab}` as "tabs.lab.samples") : name })}
          description={tab ? t("unavailable.tabText", { module: name }) : t(`fallback.${id}` as "fallback.lab")}
          className="py-16"
          actions={
            <Button variant="outline" asChild>
              <Link href={to ?? "/dashboard"}>
                {tab ? t("unavailable.module", { module: name }) : toModule ? t("unavailable.goTo", { module: t(`nav.${toModule.labelKey}` as "nav.lab") }) : t("unavailable.home")}
              </Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  )
}

/** Page guard for an action page (New patient, New appointment …): needs that action, e.g. Create, on the module. */
export function ActionAccess({ module, action, children }: { module: Exclude<PermModule, "settings">; action: PermAction; children: React.ReactNode }) {
  if (can(module, action)) return children
  return <AccessDenied module={module} action={action} />
}

function AccessDenied({ module, action }: { module: Exclude<PermModule, "settings">; action?: PermAction }) {
  const t = useTranslations("shell")
  const name = t(`nav.${module}` as "nav.patients")
  return (
    <PageContainer>
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon="lock"
          title={action ? t("noAccess.actionTitle", { module: name, action }) : t("noAccess.title", { module: name })}
          description={t("noAccess.text")}
          className="py-16"
          actions={
            <Button variant="outline" asChild>
              <Link href={action && can(module, "view") ? `/${module}` : "/dashboard"}>{action && can(module, "view") ? name : t("noAccess.home")}</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  )
}
