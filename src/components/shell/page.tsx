"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import type { ModuleId } from "@/config/modules"
import { moduleById } from "@/config/modules"
import { activeTab, moduleTabs } from "@/lib/modules"
import { Icon } from "@/components/ds/icon"
import { useNav } from "./use-shell"

/** Page content area (sheet 06): fills the space beside the sidebar / rail (grows when it collapses), p-4 / md:p-6 / lg:p-8, gap-6. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full flex-col gap-6 p-4 md:p-6 lg:p-8", className)} {...props} />
}

/**
 * DS sheet 08 · Page Header. The page title, breadcrumb and back link live in the app header (see page-title.tsx),
 * so the page header is the tabs row. xl: tabs at the start, actions at the end. md–lg: tabs, then the actions under
 * them (start-aligned). Mobile: actions (equal lg buttons) above the tabs. Without tabs the actions sit at the end.
 */
export function PageHeader({
  tabs,
  actions,
  mobileTabsFirst = false,
  className,
}: {
  tabs?: React.ReactNode
  actions?: React.ReactNode
  /** Mobile: tabs above the actions (Clinics design) instead of the actions on top. */
  mobileTabsFirst?: boolean
  className?: string
}) {
  if (!tabs && !actions) return null
  return (
    <div className={cn("flex flex-col gap-4 md:gap-3 xl:flex-row xl:items-center", className)}>
      {tabs && <div className={cn("min-w-0 md:order-1 xl:flex-1", mobileTabsFirst ? "order-1" : "order-2")}>{tabs}</div>}
      {actions && (
        <div
          className={cn(
            "flex gap-2 md:order-2 xl:ms-auto",
            mobileTabsFirst ? "order-2" : "order-1",
            "*:data-[slot=button]:h-10 *:data-[slot=button]:flex-1 *:data-[slot=button]:px-6 md:*:data-[slot=button]:h-9 md:*:data-[slot=button]:flex-none md:*:data-[slot=button]:px-4",
            !tabs && "md:justify-end"
          )}
        >
          {actions}
        </div>
      )}
    </div>
  )
}

/**
 * Module Tabs (sheet 08 · Module pages) as route navigation: muted track, active tab = card pill + shadow-xs,
 * 18px icon (Bold when active), optional count. Tabs come from the module registry, so a tab hidden for the
 * branch disappears here, in the sidebar tree and in the rail flyout at the same time.
 */
export function ModuleTabsNav({ module, counts, className }: { module: ModuleId; counts?: Record<string, React.ReactNode>; className?: string }) {
  const { pathname, tabLabel } = useNav()
  const m = moduleById(module)
  const tabs = moduleTabs(m)
  const current = activeTab(m, pathname)
  if (tabs.length < 2) return null
  // Up to 3 tabs share the width on mobile; more than that scroll sideways (Appointments has 5).
  const many = tabs.length > 3
  return (
    <nav className={cn(many ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" : "md:overflow-x-auto md:[scrollbar-width:none]", className)}>
      <div className={cn("items-center gap-1 rounded-lg bg-muted p-1", many ? "inline-flex" : "flex md:inline-flex")}>
        {tabs.map((tab) => {
          const on = current?.key === tab.key
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              data-state={on ? "active" : "inactive"}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-md text-sm",
                many ? "shrink-0 px-3 md:px-3.5" : "min-w-0 flex-1 px-2 md:flex-none md:shrink-0 md:px-3.5",
                " font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color,box-shadow] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              )}
            >
              {tab.icon && <Icon name={tab.icon} size={18} variant={on ? "bold" : "linear"} className="hidden md:block" />}
              {tabLabel(m, tab.key)}
              {counts?.[tab.key] !== undefined && (
                <span
                  className={cn(
                    "hidden h-5 items-center md:inline-flex rounded-full px-1.5 text-xs font-medium tabular-nums",
                    on ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground"
                  )}
                >
                  {counts[tab.key]}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * Fixed bottom action bar for form pages on mobile (brief §5.6): replaces the bottom navigation while mounted.
 * Hidden from md up — forms show their actions inline there.
 */
export function MobileActionBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-mobile-action-bar
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card px-4 pt-3 pb-[max(--spacing(4),env(safe-area-inset-bottom))] md:hidden *:data-[slot=button]:h-10 *:data-[slot=button]:flex-1",
        className
      )}
      {...props}
    />
  )
}
