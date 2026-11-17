"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { Button } from "@/components/ui/button"
import { usePatient, useText } from "../profile/use-patient"
import { specialtyHref } from "./data"

/**
 * Full-screen specialty workspace (Eyes & Dental · workspace screens): no sidebar or app header.
 * Workspace bar (64px): back · breadcrumb over the title · patient chip + insurance · mode tabs · actions (xl+).
 * Below xl (tablet design) the bar keeps back · title · actions and the mode tabs move to the top of the content.
 */

export type WorkspaceKind = "eye" | "dental"
const MODES: Record<WorkspaceKind, { key: string; href: (id: string) => string }[]> = {
  eye: [
    { key: "exam", href: specialtyHref.eyeExam },
    { key: "anatomy", href: specialtyHref.eyeAnatomy },
    { key: "compare", href: specialtyHref.eyeCompare },
  ],
  dental: [
    { key: "chart", href: (id) => specialtyHref.dentalChart(id) },
    { key: "3d", href: specialtyHref.dental3d },
    { key: "plan", href: specialtyHref.dentalPlan },
    { key: "gums", href: specialtyHref.dentalGums },
  ],
}

export function Workspace({
  kind,
  mode,
  actions,
  children,
}: {
  kind: WorkspaceKind
  mode: string
  /** Bar actions; render compact (icon) variants with `xl:hidden` / full ones with `max-xl:hidden` as the design does. */
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTranslations("specialties.ws")
  const tp = useTranslations("patients")
  const { b } = useText()
  const data = usePatient()
  if (!data)
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-4">
        <EmptyState
          icon="profile-2user"
          title={tp("page.notFoundTitle")}
          description={tp("page.notFoundText")}
          actions={
            <Button variant="outline" asChild>
              <Link href="/patients">{tp("page.backToList")}</Link>
            </Button>
          }
        />
      </main>
    )
  const { patient: p, record } = data
  const back = kind === "eye" ? specialtyHref.eyes(p.id) : specialtyHref.dental(p.id)
  const title = t(kind === "eye" ? "titleEye" : "titleDental")
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 xl:px-6">
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={back} aria-label={t("back")}>
            <Icon name="arrow-left" size={20} />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col xl:flex-none">
          <nav aria-label={t("breadcrumb")} className="flex items-center gap-1.5 text-xs">
            <Link href="/patients" className="text-primary hover:underline max-sm:hidden">
              {tp("title")}
            </Link>
            <span className="text-muted-foreground max-sm:hidden">/</span>
            <Link href={`/patients/${p.id}`} className="truncate text-primary hover:underline">
              {b(p.name)}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{t(kind === "eye" ? "crumbEyes" : "crumbDental")}</span>
          </nav>
          <h1 className="truncate text-base font-semibold">{title}</h1>
        </div>
        <span aria-hidden className="hidden h-8 w-px bg-border xl:block" />
        <div className="hidden items-center gap-2.5 xl:flex">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground" aria-hidden>
            {p.initials}
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-medium">{b(p.name)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("patientMeta", { age: p.age })} <bdi dir="ltr">MRN {p.mrn}</bdi>
            </span>
          </span>
          {record.details.insurance && (
            <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-medium text-info-soft-foreground">{b(record.details.insurance)}</span>
          )}
        </div>
        <ModeTabs kind={kind} mode={mode} id={p.id} className="mx-auto hidden xl:flex" />
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 xl:p-4">
        <ModeTabs kind={kind} mode={mode} id={p.id} className="xl:hidden" fill />
        {children}
      </div>
    </div>
  )
}

function ModeTabs({ kind, mode, id, className, fill }: { kind: WorkspaceKind; mode: string; id: string; className?: string; fill?: boolean }) {
  const t = useTranslations("specialties.ws.modes")
  return (
    <nav aria-label={t("label")} className={cn("max-w-full overflow-x-auto [scrollbar-width:none]", className)}>
      <div className={cn("flex gap-0.5 rounded-lg bg-muted p-[3px]", fill ? "w-full min-w-max *:flex-1" : "w-fit")}>
        {MODES[kind].map((m) => {
          const on = m.key === mode
          return (
            <Link
              key={m.key}
              href={m.href(id)}
              aria-current={on ? "page" : undefined}
              data-state={on ? "active" : "inactive"}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              {t(`${kind}.${m.key}` as "dental.chart")}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
