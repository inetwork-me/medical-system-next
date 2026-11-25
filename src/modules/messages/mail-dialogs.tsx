"use client"

import * as React from "react"

import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ASSIGN_LOAD, MSG_TODAY, STAFF } from "./data"
import { patientSex, searchLinkables, type Linkable } from "./linkables"
import { patientLinkOf, recordsPatient, useMailText } from "./mail-parts"
import { ChoiceCard, ChoiceGroup, IconTile, Note, PersonAvatar } from "./parts"
import { canOpenThread, canTakeAssignment, membersOf } from "./rules"
import { assignThread, linkThread, useAssignLoad, useMailboxes, useMemberships } from "./store"
import type { RecordLink, Thread } from "./types"

function CheckRow({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
        {label}
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ Link to a record */

/**
 * Overlay · Link to a record (Link to a record / the link icon / Link another record): search, radio results (patient,
 * visit, invoice, claim — one without a number yet), "Link later replies in this thread too", and the amber note that
 * linking to a patient limits who can open it. Records already on the email show as "Already linked". → `linked`.
 */
export function LinkDialog({
  thread,
  links: given,
  onPick,
  onOpenChange,
}: {
  /** A saved email: the link is stored on it. */
  thread?: Thread
  /** New message: the form's links, and what to do with the pick. */
  links?: RecordLink[]
  onPick?: (link: RecordLink, later: boolean) => void
  onOpenChange: (open: boolean) => void
}) {
  const { t, b } = useMailText()
  const existing = thread?.links ?? given ?? []
  const p = patientLinkOf({ links: existing })
  const firstName = p ? (recordsPatient(p.patient)?.name.en.split(" ")[0] ?? "") : ""
  const [q, setQ] = React.useState(firstName)
  const results = React.useMemo(() => searchLinkables(q), [q])
  const has = new Set(existing.map((l) => l.ref))
  const firstFree = results.find((r) => !has.has(r.ref))
  const [pick, setPick] = React.useState<string>("")
  const chosen: Linkable | undefined = results.find((r) => r.ref === (pick || firstFree?.ref))
  const [later, setLater] = React.useState(thread?.linkReplies ?? true)
  const [tried, setTried] = React.useState(false)

  const save = () => {
    setTried(true)
    if (!chosen || has.has(chosen.ref)) return
    const link: RecordLink = { kind: chosen.kind, ref: chosen.ref, patient: chosen.patient, label: chosen.label, sub: chosen.sub }
    if (onPick) onPick(link, later)
    else if (thread) linkThread(thread.id, link, later)
    if (chosen.kind === "patient") {
      const name = b(chosen.label).split(" ")[0]
      toast.success(t("toasts.linked", { name }), { description: t("toasts.linkedText", { sex: patientSex(chosen.patient) }) })
    } else toast.success(t("toasts.linkedRecord", { label: b(chosen.label) }), { description: t("toasts.linkedRecordText") })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("linkDlg.title")}
      description={t("linkDlg.sub")}
      icon="link-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("actions.link")}</Button>}
    >
      {tried && !chosen && <Note tone="destructive">{t("linkDlg.strip")}</Note>}
      <Field label={t("linkDlg.search")} error={tried && !chosen ? t("linkDlg.errPick") : undefined}>
        <div className="relative">
          <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPick("")
            }}
            placeholder={t("linkDlg.ph")}
            className="ps-9"
            autoFocus
          />
        </div>
      </Field>
      {!q.trim() ? (
        <p className="text-xs text-muted-foreground">{t("linkDlg.hint")}</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("linkDlg.none", { q: q.trim() })}</p>
      ) : (
        <ChoiceGroup value={chosen?.ref ?? ""} onValueChange={setPick} aria-label={t("linkDlg.title")}>
          {results.map((r) => (
            <ChoiceCard
              key={r.ref}
              value={r.ref}
              disabled={has.has(r.ref)}
              lead={<IconTile icon={r.icon as never} className="bg-muted group-data-[state=checked]/choice:bg-card" />}
              title={b(r.label)}
              sub={has.has(r.ref) ? t("linkDlg.already") : b(r.sub)}
            />
          ))}
        </ChoiceGroup>
      )}
      <CheckRow label={t("linkDlg.later")} checked={later} onChange={setLater} />
      {chosen?.kind === "patient" && (
        <Note tone="warning" icon="lock">
          {t("linkDlg.warn", { sex: patientSex(chosen.patient) })}
        </Note>
      )}
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ Assign */

