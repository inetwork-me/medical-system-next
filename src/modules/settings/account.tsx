"use client"

import * as React from "react"

import { visibleModules } from "@/lib/modules"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { PasswordInput } from "@/components/ds/password-input"
import { PasswordStrength, scorePassword } from "@/components/ds/password-strength"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useLocaleSwitch } from "@/components/shell/use-shell"
import { useTranslations } from "next-intl"
import { daysBetween } from "./checks"
import { SET_TODAY, type Account } from "./data"
import { SettingsFrame } from "./frame"
import { IconChip, Note, SetCard, useUserText } from "./parts"
import { identity } from "./services/identity"
import { saveAccount, updateUser, useAccount, useRules, useSecurity, useUser, writeAudit } from "./store"
import { ME_USER, type Device } from "./users-data"

const DEVICE_ICON: Record<Device["kind"], IconName> = { pc: "monitor", phone: "mobile", tablet: "mobile" }

function SwitchRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-3 rounded-[10px] border p-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      {/* A required alert stays on: shown solid, not greyed. */}
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className={disabled && checked ? "disabled:opacity-100" : undefined} />
    </div>
  )
}

/**
 * Settings · My account (everyone): Profile (photo, name, title, work email set by the admin, mobile), Preferences (language,
 * start page, calendar view), Sign-in and signing (password · Change, 2-step · On, Nafath · Linked, signing PIN · Change),
 * My notifications (critical results locked on, mentions, daily summary), Where you're signed in (this device, Sign out;
 * "Sign out everywhere else"). Header: Save changes.
 */
