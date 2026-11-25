"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import type { Bi } from "@/lib/mock/bi"
import { useDates } from "@/i18n/dates"
import { Icon, type IconName } from "@/components/ds/icon"
import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { MSG_TODAY } from "./data"
import type { AccessLevel, Delivery, LogoTone, PartnerType, Presence, Provider, TemplateChannel, ThreadStatus } from "./types"

/*
 * Shared Messages atoms (Widgets page "Messages widgets · components"): logo tiles, provider marks, mini chips, the status
 * badges (access level, delivery, thread status, connection), partner type and channel chips, presence dot.
 */

/* ------------------------------------------------------------------ text */

const ARABIC = /[؀-ۿ]/
const LATIN_RUN = /[A-Za-z0-9@+#{][A-Za-z0-9@._\-+/:#{}]*(?:[ ][A-Za-z0-9@+#{][A-Za-z0-9@._\-+/:#{}]*)*/g
const LRI = "⁦"
const PDI = "⁩"

/**
 * Arabic lines keep emails, domains, MRNs, PA / INV / CLM / REQ numbers and phone numbers LTR (brief §4 · Arabic): a value
 * with no Arabic in it is isolated whole; inside Arabic text each Latin run is isolated.
 */
export function isolate(text: string, locale: string) {
  if (locale !== "ar" || !text) return text
  if (!ARABIC.test(text)) return LRI + text + PDI
  return text.replace(LATIN_RUN, (m) => LRI + m + PDI)
}

/** Locale helpers for the Messages screens. */
export function useMsgText() {
  const locale = useLocale()
  const t = useTranslations("messages")
  const dates = useDates()
  const b = React.useCallback((v: Bi) => isolate(locale === "ar" ? v.ar : v.en, locale), [locale])
  const yesterday = React.useMemo(() => {
    const d = new Date(`${MSG_TODAY}T12:00`)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [])
  return {
    locale,
    t,
    dates,
    b,
    /** Latin value inside the current language (emails, numbers): isolated in Arabic. */
    l: (s: string) => isolate(s, locale),
    /** List time: "10:42" today, "Yesterday", else "22 Nov". */
    when: (iso: string) => {
      const day = iso.slice(0, 10)
      if (day === MSG_TODAY) return iso.slice(11, 16)
      if (day === yesterday) return t("time.yesterday")
      return dates.dayMonth(iso)
    },
    /** Message stamp: "Today 10:42", "24 Nov 14:05". */
    stamp: (iso: string) => {
      const time = iso.slice(11, 16)
      if (iso.slice(0, 10) === MSG_TODAY) return t("time.today", { time })
      return `${dates.dayMonth(iso)} ${isolate(time, locale)}`
    },
    isToday: (iso: string) => iso.slice(0, 10) === MSG_TODAY,
  }
}

/* ------------------------------------------------------------------ notes, rows, switches */

/**
 * Note / strip (design `note()`): soft fill, 12 padding, radius 10, 18 icon, 12 text. Validation errors use it as the
 * Strip (destructive) next to the field errors — never a toast.
 */
export function Note({ tone = "info", icon = "info-circle", children, className }: { tone?: "info" | "success" | "warning" | "destructive"; icon?: IconName; children: React.ReactNode; className?: string }) {
  return (
    <p
      role={tone === "warning" || tone === "destructive" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-[10px] p-3 text-xs leading-relaxed",
        tone === "info" && "bg-info-soft text-info-soft-foreground",
        tone === "success" && "bg-success-soft text-success-soft-foreground",
        tone === "warning" && "bg-warning-soft text-warning-soft-foreground",
        tone === "destructive" && "bg-destructive-soft text-destructive-soft-foreground",
        className
      )}
    >
      <Icon name={icon} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

/** Label / value rows (design `kv`): 12 muted label, 14 value, border between rows; optional value tone. */
export function KvRows({ rows, boxed, className }: { rows: [React.ReactNode, React.ReactNode, ("success" | "warning")?][]; boxed?: boolean; className?: string }) {
  return (
    <div className={cn(boxed && "rounded-[10px] border px-3", className)}>
      {rows.map(([k, v, tone], i) => (
        <div key={i} className={cn("flex items-center gap-3 border-b last:border-b-0", boxed ? "py-2.5" : "py-4")}>
          <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{k}</span>
          <span className={cn("min-w-0 flex-1 text-sm", tone === "success" ? "text-success" : tone === "warning" ? "text-warning-soft-foreground" : "text-foreground")}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/** Bordered switch row (design SWITCH field): label 14, optional 12 hint, switch at the end. */
export function SwitchRow({ label, hint, checked, onChange, disabled }: { label: React.ReactNode; hint?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-3 rounded-[10px] border p-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

/**
 * Radio card with a leading mark (design `choices()`): radio dot · 32 mark · title 14 Medium + 12 muted line; checked =
 * accent fill + primary border. Use inside <RadioGroup>.
 */
export function ChoiceCard({ value, lead, title, sub, disabled }: { value: string; lead?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; disabled?: boolean }) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      disabled={disabled}
      className="group/choice flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border bg-card p-3 text-start transition-colors outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-accent"
    >
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card group-data-[state=checked]/choice:border-primary">
        <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
      </span>
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </span>
    </RadioGroupPrimitive.Item>
  )
}

export const ChoiceGroup = ({ value, onValueChange, children, ...aria }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode; "aria-label"?: string }) => (
  <RadioGroupPrimitive.Root value={value} onValueChange={onValueChange} className="flex flex-col gap-2" {...aria}>
    {children}
  </RadioGroupPrimitive.Root>
)

/** Card shell used by the Messages widgets: radius 14, border, 20 / 16 padding, title + subtitle + optional head action. */
export function MsgCard({
  title,
  sub,
  action,
  children,
  className,
}: {
  title?: React.ReactNode
  sub?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-[14px] border bg-card p-4 md:p-5", className)}>
      {(title || action) && (
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ tiles */

const LOGO_TONE: Record<LogoTone, string> = {
  info: "bg-info-soft text-info-soft-foreground",
  accent: "bg-accent text-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  muted: "bg-muted text-foreground",
}

/** Organisation initials tile (no real logos): radius 10, soft tone, 14 Medium (H4 from 48). */
export function LogoTile({ initials, tone = "muted", size = 32, className }: { initials: string; tone?: LogoTone; size?: 32 | 36 | 40 | 44 | 56; className?: string }) {
  return (
    <span
      aria-hidden
      dir="ltr"
      style={{ width: size, height: size }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px] font-medium", size >= 48 ? "text-lg" : "text-sm", LOGO_TONE[tone], className)}
    >
      {initials}
    </span>
  )
}

/** Person avatar (initials on accent), sm 32 / md 40, with an optional presence dot. */
export function PersonAvatar({ initials, size = "sm", presence, className }: { initials: string; size?: "sm" | "default"; presence?: Presence; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar size={size}>
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      {presence && presence !== "offline" && <PresenceDot presence={presence} className="absolute -end-0.5 -bottom-0.5 ring-2 ring-card" />}
    </span>
  )
}

/** Presence: green = online, amber = away. */
export function PresenceDot({ presence, className }: { presence: Presence; className?: string }) {
  const t = useTranslations("messages.presence")
  if (presence === "offline") return null
  return (
    <span
      role="img"
      aria-label={t(presence)}
      className={cn("inline-block size-2 shrink-0 rounded-full", presence === "online" ? "bg-success" : "bg-warning", className)}
    />
  )
}

/** Icon tile: radius 10, 20 icon from 40 (18 below). */
export function IconTile({ icon, size = 32, className }: { icon: IconName; size?: 32 | 36 | 40; className?: string }) {
  return (
    <span aria-hidden style={{ width: size, height: size }} className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground", className)}>
      <Icon name={icon} size={size >= 40 ? 20 : 18} />
    </span>
  )
}

/** Microsoft 365 mark: the four squares (card tile with a border). */
export function MicrosoftMark({ size = 40 }: { size?: 16 | 32 | 40 }) {
  const q = Math.max(7, Math.floor(size / 4))
  const sq = (c: string) => <span style={{ width: q, height: q, background: c }} className="block" />
  if (size === 16)
    return (
      <span aria-hidden className="inline-grid shrink-0 grid-cols-2 gap-px" style={{ width: 15, height: 15 }}>
        {sq("#F25022")}
        {sq("#7FBA00")}
        {sq("#00A4EF")}
        {sq("#FFB900")}
      </span>
    )
  return (
    <span aria-hidden style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-[10px] border bg-card">
      <span className="grid grid-cols-2 gap-0.5" dir="ltr">
        {sq("#F25022")}
        {sq("#7FBA00")}
        {sq("#00A4EF")}
        {sq("#FFB900")}
      </span>
    </span>
  )
}

export type BrandKind = Provider | "whatsapp" | "sms" | "people"

/** Provider / channel mark: Microsoft 365, Google (card + border), WhatsApp (green), SMS (blue), people (accent). */
export function BrandMark({ kind, size = 40 }: { kind: BrandKind; size?: 32 | 40 }) {
  if (kind === "m365") return <MicrosoftMark size={size} />
  const map: Record<Exclude<BrandKind, "m365">, [IconName, string]> = {
    google: ["google", "border bg-card text-foreground"],
    imap: ["sms", "border bg-card text-foreground"],
    whatsapp: ["whatsapp", "bg-success-soft text-success-soft-foreground"],
    sms: ["sms", "bg-info-soft text-info-soft-foreground"],
    people: ["profile-2user", "bg-accent text-primary"],
  }
  const [icon, cls] = map[kind]
  return (
    <span aria-hidden style={{ width: size, height: size }} className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px]", cls)}>
      <Icon name={icon} size={size >= 40 ? 20 : 18} />
    </span>
  )
}

/* ------------------------------------------------------------------ chips */

export type ChipTone = "primary" | "warning" | "success" | "info" | "destructive"
const CHIP_TONE: Record<ChipTone | "muted", string> = {
  primary: "bg-accent text-primary",
  warning: "bg-warning-soft text-warning-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  destructive: "bg-destructive-soft text-destructive-soft-foreground",
  muted: "bg-muted text-muted-foreground",
}

/** Mini chip: pill, 2 / 8 padding, 12 icon, 12 Medium. Muted unless a tone is given. Renders a link / button when asked. */
export function MiniChip({
  icon,
  tone,
  children,
  className,
  ...props
}: React.ComponentProps<"span"> & { icon?: IconName; tone?: ChipTone }) {
  return (
    <span className={cn("inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap", CHIP_TONE[tone ?? "muted"], className)} {...props}>
      {icon && <Icon name={icon} size={12} />}
      <bdi>{children}</bdi>
    </span>
  )
}

/** Type / tag chip (spec chip, small): pill, 3 / 10 padding, 12 Medium; no tone = card with a border. */
export function TagChip({ tone, children, className }: { tone?: ChipTone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        tone ? CHIP_TONE[tone] : "border bg-card text-foreground",
        className
      )}
    >
      <bdi>{children}</bdi>
    </span>
  )
}

/** Unread / new count pill (blue, white text). */
export function CountPill({ n, className }: { n: number; className?: string }) {
  if (!n) return null
  return <span className={cn("inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums", className)}>{n}</span>
}

/* ------------------------------------------------------------------ badges */

const ACCESS_TONE: Record<AccessLevel, StatusTone> = { manage: "success", sendAs: "info", reply: "neutral", read: "warning" }
/** Mailbox access: Manage green · Send as blue · Reply grey · Read only amber. */
export function AccessBadge({ level }: { level: AccessLevel }) {
  const t = useTranslations("messages.access")
  return <StatusBadge tone={ACCESS_TONE[level]}>{t(level)}</StatusBadge>
}

/**
 * Patient message state on the list: Replied (amber, needs reception), Read (green), Failed (red). Delivered / sent and
 * handled replies show no badge (as drawn).
 */
export function DeliveryBadge({ state, needsAction, female }: { state: Delivery; needsAction?: boolean; female?: boolean }) {
  const t = useTranslations("messages.delivery")
  if (state === "failed") return <StatusBadge tone="destructive">{t("failed")}</StatusBadge>
  if (state === "read") return <StatusBadge tone="success">{t("read")}</StatusBadge>
  if (state === "replied" && needsAction) return <StatusBadge tone="warning">{t(female ? "repliedF" : "replied")}</StatusBadge>
  return null
}

const STATUS_TONE: Record<ThreadStatus, StatusTone> = { waitingUs: "warning", waitingThem: "info", closed: "neutral" }
/** Partner conversation: Waiting for us (amber) · Waiting for them (blue) · Closed (grey). */
export function ThreadStatusBadge({ status }: { status: ThreadStatus }) {
  const t = useTranslations("messages.status")
  return <StatusBadge tone={STATUS_TONE[status]}>{t(status)}</StatusBadge>
}

/** Connection card status: Connected (green) · Not connected (grey) · Allowed (blue) · Needs attention (red). */
export function ConnectionBadge({ status }: { status: "connected" | "notConnected" | "allowed" | "error" }) {
  const t = useTranslations("messages.connection")
  const tone: StatusTone = status === "connected" ? "success" : status === "allowed" ? "info" : status === "error" ? "destructive" : "neutral"
  return <StatusBadge tone={tone}>{t(status)}</StatusBadge>
}

const TYPE_TONE: Record<PartnerType, ChipTone | undefined> = { insurer: "info", lab: "success", hospital: "primary", supplier: "warning", government: undefined }
/** Partner type: Insurer blue · Lab green · Hospital (accent) · Supplier amber · Government (plain). */
export function PartnerTypeChip({ type }: { type: PartnerType }) {
  const t = useTranslations("messages.partnerType")
  return <TagChip tone={TYPE_TONE[type]}>{t(type)}</TagChip>
}

const CHANNEL_ICON: Record<TemplateChannel, IconName> = { sms: "sms", whatsapp: "whatsapp", email: "direct-inbox", chat: "messages-2" }
/** Template channel chip (WhatsApp green). */
export function ChannelChip({ channel }: { channel: TemplateChannel }) {
  const t = useTranslations("messages.channel")
  return (
    <MiniChip icon={CHANNEL_ICON[channel]} tone={channel === "whatsapp" ? "success" : undefined}>
      {t(channel)}
    </MiniChip>
  )
}

/** Patient channel icon on list rows: WhatsApp (green) / SMS (muted). */
export function ChannelIcon({ channel, className }: { channel: "whatsapp" | "sms"; className?: string }) {
  const t = useTranslations("messages.channel")
  return (
    <span role="img" aria-label={t(channel)} className={cn("inline-flex shrink-0", channel === "whatsapp" ? "text-success" : "text-muted-foreground", className)}>
      <Icon name={channel === "whatsapp" ? "whatsapp" : "sms"} size={14} />
    </span>
  )
}

/** How a shared mailbox grants access (Mail accounts): by role / by branch (muted) · named people only (red, lock). */
export function GrantChip({ grant, managed }: { grant: "role" | "branch" | "named"; managed?: boolean }) {
  const t = useTranslations("messages.grant")
  if (grant === "named")
    return (
      <MiniChip icon="lock" tone="destructive">
        {t("named")}
      </MiniChip>
    )
  return <MiniChip icon="profile-2user">{t(grant === "role" && managed ? "roleManaged" : grant)}</MiniChip>
}
