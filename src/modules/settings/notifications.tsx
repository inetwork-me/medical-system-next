"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { StatusBadge } from "@/components/ds/status-badge"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { canEditSection } from "./access"
import { SettingsFrame } from "./frame"
import { KvRows, Note, SetCard, useUserText } from "./parts"
import { CHANNELS, ESCALATE_AFTER, RECIPIENTS, REMINDER_PLANS, type Channel, type RecipientKey, type Rule } from "./notify-data"
import { saveQuiet, saveRule, useQuiet, useRules, writeAudit } from "./store"

/** Rule text helpers: recipients, channels, escalation ("Head of dept after 15 min", "30 and 7 days before"). */
function useRuleText() {
  const x = useUserText()
  const { t, b, locale } = x
  const sep = locale === "ar" ? "، " : ", "
  const who = (keys: RecipientKey[]) => keys.map((k) => b(RECIPIENTS[k])).join(sep)
  const channel = (c: Channel) => t(`notify.channels.${c}`)
  const after = (m: number) => (m >= 1440 ? t("notify.days", { n: m / 1440 }) : m >= 60 ? t("notify.hours", { n: m / 60 }) : t("notify.minutes", { n: m }))
  const reminder = (plan: string) => {
    const days = plan.split(",").map(Number)
    return t("notify.reminder", { list: days.slice(0, -1).join(sep), last: days[days.length - 1], n: days.length })
  }
  const escalation = (r: Rule) =>
    r.reminder ? reminder(r.reminder) : r.escalateAfter && r.escalateTo ? t("notify.escalation", { who: b(RECIPIENTS[r.escalateTo]), after: after(r.escalateAfter) }) : "—"
  return { ...x, who, channel, after, reminder, escalation }
}

/**
 * Settings · Notification rules: columns event (+ Urgent chip), who, channels (App / SMS / Email chips), if no one acts
 * (escalation), Edit — a list on mobile. Quiet hours box: switch + "urgent always goes through". Header: Save changes (quiet
 * hours); each rule saves from Edit rule.
 */
