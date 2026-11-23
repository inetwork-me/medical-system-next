"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Icon } from "@/components/ds/icon"
import { usePageTitle } from "@/components/shell/page-title"
import { Link, useRouter } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { isTabEnabled } from "@/lib/modules"
import { Button } from "@/components/ui/button"
import { RecordsFrame } from "./frame"
import { noteHref, notesHref, prescriptionHref, requestHref } from "./href"
import { RequestsList } from "./requests"
import { CompletionList, remindable, useRemind } from "./completion"
import { AccessList, useExportLog } from "./access"
import { MergeFilesDialog, RestrictedFileDialog, ReviewAccessDialog } from "./access-dialogs"
import { NeedsAttention, NotesToSign, RecordsKpis } from "./overview"
import type { AccessEvent } from "./data"
import { completionOpen } from "./rules"
import { NewRequestDialog, ReleaseDialog } from "./req-dialogs"
import { DocumentsList } from "./documents"
import { inMine } from "./counts"
import { patientOf } from "./lookup"
import { ME } from "./session"
import { NotesList, type NoteRowAction } from "./notes"
import { AddendumDialog, NewNoteDialog, SignNoteDialog } from "./note-dialogs"
import { useB } from "./parts"
import { recCan } from "./roles"
import { useCompletion, useEncounters, useNotes, useRecRole } from "./store"

/*
 * Medical records module tabs. Each tab is its frame (tabs + the header actions the design gives it) and its
 * widgets. Header actions follow the role: New request (records office), My notes / New visit note / New
 * prescription (doctors), Remind all (records office), Export (privacy officer).
 */

/** New request (Overview, Requests): the New request dialog (records office); the new request opens after saving. */
function NewRequestButton({ primary }: { primary?: boolean }) {
  const t = useTranslations("records.actions")
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  if (!recCan(useRecRole(), "requests") || !isTabEnabled("records", "requests")) return null
  return (
    <>
      <Button variant={primary ? "default" : "outline"} onClick={() => setOpen(true)}>
        <Icon name="add" size={18} />
        {t("newRequest")}
      </Button>
      {open && <NewRequestDialog onOpenChange={setOpen} onSaved={(no) => router.push(requestHref(no))} />}
    </>
  )
}

