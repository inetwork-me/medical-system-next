"use client"

import * as React from "react"

import { useRouter } from "@/i18n/navigation"
import { Field } from "@/components/ds/field"
import { Icon } from "@/components/ds/icon"
import { ResponsiveDialog } from "@/components/ds/responsive-dialog"
import { Segmented } from "@/components/ds/segmented"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ME, MSG_NOW, STAFF } from "./data"
import { roomHref } from "./href"
import { Note, useMsgText } from "./parts"
import { addRoomMembers, createRoom, useRooms } from "./store"
import type { ChatRoom } from "./types"

/** People who can be in a chat: staff with a mailbox (not the IT / privacy service accounts). */
const chatStaff = () => Object.values(STAFF).filter((s) => !["it", "privacy"].includes(s.role))

function CheckRow({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-2 py-1">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground">
        {label}
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ New chat */

/**
 * Overlay · New chat (New chat): type Direct / Group / Channel; name (not for Direct); people chips with type-ahead;
 * "Patients can be shared · care team only". A direct chat with someone you already talk to opens that one.
 * → `conversation-created`.
 */
export function NewChatDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t, b } = useMsgText()
  const router = useRouter()
  const rooms = useRooms()
  const [type, setType] = React.useState<"direct" | "group" | "channel">("group")
  const [name, setName] = React.useState("")
  const [people, setPeople] = React.useState<string[]>([])
  const [q, setQ] = React.useState("")
  const [patients, setPatients] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const errors = {
    name: type !== "direct" && !name.trim() ? t("newChat.errName") : undefined,
    people: !people.length ? t("newChat.errPeople") : type === "direct" && people.length > 1 ? t("newChat.errDirect") : undefined,
  }
  const invalid = Object.values(errors).some(Boolean)
  const words = q.trim().toLowerCase()
  const hits = words
    ? chatStaff()
        .filter((s) => s.key !== ME && !people.includes(s.key) && [s.name.en, s.name.ar, s.title.en, s.title.ar].join(" ").toLowerCase().includes(words))
        .slice(0, 6)
    : []

  const start = () => {
    setTried(true)
    if (invalid) return
    if (type === "direct") {
      const existing = rooms.find((r) => r.kind === "direct" && r.with === people[0] && r.members.includes(ME))
      if (existing) {
        onOpenChange(false)
        return router.push(roomHref(existing.id))
      }
    }
    const members = [ME, ...people]
    const n = rooms.length + 1
    const label = type === "direct" ? STAFF[people[0]].name : { en: name.trim(), ar: name.trim() }
    const room: ChatRoom = {
      id: `${type === "direct" ? "dm" : type === "group" ? "grp" : "ch"}-${n}`,
      kind: type,
      name: label,
      with: type === "direct" ? people[0] : undefined,
      members,
      memberCount: members.length,
      unread: 0,
      last: { text: { en: "Chat started", ar: "بدأت المحادثة" }, at: MSG_NOW },
      patientsAllowed: patients,
      notify: { mentionOnly: false, urgentBreaks: true },
    }
    createRoom(room)
    toast.success(t("toasts.convCreated"), { description: t("toasts.convCreatedText", { name: b(label), n: members.length }) })
    onOpenChange(false)
    router.push(roomHref(room.id))
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("newChat.title")}
      description={t("newChat.sub")}
      icon="messages-2"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={start}>{t("newChat.start")}</Button>}
    >
      {tried && invalid && <Note tone="destructive">{t("newChat.strip")}</Note>}
      <Field label={t("newChat.type")} required>
        {(c) => (
          <Segmented
            {...c}
            value={type}
            onValueChange={setType}
            options={[
              { value: "direct", label: t("newChat.direct") },
              { value: "group", label: t("newChat.group") },
              { value: "channel", label: t("newChat.channel") },
            ]}
          />
        )}
      </Field>
      {type !== "direct" && (
        <Field label={t("newChat.name")} required error={tried ? errors.name : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">{t("newChat.people")}</label>
        <div className="relative">
          <div className={`flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 ${tried && errors.people ? "border-destructive" : "border-input"}`}>
            {people.map((k) => (
              <span key={k} className="inline-flex h-6 items-center gap-1 rounded-md bg-accent px-2 text-xs font-medium text-primary">
                {b(STAFF[k].name)}
                <button type="button" onClick={() => setPeople(people.filter((x) => x !== k))} aria-label={b(STAFF[k].name)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Icon name="close-circle" size={14} />
                </button>
              </span>
            ))}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hits[0]) {
                  e.preventDefault()
                  setPeople([...people, hits[0].key])
                  setQ("")
                }
                if (e.key === "Backspace" && !q && people.length) setPeople(people.slice(0, -1))
              }}
              placeholder={t("newChat.peoplePh")}
              aria-label={t("newChat.people")}
              className="min-w-28 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {hits.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border bg-popover p-1 shadow-md">
              {hits.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setPeople([...people, s.key])
                      setQ("")
                    }}
                    className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-start hover:bg-muted"
                  >
                    <span className="text-sm text-foreground">{b(s.name)}</span>
                    <span className="text-xs text-muted-foreground">{b(s.title)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {tried && errors.people && <p className="text-xs text-destructive">{errors.people}</p>}
      </div>
      <CheckRow label={t("newChat.patients")} checked={patients} onChange={setPatients} />
    </ResponsiveDialog>
  )
}

