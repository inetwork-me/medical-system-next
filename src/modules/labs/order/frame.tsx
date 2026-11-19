"use client"

import * as React from "react"
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { PageContainer, PageHeader } from "@/components/shell/page"
import { PageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import type { LabOrder } from "../data"
import { orderHref, type OrderPage as OrderPageKey } from "../href"
import { useLabOrder } from "../store"
import { useLabText } from "../text"

const TABS = ["results", "sample", "report"] as const
type OrderTab = (typeof TABS)[number]

const Ctx = React.createContext<{ order: LabOrder; tab: OrderTab } | null>(null)

/** The order of the current order page (inside OrderFrame). */
export function useCurrentOrder(): LabOrder {
  const c = React.useContext(Ctx)
  if (!c) throw new Error("useCurrentOrder outside OrderFrame")
  return c.order
}

function useSegmentTab(): OrderTab {
  const seg = useSelectedLayoutSegment()
  return (TABS as readonly string[]).includes(seg ?? "") ? (seg as OrderTab) : "results"
}

/**
 * Lab order page frame (`/lab/order[/sample|/report|/entry]?no=LAB-0142`): header Back · "Lab" over
 * "LAB-0142 · Abdullah Al-Shammari"; mobile: Back · "Order" · ⋯ replaces the app bar. The order is read on the
 * client (static export; orders created in the session open too).
 */
export function OrderFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("labs.order")
  const tn = useTranslations("shell.nav")
  const { b } = useLabText()
  const order = useLabOrder(useSearchParams().get("no") ?? "")
  const tab = useSegmentTab()
  const value = React.useMemo(() => (order ? { order, tab } : null), [order, tab])

  if (!order) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="glass"
            title={t("notFound")}
            description={t("notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href="/lab">
                  <Icon name="arrow-left" size={16} />
                  {t("backToList")}
                </Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    )
  }

  return (
    <Ctx.Provider value={value}>
      <PageTitle title={t("title", { no: order.no, name: b(order.patient.name) })} crumbs={[{ label: tn("lab"), href: "/lab" }]} back="/lab" />
      <MobileBar order={order} />
      {children}
    </Ctx.Provider>
  )
}

/** Page body of an order tab: tabs row (+ the tab's actions; one row from tablet up) and the content. */
export function OrderPage({ actions, className, children }: { actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const order = useCurrentOrder()
  const tab = React.useContext(Ctx)?.tab ?? "results"
  return (
    <PageContainer className={className}>
      <PageHeader mobileTabsFirst className="md:flex-row md:items-center md:*:last:ms-auto" tabs={<OrderTabs active={tab} no={order.no} />} actions={actions} />
      {children}
    </PageContainer>
  )
}

function MobileBar({ order }: { order: LabOrder }) {
  const t = useTranslations("labs.order")
  return (
    <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/lab" aria-label={t("back")}>
          <Icon name="arrow-left" size={24} />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{t("mobileTitle")}</h1>
      <ActionMenu
        title={order.no}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("more")}>
            <Icon name="more" size={20} />
          </Button>
        }
        groups={[
          TABS.map((k) => ({ key: k, icon: k === "results" ? "glass" : k === "sample" ? "drop" : "document-text", label: t(`tabs.${k}`), href: orderHref(order.no, k as OrderPageKey) })),
        ]}
      />
    </div>
  )
}

/** Order tabs Results · Sample · Report: muted track, active = card pill + shadow-xs (text only). */
function OrderTabs({ active, no }: { active: OrderTab; no: string }) {
  const t = useTranslations("labs.order.tabs")
  return (
    <nav aria-label={t("label")}>
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
        {TABS.map((key) => {
          const on = key === active
          return (
            <Link
              key={key}
              href={orderHref(no, key)}
              aria-current={on ? "page" : undefined}
              data-state={on ? "active" : "inactive"}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color,box-shadow]",
                "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
              )}
            >
              {t(key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