/** Overview (module home): header "Home / Medical records"; New request · My notes. */
export function OverviewTab() {
  const t = useTranslations("records")
  const tn = useTranslations("shell.nav")
  const role = useRecRole()
  const [reviewing, setReviewing] = React.useState<string | null>(null)
  const [merging, setMerging] = React.useState<string | null>(null)
  usePageTitle({ title: t("title"), mobileTitle: true, crumbs: [{ label: tn("home"), href: "/dashboard" }] })
  return (
    <RecordsFrame
      tab="overview"
      actions={
        <>
          <NewRequestButton />
          {recCan(role, "writeNote") && isTabEnabled("records", "notes") && (
            <Button asChild>
              <Link href={notesHref("mine")}>{t("actions.myNotes")}</Link>
            </Button>
          )}
        </>
      }
    >
      <RecordsKpis />
      {/* Desktop: Notes to sign beside Needs attention; tablet / mobile: Needs attention first (as drawn). */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
        <div className="order-2 xl:order-1">
          <NotesToSign />
        </div>
        <div className="order-1 xl:order-2">
          <NeedsAttention onReview={setReviewing} onMerge={setMerging} />
        </div>
      </div>
      {reviewing && <ReviewAccessDialog eventId={reviewing} onOpenChange={(o) => !o && setReviewing(null)} />}
      {merging && <MergeFilesDialog pairId={merging} onOpenChange={(o) => !o && setMerging(null)} />}
    </RecordsFrame>
  )
}

/** Open on a restricted file outside the care team: break the glass, then the note opens. */
function RestrictedForNote({ noteId, onOpenChange }: { noteId: string; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const n = useNotes().find((x) => x.id === noteId)
  const e = useEncounters().find((x) => x.id === n?.encounter)
  if (!n || !e) return null
  return <RestrictedFileDialog patient={e.patient} onOpenChange={onOpenChange} onGranted={() => router.push(noteHref(n.id))} />
}

/**
 * Visit notes: header "Medical records / Visit notes"; New visit note. The list's Sign opens Sign the visit note,
 * Addendum opens Add to a signed note, Open on a restricted file outside the care team goes through Restricted file.
 */
export function NotesTab() {
  const t = useTranslations("records.actions")
  const router = useRouter()
  const [action, setAction] = React.useState<NoteRowAction | null>(null)
  const [creating, setCreating] = React.useState(false)
  const close = (o: boolean) => !o && setAction(null)
  return (
    <RecordsFrame
      tab="notes"
      actions={
        recCan(useRecRole(), "writeNote") && (
          <Button onClick={() => setCreating(true)}>
            <Icon name="add" size={18} />
            {t("newNote")}
          </Button>
        )
      }
    >
      {creating && <NewNoteDialog onOpenChange={setCreating} onCreated={(id) => router.push(noteHref(id))} />}
      <NotesList onAction={setAction} />
      {action?.kind === "restricted" && <RestrictedForNote noteId={action.note} onOpenChange={close} />}
      {action?.kind === "sign" && <SignNoteDialog noteId={action.note} onOpenChange={close} />}
      {action?.kind === "addendum" && <AddendumDialog noteId={action.note} onOpenChange={close} />}
    </RecordsFrame>
  )
}

/**
 * New prescription (Documents header): a prescription belongs to a visit, so the button lists the doctor's visits of
 * today and those not signed yet, and opens New prescription for the one picked.
 */
function NewPrescriptionButton() {
  const t = useTranslations("records.actions")
  const b = useB()
  const router = useRouter()
  const notes = useNotes()
  const encounters = useEncounters()
  if (!recCan(useRecRole(), "prescribe")) return null
  const visits = notes
    .filter((n) => n.author === ME && inMine(n))
    .map((n) => encounters.find((e) => e.id === n.encounter))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => b.at.localeCompare(a.at))
  return (
    <ActionMenu
      title={t("pickVisit")}
      description={t("pickVisitText")}
      width="w-72"
      trigger={
        <Button>
          <Icon name="add" size={18} />
          {t("newPrescription")}
        </Button>
      }
      groups={[
        visits.map((e) => {
          const p = patientOf(e.patient)
          return { key: e.id, icon: "user" as const, label: `${b(p.name)} · ${b(e.kind)}`, onSelect: () => router.push(prescriptionHref(e.id)) }
        }),
      ]}
    />
  )
}

/** Documents: header "Medical records / Documents"; New prescription; the documents list. */
export function DocumentsTab() {
  return (
    <RecordsFrame tab="documents" actions={<NewPrescriptionButton />}>
      <DocumentsList />
    </RecordsFrame>
  )
}

/** Requests: header "Medical records / Requests for records"; New request; the list (Release → Release the records). */
export function RequestsTab() {
  const t = useTranslations("records")
  const tn = useTranslations("shell.nav")
  const [releasing, setReleasing] = React.useState<string | null>(null)
  usePageTitle({ title: t("requestsTitle"), mobileTitle: true, crumbs: [{ label: tn("records"), href: "/records" }] })
  return (
    <RecordsFrame tab="requests" actions={<NewRequestButton primary />}>
      <RequestsList onRelease={setReleasing} />
      {releasing && <ReleaseDialog requestNo={releasing} onOpenChange={(o) => !o && setReleasing(null)} />}
    </RecordsFrame>
  )
}

/** Chart completion: header "Medical records / Chart completion"; Remind all (records office); the list. */
export function CompletionTab() {
  const t = useTranslations("records.actions")
  const items = useCompletion()
  const notes = useNotes()
  const encounters = useEncounters()
  const remind = useRemind()
  const [busy, setBusy] = React.useState(false)
  const pending = remindable(
    items.filter((c) => completionOpen(c, notes)),
    encounters
  )
  return (
    <RecordsFrame
      tab="completion"
      actions={
        recCan(useRecRole(), "remind") && (
          <Button
            variant="outline"
            disabled={busy || pending.length === 0}
            onClick={async () => {
              setBusy(true)
              await remind(pending)
              setBusy(false)
            }}
          >
            <Icon name="notification" size={18} />
            {t("remindAll")}
          </Button>
        )
      }
    >
      <CompletionList />
    </RecordsFrame>
  )
}

/** Access log: header "Medical records / Access log"; Export (privacy officer); the read-only log (Review on flagged rows). */
export function AccessTab() {
  const t = useTranslations("records")
  const tn = useTranslations("shell.nav")
  const exportLog = useExportLog()
  const [rows, setRows] = React.useState<AccessEvent[]>([])
  const [reviewing, setReviewing] = React.useState<string | null>(null)
  usePageTitle({ title: t("accessTitle"), mobileTitle: true, crumbs: [{ label: tn("records"), href: "/records" }] })
  return (
    <RecordsFrame
      tab="access"
      actions={
        recCan(useRecRole(), "exportLog") && (
          <Button variant="outline" onClick={() => exportLog(rows)}>
            <Icon name="export" size={18} />
            {t("actions.export")}
          </Button>
        )
      }
    >
      <AccessList onReview={setReviewing} onRows={setRows} />
      {reviewing && <ReviewAccessDialog eventId={reviewing} onOpenChange={(o) => !o && setReviewing(null)} />}
    </RecordsFrame>
  )
}
