"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"

import { Field } from "@/components/ds/field"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDates } from "@/i18n/dates"
import { REC_NOW, type PatientKey } from "./data"
import { patientOf } from "./lookup"
import { KvBox, Latin, Strip, useB } from "./parts"
import { ME } from "./session"
import { getNotes, savePatientIds, useSavedIds } from "./store"
import { idNumberProblem, idTypeConflict, inPeriod, makeCtx, missingCounts, type MissingRule } from "./visit-rules"
import { VISITS_BRANCH, VISITS_PERIOD } from "./visits"
import { CLINICS, ID_TYPES, NATIONALITIES, allVisits, baseIdsOf, type IdType } from "./visits-data"
import { yakeen } from "./yakeen"

/**
 * Overlay · Add nationality (Add nationality / Add on a Visits · Missing nationality row; the Visit page's For official
 * returns): patient + MRN and their visits in the period; Nationality, ID type (National ID · Iqama · Passport · GCC
 * ID), the ID number ("Already on file" when it is); "Check it with Yakeen when I save"; the note that all their visits
 * in the period are filled and the return updates. Nationality and ID are patient fields: one save fills every visit
 * of theirs, and the return's check counts follow without a reload. → `nationality-added`.
 */
export function AddNationalityDialog({
  patient,
  rule = "nationality",
  period = VISITS_PERIOD,
  branch = VISITS_BRANCH,
  onOpenChange,
  initial,
}: {
  patient: PatientKey
  rule?: MissingRule
  period?: string
  branch?: string
  onOpenChange: (open: boolean) => void
  /** Stories: the drawn state (Indian · Iqama) or the errors showing. */
  initial?: { nationality?: string; tried?: boolean; yakeenFail?: boolean }
}) {
  const t = useTranslations("records.addNationality")
  const tid = useTranslations("records.visits.id")
  const b = useB()
  const locale = useLocale()
  const dates = useDates()
  const saved = useSavedIds()
  const p = patientOf(patient)
  const before = { ...baseIdsOf(patient), ...saved[patient] }
  const [nationality, setNationality] = React.useState(initial?.nationality ?? before.nationality ?? "")
  const [idType, setIdType] = React.useState<IdType | "">(before.idType ?? "")
  const [idNumber, setIdNumber] = React.useState(before.idNumber ?? "")
  const [check, setCheck] = React.useState(true)
  const [tried, setTried] = React.useState(initial?.tried ?? false)
  const [noMatch, setNoMatch] = React.useState(initial?.yakeenFail ?? false)
  const [busy, setBusy] = React.useState(false)

  const visits = React.useMemo(() => allVisits().filter((v) => v.patient === patient && inPeriod(v, period, branch)), [patient, period, branch])
  const month = dates.monthName(`${period}-01`)
  const last = visits.at(-1)
  const onFile = !!before.idNumber && idNumber === before.idNumber && idType === before.idType
  const yakeenable = idType !== "passport" && idType !== ""
  const conflict = nationality && idType ? idTypeConflict(nationality, idType) : null
  const format = idType && idNumber.trim() ? idNumberProblem(idType, idNumber) : null
  const errors = {
    nationality: !nationality ? t("errors.nationality") : undefined,
    idType: !idType ? t("errors.idType") : conflict ? t(`errors.${conflict}`) : undefined,
    idNumber: !idNumber.trim() ? t("errors.idNumber") : format ? t(`errors.format.${idType || "national"}`) : noMatch ? t("errors.noMatch", { name: b(p.name) }) : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const he = p.sex === "f" ? "f" : "m"

  const save = async () => {
    setTried(true)
    if (invalid || busy || !idType) return
    setBusy(true)
    if (check && yakeenable) {
      const res = await yakeen.verify({ idType: idType as Exclude<IdType, "passport">, idNumber: idNumber.trim(), name: p.name.en })
      if (!res.ok) {
        setBusy(false)
        setNoMatch(true)
        return
      }
    }
    savePatientIds(patient, { nationality, idType, idNumber: idNumber.trim(), at: REC_NOW, by: ME, yakeen: check && yakeenable })
    // What's left for the return, counted the same way the return's check counts it.
    const ctx = makeCtx({ ...saved, [patient]: { nationality, idType, idNumber: idNumber.trim() } }, getNotes())
    const left = missingCounts(
      allVisits().filter((v) => inPeriod(v, period, branch)),
      ctx
    )
    setBusy(false)
    onOpenChange(false)
    const filled = visits.length
    if (rule === "id" && before.nationality)
      toast.success(t("idToast"), { description: t("idToastText", { n: filled, left: left.id.visits }) })
    else toast.success(t("toast"), { description: t("toastText", { n: filled, left: left.nationality.visits }) })
  }

  const numberLabel = idType ? t(`number.${idType}`) : t("number.any")
  const title = rule === "id" && before.nationality ? t("titleId") : t("title")
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={title}
      description={
        <>
          {b(p.name)} · <Latin>{p.mrn}</Latin>
        </>
      }
      icon="global"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          {t("cancel")}
        </Button>
      }
      primary={
        <Button onClick={save} disabled={busy}>
          {busy ? t("checking") : t("save")}
        </Button>
      }
    >
      {tried && invalid && (
        <Strip tone="destructive" icon="info-circle">
          {noMatch && !errors.nationality && !errors.idType && !format ? t("noMatchStrip") : t("fixStrip")}
        </Strip>
      )}
      <KvBox
        rows={[
          [
            t("patient"),
            <>
              {b(p.name)} · <Latin>{p.mrn}</Latin>
            </>,
          ],
          [t("visits"), last ? t("visitsValue", { n: visits.length, month, clinic: b(CLINICS[last.clinic]).toLocaleLowerCase(locale === "ar" ? "ar" : "en") }) : t("visitsNone", { month })],
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("nationality")} required error={tried ? errors.nationality : undefined}>
          {(fp) => (
            <Select value={nationality} onValueChange={(v) => setNationality(v)}>
              <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]} className="w-full">
                <SelectValue placeholder={t("nationalityPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NATIONALITIES).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {b(name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t("idType")} required error={tried ? errors.idType : undefined}>
          {(fp) => (
            <Select
              value={idType}
              onValueChange={(v) => {
                setIdType(v as IdType)
                setNoMatch(false)
              }}
            >
              <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]} className="w-full">
                <SelectValue placeholder={t("idTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {ID_TYPES.map((x) => (
                  <SelectItem key={x} value={x}>
                    {tid(`type.${x}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <Field label={numberLabel} required helper={onFile ? t("onFile") : undefined} error={tried ? errors.idNumber : undefined}>
        {(fp) => (
          <Input
            {...fp}
            value={idNumber}
            onChange={(e) => {
              setIdNumber(idType === "passport" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9) : e.target.value.replace(/\D/g, "").slice(0, 15))
              setNoMatch(false)
            }}
            inputMode={idType === "passport" ? "text" : "numeric"}
            autoComplete="off"
            dir="ltr"
          />
        )}
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={check && yakeenable} disabled={!yakeenable} onCheckedChange={(v) => setCheck(v === true)} />
        {yakeenable || !idType ? t("yakeen") : t("yakeenPassport")}
      </label>
      <Strip tone="info" icon="info-circle">
        {visits.length ? t(`fills.${he}`, { n: visits.length, month }) : t("fillsNone")}
      </Strip>
    </ResponsiveDialog>
  )
}
