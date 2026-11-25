"use client"

import * as React from "react"

import { AUDIT, CHAT_MESSAGES, CHAT_ROOMS, CONNECTIONS, CONSENTS, MAILBOXES, MEMBERSHIPS, ME, MSG_NOW, PATIENT_THREADS, POLICIES, ROLE_RULES, THREADS } from "./data"
import type { MsgRole } from "./roles"
import { chatUnread, inboxCounts, patientCounts } from "./rules"
import type { AuditEvent, ChatMessage, ChatRoom, Connection, Consent, Mailbox, Membership, PatientThread, Policies, RoleRule, Thread } from "./types"

/**
 * Messages session store (sessionStorage `ms.messages.session`, like the other modules). It keeps what the demo changes:
 * the role, and — as later steps land — read / archived / assigned / linked mail, sent replies, chat posts, patient
 * messages, access changes and the audit events they write. Lists read through the hooks below, so counts follow.
 */
type State = {
  role: MsgRole
  /** Thread changes (read, archived, assignee, links, replies) keyed by thread id. */
  threads: Record<string, Partial<Thread>>
  /** Threads created in this session (sent mail, drafts). */
  newThreads: Thread[]
  /** Chat rooms changed or created in this session. */
  rooms: Record<string, Partial<ChatRoom>>
  newRooms: ChatRoom[]
  patientThreads: Record<string, Partial<PatientThread>>
  mailboxes: Record<string, Partial<Mailbox>>
  newMailboxes: Mailbox[]
  /** Access as changed in this session (replaces the seed rows for that mailbox + person). */
  memberships: Membership[] | null
  audit: AuditEvent[]
  connections: Record<string, Partial<Connection>>
  newConnections: Connection[]
  policies: Partial<Policies>
  newRules: RoleRule[]
  /** Personal mailboxes linked in this session (the Personal mailboxes card counts them). */
  personalLinked: number
  /** Chat posts made in this session. */
  chat: ChatMessage[]
  /** Patient conversations started this session, and consent changes. */
  newPatientThreads: PatientThread[]
  consents: Record<string, Partial<Consent>>
}

const KEY = "ms.messages.session"
const EMPTY: State = {
  role: "lead",
  threads: {},
  newThreads: [],
  rooms: {},
  newRooms: [],
  patientThreads: {},
  mailboxes: {},
  newMailboxes: [],
  memberships: null,
  audit: [],
  connections: {},
  newConnections: [],
  policies: {},
  newRules: [],
  personalLinked: 0,
  chat: [],
  newPatientThreads: [],
  consents: {},
}
let state: State = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<State>) }
  } catch {}
}
export function commit(fn: (s: State) => State) {
  load()
  state = fn(state)
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
  for (const l of listeners) l()
}
function subscribe(l: () => void) {
  load()
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
const read = () => {
  load()
  return state
}
const serverState = () => EMPTY

function useSlice<T>(select: (s: State) => T): T {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return select(snap)
}

/** Who the demo is signed in as (Dr. Khaled) and the role the dev stories can switch. */
export const useMe = () => ME
export const useMsgRole = () => useSlice((s) => s.role)
export const setMsgRole = (role: MsgRole) => commit((s) => ({ ...s, role }))

/* ------------------------------------------------------------------ merged data */

const mergeById = <T extends { id: string }>(seed: T[], changes: Record<string, Partial<T>>, added: T[]) => [
  ...added,
  ...seed.map((x) => (changes[x.id] ? { ...x, ...changes[x.id] } : x)),
]

export function useThreads(): Thread[] {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => mergeById(THREADS, snap.threads, snap.newThreads), [snap.threads, snap.newThreads])
}
export function useMailboxes(): Mailbox[] {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => mergeById(MAILBOXES, snap.mailboxes, snap.newMailboxes), [snap.mailboxes, snap.newMailboxes])
}
export const useMemberships = (): Membership[] => useSlice((s) => s.memberships ?? MEMBERSHIPS)
export function useRooms(): ChatRoom[] {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => mergeById(CHAT_ROOMS, snap.rooms, snap.newRooms), [snap.rooms, snap.newRooms])
}
export function usePatientThreads(): PatientThread[] {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(
    () => mergeById(PATIENT_THREADS, snap.patientThreads, snap.newPatientThreads).sort((a, b) => b.last.at.localeCompare(a.last.at)),
    [snap.patientThreads, snap.newPatientThreads]
  )
}
export const useAudit = () => useSlice((s) => s.audit)

