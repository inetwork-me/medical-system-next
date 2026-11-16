"use client"

import { useTranslations } from "next-intl"

import { StatusBadge, type StatusTone } from "@/components/ds/status-badge"
import { Badge } from "@/components/ui/badge"
import type { Tag } from "../data"

const TONE: Record<Exclude<Tag, "vip">, StatusTone> = { incomplete: "warning", duplicate: "neutral", banned: "destructive" }

/** Tags column: VIP = solid Badge; Incomplete / Duplicate? / Banned = Status Badges; "—" when none. */
export function PatientTags({ tags, className }: { tags: Tag[]; className?: string }) {
  const t = useTranslations("patients.tags")
  if (!tags.length) return <span className="text-muted-foreground">—</span>
  return (
    <span className={className ?? "flex flex-wrap items-center gap-1"}>
      {tags.map((tag) =>
        tag === "vip" ? (
          <Badge key={tag}>{t("vip")}</Badge>
        ) : (
          <StatusBadge key={tag} tone={TONE[tag]}>
            {t(tag)}
          </StatusBadge>
        )
      )}
    </span>
  )
}