/* ------------------------------------------------------------------ Add people */

/**
 * Overlay · Add people (Add people / Add on Members): search staff, a checklist of people not in the conversation, "Let them
 * see the last 30 days". → `people-added`.
 */
export function AddPeopleDialog({ room, onOpenChange }: { room: ChatRoom; onOpenChange: (open: boolean) => void }) {
  const { t, b } = useMsgText()
  const [q, setQ] = React.useState("")
  const [picked, setPicked] = React.useState<string[]>([])
  const [history, setHistory] = React.useState(true)
  const [tried, setTried] = React.useState(false)
  const words = q.trim().toLowerCase()
  const pool = chatStaff()
    .filter((s) => !room.members.includes(s.key))
    .filter((s) => !words || [s.name.en, s.name.ar, s.title.en, s.title.ar, s.team?.en ?? "", s.team?.ar ?? ""].join(" ").toLowerCase().includes(words))
  const save = () => {
    setTried(true)
    if (!picked.length) return
    addRoomMembers(room.id, picked, { en: `You added ${picked.length} people to ${room.name.en}`, ar: `أضفت ${picked.length} لـ${room.name.ar}` })
    toast.success(t("toasts.peopleAdded", { n: picked.length }), { description: history ? t("toasts.peopleAddedHistory") : t("toasts.peopleAddedNew") })
    onOpenChange(false)
  }
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={t("addPeople.title")}
      description={b(room.name)}
      icon="user-add"
      width="sm:max-w-140"
      secondary={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("actions.cancel")}
        </Button>
      }
      primary={<Button onClick={save}>{t("addPeople.add", { n: picked.length })}</Button>}
    >
      {tried && !picked.length && <Note tone="destructive">{t("addPeople.strip")}</Note>}
      <Field label={t("addPeople.search")}>
        <div className="relative">
          <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" autoFocus />
        </div>
      </Field>
      <div className="flex max-h-64 flex-col overflow-y-auto rounded-[10px] border px-3 py-1.5">
        {pool.length ? (
          pool.map((s) => (
            <CheckRow
              key={s.key}
              label={`${b(s.name)} · ${b(s.title).toLowerCase()}`}
              checked={picked.includes(s.key)}
              onChange={(v) => setPicked((x) => (v ? [...x, s.key] : x.filter((k) => k !== s.key)))}
            />
          ))
        ) : (
          <p className="py-2 text-xs text-muted-foreground">{t("addPeople.none")}</p>
        )}
      </div>
      <CheckRow label={t("addPeople.history")} checked={history} onChange={setHistory} />
    </ResponsiveDialog>
  )
}
