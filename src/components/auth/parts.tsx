"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/navigation"
import { Icon, type IconName } from "@/components/ds/icon"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocaleSwitch } from "@/components/shell/use-shell"

/** Ghost sm language switch: names the other language in its own script (prototype: → twin screen). */
export function LangButton() {
  const tc = useTranslations("common.language")
  const { other, switchLocale } = useLocaleSwitch()
  return (
    <Button variant="ghost" size="sm" onClick={switchLocale} aria-label={tc("switchLabel")}>
      <Icon name="language-square" size={20} />
      <span lang={other}>{tc("other")}</span>
    </Button>
  )
}

const TILE = {
  primary: "bg-accent text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-soft-foreground",
  destructive: "bg-destructive-soft text-destructive",
} as const

/** Screen title: optional 52px icon tile (rounded-xl, 26 icon) · H2 24 SemiBold · subtitle 14 muted (form column gap 20). */
export function AuthTitle({
  icon,
  tone = "primary",
  title,
  subtitle,
}: {
  icon?: IconName
  tone?: keyof typeof TILE
  title: React.ReactNode
  subtitle?: React.ReactNode
}) {
  return (
    <>
      {icon && (
        <span className={cn("flex size-13 items-center justify-center rounded-xl", TILE[tone])}>
          <Icon name={icon} size={26} />
        </span>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </>
  )
}

const ALERT = {
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
} as const

/** Inline form alert: p-3, gap-2.5, rounded-lg, soft fill, 18 icon + 12 text. */
export function AuthAlert({ tone, icon, children }: { tone: keyof typeof ALERT; icon: IconName; children: React.ReactNode }) {
  return (
    <div role={tone === "destructive" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-lg p-3", ALERT[tone])}>
      <Icon name={icon} size={18} />
      <p className="flex-1 text-xs">{children}</p>
    </div>
  )
}

export function OrDivider() {
  const t = useTranslations("auth.common")
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{t("or")}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/** "New here? Create an account" — 12 muted question + link button. */
export function LinkLine({ question, children }: { question: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
      {question}
      {children}
    </p>
  )
}

export function TextLink({ href, onClick, children }: { href?: string; onClick?: () => void; children: React.ReactNode }) {
  const cls = "h-auto p-0 text-sm"
  return href ? (
    <Button variant="link" asChild className={cls}>
      <Link href={href}>{children}</Link>
    </Button>
  ) : (
    <Button type="button" variant="link" onClick={onClick} className={cls}>
      {children}
    </Button>
  )
}

/** Ghost sm back link with a straight arrow (mirrors in Arabic), at the start of the column. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="sm" asChild className="-ms-3 self-start">
      <Link href={href}>
        <Icon name="arrow-left" size={20} />
        {children}
      </Link>
    </Button>
  )
}

/** Full-width lg primary action. */
export function SubmitButton({ loading, children }: { loading?: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" loading={loading} className="w-full">
      {children}
    </Button>
  )
}

/** Value that must stay LTR inside Arabic copy (phone numbers, e-mails). */
export const LtrTarget = (chunks: React.ReactNode) => <bdi dir="ltr" className="font-medium text-foreground">{chunks}</bdi>

/**
 * A control that does not work yet (D49, D50): it stays visible and switched off, with its reason as a tooltip (mouse, keyboard)
 * and as small text under it (touch screens have no hover). "notAvailable" = not built yet; "thirdParty" = waits for an
 * outside service that is not connected. Put the disabled control inside.
 */
export function Unavailable({ reason, align = "center", className, children }: { reason: "notAvailable" | "thirdParty"; align?: "start" | "center"; className?: string; children: React.ReactNode }) {
  const t = useTranslations("common.availability")
  const id = React.useId()
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-describedby={id} className="block w-full cursor-not-allowed rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{t(reason)}</TooltipContent>
      </Tooltip>
      <p id={id} className={cn("text-xs text-muted-foreground", align === "center" && "text-center")}>
        {t(reason)}
      </p>
    </div>
  )
}
