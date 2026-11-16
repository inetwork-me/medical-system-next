"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HeaderSearch } from "./header-search"
import { BottomNav, MobileAppBar } from "./mobile-nav"
import { NotificationsButton } from "./notifications"
import { Rail } from "./rail"
import { SidebarPanel } from "./sidebar"
import { useLocaleSwitch, useNav } from "./use-shell"
import { UserMenuButton } from "./user-menu"

import { SIDEBAR_COOKIE } from "./constants"

/**
 * App shell (sheet 06 + Dashboard · Navigation states):
 *  · ≥1024  sidebar 256 expanded, header toggle collapses it to the 64px rail (remembered in a cookie)
 *  · 768–1023  rail always; toggle opens the full sidebar as an overlay from the start edge (black/50 scrim)
 *  · <768  mobile web app: app bar + bottom navigation (+ More sheet); no sidebar
 * The sidebar sits on the right in Arabic (logical start edge).
 */
export function AppShell({ defaultCollapsed, children }: { defaultCollapsed: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  const [overlay, setOverlay] = React.useState(false)
  const t = useTranslations("shell.header")

  const toggle = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      const next = !collapsed
      setCollapsed(next)
      document.cookie = `${SIDEBAR_COOKIE}=${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`
    } else {
      setOverlay(true)
    }
  }

  return (
    <div className="group/shell flex min-h-dvh bg-background" data-collapsed={collapsed || undefined}>
      {/* Desktop expanded sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh w-sidebar shrink-0 border-e border-sidebar-border bg-sidebar",
          !collapsed && "lg:block"
        )}
      >
        <SidebarPanel />
      </aside>
      {/* Rail: tablet always, desktop when collapsed */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh w-rail shrink-0 border-e border-sidebar-border bg-sidebar md:block",
          !collapsed && "lg:hidden"
        )}
      >
        <Rail />
      </aside>
      {/* Tablet overlay sidebar */}
      <Sheet open={overlay} onOpenChange={setOverlay}>
        <SheetContent
          side="start"
          showCloseButton={false}
          overlayClassName="bg-overlay-strong"
          className="w-sidebar gap-0 border-sidebar-border bg-sidebar sm:max-w-sidebar"
        >
          <SheetTitle className="sr-only">{t("mainNav")}</SheetTitle>
          <SidebarPanel onNavigate={() => setOverlay(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onToggle={toggle} className="hidden md:flex" />
        <MobileAppBar className="md:hidden" />
        <main className="flex min-w-0 flex-1 flex-col pb-28 md:pb-0 group-has-[[data-mobile-action-bar]]/shell:pb-24 md:group-has-[[data-mobile-action-bar]]/shell:pb-0">
          {children}
        </main>
      </div>
      <BottomNav className="md:hidden group-has-[[data-mobile-action-bar]]/shell:hidden" />
    </div>
  )
}

/**
 * DS sheet 08 · Header (64px, card, border-b, sticky): sidebar toggle · page title (18 SemiBold) · spacer ·
 * search · language (outline, names the other language) · dark mode · notifications · avatar (user menu).
 */
function Header({ onToggle, className }: { onToggle: () => void; className?: string }) {
  const { current, label } = useNav()
  const t = useTranslations("shell.header")
  const tc = useTranslations("common.language")
  const { other, switchLocale } = useLocaleSwitch()

  return (
    <header className={cn("sticky top-0 z-30 h-16 shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-8", className)}>
      <Button variant="ghost" size="icon" onClick={onToggle} aria-label={t("toggleSidebar")}>
        <Icon name="sidebar-left" size={24} />
      </Button>
      <p className="min-w-0 truncate text-lg font-semibold text-foreground">{current ? label(current) : ""}</p>
      <div className="flex-1" />
      <HeaderSearch className="w-40 lg:w-70" />
      <Button variant="outline" onClick={switchLocale} aria-label={tc("switchLabel")}>
        <Icon name="language-square" size={24} />
        <span lang={other}>{tc("other")}</span>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Dark mode is postponed (brief §5.9): the toggle is shown but not active yet. */}
          <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Button variant="ghost" size="icon" disabled aria-label={t("darkMode")} tabIndex={-1}>
              <Icon name="moon" size={24} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("darkMode")}</TooltipContent>
      </Tooltip>
      <NotificationsButton />
      <UserMenuButton />
    </header>
  )
}
