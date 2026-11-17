"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { activeTab } from "@/lib/modules"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { useNav } from "./use-shell"

export type Crumb = { label: string; href: string }
/** What the app header shows for the current page: optional back link, breadcrumb trail and the page title. */
export type PageTitleValue = { title: string; crumbs?: Crumb[]; back?: string }

const Ctx = React.createContext<{ value: PageTitleValue | null; set: (v: PageTitleValue | null) => void } | null>(null)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [value, set] = React.useState<PageTitleValue | null>(null)
  const ctx = React.useMemo(() => ({ value, set }), [value])
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
}

/**
 * Sets the header title for the page while it's mounted. Pages without one get the route default
 * (module root → "Home" / module, other module tabs → module / tab).
 */
export function usePageTitle(value: PageTitleValue | null) {
  const set = React.useContext(Ctx)?.set
  const key = JSON.stringify(value)
  React.useLayoutEffect(() => {
    if (!set) return
    set(key === "null" ? null : (JSON.parse(key) as PageTitleValue))
    return () => set(null)
  }, [key, set])
}

/** Component form of usePageTitle, for server pages. */
export function PageTitle(props: PageTitleValue) {
  usePageTitle(props)
  return null
}

function useDefaultTitle(): PageTitleValue {
  const { current, pathname, label, tabLabel, t } = useNav()
  if (!current) return { title: "" }
  // Dashboard: the greeting lives in the page (beside Export / New appointment), the top bar stays empty.
  if (current.id === "dashboard") return { title: "" }
  const tab = activeTab(current, pathname)
  if (!tab?.ownTitle) return { title: label(current), crumbs: [{ label: t("nav.home"), href: "/dashboard" }] }
  return { title: tabLabel(current, tab.key), crumbs: [{ label: label(current), href: current.href }] }
}

/**
 * Header title block (DS sheet 08 · Header): back (outline sm, arrow-left) · breadcrumb (12, first crumb primary,
 * the rest muted, "/" between) over the page title (18 SemiBold).
 */
export function HeaderTitle({ className }: { className?: string }) {
  const value = React.useContext(Ctx)?.value
  const fallback = useDefaultTitle()
  const t = useTranslations("shell.header")
  const { title, crumbs, back } = value ?? fallback
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {back && (
        <Button variant="outline" size="icon-sm" className="shrink-0" asChild>
          <Link href={back} aria-label={t("back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
      )}
      <div className="flex min-w-0 flex-col">
        {!!crumbs?.length && (
          <nav aria-label={t("breadcrumb")}>
            <ol className="flex items-center gap-1.5 text-xs leading-4">
              {crumbs.map((c, i) => (
                <React.Fragment key={c.href + i}>
                  {i > 0 && (
                    <li aria-hidden className="text-muted-foreground">
                      /
                    </li>
                  )}
                  <li className="min-w-0 truncate">
                    <Link href={c.href} className={cn("hover:underline", i === 0 ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                      {c.label}
                    </Link>
                  </li>
                </React.Fragment>
              ))}
            </ol>
          </nav>
        )}
        {title && <h1 className="truncate text-lg leading-7 font-semibold text-foreground">{title}</h1>}
      </div>
    </div>
  )
}
