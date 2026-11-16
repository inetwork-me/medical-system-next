"use client"

import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

export type PasswordLevel = "weak" | "fair" | "strong"

const LEVEL = {
  weak: { filled: 1, bar: "bg-destructive", text: "text-destructive" },
  fair: { filled: 2, bar: "bg-warning", text: "text-warning" },
  strong: { filled: 4, bar: "bg-success", text: "text-success" },
} as const

/** Simple client-side estimate; the server stays the source of truth for password rules. */
export function scorePassword(pw: string): PasswordLevel | null {
  if (!pw) return null
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s <= 2 ? "weak" : s <= 3 ? "fair" : "strong"
}

/**
 * DS sheet 11 · Password Strength: 4 segments (4px, gap 4, rounded-full) that fill from the start side,
 * + a 12 Medium label in the level tone, gap 6. Placed under the new-password field.
 */
export function PasswordStrength({ level, className }: { level: PasswordLevel | null; className?: string }) {
  const t = useTranslations("common.password")
  if (!level) return null
  const l = LEVEL[level]
  return (
    <div data-slot="password-strength" className={cn("flex flex-col gap-1.5", className)} aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i < l.filled ? l.bar : "bg-muted")} />
        ))}
      </div>
      <p className={cn("text-xs font-medium", l.text)}>{t(level)}</p>
    </div>
  )
}
