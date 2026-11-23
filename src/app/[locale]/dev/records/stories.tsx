"use client"

import * as React from "react"
import { useLocale } from "next-intl"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ACCESS,
  COMPLETION,
  DOCUMENTS,
  DRUGS,
  ENCOUNTERS,
  NOTES,
  PATIENTS,
  REQUESTS,
  drugLabel,
  type AccessFlag,
  type DocKind,
  type DocStatus,
  type OrderStatus,
  type RequestFrom,
  type RequestStatus,
  type RxStatus,
} from "@/modules/records/data"
import { accessCounts, completionCounts, documentCounts, noteCounts, requestCounts } from "@/modules/records/counts"
import { canInclude, consentBy, dueIn, needsBreakGlass, noteAge, noteStatus, vitalTone, waitingHours, type NoteStatus } from "@/modules/records/rules"
import { REC_ROLES, recCan, recTabs, type RecAction } from "@/modules/records/roles"
import { ME } from "@/modules/records/session"
import { setRecRole, useRecRole } from "@/modules/records/store"
import { NotesList } from "@/modules/records/notes"
import { ARCHIVE_DOCUMENTS, ARCHIVE_NOTES, ARCHIVE_REQUESTS } from "@/modules/records/archive"
import { DocumentsList } from "@/modules/records/documents"
import { DocumentPaper, DocumentSide } from "@/modules/records/document-page"
import { ReferralDialog, SickLeaveDialog } from "@/modules/records/doc-dialogs"
import { RequestsList } from "@/modules/records/requests"
import { CompletionList } from "@/modules/records/completion"
import { AccessList } from "@/modules/records/access"
import { NeedsAttention, NotesToSign, RecordsKpis } from "@/modules/records/overview"
import { MergeFilesDialog, RestrictedFileDialog, ReviewAccessDialog } from "@/modules/records/access-dialogs"
import { CopyParts, RequestPapers, RequestProgress, RequestSide } from "@/modules/records/request-page"
import { NewRequestDialog, ReleaseDialog } from "@/modules/records/req-dialogs"
import { MedicineCard, RxChecks, RxSummary } from "@/modules/records/prescription"
import { checkMedicines } from "@/modules/records/checks"
import { CURRENT_MEDS, PRESCRIPTIONS, type RxLine } from "@/modules/records/data"
import { DOCUMENTS as DOCS } from "@/modules/records/data"
import { CreateCard, DiagnosesCard, PatientBanner, RecordSide, VitalsCard } from "@/modules/records/note-page"
import { AddDiagnosisDialog, AddendumDialog, SignNoteDialog } from "@/modules/records/note-dialogs"
import { toast } from "@/components/ds/toast"
import { useTranslations } from "next-intl"
import {
  DiagnosisLabel,
  DocKindChip,
  DocStatusBadge,
  FlagBadge,
  FromChip,
  InitialsAvatar,
  Latin,
  NoteStatusBadge,
  OrderStatusBadge,
  RequestStatusBadge,
  RestrictedMark,
  RxStatusBadge,
  WaitingBadge,
  useB,
  useDidLabel,
  useMissingLabel,
} from "@/modules/records/parts"