/** Counts on the module tabs (Inbox 7 · Chat · Patient messages 3) and the nav badge. */
export function useMsgCounts() {
  const me = useMe()
  const threads = useThreads()
  const boxes = useMailboxes()
  const members = useMemberships()
  const rooms = useRooms()
  const pts = usePatientThreads()
  return React.useMemo(() => {
    const inbox = inboxCounts(threads, me, boxes, members)
    return { inbox, chat: chatUnread(rooms, me), patients: patientCounts(pts) }
  }, [threads, me, boxes, members, rooms, pts])
}

/* ------------------------------------------------------------------ mail threads (step 3) */

export function useThread(id: string): Thread | undefined {
  const threads = useThreads()
  return threads.find((t) => t.id === id)
}

function patchThread(s: State, id: string, patch: (t: Thread) => Partial<Thread>): State {
  const all = mergeById(THREADS, s.threads, s.newThreads)
  const cur = all.find((t) => t.id === id)
  if (!cur) return s
  const next = patch(cur)
  if (s.newThreads.some((t) => t.id === id)) return { ...s, newThreads: s.newThreads.map((t) => (t.id === id ? { ...t, ...next } : t)) }
  return { ...s, threads: { ...s.threads, [id]: { ...s.threads[id], ...next } } }
}
const event = (text: AuditEvent["text"]) => ({ at: MSG_NOW, text })

export function markRead(id: string, unread = false) {
  commit((s) => patchThread(s, id, () => ({ unread })))
}
export function toggleFlag(id: string) {
  commit((s) => patchThread(s, id, (t) => ({ flagged: !t.flagged })))
}

/** Opening shared mail is logged once per session when the rule is on (brief §4). */
const opened = new Set<string>()
export function logOpen(t: Thread, shared: boolean, logOn: boolean) {
  if (!shared || !logOn || opened.has(t.id)) return
  opened.add(t.id)
  commit((s) => withAudit(s, { kind: "opened", actor: ME, mailbox: t.mailbox, thread: t.id, text: { en: `You opened “${t.subject.en}”`, ar: `فتحت «${t.subject.ar}»` } }))
}

export function archiveThread(id: string) {
  commit((s) => patchThread(s, id, (t) => ({ folder: "archive", unread: false, events: [...t.events, event({ en: "You archived it", ar: "أرشفتها أنت" })] })))
}

export function assignThread(id: string, a: { to: string; note?: AuditEvent["text"]; remindOn?: string }, who: AuditEvent["text"]) {
  commit((s) =>
    patchThread(s, id, (t) => ({
      assignee: { to: a.to, by: ME, at: MSG_NOW, note: a.note, remindOn: a.remindOn },
      events: [...t.events, event({ en: `You assigned it to ${who.en}`, ar: `عيّنتها لـ${who.ar}` })],
    }))
  )
}

export function linkThread(id: string, link: Thread["links"][number], later: boolean) {
  commit((s) =>
    patchThread(s, id, (t) => ({
      links: [...t.links.filter((l) => l.ref !== link.ref), { ...link, auto: false }],
      linkReplies: later,
      events: [...t.events, event({ en: `You linked it to ${link.label.en}`, ar: `ربطتها بـ${link.label.ar}` })],
    }))
  )
}

export function sendReply(id: string, msg: Thread["messages"][number], snippet: Thread["snippet"]) {
  commit((s) =>
    patchThread(s, id, (t) => ({
      messages: [...t.messages, msg],
      lastAt: msg.at,
      snippet,
      unread: false,
      draft: undefined,
      status: "waitingThem",
      events: [...t.events, event(msg.encrypted ? { en: "You replied · sent encrypted", ar: "رديت · انرسل مشفّر" } : { en: "You replied", ar: "رديت" })],
    }))
  )
}

/** Save a draft (Drafts): a new draft is added; an existing one (seed or session) is updated in place. */
export function saveDraft(t: Thread) {
  commit((s) => {
    const exists = THREADS.some((x) => x.id === t.id) || s.newThreads.some((x) => x.id === t.id)
    return exists ? patchThread(s, t.id, () => t) : { ...s, newThreads: [t, ...s.newThreads] }
  })
}

/**
 * Send a new message: the draft (if it came from one) becomes the sent conversation; otherwise a new one is added. Sending
 * as it is (patient data, no encryption) is logged for the privacy officer.
 */
