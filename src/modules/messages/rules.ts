import { PATIENTS } from "@/modules/records/data"
import { CLINIC_NURSES, MAILBOXES, MEMBERSHIPS, MSG_TODAY, STAFF } from "./data"
import { accessAtLeast, type AccessLevel, type ChatRoom, type Mailbox, type Membership, type PatientThread, type StaffKey, type Thread } from "./types"

/*
 * Access rules (brief §4). Every list, count and search goes through these, so a message linked to a patient never shows
 * to someone outside his care team (plus the teams the rule names, e.g. Claims) — and the tab counts agree with the lists.
 */

/** Teams that may open patient-linked mail besides the care team ("Only his care team and Claims can open it"). */
export const PATIENT_MAIL_TEAMS: StaffKey[] = ["rawan"]

const activeGrant = (m: Membership, today = MSG_TODAY) => !m.until || m.until >= today

/** The person's level in a shared mailbox (personal and linked mailboxes: "manage" for the owner). */
export function levelIn(mailbox: Mailbox, who: StaffKey, memberships: Membership[] = MEMBERSHIPS): AccessLevel | undefined {
  if (mailbox.kind !== "shared") return mailbox.owner === who ? "manage" : undefined
  return memberships.find((m) => m.mailbox === mailbox.id && m.staff === who && activeGrant(m))?.level
}

/** Mailboxes the person sees in Inbox: their own, the shared ones they have access to, their linked ones. */
export function mailboxesOf(who: StaffKey, mailboxes: Mailbox[] = MAILBOXES, memberships: Membership[] = MEMBERSHIPS) {
  return mailboxes.filter((m) => levelIn(m, who, memberships))
}

/** Care team of a Medical records patient (records user keys → Messages staff keys), plus the clinic nurses of those doctors. */
export function inCareTeam(patient: string, who: StaffKey) {
  const p = (PATIENTS as Record<string, { careTeam: string[] }>)[patient]
  if (!p) return false
  const rec = STAFF[who].recUser
  if (rec && p.careTeam.includes(rec)) return true
  return p.careTeam.some((doc) => CLINIC_NURSES[doc]?.includes(who))
}

/** Patient-linked mail: only the care team of every linked patient and the named teams can open it. */
export function canOpenThread(t: Thread, who: StaffKey, mailboxes: Mailbox[] = MAILBOXES, memberships: Membership[] = MEMBERSHIPS) {
  const box = mailboxes.find((m) => m.id === t.mailbox)
  if (!box || !levelIn(box, who, memberships)) return false
  const patients = t.links.filter((l) => l.kind === "patient" && l.patient).map((l) => l.patient!)
  return patients.every((p) => inCareTeam(p, who) || PATIENT_MAIL_TEAMS.includes(who))
}

/** Can answer from the thread's mailbox (Reply or higher). */
export function canReply(t: Thread, who: StaffKey, mailboxes: Mailbox[] = MAILBOXES, memberships: Membership[] = MEMBERSHIPS) {
  const box = mailboxes.find((m) => m.id === t.mailbox)
  return !!box && accessAtLeast(levelIn(box, who, memberships), "reply")
}

/** Mailboxes the person may start new mail from (Send as or higher; personal = owner). */
export function sendableBoxes(who: StaffKey, mailboxes: Mailbox[] = MAILBOXES, memberships: Membership[] = MEMBERSHIPS) {
  return mailboxes.filter((m) => accessAtLeast(levelIn(m, who, memberships), "sendAs"))
}