function Box({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5", className)}>
      <h2 className="font-mono text-xs text-muted-foreground" dir="ltr">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Check({ ok }: { ok: boolean }) {
  return <span className={cn("font-mono text-xs", ok ? "text-success" : "text-destructive")}>{ok ? "✓" : "✗"}</span>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground" dir="ltr">
        {label}
      </span>
      {children}
    </div>
  )
}

const ACTIONS: RecAction[] = ["writeNote", "signNote", "vitals", "prescribe", "documents", "requests", "release", "remind", "merge", "reviewAccess", "exportLog"]

export function RecordsStories() {
  const b = useB()
  const locale = useLocale()
  const role = useRecRole()
  const did = useDidLabel()
  const missing = useMissingLabel()

  const n = noteCounts([...NOTES, ...ARCHIVE_NOTES], ME)
  const d = documentCounts([...DOCUMENTS, ...ARCHIVE_DOCUMENTS])
  const r = requestCounts([...REQUESTS, ...ARCHIVE_REQUESTS])
  const c = completionCounts(COMPLETION, NOTES, ENCOUNTERS)
  const a = accessCounts(ACCESS)
  // [label, computed, drawn in the design]
  const counts: [string, number, number][] = [
    ["Notes · Mine", n.mine, 6],
    ["Notes · To sign (tab, KPI)", n.toSign, 4],
    ["Notes · Drafts (24 h rule: Mona is a draft)", n.drafts, 2],
    ["Notes · Overdue", n.overdue, 2],
    ["Notes · Signed", n.signed, 31],
    ["Notes · Showing of (Mine)", n.mineAll, 37],
    ["Documents · All", d.all, 48],
    ["Documents · Prescriptions", d.prescription, 21],
    ["Documents · Sick leaves", d.sickLeave, 9],
    ["Documents · Reports", d.report, 11],
    ["Documents · Referrals", d.referral, 7],
    ["Requests · Open (tab, KPI)", r.open, 4],
    ["Requests · Due this week", r.week, 2],
    ["Requests · Released", r.released, 38],
    ["Requests · Rejected", r.rejected, 3],
    ["Requests · All", r.all, 45],
    ["Charts · Not complete (tab)", c.open, 6],
    ["Charts · Over 48 h", c.over48, 3],
    ["Charts · Doctors", c.doctors, 2],
    ["Access · Flagged (tab)", a.flagged, 2],
    ["Access · Break the glass", a.breakGlass, 1],
  ]

  const noteStatuses: NoteStatus[] = ["draft", "overdue", "signed", "addendum"]
  const docStatuses: DocStatus[] = ["draft", "issued", "sent", "waiting", "expired"]
  const rxStatuses: RxStatus[] = ["draft", "sent", "dispensed", "expired"]
  const reqStatuses: RequestStatus[] = ["new", "consent", "preparing", "ready", "released", "rejected"]
  const orders: OrderStatus[] = ["done", "inLab", "booked"]
  const flags: AccessFlag[] = ["breakGlass", "unusual", "normal"]
  const kinds: DocKind[] = ["prescription", "report", "sickLeave", "referral", "discharge"]
  const froms: RequestFrom[] = ["patient", "insurer", "hospital", "court"]
  const fahad = NOTES[0]

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Box title="Status badges (Widget / Rec …)">
        <Row label="Visit note">
          {noteStatuses.map((s) => (
            <NoteStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Notes to sign">
          <NoteStatusBadge status="draft" hours={2} />
          <NoteStatusBadge status="draft" hours={1} />
          <NoteStatusBadge status="overdue" hours={19} />
          <NoteStatusBadge status="overdue" hours={23} />
        </Row>
        <Row label="Document">
          {docStatuses.map((s) => (
            <DocStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Prescription">
          {rxStatuses.map((s) => (
            <RxStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Request">
          {reqStatuses.map((s) => (
            <RequestStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Order">
          {orders.map((s) => (
            <OrderStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Access flag">
          {flags.map((s) => (
            <FlagBadge key={s} flag={s} />
          ))}
        </Row>
        <Row label="Waiting">
          {COMPLETION.map((x) => (
            <WaitingBadge key={x.id} since={x.since} />
          ))}
        </Row>
      </Box>

      <Box title="Chips, labels and Latin runs">
        <Row label="Document type">
          {kinds.map((k) => (
            <DocKindChip key={k} kind={k} />
          ))}
        </Row>
        <Row label="Request from">
          {froms.map((f) => (
            <FromChip key={f} from={f} />
          ))}
        </Row>
        <Row label="Diagnosis (list)">
          <DiagnosisLabel code="I10" />
          <DiagnosisLabel code="R07.4" />
        </Row>
        <Row label="Diagnosis (note)">
          <DiagnosisLabel code="I10" full codeClassName="text-primary" />
        </Row>
        <Row label="Patient + MRN">
          <InitialsAvatar initials={PATIENTS.khaldi.initials} />
          <span className="flex flex-col text-sm">
            {b(PATIENTS.khaldi.name)}
            <span className="text-xs text-muted-foreground">
              <Latin>{PATIENTS.khaldi.mrn}</Latin> · <RestrictedMark kind={PATIENTS.khaldi.restricted} />
            </span>
          </span>
        </Row>
        <Row label="Drug names">
          {DRUGS.slice(0, 4).map((x) => (
            <span key={x.id} className="text-sm">
              {drugLabel(x, locale)}
            </span>
          ))}
        </Row>
        <Row label="Did">
          {ACCESS.map((x) => (
            <span key={x.id} className="text-sm">
              {did(x.action, x.pages)}
            </span>
          ))}
        </Row>
        <Row label="Missing">
          {COMPLETION.map((x) => (
            <span key={x.id} className="text-sm">
              {missing(x.missing)}
            </span>
          ))}
        </Row>
      </Box>

      <Box title="Counts · computed vs design">
        <table className="w-full text-sm">
          <tbody>
            {counts.map(([label, got, drawn]) => (
              <tr key={label} className="border-t first:border-0">
                <td className="py-1">{label}</td>
                <td className="py-1 text-end tabular-nums">{got}</td>
                <td className="py-1 text-end text-muted-foreground tabular-nums">{drawn}</td>
                <td className="w-6 py-1 text-end">
                  <Check ok={got === drawn} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Box title="Rules · notes, charts, requests, restricted files">
        <table className="w-full text-sm">
          <tbody>
            {NOTES.map((x) => (
              <tr key={x.id} className="border-t first:border-0">
                <td className="py-1">
                  <Latin>{x.id}</Latin>
                </td>
                <td className="py-1 tabular-nums">{noteAge(x)} h</td>
                <td className="py-1">
                  <NoteStatusBadge status={noteStatus(x)} />
                </td>
              </tr>
            ))}
            {COMPLETION.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="py-1">
                  <Latin>{x.encounter}</Latin>
                </td>
                <td className="py-1 tabular-nums">{waitingHours(x)} h</td>
                <td className="py-1">
                  <WaitingBadge since={x.since} />
                </td>
              </tr>
            ))}
            {REQUESTS.map((x) => (
              <tr key={x.no} className="border-t">
                <td className="py-1">
                  <Latin>{x.no}</Latin>
                </td>
                <td className="py-1 tabular-nums">due in {dueIn(x)} d</td>
                <td className="py-1 font-mono text-xs" dir="ltr">
                  {(["notes", "labs", "prescriptions", "imaging", "mental"] as const).map((p) => `${p}:${canInclude(x, p) ? "✓" : "–"}`).join(" ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-col gap-1 font-mono text-xs" dir="ltr">
          <span>
            BP 148/92 → {vitalTone("bp", fahad.vitals!)} · BMI 30.1 → {vitalTone("bmi", fahad.vitals!)} · pulse 88 → {String(vitalTone("pulse", fahad.vitals!))}
          </span>
          <span>
            Turki (VIP) by Dr. Rayan → break the glass: {String(needsBreakGlass(PATIENTS.saud, "rayan"))} · Abdulaziz (staff) by Dr. Khaled → {String(needsBreakGlass(PATIENTS.khaldi, "khaled"))}
          </span>
          <span>
            Abdullah (9 y) consent by: {consentBy(PATIENTS.shammari)} · Lina (29 y): {consentBy(PATIENTS.haddad)}
          </span>
        </div>
      </Box>

      <NoteStories />
      <RxStories />
      <DocStories />
      <ReqStories />
      <CompletionStories />
      <AccessStories />
      <OverviewStories />

      <Box title="Roles · switch the demo role" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {REC_ROLES.map((x) => (
            <Button key={x} size="sm" variant={x === role ? "default" : "outline"} onClick={() => setRecRole(x)}>
              {x}
            </Button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="ltr">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-start font-normal">role</th>
                <th className="py-1 text-start font-normal">tabs</th>
                {ACTIONS.map((x) => (
                  <th key={x} className="px-1 py-1 font-normal">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REC_ROLES.map((x) => (
                <tr key={x} className={cn("border-t", x === role && "bg-accent")}>
                  <td className="py-1 font-mono text-xs">{x}</td>
                  <td className="py-1 text-xs">{recTabs(x).join(", ")}</td>
                  {ACTIONS.map((y) => (
                    <td key={y} className="px-1 py-1 text-center">
                      {recCan(x, y) ? "✓" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  )
}

/* ------------------------------------------------------------------ step 2: visit notes */

type Dlg =
  | "sign"
  | "signErrors"
  | "signWrong"
  | "signSara"
  | "diag"
  | "diagEmpty"
  | "diagError"
  | "addendum"
  | "addendumErrors"
  | null

function NoteStories() {
  const t = useTranslations("records")
  const [dlg, setDlg] = React.useState<Dlg>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const fahad = NOTES[0]
  const buttons: [Exclude<Dlg, null>, string][] = [
    ["sign", "Sign · drawn (ticked, PIN typed)"],
    ["signErrors", "Sign · nothing filled"],
    ["signWrong", "Sign · wrong PIN"],
    ["signSara", "Sign · overdue row (Sara)"],
    ["diag", "Add diagnosis · drawn (palpitations, I47.1)"],
    ["diagEmpty", "Add diagnosis · empty search"],
    ["diagError", "Add diagnosis · nothing picked"],
    ["addendum", "Addendum · drawn (Abdulaziz)"],
    ["addendumErrors", "Addendum · nothing filled"],
  ]
  const toasts: [string, () => void][] = [
    ["note-signed", () => toast.success(t("sign.toast"), { description: t("sign.toastText") })],
    ["note-saved", () => toast.success(t("note.savedToast"), { description: t("note.savedToastText") })],
    ["diagnosis-added", () => toast.success(t("addDiagnosis.toast"), { description: "⁦I47.1⁩ · " + t("addDiagnosis.typeLower.secondary") })],
    ["addendum-added", () => toast.success(t("addendum.toast"), { description: t("addendum.toastText") })],
    ["item-removed", () => toast.info(t("removed.toast"), { description: t("removed.toastText") })],
    ["more-loaded", () => toast.info(t("showMore.toast", { n: 20 }), { description: t("showMore.toastText") })],
  ]
  return (
    <>
      <Box title="Widget / Rec Notes (wide + compact) · Sign / Addendum open the dialogs" className="lg:col-span-2">
        <NotesList onAction={(a) => setDlg(a.kind === "sign" ? "signSara" : a.kind === "addendum" ? "addendum" : null)} />
        <div className="max-w-[390px]">
          <NotesList onAction={() => undefined} />
        </div>
      </Box>
      <Box title="Widget / Rec Banner" className="lg:col-span-2">
        <PatientBanner patientKey="dosari" />
        <div className="max-w-[358px]">
          <PatientBanner patientKey="dosari" />
        </div>
      </Box>
      <Box title="Widget / Rec Visit Note · vitals + diagnoses (wide + compact)">
        <VitalsCard v={fahad.vitals} />
        <DiagnosesCard n={fahad} editable onAdd={() => setDlg("diag")} />
        <div className="max-w-[358px]">
          <VitalsCard v={fahad.vitals} />
        </div>
      </Box>
      <Box title="Widget / Rec Note Side">
        <CreateCard onCreate={() => undefined} />
        <RecordSide patientKey="dosari" />
      </Box>
      <Box title="Dialogs · Sign note, Add diagnosis, Addendum" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {buttons.map(([k, label]) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setDlg(k)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {toasts.map(([k, fn]) => (
            <Button key={k} size="sm" variant="ghost" onClick={fn}>
              toast · {k}
            </Button>
          ))}
        </div>
      </Box>
      {dlg === "sign" && <SignNoteDialog noteId="VN-2611-2041" onOpenChange={close} initial={{ reviewed: true, pin: "2468" }} />}
      {dlg === "signErrors" && <SignNoteDialog noteId="VN-2611-2041" onOpenChange={close} initial={{ tried: true }} />}
      {dlg === "signWrong" && <SignNoteDialog noteId="VN-2611-2041" onOpenChange={close} initial={{ reviewed: true, wrong: true }} />}
      {dlg === "signSara" && <SignNoteDialog noteId="VN-2611-1962" onOpenChange={close} />}
      {dlg === "diag" && <AddDiagnosisDialog noteId="VN-2611-2041" onOpenChange={close} initial={{ query: "palpitations", code: "I47.1", type: "secondary" }} />}
      {dlg === "diagEmpty" && <AddDiagnosisDialog noteId="VN-2611-2041" onOpenChange={close} />}
      {dlg === "diagError" && <AddDiagnosisDialog noteId="VN-2611-2041" onOpenChange={close} initial={{ query: "palpitations", tried: true }} />}
      {dlg === "addendum" && <AddendumDialog noteId="VN-2611-2036" onOpenChange={close} initial={{ why: "lateResult", text: "INR today 2.4, in range. Warfarin dose stays the same." }} />}
      {dlg === "addendumErrors" && <AddendumDialog noteId="VN-2611-2036" onOpenChange={close} initial={{ tried: true }} />}
    </>
  )
}

/* ------------------------------------------------------------------ step 3: prescription */

function RxStories() {
  const t = useTranslations("records")
  const rx = PRESCRIPTIONS[0]
  const p = PATIENTS.dosari
  const [lines, setLines] = React.useState<RxLine[]>(rx.lines)
  const [acked, setAcked] = React.useState<string[]>([])
  const drawn = checkMedicines(p, rx.lines.map((l) => l.drug), CURRENT_MEDS.dosari)
  const clash = checkMedicines(p, [...rx.lines.map((l) => l.drug), "amoxicillin500"], CURRENT_MEDS.dosari)
  const toasts: [string, () => void][] = [
    ["prescription-sent", () => toast.success(t("rx.sentToast"), { description: t("rx.sentToastText", { name: "Fahad" }) })],
    ["prescription-draft", () => toast.success(t("rx.draftToast"), { description: t("rx.draftToastText") })],
    ["advice-added", () => toast.success(t("rx.adviceToast", { sex: "m" }), { description: t("rx.adviceToastText", { sex: "m" }) })],
    ["item-removed", () => toast.info(t("rx.removedToast"), { description: t("rx.removedToastText") })],
  ]
  const cards = (
    <ul className="flex flex-col gap-3">
      {lines.map((l, i) => (
        <MedicineCard key={l.drug} line={l} onRemove={() => setLines(lines.filter((_, j) => j !== i))} onChange={(n) => setLines(lines.map((x, j) => (j === i ? n : x)))} />
      ))}
    </ul>
  )
  return (
    <>
      <Box title="Widget / Rec Prescription · checks (drawn · acknowledged · allergy clash · not acknowledged on Send)" className="lg:col-span-2">
        <RxChecks patient={p} result={drawn} acknowledged={["aspirin+ibuprofen"]} onAck={() => undefined} />
        <RxChecks patient={p} result={drawn} acknowledged={acked} onAck={(i) => setAcked((a) => (a.includes(i.id) ? a.filter((x) => x !== i.id) : [...a, i.id]))} />
        <RxChecks patient={p} result={clash} acknowledged={[]} onAck={() => undefined} error />
      </Box>
      <Box title="Widget / Rec Prescription · Layout=Two (wide) and One (compact, the line opens the fields)" className="lg:col-span-2">
        <div className="@container/rx">{cards}</div>
        <div className="@container/rx max-w-[358px]">{cards}</div>
      </Box>
      <Box title="Widget / Rec Prescription Summary · draft · sent · dispensed" className="lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-3">
          <RxSummary rx={rx} patient={p} />
          <RxSummary rx={{ ...rx, status: "sent", code: "7Q4-388" }} patient={p} />
          <RxSummary rx={{ ...rx, status: "dispensed", code: "7Q4-388" }} patient={p} dispensing={{ status: "dispensed", pharmacy: { en: "Al-Nahdi pharmacy · Olaya", ar: "صيدلية النهدي · العليا" } }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {toasts.map(([k, fn]) => (
            <Button key={k} size="sm" variant="ghost" onClick={fn}>
              toast · {k}
            </Button>
          ))}
        </div>
      </Box>
    </>
  )
}

/* ------------------------------------------------------------------ step 4: documents */

type DocDlg = "sl" | "slErrors" | "slNoWork" | "ref" | "refErrors" | "refOutside" | null

function DocStories() {
  const t = useTranslations("records")
  const [dlg, setDlg] = React.useState<DocDlg>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const mr = DOCS.find((d) => d.no === "MR-2611-0057")!
  const sl = DOCS.find((d) => d.no === "SL-2611-0091")!
  const rf = DOCS.find((d) => d.no === "RF-2611-0024")!
  const buttons: [Exclude<DocDlg, null>, string][] = [
    ["sl", "Sick leave · drawn"],
    ["slErrors", "Sick leave · 0 days"],
    ["slNoWork", "Sick leave · not working, diagnosis shown"],
    ["ref", "Referral · drawn (echo lab)"],
    ["refErrors", "Referral · nothing picked"],
    ["refOutside", "Referral · another hospital"],
  ]
  const toasts: [string, () => void][] = [
    ["sickleave-issued", () => toast.success(t("sickLeave.toast"), { description: t("sickLeave.toastText", { days: 2, ref: "⁦4471905⁩" }) })],
    ["referral-sent", () => toast.success(t("referral.toast"), { description: t("referral.toastInside", { clinic: "Echo lab", sex: "m" }) })],
    ["report-sent", () => toast.success(t("doc.sentAgainReport"), { description: t("doc.sentToastText", { to: "the patient and SABIC HR" }) })],
    ["pdf-downloaded", () => toast.success(t("doc.pdfToast"), { description: t("doc.pdfToastText") })],
  ]
  return (
    <>
      <Box title="Widget / Rec Documents (wide + compact)" className="lg:col-span-2">
        <DocumentsList />
        <div className="max-w-[390px]">
          <DocumentsList />
        </div>
      </Box>
      <Box title="Widget / Rec Report + Rec Report Side (MR-2611-0057)" className="lg:col-span-2">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DocumentPaper d={mr} />
          <DocumentSide d={mr} onDownload={() => undefined} />
        </div>
        <div className="max-w-[358px]">
          <DocumentPaper d={mr} />
        </div>
      </Box>
      <Box title="The same paper · sick leave (diagnosis hidden) and referral">
        <DocumentPaper d={sl} />
      </Box>
      <Box title="Referral paper">
        <DocumentPaper d={rf} />
      </Box>
      <Box title="Dialogs · Sick leave, Referral" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {buttons.map(([k, label]) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setDlg(k)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {toasts.map(([k, fn]) => (
            <Button key={k} size="sm" variant="ghost" onClick={fn}>
              toast · {k}
            </Button>
          ))}
        </div>
      </Box>
      {dlg === "sl" && <SickLeaveDialog encounter="V-2611-2041" onOpenChange={close} />}
      {dlg === "slErrors" && <SickLeaveDialog encounter="V-2611-2041" onOpenChange={close} initial={{ days: "0", tried: true }} />}
      {dlg === "slNoWork" && <SickLeaveDialog encounter="V-2611-2041" onOpenChange={close} initial={{ sector: "none", diagnosis: true }} />}
      {dlg === "ref" && (
        <ReferralDialog
          encounter="V-2611-2041"
          onOpenChange={close}
          initial={{ clinic: "echo", doctor: "sami", reason: "Palpitations with high blood pressure. Please check heart structure and pump function." }}
        />
      )}
      {dlg === "refErrors" && <ReferralDialog encounter="V-2611-2041" onOpenChange={close} initial={{ tried: true }} />}
      {dlg === "refOutside" && <ReferralDialog encounter="V-2611-2041" onOpenChange={close} initial={{ inside: false, hospital: "kfsh", soon: "week" }} />}
    </>
  )
}

/* ------------------------------------------------------------------ step 5: requests */

type ReqDlg = "new" | "newErrors" | "newDrawn" | "newCourt" | "release" | "releaseErrors" | "releasePrinted" | "releaseNotReady" | null

function ReqStories() {
  const t = useTranslations("records")
  const [dlg, setDlg] = React.useState<ReqDlg>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const r14 = REQUESTS[0]
  const r16 = REQUESTS[1]
  const r18 = REQUESTS[3]
  const file = { id: "f1", name: "Father's ID and guardianship proof", meta: "PDF · 2 pages · uploaded" }
  const buttons: [Exclude<ReqDlg, null>, string][] = [
    ["newDrawn", "New request · drawn (Abdullah, father)"],
    ["new", "New request · empty"],
    ["newErrors", "New request · nothing filled"],
    ["newCourt", "New request · court"],
    ["release", "Release · drawn (REQ-2611-014)"],
    ["releasePrinted", "Release · printed"],
    ["releaseErrors", "Release · no address"],
    ["releaseNotReady", "Release · not reviewed yet (REQ-2611-017)"],
  ]
  const toasts: [string, () => void][] = [
    ["request-created", () => toast.success(t("newRequest.toast"), { description: t("newRequest.toastText", { no: "⁦REQ-2611-019⁩", date: "23 Dec" }) })],
    ["records-released", () => toast.success(t("release.toast"), { description: t("release.toastText.link", { who: "Tawuniya", sms: "yes" }) })],
  ]
  return (
    <>
      <Box title="Widget / Rec Requests (wide + compact)" className="lg:col-span-2">
        <RequestsList onRelease={() => setDlg("release")} />
        <div className="max-w-[390px]">
          <RequestsList onRelease={() => setDlg("release")} />
        </div>
      </Box>
      <Box title="Widget / Rec Request (REQ-2611-014: ready to release)">
        <RequestProgress r={r14} />
        <CopyParts r={r14} />
        <RequestPapers r={r14} onDownload={() => undefined} />
      </Box>
      <Box title="Widget / Rec Request Side · and a request waiting for consent / a court order">
        <RequestSide r={r14} />
        <RequestProgress r={r16} />
        <CopyParts r={r18} />
      </Box>
      <Box title="Dialogs · New request, Release the records" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {buttons.map(([k, label]) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setDlg(k)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {toasts.map(([k, fn]) => (
            <Button key={k} size="sm" variant="ghost" onClick={fn}>
              toast · {k}
            </Button>
          ))}
        </div>
      </Box>
      {dlg === "new" && <NewRequestDialog onOpenChange={close} />}
      {dlg === "newErrors" && <NewRequestDialog onOpenChange={close} initial={{ tried: true }} />}
      {dlg === "newDrawn" && (
        <NewRequestDialog
          onOpenChange={close}
          initial={{ patient: "shammari", askedBy: "His father · Saad Al-Shammari", parts: ["notes", "labs"], period: "m12", purpose: "secondOpinion", files: [file] }}
        />
      )}
      {dlg === "newCourt" && <NewRequestDialog onOpenChange={close} initial={{ from: "court", patient: "subaie", askedBy: "Riyadh General Court · case 4471", parts: ["notes"] }} />}
      {dlg === "release" && <ReleaseDialog requestNo="REQ-2611-014" onOpenChange={close} />}
      {dlg === "releasePrinted" && <ReleaseDialog requestNo="REQ-2611-014" onOpenChange={close} initial={{ via: "printed" }} />}
      {dlg === "releaseErrors" && <ReleaseDialog requestNo="REQ-2611-014" onOpenChange={close} initial={{ sendTo: "", tried: true }} />}
      {dlg === "releaseNotReady" && <ReleaseDialog requestNo="REQ-2611-017" onOpenChange={close} />}
    </>
  )
}

/* ------------------------------------------------------------------ step 6: chart completion */

function CompletionStories() {
  const t = useTranslations("records.completion")
  return (
    <Box title="Widget / Rec Completion (wide + compact) · Remind sends an app notification + SMS (stub)" className="lg:col-span-2">
      <CompletionList />
      <div className="max-w-[390px]">
        <CompletionList />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => toast.success(t("toast"), { description: t("toastText") })}>
          toast · reminder-sent
        </Button>
        <Button size="sm" variant="ghost" onClick={() => toast.success(t("toast"), { description: t("toastAll", { n: 3 }) })}>
          toast · reminder-sent (Remind all)
        </Button>
      </div>
    </Box>
  )
}

/* ------------------------------------------------------------------ step 7: privacy */

type AxDlg = "bg" | "bgErrors" | "review" | "reviewBg" | "reviewErrors" | "merge" | "mergeOther" | null

function AccessStories() {
  const t = useTranslations("records")
  const [dlg, setDlg] = React.useState<AxDlg>(null)
  const close = (o: boolean) => !o && setDlg(null)
  const buttons: [Exclude<AxDlg, null>, string][] = [
    ["bg", "Restricted file · drawn (Turki, emergency)"],
    ["bgErrors", "Restricted file · nothing filled"],
    ["review", "Review access · drawn (Majed, ask him why)"],
    ["reviewBg", "Review access · break the glass (Dr. Rayan)"],
    ["reviewErrors", "Review access · no outcome"],
    ["merge", "Merge files · drawn (keep MRN-23118)"],
    ["mergeOther", "Merge files · keep MRN-24007"],
  ]
  const toasts: [string, () => void][] = [
    ["access-granted", () => toast.warning(t("restrictedFile.toast", { h: 4 }), { description: t("restrictedFile.toastText") })],
    ["access-reviewed", () => toast.success(t("review.toast"), { description: t("review.toastText.askWhy", { name: "Majed", female: "no" }) })],
    ["files-merged", () => toast.success(t("merge.toast"), { description: t("merge.toastText", { mrn: "⁦MRN-23118⁩" }), action: { label: t("merge.undo"), onClick: () => undefined } })],
    ["log-exported", () => toast.success(t("access.exportToast"), { description: t("access.exportToastText") })],
  ]
  return (
    <>
      <Box title="Widget / Rec Access (wide + compact) · read-only; Review on flagged rows only" className="lg:col-span-2">
        <AccessList onReview={(id) => setDlg(id === "ax-0214" ? "reviewBg" : "review")} />
        <div className="max-w-[390px]">
          <AccessList onReview={() => setDlg("review")} />
        </div>
      </Box>
      <Box title="Dialogs · Restricted file, Review access, Merge files" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {buttons.map(([k, label]) => (
            <Button key={k} size="sm" variant="outline" onClick={() => setDlg(k)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {toasts.map(([k, fn]) => (
            <Button key={k} size="sm" variant="ghost" onClick={fn}>
              toast · {k}
            </Button>
          ))}
        </div>
      </Box>
      {dlg === "bg" && <RestrictedFileDialog patient="saud" onOpenChange={close} initial={{ reason: "emergency", details: "Came to ER at 02:00 with chest pain. Need his cardiac history and medicines." }} />}
      {dlg === "bgErrors" && <RestrictedFileDialog patient="saud" onOpenChange={close} initial={{ tried: true }} />}
      {dlg === "review" && <ReviewAccessDialog eventId="ax-0847" onOpenChange={close} initial={{ outcome: "askWhy", note: "Was there a prescription question from the clinic?" }} />}
      {dlg === "reviewBg" && <ReviewAccessDialog eventId="ax-0214" onOpenChange={close} />}
      {dlg === "reviewErrors" && <ReviewAccessDialog eventId="ax-0847" onOpenChange={close} initial={{ tried: true }} />}
      {dlg === "merge" && <MergeFilesDialog pairId="dup-ahmed" onOpenChange={close} />}
      {dlg === "mergeOther" && <MergeFilesDialog pairId="dup-ahmed" onOpenChange={close} initial={{ keep: "ahmed2" }} />}
    </>
  )
}

/* ------------------------------------------------------------------ step 8: overview */

function OverviewStories() {
  const [reviewing, setReviewing] = React.useState<string | null>(null)
  const [merging, setMerging] = React.useState<string | null>(null)
  return (
    <>
      <Box title="Overview · KPIs (live counts)" className="lg:col-span-2">
        <RecordsKpis />
      </Box>
      <Box title="Widget / Rec My Notes (Notes to sign · wide + compact)">
        <NotesToSign />
        <div className="max-w-[358px]">
          <NotesToSign />
        </div>
      </Box>
      <Box title="Widget / Rec Attention (Review → Review access · Merge → Merge files)">
        <NeedsAttention onReview={setReviewing} onMerge={setMerging} />
        <div className="max-w-[358px]">
          <NeedsAttention onReview={setReviewing} onMerge={setMerging} />
        </div>
      </Box>
      {reviewing && <ReviewAccessDialog eventId={reviewing} onOpenChange={(o) => !o && setReviewing(null)} />}
      {merging && <MergeFilesDialog pairId={merging} onOpenChange={(o) => !o && setMerging(null)} />}
    </>
  )
}