export function sendNew(t: Thread, asIs?: { reason: string }) {
  commit((s) => {
    const exists = THREADS.some((x) => x.id === t.id) || s.newThreads.some((x) => x.id === t.id)
    const next = exists ? patchThread(s, t.id, () => ({ ...t, compose: undefined })) : { ...s, newThreads: [t, ...s.newThreads] }
    return asIs
      ? withAudit(next, {
          kind: "sentAsIs",
          actor: ME,
          mailbox: t.mailbox,
          thread: t.id,
          text: { en: `Sent with patient data, not encrypted · reason: ${asIs.reason}`, ar: `انرسل ببيانات مريض بدون تشفير · السبب: ${asIs.reason}` },
        })
      : next
  })
}

/** Session load per person (Assign dialog) = seed + assignments made this session. */
export function useAssignLoad(seed: Record<string, number>) {
  const threads = useThreads()
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => {
    const load = { ...seed }
    for (const [id, ch] of Object.entries(snap.threads)) {
      const base = THREADS.find((t) => t.id === id)
      if (ch.assignee && ch.assignee.to !== base?.assignee?.to) load[ch.assignee.to] = (load[ch.assignee.to] ?? 0) + 1
    }
    return load
  }, [seed, snap.threads, threads])
}

/* ------------------------------------------------------------------ mail accounts (step 2) */

export function useConnections(): Connection[] {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => [...mergeById(CONNECTIONS, snap.connections, []), ...snap.newConnections], [snap.connections, snap.newConnections])
}
export function usePolicies(): Policies {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => ({ ...POLICIES, ...snap.policies }), [snap.policies])
}
export function useRoleRules(): RoleRule[] {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => [...ROLE_RULES, ...snap.newRules], [snap.newRules])
}
export const usePersonalLinked = () => useSlice((s) => s.personalLinked)
/** Seed audit + this session's events, newest first. */
export function useAuditLog(): AuditEvent[] {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => [...snap.audit, ...AUDIT].sort((a, b) => b.at.localeCompare(a.at)), [snap.audit])
}

let seq = 0
const eventId = () => `a-s${Date.now().toString(36)}${seq++}`
const withAudit = (s: State, e: Omit<AuditEvent, "id" | "at">): State => ({ ...s, audit: [{ id: eventId(), at: MSG_NOW, ...e }, ...s.audit] })

/** Every write below logs who did it (brief §4: every access change is logged; the privacy officer sees the log). */
export function logEvent(e: Omit<AuditEvent, "id" | "at">) {
  commit((s) => withAudit(s, e))
}

export function setPolicies(patch: Partial<Policies>, text: AuditEvent["text"]) {
  commit((s) => withAudit({ ...s, policies: { ...s.policies, ...patch } }, { kind: "ruleAdded", actor: ME, text }))
}

/** Sync now: the connection (and the mailbox) read "synced just now". */
export function markSynced(connection: string, mailbox?: string) {
  commit((s) => ({
    ...s,
    connections: { ...s.connections, [connection]: { ...s.connections[connection], lastSync: MSG_NOW } },
    mailboxes: mailbox ? { ...s.mailboxes, [mailbox]: { ...s.mailboxes[mailbox], lastSync: MSG_NOW } } : s.mailboxes,
  }))
}

/** An org connection granted (or refreshed): status, account, domain, mailbox count. */
export function saveConnection(id: string, patch: Partial<Connection>, text: AuditEvent["text"]) {
  commit((s) => withAudit({ ...s, connections: { ...s.connections, [id]: { ...s.connections[id], ...patch } } }, { kind: "accessChanged", actor: ME, text }))
}

/** A personal mailbox linked by the signed-in user: a new linked mailbox + its connection. */
export function addPersonalMailbox(box: Mailbox, conn: Connection, text: AuditEvent["text"]) {
  commit((s) =>
    withAudit(
      { ...s, newMailboxes: [box, ...s.newMailboxes], newConnections: [...s.newConnections, conn], personalLinked: s.personalLinked + 1 },
      { kind: "accessChanged", actor: ME, mailbox: box.id, text }
    )
  )
}

export function createSharedMailbox(box: Mailbox, members: Membership[], rule: RoleRule | null, text: AuditEvent["text"]) {
  commit((s) =>
    withAudit(
      { ...s, newMailboxes: [...s.newMailboxes, box], memberships: [...(s.memberships ?? MEMBERSHIPS), ...members], newRules: rule ? [...s.newRules, rule] : s.newRules },
      { kind: "accessChanged", actor: ME, mailbox: box.id, text }
    )
  )
}

/** Take one person's access away (role-rule members leave the rule for this mailbox only). */
export function removeAccess(mailbox: string, staff: string, text: AuditEvent["text"]) {
  commit((s) =>
    withAudit(
      { ...s, memberships: (s.memberships ?? MEMBERSHIPS).filter((m) => !(m.mailbox === mailbox && m.staff === staff)) },
      { kind: "accessChanged", actor: ME, mailbox, text }
    )
  )
}

