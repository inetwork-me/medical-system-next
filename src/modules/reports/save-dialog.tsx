"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Field } from "@/components/ds/field"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { REP_NOW } from "./data"
import { SOURCE_FOLDER, type BuilderCfg, type PreviewRow } from "./builder-data"
import type { DrillTo, SavedReport } from "./library"
import { personOf } from "./library-list"
import type { AreaId } from "./overview-data"
import { useB } from "./parts"
import { repCan } from "./roles"
import { saveReport, useRepRole } from "./store"
import { Strip } from "./strip"

const ME = "mansour"
const FOLDERS: AreaId[] = ["operations", "finance", "clinical", "doctors"]
type Visibility = SavedReport["visibility"]

/** Where a saved report's Open goes (the module list, normal permissions there). */
function drillOf(c: BuilderCfg): DrillTo {
  if (c.measure === "noShowRate" && c.groupBy === "clinic") return "appointmentsNoShows"
  if (c.measure === "claimRejections" && c.groupBy === "insurer") return "claims"
  if (c.measure === "notesOnTime") return "completion"
  return "none"
}

/**
 * Overlay · Save the report (Save report in the builder): Name*, What it's for, Folder, Who can see it (Only me / My
 * team / Everyone with reports). The report stores source, measure, grouping, filters, chart, owner, folder and
 * visibility (brief §4). Editing your own report saves over it; someone else's is saved as your own copy (theirs stays
 * as it is). A missing name shows on the field and in a strip, never in a toast. Save → report-saved.
 */
export function SaveReportDialog({
  cfg,
  rows,
  editing,
  suggested,
  onOpenChange,
  onSaved,
  initial,
}: {
  cfg: BuilderCfg
  rows: PreviewRow[]
  editing?: SavedReport
  suggested: string
  onOpenChange: (open: boolean) => void
  onSaved?: (id: string) => void
  initial?: { name?: string; tried?: boolean }
}) {
  const t = useTranslations("reports.save")
  const tt = useTranslations("shell.tabs.reports")
  const b = useB()
  const role = useRepRole()
  const own = !!editing && editing.owner === ME
  const wide = repCan(role, "share")
  const [name, setName] = React.useState(initial?.name ?? (editing ? b(editing.name) : suggested))
  const [purpose, setPurpose] = React.useState(editing ? b(editing.desc) : "")
  const [folder, setFolder] = React.useState<AreaId>(editing?.folder ?? SOURCE_FOLDER[cfg.source])
  const [who, setWho] = React.useState<Visibility>(wide ? (own ? editing.visibility : "team") : "me")
  const [tried, setTried] = React.useState(!!initial?.tried)
  const missing = !name.trim()
  const owner = editing && !own ? personOf(editing.owner) : undefined

  const save = () => {
    if (missing) {
      setTried(true)
      return
    }
    const id = own ? editing.id : `my-${Date.now().toString(36)}`
    const keepName = editing && name.trim() === b(editing.name)
    const keepDesc = editing && purpose.trim() === b(editing.desc)
    const booked = rows.reduce((s, r) => s + (r.base ?? 0), 0)
    const missed = rows.reduce((s, r) => s + (r.count ?? 0), 0)
    const r: SavedReport = {
      id,
      name: keepName ? editing.name : { en: name.trim(), ar: name.trim() },
      desc: keepDesc ? editing.desc : { en: purpose.trim(), ar: purpose.trim() },
      area: folder,
      owner: ME,
      source: cfg.source,
      measure: cfg.measure,
      groupBy: cfg.groupBy,
      chart: cfg.chart,
      folder,
      visibility: who,
      lastRun: REP_NOW,
      schedule: own ? editing.schedule : undefined,
      shares: own ? editing.shares : [],
      rows: rows.map(({ key, label, now, before, base, count }) => ({ key, label, now, before, base, count })),
      cause: own && editing.measure === cfg.measure ? editing.cause : undefined,
      drill: drillOf(cfg),
      refresh: own ? editing.refresh : { en: "When opened", ar: "لما ينفتح" },
      extra: cfg.measure === "noShowRate" && booked ? { missed, booked, revenueMissed: own ? editing.extra?.revenueMissed : undefined } : undefined,
      builder: { thenBy: cfg.thenBy, filters: cfg.filters, dated: cfg.dated, status: cfg.status },
    }
    saveReport(r)
    onOpenChange(false)
    toast.success(t("toast"), { description: t("toastText", { folder: tt(folder) }) })
    onSaved?.(id)
  }

  const nameError = tried && missing ? t("nameError") : undefined
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("text")}
      icon="tick-circle"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("save")}</Button>}
    >
      {tried && missing && (
        <Strip tone="destructive" icon="info-circle">
          {t("error")}
        </Strip>
      )}
      {owner && (
        <Strip tone="info" icon="info-circle">
          {t("copy", { owner: b(owner.name) })}
        </Strip>
      )}
      <Field label={t("name")} required error={nameError}>
        {(fp) => <Input {...fp} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
      </Field>
      <Field label={t("purpose")}>
        {(fp) => <Textarea {...fp} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("purposePlaceholder")} className="min-h-[88px]" maxLength={300} />}
      </Field>
      <Field label={t("folder")}>
        {(fp) => (
          <Select value={folder} onValueChange={(v) => setFolder(v as AreaId)}>
            <SelectTrigger {...fp} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOLDERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {tt(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span id="save-who" className="text-sm font-medium text-foreground">
          {t("who")}
        </span>
        <Segmented
          value={who}
          onValueChange={(v) => wide && setWho(v)}
          aria-labelledby="save-who"
          className="*:flex-auto *:px-3"
          options={(wide ? (["me", "team", "everyone"] as const) : (["me"] as const)).map((v) => ({ value: v, label: t(v) }))}
        />
        {!wide && <p className="text-xs text-muted-foreground">{t("onlyMe")}</p>}
      </div>
    </ResponsiveDialog>
  )
}