export function NotificationsPage() {
  const x = useRuleText()
  const { t, b, l } = x
  const rules = useRules()
  const saved = useQuiet()
  const edit = canEditSection("notifications")
  const [quietOn, setQuietOn] = React.useState(saved.on)
  const [editing, setEditing] = React.useState<Rule | null>(null)

  const save = () => {
    if (quietOn !== saved.on) {
      saveQuiet({ ...saved, on: quietOn })
      writeAudit({ what: { en: `Turned quiet hours ${quietOn ? "on" : "off"} (${saved.from}–${saved.to})`, ar: `${quietOn ? "فعّل" : "قفل"} ساعات الهدوء (${saved.from}–${saved.to})` }, where: "notifications" })
    }
    toast.success(t("toasts.saved"), { description: t("toasts.savedText") })
  }

  const chips = (r: Rule) => (
    <span className="flex flex-wrap gap-1">
      {r.channels.map((c) => (
        <span key={c} className="inline-flex h-5 items-center rounded-full bg-info-soft px-2 text-xs text-info-soft-foreground">
          {x.channel(c)}
        </span>
      ))}
    </span>
  )
  const urgent = <StatusBadge tone="destructive">{t("notify.urgent")}</StatusBadge>

  return (
    <SettingsFrame section="notifications" actions={edit ? <Button onClick={save}>{t("general.save")}</Button> : undefined}>
      <SetCard title={t("pageTitles.notifications")} sub={t("notify.sub")}>
        <div className="hidden overflow-hidden rounded-lg border xl:block">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="w-[25%] px-4 py-3 text-start font-normal">{t("notify.colEvent")}</th>
                <th className="w-[19%] px-3 py-3 text-start font-normal">{t("notify.colWho")}</th>
                <th className="w-[17%] px-3 py-3 text-start font-normal">{t("notify.colChannels")}</th>
                <th className="w-[29%] px-3 py-3 text-start font-normal">{t("notify.colEscalation")}</th>
                <th className="px-4 py-3">
                  <span className="sr-only">{t("users.colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-foreground">{b(r.event)}</span>
                      {r.urgent && urgent}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-foreground">{x.who(r.who)}</td>
                  <td className="px-3 py-3">{chips(r)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{x.escalation(r)}</td>
                  <td className="px-4 py-3 text-end">
                    {edit && (
                      <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                        {t("branches.edit")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="flex flex-col divide-y xl:hidden">
          {rules.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={!edit}
                onClick={() => setEditing(r)}
                className="flex w-full cursor-pointer items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <Icon name="notification" size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm text-foreground">{b(r.event)}</span>
                  <span className="text-xs text-muted-foreground">
                    {x.who(r.who)} · {r.channels.map(x.channel).join(x.locale === "ar" ? "، " : ", ")}
                  </span>
                  {r.urgent && <span>{urgent}</span>}
                </span>
                {edit && <Icon name="arrow-right-1" size={20} className="shrink-0 text-foreground" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted/70 p-3.5">
          <div className="flex items-center gap-3">
            <Icon name="timer-1" size={18} className="shrink-0 text-muted-foreground" />
            <label htmlFor="quiet" className="min-w-0 flex-1 cursor-pointer text-sm text-foreground">
              {t("notify.quiet", { from: l(saved.from), to: l(saved.to) })}
            </label>
            <Switch id="quiet" checked={quietOn} onCheckedChange={setQuietOn} disabled={!edit} />
          </div>
          <p className="text-xs text-muted-foreground">{t("notify.quietHint")}</p>
        </div>
      </SetCard>
      {editing && <EditRuleDialog rule={editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </SettingsFrame>
  )
}

function CheckList<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T[]; onChange: (v: T[]) => void; label: string }) {
  const id = React.useId()
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 rounded-[10px] border px-3 py-2.5">
      {options.map(([k, text]) => (
        <div key={k} className="flex items-center gap-2.5">
          <Checkbox id={`${id}-${k}`} checked={value.includes(k)} onCheckedChange={(v) => onChange(v === true ? [...value, k] : value.filter((y) => y !== k))} />
          <label htmlFor={`${id}-${k}`} className="cursor-pointer text-sm text-foreground">
            {text}
          </label>
        </div>
      ))}
    </div>
  )
}

/**
 * Overlay · Edit rule: event, who (checklist), how (App / SMS / Email), if no one acts in … then tell … (a reminder plan for
 * expiring credentials), ignore quiet hours (always on for urgent rules). → `rule-saved`.
 */
function EditRuleDialog({ rule, onOpenChange }: { rule: Rule; onOpenChange: (o: boolean) => void }) {
  const x = useRuleText()
  const { t, b } = x
  const [who, setWho] = React.useState<RecipientKey[]>(rule.who)
  const [channels, setChannels] = React.useState<Channel[]>(rule.channels)
  const [after, setAfter] = React.useState(String(rule.escalateAfter ?? 0))
  const [to, setTo] = React.useState<RecipientKey | "">(rule.escalateTo ?? "")
  const [plan, setPlan] = React.useState(rule.reminder ?? "")
  const [ignoreQuiet, setIgnoreQuiet] = React.useState(!!rule.ignoreQuiet || !!rule.urgent)
  const [tried, setTried] = React.useState(false)
  const escalates = after !== "0"
  const errors = {
    who: !who.length ? t("notify.errWho") : undefined,
    channels: !channels.length ? t("notify.errChannels") : undefined,
    to: escalates && !rule.reminder && !to ? t("notify.errTo") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const id = React.useId()
  // Escalate to a role that isn't already told (Head of department, Medical director, Billing manager …).
  const escalateOptions = (Object.keys(RECIPIENTS) as RecipientKey[]).filter((k) => !who.includes(k) && k !== "orderingDoctor" && k !== "theDoctor")

  const save = () => {
    setTried(true)
    if (invalid) return
    const next: Rule = {
      ...rule,
      who,
      channels: CHANNELS.filter((c) => channels.includes(c)),
      escalateAfter: rule.reminder ? undefined : Number(after) || undefined,
      escalateTo: rule.reminder || !escalates ? undefined : (to as RecipientKey),
      reminder: rule.reminder ? plan : undefined,
      ignoreQuiet: rule.urgent ? true : ignoreQuiet,
    }
    saveRule(next)
    writeAudit({
      what: {
        en: `Changed the "${rule.event.en}" rule: ${next.who.map((k) => RECIPIENTS[k].en).join(", ")} · ${next.channels.join(", ")}${next.escalateTo ? ` · escalate to ${RECIPIENTS[next.escalateTo].en} after ${next.escalateAfter} min` : ""}`,
        ar: `عدّل قاعدة "${rule.event.ar}"`,
      },
      where: "notifications",
    })
    toast.success(t("toasts.ruleSaved"), { description: t("toasts.ruleSavedText", { event: b(rule.event), n: who.length }) })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("notify.editTitle")}
      description={b(rule.event)}
      icon="notification"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("notify.save")}</Button>}
    >
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <KvRows boxed rows={[[t("notify.colEvent"), b(rule.event), rule.urgent ? "warning" : undefined]]} />
      <Field label={t("notify.colWho")} error={tried ? errors.who : undefined}>
        <CheckList options={rule.options.map((k) => [k, b(RECIPIENTS[k])] as [RecipientKey, string])} value={who} onChange={setWho} label={t("notify.colWho")} />
      </Field>
      <Field label={t("notify.how")} error={tried ? errors.channels : undefined}>
        <CheckList options={CHANNELS.map((c) => [c, x.channel(c)] as [Channel, string])} value={channels} onChange={setChannels} label={t("notify.how")} />
      </Field>
      {rule.reminder ? (
        <Field label={t("notify.remind")}>
          {(c) => (
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {x.reminder(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <Field label={t("notify.after")}>
            {(c) => (
              <Select value={after} onValueChange={setAfter}>
                <SelectTrigger {...c} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESCALATE_AFTER.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m ? x.after(m) : t("notify.noEscalation")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label={t("notify.thenTell")} error={tried ? errors.to : undefined}>
            {(c) => (
              <Select value={to} onValueChange={(v) => setTo(v as RecipientKey)} disabled={!escalates}>
                <SelectTrigger {...c} className="w-full">
                  <SelectValue placeholder={escalates ? t("invite.pick") : "—"} />
                </SelectTrigger>
                <SelectContent>
                  {escalateOptions.map((k) => (
                    <SelectItem key={k} value={k}>
                      {b(RECIPIENTS[k])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <Checkbox id={id} checked={ignoreQuiet} onCheckedChange={(v) => setIgnoreQuiet(v === true)} disabled={rule.urgent} />
          <label htmlFor={id} className={cn("cursor-pointer text-sm text-foreground", rule.urgent && "cursor-default")}>
            {t("notify.ignoreQuiet")}
          </label>
        </div>
        {rule.urgent && <p className="ps-7 text-xs text-muted-foreground">{t("notify.urgentAlways")}</p>}
      </div>
    </ResponsiveDialog>
  )
}