/** Add or change one person's access to a shared mailbox. */
export function saveAccess(row: Membership, text: AuditEvent["text"]) {
  commit((s) => {
    const list = (s.memberships ?? MEMBERSHIPS).filter((m) => !(m.mailbox === row.mailbox && m.staff === row.staff))
    return withAudit({ ...s, memberships: [...list, row] }, { kind: "accessChanged", actor: ME, mailbox: row.mailbox, text })
  })
}

/* ------------------------------------------------------------------ staff chat (step 5) */

/** A room's posts, oldest first (seed + this session). */
export function useChatMessages(room: string): ChatMessage[] {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => [...CHAT_MESSAGES, ...snap.chat].filter((m) => m.room === room).sort((a, b) => a.at.localeCompare(b.at)), [room, snap.chat])
}

function patchRoom(s: State, id: string, patch: (r: ChatRoom) => Partial<ChatRoom>): State {
  const all = mergeById(CHAT_ROOMS, s.rooms, s.newRooms)
  const cur = all.find((r) => r.id === id)
  if (!cur) return s
  const next = patch(cur)
  if (s.newRooms.some((r) => r.id === id)) return { ...s, newRooms: s.newRooms.map((r) => (r.id === id ? { ...r, ...next } : r)) }
  return { ...s, rooms: { ...s.rooms, [id]: { ...s.rooms[id], ...next } } }
}

/** Opening a room reads it. */
export function readRoom(id: string) {
  commit((s) => patchRoom(s, id, (r) => (r.unread ? { unread: 0 } : {})))
}

export function postChat(m: ChatMessage, last: ChatRoom["last"]) {
  commit((s) => patchRoom({ ...s, chat: [...s.chat, m] }, m.room, () => ({ last, unread: 0 })))
}

/** Mute for 8 hours (urgent posts still come through) or unmute. */
export function muteRoom(id: string, until: string | null) {
  commit((s) => patchRoom(s, id, () => ({ muted: !!until, mutedUntil: until ?? undefined })))
}

export function setRoomNotify(id: string, notify: NonNullable<ChatRoom["notify"]>) {
  commit((s) => patchRoom(s, id, () => ({ notify })))
}

export function addRoomMembers(id: string, people: string[], text: AuditEvent["text"]) {
  commit((s) =>
    withAudit(
      patchRoom(s, id, (r) => ({ members: [...r.members, ...people.filter((p) => !r.members.includes(p))], memberCount: r.memberCount + people.filter((p) => !r.members.includes(p)).length })),
      { kind: "accessChanged", actor: ME, text }
    )
  )
}

export function createRoom(r: ChatRoom) {
  commit((s) => ({ ...s, newRooms: [r, ...s.newRooms] }))
}

/** Opening a patient card shared in chat is logged (and so is a refused open). */
export function logPatientCard(patient: string, room: string, allowed: boolean, text: AuditEvent["text"]) {
  commit((s) => withAudit(s, { kind: "opened", actor: ME, text: allowed ? text : { en: `Refused: ${text.en}`, ar: `مرفوض: ${text.ar}` }, thread: `${room}:${patient}` }))
}

/* ------------------------------------------------------------------ patient messages (step 6) */

/** A patient's consent: what they signed, plus changes made this session at their request. */
export function useConsent(patient: string): Consent {
  const snap = React.useSyncExternalStore(subscribe, read, serverState)
  return React.useMemo(() => {
    const base = CONSENTS.find((c) => c.patient === patient) ?? { patient, reminders: true, whatsapp: false, offers: false, signed: "", smsFallback: false }
    return { ...base, ...snap.consents[patient] }
  }, [patient, snap.consents])
}

export function setConsent(patient: string, patch: Partial<Consent>, text: AuditEvent["text"]) {
  commit((s) => withAudit({ ...s, consents: { ...s.consents, [patient]: { ...s.consents[patient], ...patch } } }, { kind: "accessChanged", actor: ME, text }))
}

function patchPatientThread(s: State, id: string, patch: (t: PatientThread) => Partial<PatientThread>): State {
  const all = mergeById(PATIENT_THREADS, s.patientThreads, s.newPatientThreads)
  const cur = all.find((t) => t.id === id)
  if (!cur) return s
  const next = patch(cur)
  if (s.newPatientThreads.some((t) => t.id === id)) return { ...s, newPatientThreads: s.newPatientThreads.map((t) => (t.id === id ? { ...t, ...next } : t)) }
  return { ...s, patientThreads: { ...s.patientThreads, [id]: { ...s.patientThreads[id], ...next } } }
}

