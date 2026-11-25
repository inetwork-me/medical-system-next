"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { MODULE_FALLBACKS, moduleById, type ModuleId } from "@/config/modules"
import LINKS from "@/config/module-links.json"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { canEditSection } from "./access"
import { OPEN_ITEMS, TONIGHT, type Branch, type BranchKey, type BranchModules } from "./data"
import { SettingsFrame } from "./frame"
import { KvRows, Note, SetCard, useUserText } from "./parts"
import { cancelScheduled, scheduleOff, setModuleNow, setTab, useBranches, useBranchModules, useScheduled, writeAudit } from "./store"

/** Rows in the design's order; Doctors (missing from the design) sits after Appointments. Eyes and dental is one row. */
type RowId = ModuleId | "eyesDental"
const ROWS: RowId[] = ["dashboard", "patients", "appointments", "doctors", "clinics", "lab", "billing", "records", "reports", "messages", "eyesDental"]
const EYES_DENTAL_TABS = ["patients.eyes", "patients.dental"]

const isOn = (cfg: BranchModules, id: RowId) => (id === "eyesDental" ? !EYES_DENTAL_TABS.some((t) => cfg.hiddenTabs.includes(t)) : !cfg.hiddenModules.includes(id))

/** Links that change when a module turns off: the nav surfaces plus every guarded link into it (scripts/module-links.mjs). */
export function linksInto(id: RowId): number {
  if (id === "eyesDental") return EYES_DENTAL_TABS.reduce((n, k) => n + ((LINKS.tabs as Record<string, number>)[k] ?? 0), 0)
  return LINKS.nav + ((LINKS.modules as Record<string, number>)[id] ?? 0)
}

function useModuleText() {
  const x = useUserText()
  const ts = useTranslations("shell")
  const branches = useBranches()
  const name = (id: RowId) => (id === "eyesDental" ? x.t("mods.eyesDental") : ts(`nav.${moduleById(id).labelKey}` as "nav.lab"))
  const icon = (id: RowId): IconName => (id === "eyesDental" ? "eye" : moduleById(id).icon)
  const branchName = (b: BranchKey) => x.b(branches.find((y) => y.key === b)!.name)
  const branchEn = (b: BranchKey) => branches.find((y) => y.key === b)!.name.en
  /** Eyes and dental is referred to the nearest branch that still offers it (Olaya, else another branch). */
  const referTo = (b: BranchKey, all: Record<BranchKey, BranchModules>) => {
    const other = branches.find((y: Branch) => y.key !== b && y.status === "open" && !!all[y.key] && isOn(all[y.key], "eyesDental"))
    return other ? x.b(other.name) : x.t("mods.anotherCenter")
  }
  const whenOff = (id: RowId, b: BranchKey, all: Record<BranchKey, BranchModules>) =>
    id === "eyesDental" ? x.t("whenOff.eyesDental", { branch: referTo(b, all) }) : x.t(`whenOff.${id as Exclude<ModuleId, "dashboard" | "patients">}`)
  return { ...x, ts, branches, name, icon, branchName, branchEn, whenOff, referTo }
}

/**
 * Settings · Modules per branch: branch switch (Olaya / Malaz / Jeddah), the rule note, one row per module — tile, name,
 * "n of m tabs" (+ open items), "When off" (its replacement), lock for Dashboard and Patients, a switch. A module with tabs
 * off shows its tab switches (any module's tabs open from "n of m tabs"). Switching a module off opens Turn off … at ….
 * Header: Branches.
 */
