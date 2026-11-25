"use client"

import * as React from "react"

import { VALID, type OrgIdentity } from "@/lib/org"
import { Field } from "@/components/ds/field"
import { Icon, type IconName } from "@/components/ds/icon"
import { DatePicker } from "@/components/ds/pickers"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { canEditSection } from "./access"
import { daysBetween } from "./checks"
import { SET_TODAY } from "./data"
import { SettingsFrame } from "./frame"
import { Note, SetCard, useUserText } from "./parts"
import { saveOrg, useBranches, useOrg, writeAudit } from "./store"

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const LABELS: Record<string, string> = {
  name: "name", short: "short name", cr: "commercial registration", vat: "VAT number", moh: "MOH licence", mohExpires: "licence expiry",
  cchi: "CCHI accreditation", nphies: "NPHIES provider ID", phone: "phone", email: "email", website: "website", mainBranch: "main branch",
}

/** A text field with a leading icon (phone, email, website). */
function IconInput({ icon, value, onChange, ...c }: { icon: IconName; value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<"input">, "onChange" | "value">) {
  return (
    <div className="relative" dir="ltr">
      <Icon name={icon} size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input {...c} dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} className="ps-9 text-start" />
    </div>
  )
}

/**
 * Settings · General: Identity (logo + Upload, the name in the current language — each language edits its own name — and
 * the short name used as the SMS sender), Legal and licences (CR, VAT, MOH licence + expiry, CCHI, NPHIES provider ID: checked
 * here, then printed on invoices, claims and documents), Contact (phone, email, website, main branch). Header: Save changes.
 */