/**
 * Overlay · Assign this email (Assign): radio cards of the people in the email's mailbox (avatar, team · how many they have
 * assigned, or where they are now). People who can't open it (outside the patient's care team) or can't answer from the
 * mailbox show disabled with the reason. Note; "Remind her tomorrow if it's still open". → `assigned`.
 */
export function AssignDialog({ thread, onOpenChange }: { thread: Thread; onOpenChange: (open: boolean) => void }) {
  const { t, b, firstName } = useMailText()
  const boxes = useMailboxes()
  const members = useMemberships()
  const load = useAssignLoad(ASSIGN_LOAD)
  const box = boxes.find((m) => m.id === thread.mailbox)
  // People in the mailbox (shared) or, for a personal mailbox, the owner's clinic team.
  const pool = (box?.kind === "shared" ? membersOf(box.id, members).map((m) => m.staff) : ["amal", "sami", "lama"]).filter((k) => STAFF[k])
  const rows = pool
    .map((k) => ({ k, ok: canTakeAssignment(thread, k, boxes, members), open: canOpenThread(thread, k, boxes, members) }))
    .sort((a, b2) => Number(b2.ok) - Number(a.ok))
  const first = rows.find((r) => r.ok && r.k !== thread.assignee?.to)
  const [who, setWho] = React.useState(first?.k ?? "")
  const [note, setNote] = React.useState("")
  const [remind, setRemind] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const s = who ? STAFF[who] : undefined

  const save = () => {
    setTried(true)
    if (!s) return
    const tomorrow = new Date(`${MSG_TODAY}T12:00`)
    tomorrow.setDate(tomorrow.getDate() + 1)
    assignThread(
      thread.id,
      { to: s.key, note: note.trim() ? { en: note.trim(), ar: note.trim() } : undefined, remindOn: remind ? tomorrow.toISOString().slice(0, 10) : undefined },
      { en: s.name.en, ar: s.name.ar }
    )
    toast.success(t("toasts.assigned", { name: firstName(s.key) }), { description: t("toasts.assignedText", { sex: s.female ? "f" : "m" }) })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("assign.title")}
      description={t("assign.sub")}
      icon="user-tag"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("actions.assign")}</Button>}
    >
      {tried && !s && <Note tone="destructive">{t("assign.strip")}</Note>}
      <ChoiceGroup value={who} onValueChange={setWho} aria-label={t("assign.title")}>
        {rows.map(({ k, ok, open }) => {
          const p = STAFF[k]
          const sub = !open
            ? t("assign.cantOpen")
            : !ok
              ? t("assign.cantReply")
              : thread.assignee?.to === k
                ? t("assign.current")
                : p.availability
                  ? b(p.availability)
                  : t("assign.load", { team: b(p.team ?? p.title), n: load[k] ?? 0 })
          return <ChoiceCard key={k} value={k} disabled={!ok} lead={<PersonAvatar initials={p.initials} />} title={b(p.name)} sub={sub} />
        })}
      </ChoiceGroup>
      <Field label={t("assign.note")}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("assign.notePh")} rows={3} />
      </Field>
      <CheckRow label={s?.female ? t("assign.remindF") : t("assign.remindM")} checked={remind} onChange={setRemind} />
    </ResponsiveDialog>
  )
}