export function ModulesPage() {
  const x = useModuleText()
  const { t } = x
  const router = useRouter()
  const params = useSearchParams()
  const all = useBranchModules()
  const scheduled = useScheduled()
  const edit = canEditSection("modules")
  // The design opens on Malaz, the branch being set up; ?branch= picks another.
  const [branch, setBranch] = React.useState<BranchKey>(() => {
    const v = params.get("branch")
    return v && x.branches.some((y) => y.key === v) ? v : "malaz"
  })
  const [open, setOpen] = React.useState<Partial<Record<ModuleId, boolean>>>({})
  const [turnOff, setTurnOff] = React.useState<RowId | null>(null)
  const cfg = all[branch]
  const bn = x.branchName(branch)

  const pick = (b: BranchKey) => {
    setBranch(b)
    router.replace(`/settings/modules?branch=${b}`, { scroll: false })
  }
  const turnOn = (id: RowId) => {
    setModuleNow(branch, id, true)
    writeAudit({ what: { en: `Turned ${nameEn(id)} on at ${x.branchEn(branch)}`, ar: `فعّل ${x.name(id)} في ${bn}` }, where: "modules" })
    toast.success(t("toasts.moduleOn", { module: x.name(id), branch: bn }), { description: t("toasts.moduleOnText") })
  }
  const cancel = (id: RowId) => {
    cancelScheduled(branch, id)
    writeAudit({ what: { en: `Cancelled turning ${nameEn(id)} off tonight`, ar: `ألغى قفل ${x.name(id)} الليلة` }, where: "modules" })
    toast.info(t("toasts.offCancelled"), { description: t("toasts.offCancelledText", { module: x.name(id), branch: bn }) })
  }
  const toggleTab = (m: ModuleId, key: string, on: boolean) => {
    setTab(branch, `${m}.${key}`, on)
    const tab = x.ts(`tabs.${m}.${key}` as "tabs.lab.samples")
    writeAudit({ what: { en: `Turned the ${m} › ${key} tab ${on ? "on" : "off"}`, ar: `${on ? "فعّل" : "قفل"} تبويب ${tab} في ${x.name(m)}` }, where: "modules" })
    toast.success(on ? t("toasts.tabOn", { tab, branch: bn }) : t("toasts.tabOff", { tab, branch: bn }), { description: t("toasts.tabText") })
  }

  return (
    <SettingsFrame
      section="modules"
      actions={
        <Button variant="outline" asChild>
          <Link href="/settings/branches">
            <Icon name="location" size={20} />
            {t("sections.branches")}
          </Link>
        </Button>
      }
    >
      <SetCard title={t("pageTitles.modules")} sub={t("mods.sub")}>
        <Segmented
          size="sm"
          value={branch}
          onValueChange={pick}
          options={x.branches.map((y) => ({ value: y.key, label: x.b(y.name) }))}
          aria-label={t("mods.branch")}
          className="max-md:w-full md:w-fit"
        />
        <Note icon="shield-tick">{t("mods.rule")}</Note>
        <ul className="flex flex-col divide-y rounded-lg border">
          {ROWS.map((id) => {
            const locked = id !== "eyesDental" && !!MODULE_FALLBACKS[id].alwaysOn
            const on = isOn(cfg, id)
            const m = id === "eyesDental" ? undefined : moduleById(id)
            const tabs = m?.tabs ?? []
            const tabsOn = tabs.filter((tb) => !cfg.hiddenTabs.includes(`${m!.id}.${tb.key}`))
            const sched = scheduled.find((s) => s.branch === branch && s.module === id)
            const items = OPEN_ITEMS[branch]?.[id] ?? 0
            const showTabs = !!m && on && !locked && tabs.length > 1 && (open[m.id] ?? tabsOn.length < tabs.length)
            return (
              <li key={id} className={cn("flex flex-col gap-3 px-4 py-3", !on && "bg-muted/40")}>
                <div className="flex items-center gap-3">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", on ? "bg-accent text-primary" : "bg-muted text-muted-foreground")}>
                    <Icon name={x.icon(id)} size={20} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:gap-4">
                    <div className="flex min-w-0 flex-col gap-0.5 md:flex-1">
                      <span className={cn("text-sm font-medium", on ? "text-foreground" : "text-muted-foreground")}>{x.name(id)}</span>
                      <span className="text-xs text-muted-foreground">
                        {locked ? (
                          t("mods.alwaysOn")
                        ) : !on ? (
                          t("mods.offHere")
                        ) : tabs.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setOpen((o) => ({ ...o, [m!.id]: !showTabs }))}
                            aria-expanded={showTabs}
                            className="cursor-pointer rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            {t("mods.tabsOf", { n: tabsOn.length, m: tabs.length })}
                          </button>
                        ) : (
                          t("mods.noTabs")
                        )}
                        {on && items > 0 && <> · {t(`mods.items.${id === "lab" ? "lab" : "other"}`, { n: items })}</>}
                      </span>
                      {sched && (
                        <span className="text-xs text-warning-soft-foreground">
                          {t("mods.offTonight", { time: x.l(TONIGHT) })} ·{" "}
                          {edit && (
                            <button type="button" onClick={() => cancel(id)} className="cursor-pointer underline outline-none">
                              {t("mods.cancel")}
                            </button>
                          )}
                        </span>
                      )}
                      {!locked && <span className="text-xs text-info-soft-foreground md:hidden">{t("mods.whenOffLine", { what: x.whenOff(id, branch, all) })}</span>}
                    </div>
                    {!locked && (
                      <span className="hidden w-[300px] shrink-0 items-center gap-1.5 text-xs text-muted-foreground md:flex">
                        <Icon name="routing-2" size={16} className="shrink-0" />
                        {x.whenOff(id, branch, all)}
                      </span>
                    )}
                  </div>
                  {locked && <Icon name="lock" size={18} className="shrink-0 text-muted-foreground" label={t("mods.alwaysOn")} />}
                  <Switch
                    checked={on && !sched}
                    disabled={locked || !edit}
                    aria-label={t("mods.switch", { module: x.name(id), branch: bn })}
                    onCheckedChange={(v) => (v ? (sched ? cancel(id) : turnOn(id)) : setTurnOff(id))}
                    className={cn(locked && "data-[state=checked]:bg-muted-foreground disabled:opacity-100")}
                  />
                </div>
                {showTabs && (
                  <div className="ms-12 grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {tabs.map((tb) => {
                      const tabOn = !cfg.hiddenTabs.includes(`${m!.id}.${tb.key}`)
                      const last = tabOn && tabsOn.length === 1
                      const label = x.ts(`tabs.${m!.id}.${tb.key}` as "tabs.lab.samples")
                      return (
                        <label
                          key={tb.key}
                          className={cn("flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-xs", tabOn ? "bg-card text-foreground" : "bg-muted/60 text-muted-foreground")}
                        >
                          <span className="min-w-0 flex-1 leading-tight">{label}</span>
                          <Switch
                            checked={tabOn}
                            disabled={!edit || last}
                            onCheckedChange={(v) => toggleTab(m!.id, tb.key, v)}
                            aria-label={t("mods.tabSwitch", { tab: label, branch: bn })}
                          />
                        </label>
                      )
                    })}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </SetCard>
      {turnOff && <TurnOffDialog branch={branch} id={turnOff} onOpenChange={(o) => !o && setTurnOff(null)} />}
    </SettingsFrame>
  )
}

const nameEn = (id: RowId) => (id === "eyesDental" ? "Eyes and dental" : moduleById(id).labelKey)

type When = "tonight" | "now"

/**
 * Overlay · Turn off a module (module switch): summary (branch, module, open items — amber, must finish or move), what
 * happens (where its work goes, what patient files show, menu hidden at this branch only, "Nothing breaks · n links now
 * point to the replacement"), when (Tonight 23:00 / Now). Open items block "Now". → `module-off`.
 */
function TurnOffDialog({ branch, id, onOpenChange }: { branch: BranchKey; id: RowId; onOpenChange: (o: boolean) => void }) {
  const x = useModuleText()
  const { t } = x
  const all = useBranchModules()
  const [when, setWhen] = React.useState<When>("tonight")
  const [tried, setTried] = React.useState(false)
  const bn = x.branchName(branch)
  const name = x.name(id)
  const items = OPEN_ITEMS[branch]?.[id] ?? 0
  const links = linksInto(id)
  const replaced = id !== "eyesDental" && !!MODULE_FALLBACKS[id].href
  const error = when === "now" && items > 0 ? t("turnOff.errNow", { n: items }) : undefined
  const toastText = id === "eyesDental" ? t("toastOff.eyesDental", { branch: x.referTo(branch, all) }) : t(`toastOff.${id as "lab"}`)

  const go = () => {
    setTried(true)
    if (error) return
    if (when === "now") setModuleNow(branch, id, false)
    else scheduleOff(branch, id)
    const br = x.branches.find((y) => y.key === branch)!.name
    writeAudit({
      what: {
        en: `${when === "now" ? "Turned" : `Scheduled turning`} ${nameEn(id)} off at ${br.en}${when === "now" ? "" : ` tonight ${TONIGHT}`}`,
        ar: `${when === "now" ? "قفل" : "جدول قفل"} ${name} في ${br.ar}${when === "now" ? "" : ` الليلة ${TONIGHT}`}`,
      },
      where: "modules",
    })
    if (when === "now") toast.success(t("toasts.moduleOffNow", { module: name, branch: bn }), { description: toastText })
    else toast.success(t("toasts.moduleOff", { module: name, branch: bn }), { description: t("toasts.moduleOffText", { time: x.l(TONIGHT), what: toastText }) })
    onOpenChange(false)
  }

  const lines: [IconName, string][] = [
    ["routing-2", id === "eyesDental" ? t("what.eyesDental.route", { branch: x.referTo(branch, all) }) : t(`what.${id as "lab"}.route`, { branch: bn })],
    ["document-text", id === "eyesDental" ? t("what.eyesDental.file") : t(`what.${id as "lab"}.file`)],
    ["category", t("what.menu", { module: name, branch: bn })],
  ]
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("turnOff.title", { module: name, branch: bn })}
      description={t("turnOff.sub")}
      icon="category"
      tone="warning"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={go}>{t("turnOff.confirm")}</Button>}
    >
      {tried && error && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <KvRows
        boxed
        rows={[
          [t("turnOff.branch"), bn],
          [t("turnOff.module"), name],
          [id === "lab" ? t("turnOff.openOrders") : t("turnOff.openItems"), items > 0 ? t("turnOff.itemsValue", { n: items }) : t("turnOff.none"), items > 0 ? "warning" : undefined],
        ]}
      />
      <ul className="flex flex-col gap-2 rounded-[10px] bg-muted/70 p-3 text-xs text-foreground">
        {lines.map(([ic, text]) => (
          <li key={ic} className="flex items-start gap-2">
            <Icon name={ic} size={16} className="mt-px shrink-0 text-primary" />
            <span>{text}</span>
          </li>
        ))}
        <li className="flex items-start gap-2">
          <Icon name="tick-circle" size={16} className="mt-px shrink-0 text-success" />
          <span>{replaced ? t("what.linksReplaced", { n: links }) : t("what.linksHidden", { n: links, branch: bn })}</span>
        </li>
      </ul>
      <Field label={t("turnOff.when")} required error={tried ? error : undefined}>
        {(c) => (
          <Segmented<When>
            {...c}
            value={when}
            onValueChange={setWhen}
            options={[
              { value: "tonight", label: t("turnOff.tonight", { time: x.l(TONIGHT) }) },
              { value: "now", label: t("turnOff.now") },
            ]}
          />
        )}
      </Field>
    </ResponsiveDialog>
  )
}
