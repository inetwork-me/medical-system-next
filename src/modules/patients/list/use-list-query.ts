"use client"

import { useSearchParams } from "next/navigation"

import { usePathname, useRouter } from "@/i18n/navigation"
import type { BranchKey, Gender, PatientQuery, RegionKey, Tag } from "../data"

export const FILTER_KEYS = ["gender", "ageFrom", "ageTo", "region", "branch", "from", "to", "tags"] as const

/**
 * Patients list state lives in the URL (?q, chip, page, filters, patient=<id> for the side sheet) so links like
 * "Clear filters", the back button and sharing a filtered list all work.
 */
export function useListQuery() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined)

  const query: PatientQuery = {
    q: sp.get("q") ?? undefined,
    chip: (sp.get("chip") as Tag | null) ?? "all",
    gender: (sp.get("gender") as Gender | null) ?? "all",
    ageFrom: num("ageFrom"),
    ageTo: num("ageTo"),
    region: (sp.get("region") as RegionKey | null) ?? "all",
    branch: (sp.get("branch") as BranchKey | null) ?? "all",
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    tags: (sp.get("tags")?.split(",").filter(Boolean) as Tag[] | undefined) ?? [],
  }
  const page = Math.max(1, num("page") ?? 1)
  const activeFilters = FILTER_KEYS.filter((k) => sp.get(k)).length

  /** Patch the URL; any change other than paging/sheet resets to page 1. */
  function update(patch: Record<string, string | number | null | undefined>) {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "" || v === "all") next.delete(k)
      else next.set(k, String(v))
    }
    if (!("page" in patch) && !("patient" in patch)) next.delete("page")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { query, page, update, activeFilters, sheetId: sp.get("patient") }
}