/** Add a sent message to a patient conversation (new conversation if there's none for the patient yet). */
export function postPatientMessage(thread: PatientThread, msg: PatientThread["messages"][number]) {
  commit((s) => {
    const exists = PATIENT_THREADS.some((t) => t.id === thread.id) || s.newPatientThreads.some((t) => t.id === thread.id)
    const last = { text: msg.text, at: msg.at, state: msg.state ?? ("sent" as const) }
    if (!exists) return { ...s, newPatientThreads: [{ ...thread, messages: [msg], last, needsAction: msg.state === "failed" }, ...s.newPatientThreads] }
    return patchPatientThread(s, thread.id, (t) => ({ messages: [...t.messages, msg], last, channel: msg.channel, needsAction: msg.state === "failed" }))
  })
}

/** Reception handled the reply (answered it): the amber "Replied" goes. */
export function markHandled(id: string) {
  commit((s) => patchPatientThread(s, id, () => ({ needsAction: false })))
}

/* ------------------------------------------------------------------ partners (step 7) */

const contactsKey = "ms.messages.contacts"
let addedContacts: import("./types").Contact[] = []
let contactsLoaded = false
const contactListeners = new Set<() => void>()
function loadContacts() {
  if (contactsLoaded || typeof window === "undefined") return
  contactsLoaded = true
  try {
    addedContacts = JSON.parse(sessionStorage.getItem(contactsKey) ?? "[]")
  } catch {}
}
/** Partner contacts: the seed + the ones added this session (Add contact). */
export function useContacts(seed: import("./types").Contact[]) {
  const added = React.useSyncExternalStore(
    (l) => {
      loadContacts()
      contactListeners.add(l)
      return () => {
        contactListeners.delete(l)
      }
    },
    () => {
      loadContacts()
      return addedContacts
    },
    () => EMPTY_CONTACTS
  )
  return React.useMemo(() => [...seed, ...added], [seed, added])
}
const EMPTY_CONTACTS: import("./types").Contact[] = []
export function addContact(c: import("./types").Contact) {
  loadContacts()
  addedContacts = [...addedContacts, c]
  try {
    sessionStorage.setItem(contactsKey, JSON.stringify(addedContacts))
  } catch {}
  for (const l of contactListeners) l()
}

/* ------------------------------------------------------------------ templates + signatures (step 8) */

const tplKey = "ms.messages.templates"
type TplState = { templates: import("./types").Template[]; signatures: Record<string, Partial<import("./types").Signature>> }
let tplState: TplState = { templates: [], signatures: {} }
let tplLoaded = false
const tplListeners = new Set<() => void>()
const TPL_EMPTY: TplState = { templates: [], signatures: {} }
function loadTpl() {
  if (tplLoaded || typeof window === "undefined") return
  tplLoaded = true
  try {
    tplState = { ...tplState, ...JSON.parse(sessionStorage.getItem(tplKey) ?? "{}") }
  } catch {}
}
function commitTpl(next: TplState) {
  tplState = next
  try {
    sessionStorage.setItem(tplKey, JSON.stringify(tplState))
  } catch {}
  for (const l of tplListeners) l()
}
function useTplState() {
  return React.useSyncExternalStore(
    (l) => {
      loadTpl()
      tplListeners.add(l)
      return () => {
        tplListeners.delete(l)
      }
    },
    () => {
      loadTpl()
      return tplState
    },
    () => TPL_EMPTY
  )
}
/** Templates: the seed, with this session's edits (same id) and new ones. */
export function useTemplates(seed: import("./types").Template[]) {
  const s = useTplState()
  return React.useMemo(() => {
    const edited = seed.map((x) => s.templates.find((y) => y.id === x.id) ?? x)
    return [...edited, ...s.templates.filter((y) => !seed.some((x) => x.id === y.id))]
  }, [seed, s.templates])
}
export function saveTemplate(t: import("./types").Template) {
  loadTpl()
  commitTpl({ ...tplState, templates: [...tplState.templates.filter((x) => x.id !== t.id), t] })
}
export function useSignatures(seed: import("./types").Signature[]) {
  const s = useTplState()
  return React.useMemo(() => seed.map((x) => ({ ...x, ...s.signatures[x.id] })), [seed, s.signatures])
}
export function saveSignature(id: string, patch: Partial<import("./types").Signature>) {
  loadTpl()
  commitTpl({ ...tplState, signatures: { ...tplState.signatures, [id]: { ...tplState.signatures[id], ...patch } } })
}