export function GeneralPage() {
  const x = useUserText()
  const { t, locale } = x
  const saved = useOrg()
  const branches = useBranches()
  const edit = canEditSection("general")
  const lang = locale === "ar" ? "ar" : "en"
  const [f, setF] = React.useState<OrgIdentity>(saved)
  const [tried, setTried] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const set = <K extends keyof OrgIdentity>(k: K, v: OrgIdentity[K]) => setF((o) => ({ ...o, [k]: v }))

  const errors: Partial<Record<keyof OrgIdentity, string>> = {
    name: !f.name[lang].trim() ? t("general.errName") : undefined,
    short: !f.short[lang].trim() ? t("general.errShort") : f.short[lang].length > 20 ? t("general.errShortLong") : undefined,
    cr: !VALID.cr(f.cr) ? t("general.errCr") : undefined,
    vat: !VALID.vat(f.vat) ? t("general.errVat") : undefined,
    moh: !VALID.moh(f.moh) ? t("general.errMoh") : undefined,
    cchi: !VALID.cchi(f.cchi) ? t("general.errCchi") : undefined,
    nphies: !VALID.nphies(f.nphies) ? t("general.errNphies") : undefined,
    phone: !VALID.phone(f.phone) ? t("general.errPhone") : undefined,
    email: !VALID.email(f.email) ? t("general.errEmail") : undefined,
    website: !VALID.website(f.website) ? t("general.errWebsite") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const e = (k: keyof OrgIdentity) => (tried ? errors[k] : undefined)
  const licenceDays = daysBetween(SET_TODAY, f.mohExpires)

  const save = () => {
    setTried(true)
    if (invalid) return
    const changed = (Object.keys(f) as (keyof OrgIdentity)[]).filter((k) => k !== "logo" && JSON.stringify(f[k]) !== JSON.stringify(saved[k]))
    saveOrg(f)
    if (changed.length) {
      writeAudit({ what: { en: `Changed the ${changed.map((k) => LABELS[k]).join(", ")}`, ar: `غيّر بيانات المنشأة (${changed.length})` }, where: "general" })
    }
    toast.success(t("toasts.saved"), { description: t("toasts.savedText") })
  }

  const upload = (file?: File) => {
    if (!file) return
    if (!/^image\/(png|svg\+xml)$/.test(file.type)) {
      toast.error(t("general.errLogoType"), { retry: () => fileRef.current?.click() })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const logo = String(reader.result)
      setF((o) => ({ ...o, logo }))
      saveOrg({ ...saved, logo })
      writeAudit({ what: { en: "Uploaded a new logo", ar: "رفع شعار جديد" }, where: "general" })
      toast.success(t("toasts.logo"), { description: t("toasts.logoText") })
    }
    reader.readAsDataURL(file)
  }

  const actions = edit ? <Button onClick={save}>{t("general.save")}</Button> : undefined
  const initials = f.short.en
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SettingsFrame section="general" actions={actions}>
      {tried && invalid && <Note tone="destructive" icon="danger">{t("invite.strip")}</Note>}
      <fieldset disabled={!edit} className="contents">
        <SetCard title={t("general.identity")} sub={t("general.identitySub")}>
          <div className="flex items-center gap-4">
            {f.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.logo} alt="" className="size-16 shrink-0 rounded-xl border object-contain" />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-semibold text-primary-foreground">{initials}</span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm text-foreground">{t("general.logo")}</span>
              <span className="text-xs text-muted-foreground">{t("general.logoHint")}</span>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml" className="hidden" onChange={(ev) => upload(ev.target.files?.[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Icon name="export" size={20} />
              {t("general.upload")}
            </Button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            <Field label={t(lang === "ar" ? "general.nameAr" : "general.nameEn")} required helper={t(lang === "ar" ? "general.nameArHint" : "general.nameEnHint")} error={e("name")}>
              <Input value={f.name[lang]} onChange={(ev) => set("name", { ...f.name, [lang]: ev.target.value })} />
            </Field>
            <Field label={t("general.short")} helper={t("general.shortHint")} error={e("short")}>
              <Input value={f.short[lang]} onChange={(ev) => set("short", { ...f.short, [lang]: ev.target.value })} />
            </Field>
          </div>
        </SetCard>

        <SetCard title={t("general.legal")} sub={t("general.legalSub")}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            <Field label={t("general.cr")} required error={e("cr")}>
              <Input dir="ltr" inputMode="numeric" className="text-start" value={f.cr} onChange={(ev) => set("cr", ev.target.value.trim())} />
            </Field>
            <Field label={t("general.vat")} required error={e("vat")}>
              <Input dir="ltr" inputMode="numeric" className="text-start" value={f.vat} onChange={(ev) => set("vat", ev.target.value.trim())} />
            </Field>
            <Field label={t("general.moh")} required error={e("moh")}>
              <Input dir="ltr" className="text-start" value={f.moh} onChange={(ev) => set("moh", ev.target.value.trim().toUpperCase())} />
            </Field>
            <Field label={t("general.mohExpires")} helper={licenceDays <= 90 ? t("general.mohSoon", { n: licenceDays }) : undefined}>
              {(c) => <DatePicker {...c} value={new Date(`${f.mohExpires}T12:00:00`)} onChange={(d) => d && set("mohExpires", isoDay(d))} placeholder={t("invite.pick")} />}
            </Field>
            <Field label={t("general.cchi")} error={e("cchi")}>
              <Input dir="ltr" className="text-start" value={f.cchi} onChange={(ev) => set("cchi", ev.target.value.trim().toUpperCase())} />
            </Field>
            <Field label={t("general.nphies")} error={e("nphies")}>
              <Input dir="ltr" className="text-start" value={f.nphies} onChange={(ev) => set("nphies", ev.target.value.trim().toUpperCase())} />
            </Field>
          </div>
        </SetCard>

        <SetCard title={t("general.contact")}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            <Field label={t("general.phone")} error={e("phone")}>
              {(c) => <IconInput {...c} icon="call" inputMode="tel" value={f.phone} onChange={(v) => set("phone", v.replace(/[\s-]/g, ""))} />}
            </Field>
            <Field label={t("general.email")} error={e("email")}>
              {(c) => <IconInput {...c} icon="sms" type="email" value={f.email} onChange={(v) => set("email", v.trim())} />}
            </Field>
            <Field label={t("general.website")} error={e("website")}>
              {(c) => <IconInput {...c} icon="global" value={f.website} onChange={(v) => set("website", v.trim())} />}
            </Field>
            <Field label={t("general.main")}>
              {(c) => (
                <Select value={f.mainBranch} onValueChange={(v) => set("mainBranch", v)}>
                  <SelectTrigger {...c} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter((b) => b.status === "open")
                      .map((b) => (
                        <SelectItem key={b.key} value={b.key}>
                          {x.b(b.name)} · {x.b(b.city)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </SetCard>
      </fieldset>
    </SettingsFrame>
  )
}
