"use client"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { canOpenSection } from "./access"
import { attentionDots, attentionItems, sectionFacts, type Attention } from "./checks"
import { TWO_STEP_FROM } from "./data"
import { SettingsFrame, useAllowedSections, useDayMonth, useSetText } from "./frame"
import { SECTION_GROUPS, sectionById, type SectionDef, type SectionId } from "./sections"
import { useBranches, usePlan, useQuiet, useRoles, useRules, useSecurity, useUsers, useZatcaUnits } from "./store"

/** One-line status under each section (Overview cards and the mobile list). */
function useStatus() {
  const { t, b, n, l } = useSetText()
  const day = useDayMonth()
  const f = sectionFacts(useUsers(), useBranches(), useZatcaUnits())
  const roleCount = useRoles().length
  const twoStepRoles = useSecurity().twoStepRoles.length
  const rules = useRules().length
  const plan = usePlan()
  const quiet = useQuiet()
  return (id: SectionId): string => {
    switch (id) {
      case "branches":
        return t("status.branches", { count: f.branches, drafts: f.drafts })
      case "plan":
        return t("status.plan", { plan: b(plan.def.name), date: day(plan.renews) })
      case "users":
        return t("status.users", { active: n(f.active), invited: n(f.invited) })
      case "roles":
        return t("status.roles", { count: roleCount })
      case "modules":
        return t("status.modules", { count: f.modules })
      case "integrations":
        return t("status.integrations", { count: f.integrations, warnings: f.warnings })
      case "security":
        return t("status.security", { count: twoStepRoles })
      case "notifications":
        return quiet.on ? t("status.notifications", { count: rules, from: l(quiet.from), to: l(quiet.to) }) : t("status.notificationsNoQuiet", { count: rules })
      case "overview":
        return ""
      default:
        return t(`status.${id}`)
    }
  }
}

const TONE: Record<Attention["tone"], string> = {
  destructive: "bg-destructive-soft text-destructive",
  warning: "bg-warning-soft text-warning-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
}

/** Icon tile for section cards and rows (36, accent tint, primary icon). */
function Tile({ s }: { s: SectionDef }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
      <Icon name={s.icon} size={20} />
    </span>
  )
}

/**
 * Needs your attention (Widget / Set Attention): ZATCA certificate (red, Renew), users without 2-step (View), invites not
 * accepted (View), SMS usage (Plan). Rows for sections the user can't open are left out; the card hides when none are left.
 */
function AttentionCard() {
  const { t, b, n } = useSetText()
  const day = useDayMonth()
  const items = attentionItems(useUsers(), useZatcaUnits(), usePlan().sms).filter((a) => canOpenSection(a.section))
  const branches = useBranches()
  if (!items.length) return null
  const text = (a: Attention) => {
    switch (a.kind) {
      case "zatca": {
        const branch = branches.find((x) => x.key === a.values.branch)!
        return { title: t("attention.zatca", { days: a.values.days }), detail: t("attention.zatcaDetail", { branch: b(branch.name) }), button: t("attention.renew") }
      }
      case "twoStep":
        return { title: t("attention.twoStep", { count: a.values.count }), detail: t("attention.twoStepDetail", { date: day(TWO_STEP_FROM) }), button: t("attention.view") }
      case "invites":
        return { title: t("attention.invites", { count: a.values.count }), detail: t("attention.invitesDetail", { soon: a.values.soon }), button: t("attention.view") }
      case "sms":
        return {
          title: t("attention.sms", { pct: a.values.pct }),
          detail: t("attention.smsDetail", { used: n(Number(a.values.used)), quota: n(Number(a.values.quota)) }),
          button: t("attention.plan"),
        }
    }
  }
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 md:px-5 md:py-6">
      <header className="flex flex-col gap-1 pb-2">
        <h2 className="text-lg font-semibold text-foreground">{t("attention.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("attention.sub")}</p>
      </header>
      <ul className="flex flex-col divide-y">
        {items.map((a) => {
          const x = text(a)
          return (
            <li key={a.kind} className="flex items-center gap-3 py-3">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", TONE[a.tone])}>
                <Icon name={a.icon} size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{x.title}</p>
                <p className="text-xs text-muted-foreground">{x.detail}</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={a.href}>{x.button}</Link>
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Section cards, grouped (Widget / Set Sections): desktop = cards, 3 per row (tile, name, status, amber dot); tablet and
 * mobile = one list card per group (tile, name, status, dot, chevron).
 */
function SectionCards() {
  const { t } = useSetText()
  const status = useStatus()
  const dots = attentionDots(useUsers(), useZatcaUnits())
  const allowed = useAllowedSections()
  return (
    <div className="flex flex-col gap-6">
      {SECTION_GROUPS.map((g) => {
        const items = allowed.filter((s) => s.group === g)
        if (!items.length) return null
        return (
          <section key={g} className="flex flex-col gap-2.5">
            <h2 className="text-xs text-muted-foreground">{t(`groups.${g}`)}</h2>
            {/* Desktop cards */}
            <div className="hidden grid-cols-3 gap-3 xl:grid">
              {items.map((s) => (
                <Link
                  key={s.id}
                  href={s.href}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-4 outline-none transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="flex items-start justify-between gap-2">
                    <Tile s={s} />
                    {dots[s.id] && <span aria-label={t("menu.needsAttention")} role="img" className="mt-1 size-2 rounded-full bg-warning" />}
                  </span>
                  <span className="flex flex-col gap-1.5 pt-1">
                    <span className="text-sm font-medium text-foreground">{t(`sections.${s.id}`)}</span>
                    <span className="truncate text-xs text-muted-foreground">{status(s.id)}</span>
                  </span>
                </Link>
              ))}
            </div>
            {/* Tablet / mobile list */}
            <ul className="flex flex-col divide-y rounded-xl border bg-card px-4 xl:hidden">
              {items.map((s) => (
                <li key={s.id}>
                  <Link href={s.href} className="flex items-center gap-3 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <Tile s={s} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{t(`sections.${s.id}`)}</span>
                      <span className="truncate text-xs text-muted-foreground">{status(s.id)}</span>
                    </span>
                    {dots[s.id] && <span aria-label={t("menu.needsAttention")} role="img" className="size-2 shrink-0 rounded-full bg-warning" />}
                    <Icon name="arrow-right-1" size={20} className="shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/**
 * Settings · Overview (the Settings home on mobile): Needs your attention, then the grouped section cards. Header: Audit log
 * (when the user can open it).
 */
export function SettingsOverview() {
  const { t } = useSetText()
  const audit = sectionById("audit")
  return (
    <SettingsFrame
      section="overview"
      actions={
        canOpenSection("audit") ? (
          <Button variant="outline" asChild>
            <Link href={audit.href}>
              <Icon name="document-text" size={20} />
              {t("actions.auditLog")}
            </Link>
          </Button>
        ) : undefined
      }
    >
      <AttentionCard />
      <SectionCards />
    </SettingsFrame>
  )
}
