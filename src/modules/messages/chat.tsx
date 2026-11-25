"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Link, useRouter } from "@/i18n/navigation"
import { isModuleEnabled } from "@/lib/modules"
import { pdfDocument } from "@/lib/export/pdf"
import { saveBlob } from "@/lib/export/files"
import { Icon, type IconName } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { patientHref } from "@/modules/patients/href"
import { PATIENTS } from "@/modules/records/data"
import { CENTER, ME, MSG_NOW, STAFF } from "./data"
import { roomHref } from "./href"
import { CountPill, PersonAvatar, PresenceDot, useMsgText } from "./parts"
import { msgCan } from "./roles"
import { inCareTeam, roomsOf } from "./rules"
import { NewChatDialog } from "./chat-dialogs"
import { logEvent, logPatientCard, postChat, readRoom, useChatMessages, useMe, useMsgRole, usePolicies, useRooms } from "./store"
import type { Attachment, ChatMessage, ChatRoom } from "./types"

type Pt = { name: { en: string; ar: string }; mrn: string; patientId?: string }
const pts = PATIENTS as unknown as Record<string, Pt>
const patientByMrn = (mrn: string) => Object.entries(pts).find(([, p]) => p.mrn === mrn)?.[0]

/* ------------------------------------------------------------------ atoms */

/** Lead mark of a room: # tile (channel), bell (announcements), group icon, or the person's avatar (direct). */
export function RoomLead({ room, size = 32 }: { room: ChatRoom; size?: 32 | 36 }) {
  if (room.kind === "direct" && room.with) return <PersonAvatar initials={STAFF[room.with]?.initials ?? "?"} />
  const icon: IconName = room.kind === "announcements" ? "notification" : room.kind === "group" ? "messages-2" : "hashtag"
  return (
    <span style={{ width: size, height: size }} className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px]", size === 36 ? "bg-accent text-primary" : "bg-muted text-foreground")}>
      <Icon name={icon} size={18} />
    </span>
  )
}

export function useRoomName() {
  const { b } = useMsgText()
  return (r: ChatRoom) => (r.kind === "direct" && r.with && STAFF[r.with] ? b(STAFF[r.with].name) : b(r.name))
}

/** Room list row: lead · name (+ presence) · time; last line · unread count. Selected = accent, name blue. */
function RoomRow({ room, selected, onSelect, href, flush }: { room: ChatRoom; selected?: boolean; onSelect?: () => void; href?: string; flush?: boolean }) {
  const { b, when } = useMsgText()
  const name = useRoomName()
  const person = room.kind === "direct" && room.with ? STAFF[room.with] : undefined
  const body = (
    <>
      <RoomLead room={room} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className={cn("flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium", selected ? "text-primary" : "text-foreground")}>
            <span className="truncate">{name(room)}</span>
            {person && <PresenceDot presence={person.presence} />}
            {room.muted && <Icon name="volume-slash" size={14} className="shrink-0 text-muted-foreground" />}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{when(room.last.at)}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{b(room.last.text)}</span>
          <CountPill n={room.unread} />
        </span>
      </span>
    </>
  )
  const cls = cn(
    "flex w-full items-center gap-2.5 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    flush ? "border-b py-3 last:border-b-0" : "rounded-lg px-3 py-2.5",
    selected ? "bg-accent" : !flush && "hover:bg-muted/50"
  )
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onSelect} className={cls} aria-current={selected || undefined}>
      {body}
    </button>
  )
}

