"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import type { DateRange } from "react-day-picker"

import { bi } from "@/lib/mock/bi"
import { useIsMobile } from "@/hooks/use-media-query"
import { Field } from "@/components/ds/field"
import { DateRangePicker } from "@/components/ds/pickers"
import { Segmented } from "@/components/ds/segmented"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BRANCH_KEYS, REGIONS, REGION_KEYS, filterPatients, type PatientQuery, type Tag } from "../data"
import { usePatientsStore } from "../store"
import { useListQuery } from "./use-list-query"

const toIso = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined)
const fromIso = (s?: string) => (s ? new Date(`${s}T00:00:00`) : undefined)

/**
 * Overlay · Filters panel (prototype: Filters → drawer, topRight = inline-end; mobile = bottom sheet):
 * gender, age from/to, region, branch, last-visit range, tags; Reset + "Show N patients" with a live count.
 */
export function FiltersPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("patients.filters")
  const mobile = useIsMobile()
  const { query, update } = useListQuery()
  const { patients } = usePatientsStore()
  const locale = useLocale()
  const [draft, setDraft] = React.useState<PatientQuery>(query)

  // Re-seed the draft from the URL each time the panel opens.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(query)
  }

  const count = React.useMemo(() => filterPatients(patients, draft, locale).length, [patients, draft, locale])
  const set = (patch: Partial<PatientQuery>) => setDraft((d) => ({ ...d, ...patch }))
  const tagOn = (tag: Tag) => draft.tags?.includes(tag) ?? false
  const setTag = (tag: Tag, on: boolean) => set({ tags: on ? [...(draft.tags ?? []), tag] : (draft.tags ?? []).filter((x) => x !== tag) })

  const apply = () => {
    update({
      gender: draft.gender,
      ageFrom: draft.ageFrom,
      ageTo: draft.ageTo,
      region: draft.region,
      branch: draft.branch,
      from: draft.from,
      to: draft.to,
      tags: draft.tags?.join(",") || null,
    })
    onOpenChange(false)
  }
  const reset = () => setDraft({ q: query.q, chip: query.chip })

  const body = (
    <div className="flex flex-col gap-4">
      <Field label={t("gender")}>
        {(c) => (
          <Segmented
            aria-labelledby={undefined}
            aria-label={t("gender")}
            value={draft.gender ?? "all"}
            onValueChange={(v) => set({ gender: v })}
            options={[
              { value: "all", label: t("all") },
              { value: "male", label: t("male") },
              { value: "female", label: t("female") },
            ]}
            className={c["aria-invalid"] ? "ring-destructive" : undefined}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("ageFrom")}>
          <Input inputMode="numeric" value={draft.ageFrom ?? ""} onChange={(e) => set({ ageFrom: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })} dir="ltr" />
        </Field>
        <Field label={t("ageTo")}>
          <Input inputMode="numeric" value={draft.ageTo ?? ""} onChange={(e) => set({ ageTo: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })} dir="ltr" />
        </Field>
      </div>
      <Field label={t("region")}>
        {(c) => (
          <Select value={draft.region ?? "all"} onValueChange={(v) => set({ region: v as PatientQuery["region"] })}>
            <SelectTrigger {...c}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allRegions")}</SelectItem>
              {REGION_KEYS.map((r) => (
                <SelectItem key={r} value={r}>
                  {bi(REGIONS[r].long, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("branch")}>
        {(c) => (
          <Select value={draft.branch ?? "all"} onValueChange={(v) => set({ branch: v as PatientQuery["branch"] })}>
            <SelectTrigger {...c}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allBranches")}</SelectItem>
              {BRANCH_KEYS.map((b) => (
                <SelectItem key={b} value={b}>
                  <BranchLabel k={b} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label={t("lastVisit")}>
        {(c) => (
          <DateRangePicker
            {...c}
            value={draft.from || draft.to ? ({ from: fromIso(draft.from), to: fromIso(draft.to) } as DateRange) : undefined}
            onChange={(r) => set({ from: toIso(r?.from), to: toIso(r?.to) })}
            placeholder={t("pickRange")}
            daysLabel={(n) => t("days", { n })}
          />
        )}
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-xs font-medium">{t("tags")}</legend>
        {(
          [
            ["vip", t("tagVip")],
            ["incomplete", t("tagIncomplete")],
            ["duplicate", t("tagDuplicate")],
            ["banned", t("tagBanned")],
          ] as [Tag, string][]
        ).map(([tag, label]) => (
          <label key={tag} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={tagOn(tag)} onCheckedChange={(v) => setTag(tag, v === true)} />
            {label}
          </label>
        ))}
      </fieldset>
    </div>
  )

  const actions = (
    <>
      <Button variant="outline" onClick={reset}>
        {t("reset")}
      </Button>
      <Button onClick={apply}>{t("show", { count })}</Button>
    </>
  )

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("title")}</DrawerTitle>
            <DrawerDescription>{t("description")}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>{body}</DrawerBody>
          <DrawerFooter className="flex-row *:data-[slot=button]:flex-1">{actions}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="gap-5 sm:max-w-100">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <SheetBody>{body}</SheetBody>
        <SheetFooter className="border-t-0 pb-6">{actions}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function BranchLabel({ k }: { k: (typeof BRANCH_KEYS)[number] }) {
  const t = useTranslations("patients.branches")
  return <>{t(k)}</>
}
