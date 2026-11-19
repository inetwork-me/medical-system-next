"use client"

import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/ds/states"
import { LabFrame } from "./frame"

/** Placeholder for Lab screens built in later steps of the Labs build. */
export function LabSoon() {
  const t = useTranslations("labs.soon")
  return (
    <LabFrame>
      <div className="rounded-xl border bg-card">
        <EmptyState icon="glass" title={t("title")} className="py-16" />
      </div>
    </LabFrame>
  )
}