export function AccountPage() {
  const x = useUserText()
  const { t, b, locale } = x
  const tn = useTranslations("shell.nav")
  const saved = useAccount()
  const me = useUser(ME_USER)!
  const rules = useRules()
  const { switchLocale } = useLocaleSwitch()
  const lang = locale === "ar" ? "ar" : "en"
  const [f, setF] = React.useState<Account>({ ...saved, language: saved.language ?? lang })
  const [tried, setTried] = React.useState(false)
  const [dialog, setDialog] = React.useState<null | "password" | "pin">(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const set = <K extends keyof Account>(k: K, v: Account[K]) => setF((o) => ({ ...o, [k]: v }))
  // Critical results are a required alert (an urgent rule) for the doctors who get them.
  const critical = rules.find((r) => r.id === "critical-lab")
  const errors = {
    name: !f.name[lang].trim() ? t("account.errName") : undefined,
    mobile: !/^05\d{8}$/.test(f.mobile) ? t("invite.errMobile") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const devices = me.devices ?? []
  const starts: [string, string][] = visibleModules().map((m) => [m.href, tn(m.labelKey as "dashboard")])

  const save = () => {
    setTried(true)
    if (invalid) return
    saveAccount(f)
    writeAudit({ what: { en: "Updated my account", ar: "حدّث حسابه" }, where: "account" })
    toast.success(t("toasts.saved"), { description: t("toasts.savedText") })
    // Language takes effect straight away.
    if (f.language && f.language !== lang) switchLocale()
  }
  const photo = (file?: File) => {
    if (!file || !/^image\//.test(file.type)) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      set("photo", url)
      saveAccount({ photo: url })
      toast.success(t("toasts.logo"), { description: t("toasts.logoText") })
    }
    reader.readAsDataURL(file)
  }
  const signOut = (d: Device) => {
    updateUser(ME_USER, { devices: devices.filter((y) => y.id !== d.id) })
    writeAudit({ what: { en: `Signed out of ${d.name.en}`, ar: `طلع من ${d.name.ar}` }, where: "account" })
    toast.info(t("toasts.sessionEnded"), { description: t("toasts.sessionEndedText") })
  }
  const signOutOthers = () => {
    const others = devices.slice(1)
    if (!others.length) return
    updateUser(ME_USER, { devices: devices.slice(0, 1) })
    writeAudit({ what: { en: `Signed out of ${others.length} other devices`, ar: `طلع من ${others.length} أجهزة ثانية` }, where: "account" })
    toast.info(t("toasts.sessionEnded"), { description: t("account.othersOut", { n: others.length }) })
  }
  const passwordAge = daysBetween(f.passwordChanged, SET_TODAY)

  return (
    <SettingsFrame section="account" actions={<Button onClick={save}>{t("general.save")}</Button>}>
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <SetCard title={t("account.profile")}>
        <div className="flex items-center gap-4">
          {f.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-primary">{me.initials}</span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm text-foreground">{b(me.name)}</span>
            <span className="text-xs text-muted-foreground">{b(f.headline)}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => photo(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            {t("account.changePhoto")}
          </Button>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Field label={t("account.name")} required error={tried ? errors.name : undefined}>
            <Input value={f.name[lang]} onChange={(e) => set("name", { ...f.name, [lang]: e.target.value })} />
          </Field>
          <Field label={t("account.title")}>
            <Input value={f.title[lang]} onChange={(e) => set("title", { ...f.title, [lang]: e.target.value })} />
          </Field>
          <Field label={t("account.email")} helper={t("account.emailHint")}>
            {(c) => (
              <div className="relative" dir="ltr">
                <Icon name="sms" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input {...c} value={me.email} readOnly dir="ltr" className="ps-9 text-start" />
              </div>
            )}
          </Field>
          <Field label={t("account.mobile")} error={tried ? errors.mobile : undefined}>
            {(c) => (
              <div className="relative" dir="ltr">
                <Icon name="call" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input {...c} dir="ltr" inputMode="tel" value={f.mobile} onChange={(e) => set("mobile", e.target.value.replace(/[\s-]/g, ""))} className="ps-9 text-start" />
              </div>
            )}
          </Field>
        </div>
      </SetCard>

      <SetCard title={t("account.prefs")}>
        <Field label={t("account.language")}>
          {(c) => (
            <Segmented<"ar" | "en">
              {...c}
              value={f.language ?? lang}
              onValueChange={(v) => set("language", v)}
              options={[
                { value: "ar", label: t("numbering.prefs.language.ar") },
                { value: "en", label: t("numbering.prefs.language.en") },
              ]}
            />
          )}
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Field label={t("account.startPage")}>
            {(c) => (
              <Select value={f.startPage} onValueChange={(v) => set("startPage", v)}>
                <SelectTrigger {...c} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {starts.map(([href, label]) => (
                    <SelectItem key={href} value={href}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label={t("account.calendar")}>
            {(c) => (
              <Select value={f.calendar} onValueChange={(v) => set("calendar", v as Account["calendar"])}>
                <SelectTrigger {...c} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["day", "week", "month", "list"] as const).map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`account.views.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      </SetCard>

      <SetCard title={t("account.signing")}>
        <ul className="flex flex-col divide-y">
          {[
            { icon: "key" as IconName, title: t("account.password"), sub: passwordAge < 1 ? t("account.passwordToday") : passwordAge < 30 ? t("account.passwordDays", { n: passwordAge }) : t("account.passwordAge", { n: Math.round(passwordAge / 30) }), end: <Button variant="outline" size="sm" onClick={() => setDialog("password")}>{t("account.change")}</Button> },
            { icon: "shield-tick" as IconName, title: t("account.twoStep"), sub: me.twoStepMethod === "sms" ? t("account.viaSms") : t("account.viaApp"), end: me.twoStep ? <IconChip tone="success" icon="tick-circle">{t("users.on")}</IconChip> : <IconChip tone="warning">{t("users.off")}</IconChip> },
            { icon: "finger-scan" as IconName, title: t("account.nafath"), sub: t("account.nafathSub"), end: <IconChip tone="success" icon="tick-circle">{t("account.linked")}</IconChip> },
            { icon: "edit-2" as IconName, title: t("account.pin"), sub: t("account.pinSub"), end: <Button variant="outline" size="sm" onClick={() => setDialog("pin")}>{t("account.change")}</Button> },
          ].map((r) => (
            <li key={r.title} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <Icon name={r.icon} size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">{r.title}</span>
                <span className="text-xs text-muted-foreground">{r.sub}</span>
              </span>
              {r.end}
            </li>
          ))}
        </ul>
      </SetCard>

      <SetCard title={t("account.notifications")}>
        <div className="flex flex-col gap-3">
          <SwitchRow label={t("account.critical")} hint={critical?.urgent ? t("account.criticalHint") : undefined} checked disabled={!!critical?.urgent} onChange={() => {}} />
          <SwitchRow label={t("account.mentions")} checked={f.mentions} onChange={(v) => set("mentions", v)} />
          <SwitchRow label={t("account.daily")} checked={f.daily} onChange={(v) => set("daily", v)} />
        </div>
      </SetCard>

      <SetCard title={t("account.where")}>
        <ul className="flex flex-col divide-y">
          {devices.map((d, i) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                <Icon name={DEVICE_ICON[d.kind]} size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-foreground">{b(d.name)}</span>
                <span className="text-xs text-muted-foreground">{[d.browser ? b(d.browser) : "", x.agoInline(d.at), d.place ? b(d.place) : ""].filter(Boolean).join(" · ")}</span>
              </span>
              {i === 0 ? (
                <span className="inline-flex h-5 items-center rounded-full bg-info-soft px-2 text-xs text-info-soft-foreground">{t("account.thisDevice")}</span>
              ) : (
                <Button variant="outline" size="sm" onClick={() => signOut(d)}>
                  {t("user.signOut")}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {devices.length > 1 && (
          <Button variant="ghost" className="w-fit" onClick={signOutOthers}>
            {t("account.signOutOthers")}
          </Button>
        )}
      </SetCard>
      {dialog === "password" && <PasswordDialog onOpenChange={(o) => !o && setDialog(null)} onChanged={() => set("passwordChanged", SET_TODAY)} />}
      {dialog === "pin" && <PinDialog onOpenChange={(o) => !o && setDialog(null)} />}
    </SettingsFrame>
  )
}

/** Overlay · Change password: current, new (strength helper, the Security policy's length), again, sign out my other devices. */
function PasswordDialog({ onOpenChange, onChanged }: { onOpenChange: (o: boolean) => void; onChanged: () => void }) {
  const { t } = useUserText()
  const min = useSecurity().minLength
  const me = useUser(ME_USER)!
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [again, setAgain] = React.useState("")
  const [others, setOthers] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [wrong, setWrong] = React.useState(false)
  const id = React.useId()
  const level = next ? scorePassword(next) : null
  const errors = {
    current: !current ? t("account.errCurrent") : wrong ? t("account.errCurrentWrong") : undefined,
    next: next.length < min ? t("account.errLength", { n: min }) : level === "weak" ? t("account.errWeak") : next === current ? t("account.errSamePw") : undefined,
    again: again !== next ? t("account.errAgain") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  const go = async () => {
    setTried(true)
    if (invalid || busy) return
    setBusy(true)
    const r = await identity.changePassword(current, next)
    setBusy(false)
    if (!r.ok) {
      setWrong(true)
      return
    }
    if (others) updateUser(ME_USER, { devices: (me.devices ?? []).slice(0, 1) })
    onChanged()
    saveAccount({ passwordChanged: SET_TODAY })
    writeAudit({ what: { en: `Changed my password${others ? " · signed out other devices" : ""}`, ar: "غيّر كلمة المرور" }, where: "account" })
    toast.success(t("toasts.passwordChanged"), { description: others ? t("toasts.passwordChangedText") : t("toasts.passwordChangedStay") })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("account.pwTitle")}
      description={t("security.lengthN", { n: min })}
      icon="key"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void go()} disabled={busy}>
          {t("account.change")}
        </Button>
      }
    >
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <Field label={t("account.current")} required error={tried ? errors.current : undefined}>
        <PasswordInput value={current} onChange={(e) => { setCurrent(e.target.value); setWrong(false) }} autoComplete="current-password" />
      </Field>
      <Field label={t("account.newPw")} required error={tried ? errors.next : undefined} helper={next ? t(`account.strength.${level ?? "weak"}`, { n: next.length }) : undefined}>
        <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </Field>
      {next && <PasswordStrength level={level} className="-mt-2" />}
      <Field label={t("account.again")} required error={tried ? errors.again : undefined}>
        <PasswordInput value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
      </Field>
      <div className="flex items-center gap-2.5">
        <Checkbox id={id} checked={others} onCheckedChange={(v) => setOthers(v === true)} />
        <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
          {t("account.signOutMine")}
        </label>
      </div>
    </ResponsiveDialog>
  )
}

/** Overlay · Change signing PIN: current + new PIN (4 digits, not a birth year); Nafath confirms the change. */
function PinDialog({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const { t } = useUserText()
  const [current, setCurrent] = React.useState("")
  const [next, setNext] = React.useState("")
  const [tried, setTried] = React.useState(false)
  const [step, setStep] = React.useState<"idle" | "nafath" | "saving">("idle")
  const [wrong, setWrong] = React.useState(false)
  const yearLike = /^(19|20)\d\d$/.test(next)
  const weak = ["0000", "1111", "1234", "4321", "2580"].includes(next) || /^(\d)\1{3}$/.test(next)
  const errors = {
    current: !/^\d{4}$/.test(current) ? t("account.errPin") : wrong ? t("account.errPinWrong") : undefined,
    next: !/^\d{4}$/.test(next) ? t("account.errPin") : yearLike ? t("account.errPinYear") : weak || next === current ? t("account.errPinWeak") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)

  const go = async () => {
    setTried(true)
    if (invalid || step !== "idle") return
    setStep("nafath")
    const n = await identity.confirmWithNafath("pin")
    if (!n.approved) {
      setStep("idle")
      return
    }
    setStep("saving")
    const r = await identity.changePin(current, next)
    setStep("idle")
    if (!r.ok) {
      setWrong(true)
      return
    }
    writeAudit({ what: { en: "Changed my signing PIN · confirmed with Nafath", ar: "غيّر رمز التوقيع · بتأكيد نفاذ" }, where: "account" })
    toast.success(t("toasts.pinChanged"), { description: t("toasts.pinChangedText") })
    onOpenChange(false)
  }

  const pinInput = (value: string, onChange: (v: string) => void) => (
    <Input type="password" inputMode="numeric" maxLength={4} dir="ltr" className="text-start tracking-[0.4em]" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} autoComplete="off" />
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("account.pinTitle")}
      description={t("account.pinSubDialog")}
      icon="edit-2"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={step !== "idle"}>
          {t("actions.cancel")}
        </Button>
      }
      primary={
        <Button onClick={() => void go()} disabled={step !== "idle"}>
          {step === "nafath" ? t("account.waitingNafath") : t("account.change")}
        </Button>
      }
    >
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label={t("account.currentPin")} required error={tried ? errors.current : undefined}>
          {pinInput(current, (v) => {
            setCurrent(v)
            setWrong(false)
          })}
        </Field>
        <Field label={t("account.newPin")} required error={tried ? errors.next : undefined}>
          {pinInput(next, setNext)}
        </Field>
      </div>
      <Note icon="finger-scan">{step === "nafath" ? t("account.nafathWaiting") : t("account.pinNote")}</Note>
    </ResponsiveDialog>
  )
}
