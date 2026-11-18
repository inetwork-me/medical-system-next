"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Field } from "@/components/ds/field"
import { DatePicker } from "@/components/ds/pickers"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { notify } from "@/components/ds/toast"
import { DropZone, UploadItem, toMb } from "@/components/ds/upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Bi } from "@/lib/mock/bi"
import { DOCTORS_TODAY, type Credential, type CredentialType } from "./data"
import { updateDoctor, useDoctors } from "./store"
import { useDoctorText } from "./text"

/** Scans uploaded this session (file name → object URL), so View document can open them. */
export const scanUrls = new Map<string, string>()

const TYPES: CredentialType[] = ["scfhs", "moh", "bls", "pals", "acls", "malpractice"]
const ISSUERS: Bi[] = [
  { en: "SCFHS", ar: "هيئة التخصصات" },
  { en: "Ministry of Health", ar: "وزارة الصحة" },
  { en: "Saudi Heart Association", ar: "جمعية القلب السعودية" },
  { en: "American Heart Association", ar: "جمعية القلب الأمريكية" },
  { en: "Tawuniya", ar: "التعاونية" },
  { en: "Bupa", ar: "بوبا" },
]
const DEFAULT_ISSUER: Record<CredentialType, number> = { scfhs: 0, moh: 1, bls: 2, pals: 2, acls: 2, malpractice: 4 }
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const dateOf = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const plusYears = (iso: string, n: number) => `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}`

/**
 * Overlay · Renew credential (desktop dialog, mobile sheet): the credential and its current expiry; Certificate number ·
 * New expiry date; Issued by; drop zone (PDF or photo, up to 10 MB). Save updates the credential — the card alert, the
 * KPI, the board and the booking block follow — and swaps to the "credential-renewed" toast. Without `type` it adds a
 * credential (the tab's + Add, which has no overlay of its own in the design).
 */
export function RenewDialog({ doctorKey, type, onOpenChange }: { doctorKey: string; type?: CredentialType; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("doctors.renew")
  const tn = useTranslations("doctors.creds.name")
  const { b, dates } = useDoctorText()
  const d = useDoctors().find((x) => x.key === doctorKey)
  const [kind, setKind] = React.useState<CredentialType>(type ?? "acls")
  const cur = d?.credentials.find((c) => c.type === kind)
  const [number, setNumber] = React.useState(cur?.number ?? "")
  const [expiry, setExpiry] = React.useState<Date | undefined>(cur ? dateOf(plusYears(cur.expires < DOCTORS_TODAY ? DOCTORS_TODAY : cur.expires, 2)) : undefined)
  const [issuer, setIssuer] = React.useState(() => (cur ? cur.issuer.en : ISSUERS[DEFAULT_ISSUER[kind]].en))
  const [file, setFile] = React.useState<{ name: string; size: string } | null>(null)
  const [tried, setTried] = React.useState(false)
  if (!d) return null

  const iso = expiry ? isoOf(expiry) : ""
  const numErr = tried && !number.trim() ? t("required") : undefined
  const expErr = tried && !iso ? t("required") : iso && iso <= DOCTORS_TODAY ? t("future") : undefined
  const name = tn(kind)

  const save = () => {
    setTried(true)
    if (!number.trim() || !iso || iso <= DOCTORS_TODAY) return
    const next: Credential = {
      type: kind,
      number: number.trim(),
      issuer: ISSUERS.find((x) => x.en === issuer) ?? ISSUERS[0],
      issued: DOCTORS_TODAY,
      expires: iso,
      required: cur?.required ?? kind !== "acls",
      ...(file ? { fileName: file.name } : cur?.fileName ? { fileName: cur.fileName } : {}),
    }
    updateDoctor(d.key, (x) => ({ credentials: x.credentials.some((c) => c.type === kind) ? x.credentials.map((c) => (c.type === kind ? next : c)) : [...x.credentials, next] }))
    onOpenChange(false)
    notify.success(cur ? t("toast", { name }) : t("added", { name }), { description: t(cur ? "toastText" : "addedText", { date: dates.short(iso) }) })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={type ? t("title", { name }) : t("addTitle")}
      description={t("text")}
      icon="shield-tick"
      width="sm:max-w-130"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("save")}</Button>}
    >
      {type && cur ? (
        <div className="flex items-baseline gap-3 text-sm">
          <span className="w-28 shrink-0 text-xs text-muted-foreground">{t("credential")}</span>
          <span className="font-medium tabular-nums">
            <bdi>{t("current", { name, date: dates.short(cur.expires) })}</bdi>
          </span>
        </div>
      ) : (
        <Field label={t("type")}>
          {(p) => (
            <Select
              value={kind}
              onValueChange={(v) => {
                const k = v as CredentialType
                setKind(k)
                const c = d.credentials.find((x) => x.type === k)
                setNumber(c?.number ?? "")
                setIssuer(c ? c.issuer.en : ISSUERS[DEFAULT_ISSUER[k]].en)
              }}
            >
              <SelectTrigger {...p} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {tn(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("number")} required error={numErr}>
          <Input value={number} onChange={(e) => setNumber(e.target.value)} dir="ltr" className="text-start" />
        </Field>
        <Field label={t("expiry")} required error={expErr}>
          {(p) => <DatePicker {...p} value={expiry} onChange={setExpiry} placeholder="dd/mm/yyyy" />}
        </Field>
      </div>
      <Field label={t("issuer")}>
        {(p) => (
          <Select value={issuer} onValueChange={setIssuer}>
            <SelectTrigger {...p} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISSUERS.map((x) => (
                <SelectItem key={x.en} value={x.en}>
                  {b(x)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      {file ? (
        <UploadItem name={file.name} state="complete" totalMb={file.size} onRemove={() => setFile(null)} />
      ) : (
        <DropZone multiple={false} className="gap-2 bg-muted p-5" onFiles={([f]) => {
            scanUrls.set(f.name, URL.createObjectURL(f))
            setFile({ name: f.name, size: toMb(f.size) })
          }} />
      )}
    </ResponsiveDialog>
  )
}