/** Channels (and groups), then direct messages, filtered by the search. */
function RoomList({ rooms, q, selected, onSelect, linkRows }: { rooms: ChatRoom[]; q: string; selected?: string; onSelect?: (id: string) => void; linkRows?: boolean }) {
  const { t } = useMsgText()
  const name = useRoomName()
  const words = q.trim().toLowerCase()
  const match = (r: ChatRoom) => !words || name(r).toLowerCase().includes(words) || r.name.en.toLowerCase().includes(words) || r.name.ar.includes(words)
  const groups: [string, ChatRoom[]][] = [
    [t("chat.channels"), rooms.filter((r) => (r.kind === "channel" || r.kind === "announcements") && match(r))],
    [t("chat.groups"), rooms.filter((r) => r.kind === "group" && match(r))],
    [t("chat.direct"), rooms.filter((r) => r.kind === "direct" && match(r))],
  ]
  const any = groups.some(([, l]) => l.length)
  if (!any) return <p className="px-1 py-6 text-center text-xs text-muted-foreground">{t("chat.empty")}</p>
  return (
    <div className="flex flex-col gap-3.5">
      {groups
        .filter(([, l]) => l.length)
        .map(([label, list]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{label}</p>
            {list.map((r) => (
              <RoomRow key={r.id} room={r} flush={linkRows} selected={!linkRows && selected === r.id} onSelect={() => onSelect?.(r.id)} href={linkRows ? roomHref(r.id) : undefined} />
            ))}
          </div>
        ))}
    </div>
  )
}

function SearchBox({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const { t } = useMsgText()
  return (
    <div className="relative">
      <Icon name="search-normal-1" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("chat.search")} aria-label={t("chat.search")} className="ps-9" />
    </div>
  )
}

/* ------------------------------------------------------------------ patient card */

/**
 * A patient shared in chat. Only their care team opens it (rule "Patients in chat: care team only"); every open — and every
 * refused open — is logged.
 */
export function usePatientCard(room: string) {
  const { t, b } = useMsgText()
  const me = useMe()
  const policies = usePolicies()
  const router = useRouter()
  return (patient: string) => {
    const p = pts[patient]
    if (!p) return
    const allowed = !policies.chatCareTeamOnly || inCareTeam(patient, me)
    const text = { en: `You opened ${p.name.en} (${p.mrn}) from chat`, ar: `فتحت ${p.name.ar} من المحادثات · ${p.mrn}` }
    logPatientCard(patient, room, allowed, text)
    if (!allowed) return toast.warning(t("chat.locked", { name: b(p.name).split(" ")[0] }), { description: t("chat.lockedText") })
    if (p.patientId && isModuleEnabled("patients")) router.push(patientHref(p.patientId))
  }
}

function PatientCard({ patient, room }: { patient: string; room: string }) {
  const { t, b, l } = useMsgText()
  const open = usePatientCard(room)
  const p = pts[patient]
  if (!p) return null
  return (
    <button
      type="button"
      onClick={() => open(patient)}
      className="flex w-fit max-w-full items-center gap-2.5 rounded-[10px] border bg-card py-2 ps-2 pe-3 text-start outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent text-primary">
        <Icon name="profile-2user" size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-foreground">
          {b(p.name)} · {l(p.mrn)}
        </span>
        <span className="text-xs text-muted-foreground">{t("chat.careOnly")}</span>
      </span>
      <Icon name="lock" size={16} className="shrink-0 text-muted-foreground" />
    </button>
  )
}

export async function downloadFile(file: Attachment, title: string, locale: string, b: (v: { en: string; ar: string }) => string, toastText: { title: string; text: string }) {
  const blob = await pdfDocument(
    [
      { kind: "brand", title: b(CENTER), subtitle: title },
      { kind: "title", text: b(file.name) },
      { kind: "meta", text: b(file.meta) },
    ],
    { dir: locale === "ar" ? "rtl" : "ltr", title: file.name.en }
  )
  saveBlob(blob, `${file.name.en.replace(/[^\w.-]+/g, "-")}.pdf`)
  logEvent({ kind: "opened", actor: ME, text: { en: `You downloaded ${file.name.en} from chat`, ar: `حمّلت ${file.name.ar} من المحادثات` } })
  toast.info(toastText.title, { description: toastText.text })
}