/** Inbox threads the person can see, newest first. */
export function visibleThreads(threads: Thread[], who: StaffKey, mailboxes: Mailbox[] = MAILBOXES, memberships: Membership[] = MEMBERSHIPS) {
  return threads
    .filter((t) => t.folder === "inbox" && canOpenThread(t, who, mailboxes, memberships))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/** Inbox left pane: the unified Inbox, a folder of your mailbox, or one mailbox. */
export type InboxView = "inbox" | "flagged" | "sent" | "drafts" | `box:${string}`

/** Threads for a view, newest first (access rules first: what you can't open never shows). */
export function viewThreads(threads: Thread[], who: StaffKey, view: InboxView, mailboxes: Mailbox[] = MAILBOXES, memberships: Membership[] = MEMBERSHIPS) {
  const ok = threads.filter((t) => canOpenThread(t, who, mailboxes, memberships))
  const pick =
    view === "inbox"
      ? ok.filter((t) => t.folder === "inbox")
      : view === "flagged"
        ? ok.filter((t) => t.flagged && t.folder !== "drafts" && t.folder !== "archive")
        : view === "sent"
          ? ok.filter((t) => t.folder !== "drafts" && t.messages.some((m) => m.from.staff === who))
          : view === "drafts"
            ? ok.filter((t) => t.folder === "drafts")
            : ok.filter((t) => t.folder === "inbox" && t.mailbox === view.slice(4))
  return pick.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/** Who an email can be assigned to: people in its mailbox (Reply or higher) who are allowed to open it. */
export function canTakeAssignment(t: Thread, who: StaffKey, mailboxes: Mailbox[] = MAILBOXES, memberships: Membership[] = MEMBERSHIPS) {
  return canOpenThread(t, who, mailboxes, memberships) && canReply(t, who, mailboxes, memberships)
}

export function inboxCounts(threads: Thread[], who: StaffKey, mailboxes: Mailbox[] = MAILBOXES, memberships: Membership[] = MEMBERSHIPS) {
  const list = visibleThreads(threads, who, mailboxes, memberships)
  const byBox: Record<string, number> = {}
  for (const t of list) if (t.unread) byBox[t.mailbox] = (byBox[t.mailbox] ?? 0) + 1
  return {
    total: list.length,
    unread: list.filter((t) => t.unread).length,
    mine: list.filter((t) => t.assignee?.to === who).length,
    flagged: viewThreads(threads, who, "flagged", mailboxes, memberships).length,
    drafts: viewThreads(threads, who, "drafts", mailboxes, memberships).length,
    byBox,
    mailboxes: mailboxesOf(who, mailboxes, memberships).length,
  }
}

/** Chat rooms the person is in, and their unread total. */
export const roomsOf = (rooms: ChatRoom[], who: StaffKey) => rooms.filter((r) => r.members.includes(who))
export const chatUnread = (rooms: ChatRoom[], who: StaffKey) => roomsOf(rooms, who).reduce((n, r) => n + (r.muted ? 0 : r.unread), 0)

/** Patient messages: replies (tab count) and failed sends. */
export function patientCounts(threads: PatientThread[]) {
  return {
    replies: threads.filter((t) => t.last.state === "replied").length,
    failed: threads.filter((t) => t.last.state === "failed").length,
  }
}

/** People with access to a shared mailbox (grants that haven't ended). */
export function membersOf(mailbox: string, memberships: Membership[] = MEMBERSHIPS) {
  return memberships.filter((m) => m.mailbox === mailbox && activeGrant(m))
}
export const peopleIn = (mailbox: Mailbox, memberships: Membership[] = MEMBERSHIPS) => membersOf(mailbox.id, memberships).length

/**
 * Unread in a mailbox (Mail accounts): the provider's count for mailboxes whose mail isn't all loaded here (claims@ holds
 * more than the few Bupa conversations the app carries), otherwise counted from its mail.
 */
export function unreadIn(mailbox: Mailbox, threads: Thread[]) {
  if (mailbox.seedUnread !== undefined) return mailbox.seedUnread
  return threads.filter((t) => t.mailbox === mailbox.id && t.folder === "inbox" && t.unread).length
}

/** "1 min ago" style age of a sync, in whole minutes (0 = just now). */
export function minutesSince(iso: string, now: string) {
  return Math.max(0, Math.round((new Date(now).getTime() - new Date(iso).getTime()) / 60000))
}