function FileCard({ file, room }: { file: Attachment; room: string }) {
  const { t, b, locale } = useMsgText()
  return (
    <button
      type="button"
      onClick={() => void downloadFile(file, room, locale, b, { title: t("toasts.pdf"), text: t("toasts.pdfText") })}
      className="flex w-fit max-w-full items-center gap-2.5 rounded-[10px] border bg-card py-2 ps-2 pe-3 text-start outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground">
        <Icon name="document-text" size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-foreground">{b(file.name)}</span>
        <span className="text-xs text-muted-foreground">{b(file.meta)}</span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ conversation */

/** Day pill label: Today, Yesterday, or "22 Nov". */
function useDayLabel() {
  const { t, dates, isToday } = useMsgText()
  return (iso: string) => {
    if (isToday(iso)) return t("chat.today")
    const y = new Date(`${MSG_NOW.slice(0, 10)}T12:00`)
    y.setDate(y.getDate() - 1)
    return iso.slice(0, 10) === y.toISOString().slice(0, 10) ? t("chat.yesterday") : dates.dayMonth(iso)
  }
}

/** Posts with day pills: others (avatar · name · time · grey bubble), yours (blue, end-aligned, "time · Seen by N"), cards, alerts. */
function Posts({ room }: { room: ChatRoom }) {
  const { t, b } = useMsgText()
  const me = useMe()
  const day = useDayLabel()
  const posts = useChatMessages(room.id)
  return (
    <div className="flex flex-col gap-3.5">
      {posts.map((m, i) => {
        const pill = i === 0 || posts[i - 1].at.slice(0, 10) !== m.at.slice(0, 10) ? day(m.at) : null
        return (
          <React.Fragment key={m.id}>
            {pill && (
              <div className="flex justify-center">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{pill}</span>
              </div>
            )}
            {m.kind === "system" ? (
              <div className="flex justify-center">
                <span
                  className={cn(
                    "inline-flex max-w-full items-start gap-1.5 rounded-2xl px-3 py-1 text-xs font-medium",
                    m.tone === "destructive" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-info-soft text-info-soft-foreground"
                  )}
                >
                  <Icon name="danger" size={14} className="shrink-0" />
                  {b(m.text)}
                </span>
              </div>
            ) : m.from === me ? (
              <div className="flex flex-col items-end gap-1">
                <p className="max-w-[80%] rounded-xl bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{b(m.text)}</p>
                {m.kind === "patient" && <PatientCard patient={m.patient} room={room.id} />}
                {m.kind === "file" && <FileCard file={m.file} room={room.id} />}
                <span className="text-xs text-muted-foreground">
                  {"seenBy" in m && m.seenBy ? t("chat.seenBy", { time: m.at.slice(11, 16), n: m.seenBy }) : t("chat.sent", { time: m.at.slice(11, 16) })}
                </span>
              </div>
            ) : (
              <Theirs m={m} room={room.id} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function Theirs({ m, room }: { m: Exclude<ChatMessage, { kind: "system" }>; room: string }) {
  const { b } = useMsgText()
  const s = STAFF[m.from]
  return (
    <div className="flex items-start gap-2.5">
      <PersonAvatar initials={s?.initials ?? "?"} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="flex items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{s ? b(s.name).replace(/^(Nurse \w+) .*/, "$1").replace(/^(الممرضة \S+) .*/, "$1") : m.from}</span>
          <span className="text-muted-foreground">{m.at.slice(11, 16)}</span>
        </span>
        <p className="max-w-[80%] rounded-xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap text-foreground">{b(m.text)}</p>
        {m.kind === "patient" && <PatientCard patient={m.patient} room={room} />}
        {m.kind === "file" && <FileCard file={m.file} room={room} />}
      </div>
    </div>
  )
}

/** Composer: attach · text · Send, and the privacy line. Announcements: admins only. Patients by MRN become a card. */
function Composer({ room }: { room: ChatRoom }) {
  const { t } = useMsgText()
  const me = useMe()
  const role = useMsgRole()
  const name = useRoomName()
  const [text, setText] = React.useState("")
  const [error, setError] = React.useState<string>()
  const fileInput = React.useRef<HTMLInputElement>(null)
  const posts = useChatMessages(room.id)
  if (room.postBy === "admins" && !msgCan(role, "admin"))
    return <p className="rounded-[10px] bg-muted p-3 text-xs text-muted-foreground">{t("chat.adminsOnly", { name: name(room) })}</p>

  const sent = (preview: { en: string; ar: string }) => {
    toast.success(t("toasts.chatSent"), { description: t("toasts.chatSentText", { name: name(room), n: room.memberCount }) })
    return preview
  }
  const id = () => `${room.id}-s${posts.length + 1}`
  const send = () => {
    const v = text.trim()
    if (!v) return setError(t("chat.errEmpty"))
    const mrn = v.match(/\bMRN-\d{4,}\b/)?.[0]
    const patient = mrn ? patientByMrn(mrn) : undefined
    if (patient && !room.patientsAllowed) return setError(t("chat.noPatients", { name: name(room) }))
    const txt = { en: v, ar: v }
    const m: ChatMessage = patient ? { id: id(), room: room.id, kind: "patient", from: me, at: MSG_NOW, text: txt, patient } : { id: id(), room: room.id, kind: "text", from: me, at: MSG_NOW, text: txt }
    const you = { en: `You: ${v}`, ar: `أنت: ${v}` }
    postChat(m, { text: sent(you), at: MSG_NOW })
    setText("")
    setError(undefined)
  }
  const attach = (list: FileList | null) => {
    const f = list?.[0]
    if (!f) return
    const ext = (f.name.split(".").pop() ?? "file").toUpperCase()
    const meta = `${ext} · ${Math.max(1, Math.round(f.size / 1024))} KB`
    const file: Attachment = { name: { en: f.name, ar: f.name }, meta: { en: meta, ar: meta }, kind: f.type.includes("pdf") ? "pdf" : "doc" }
    postChat({ id: id(), room: room.id, kind: "file", from: me, at: MSG_NOW, text: { en: f.name, ar: f.name }, file }, { text: { en: `You: ${f.name}`, ar: `أنت: ${f.name}` }, at: MSG_NOW })
    toast.info(t("toasts.fileAttached"), { description: f.name })
  }
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex items-center gap-2 rounded-[10px] border bg-card py-2 ps-3 pe-2", error ? "border-destructive" : "border-input")}>
        <input ref={fileInput} type="file" hidden onChange={(e) => attach(e.target.files)} />
        <Button variant="ghost" size="icon" className="size-8" onClick={() => fileInput.current?.click()} aria-label={t("chat.attach")}>
          <Icon name="paperclip-2" size={20} />
        </Button>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(undefined)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={t("chat.ph", { name: name(room) })}
          aria-label={t("chat.ph", { name: name(room) })}
          aria-invalid={!!error || undefined}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button size="sm" onClick={send}>
          <Icon name="send-2" size={18} />
          {t("actions.send")}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">{t("chat.privacy")}</p>
    </div>
  )
}

/** Conversation pane / card: header (# tile, name, members · branch, info), posts, composer. */
export function ConversationPane({
  room,
  head = true,
  fill,
  info,
  markRead = true,
}: {
  room: ChatRoom
  head?: boolean
  fill?: boolean
  info?: boolean
  /** Opening reads it; the room the Chat tab shows first stays unread until it's picked (as drawn). */
  markRead?: boolean
}) {
  const { t, b } = useMsgText()
  const name = useRoomName()
  const person = room.kind === "direct" && room.with ? STAFF[room.with] : undefined
  const count = useChatMessages(room.id).length
  const scroller = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (markRead && room.unread) readRoom(room.id)
  }, [markRead, room.id, room.unread])
  // Two-pane view: keep the newest post in sight (scroll the pane only, never the page).
  React.useEffect(() => {
    const el = scroller.current
    if (fill && el) el.scrollTop = el.scrollHeight
  }, [fill, count])
  return (
    <div className={cn("flex min-w-0 flex-col gap-4", fill && "h-full")}>
      {head && (
        <div className="flex items-center gap-2.5 border-b pb-3.5">
          <RoomLead room={room} size={36} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{name(room)}</span>
            <span className="text-xs text-muted-foreground">
              {person ? b(person.title) : room.branch ? t("chat.membersBranch", { n: room.memberCount, branch: b(room.branch) }) : t("chat.members", { n: room.memberCount })}
            </span>
          </span>
          {info && (
            <Button variant="ghost" size="icon" asChild>
              <Link href={roomHref(room.id)} aria-label={t("actions.info")}>
                <Icon name="info-circle" size={22} />
              </Link>
            </Button>
          )}
        </div>
      )}
      <div ref={scroller} className={cn(fill && "min-h-0 flex-1 overflow-y-auto")}>
        <Posts room={room} />
      </div>
      <Composer room={room} />
    </div>
  )
}

/* ------------------------------------------------------------------ Chat tab */

/** Header action on Chat: New chat. */
export function ChatActions() {
  const { t } = useMsgText()
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="add" size={18} />
        {t("actions.newChat")}
      </Button>
      {open && <NewChatDialog onOpenChange={setOpen} />}
    </>
  )
}

/**
 * Widget / Msg Chat. Desktop (xl): one card, 780 high — the list (Chat + New chat, search, Channels, Direct messages) and
 * the open conversation. Tablet / mobile: the list only; rows open the Conversation page.
 */
export function ChatBody() {
  const { t } = useMsgText()
  const me = useMe()
  const rooms = roomsOf(useRooms(), me).sort((a, b) => b.last.at.localeCompare(a.last.at))
  const unread = rooms.reduce((n, r) => n + (r.muted ? 0 : r.unread), 0)
  const [q, setQ] = React.useState("")
  const [sel, setSel] = React.useState<string>()
  const [newChat, setNewChat] = React.useState(false)
  // Channels keep the drawn order (Cardiology team first); direct messages newest first.
  const ordered = [...rooms.filter((r) => r.kind !== "direct"), ...rooms.filter((r) => r.kind === "direct")]
  const current = rooms.find((r) => r.id === sel) ?? ordered[0]
  const head = (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{t("chat.title")}</h2>
        <p className="text-xs text-muted-foreground">{unread ? t("chat.subUnread", { n: unread }) : t("chat.sub")}</p>
      </div>
      <Button variant="outline" size="icon" onClick={() => setNewChat(true)} aria-label={t("actions.newChat")}>
        <Icon name="add" size={20} />
      </Button>
    </div>
  )
  return (
    <>
      <div className="hidden h-[780px] overflow-hidden rounded-[14px] border bg-card xl:flex">
        <div className="flex w-[300px] shrink-0 flex-col gap-3.5 overflow-y-auto border-e px-3 py-4">
          {head}
          <SearchBox q={q} setQ={setQ} />
          <RoomList rooms={ordered} q={q} selected={current?.id} onSelect={setSel} />
        </div>
        <div className="min-w-0 flex-1 p-6">{current ? <ConversationPane key={current.id} room={current} fill info markRead={!!sel} /> : <EmptyState icon="messages-2" title={t("chat.pick")} description={t("chat.pickText")} />}</div>
      </div>
      <section className="flex flex-col gap-4 rounded-[14px] border bg-card p-4 xl:hidden">
        {head}
        <SearchBox q={q} setQ={setQ} />
        <RoomList rooms={ordered} q={q} linkRows />
      </section>
      {newChat && <NewChatDialog onOpenChange={setNewChat} />}
    </>
  )
}
