"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { Link } from "@/i18n/navigation"
import { ActionMenu } from "@/components/ds/action-menu"
import { Icon } from "@/components/ds/icon"
import { EmptyState } from "@/components/ds/states"
import { toast } from "@/components/ds/toast"
import { usePageTitle } from "@/components/shell/page-title"
import { Button } from "@/components/ui/button"
import { PATIENTS } from "@/modules/records/data"
import { ME, MSG_NOW, SHARED_PATIENTS, STAFF } from "./data"
import { AddPeopleDialog, NewChatDialog } from "./chat-dialogs"
import { ConversationPane, downloadFile, usePatientCard, useRoomName } from "./chat"
import { MessagesInner } from "./frame"
import { chatHref } from "./href"
import { MsgCard, PersonAvatar, SwitchRow, useMsgText } from "./parts"
import { msgCan } from "./roles"
import { muteRoom, setRoomNotify, useChatMessages, useMe, useMsgRole, useRooms } from "./store"
import type { Attachment, ChatRoom, StaffRole } from "./types"

type Pt = { name: { en: string; ar: string }; mrn: string }
const pts = PATIENTS as unknown as Record<string, Pt>

/**
 * Chat · Conversation (inner page of Chat, `/messages/chat/conversation?id=cardiology-team`): header Back · "Messages / Chat"
 * over the room's name; Mute · Add people. The conversation card (its header on desktop and tablet; the app bar on
 * mobile). Side: Members (4 · Add · Show all), Pinned and files, Patients shared here (care team only), Notifications.
 */
export function ConversationPage() {
  const { t } = useMsgText()
  const id = useSearchParams().get("id") ?? ""
  const me = useMe()
  const room = useRooms().find((r) => r.id === id && r.members.includes(me))
  const name = useRoomName()
  const [dlg, setDlg] = React.useState<null | "add" | "new">(null)

  usePageTitle({
    title: room ? name(room) : t("titles.conversation"),
    back: chatHref(),
    crumbs: [
      { label: t("title"), href: "/messages" },
      { label: t("chat.title"), href: chatHref() },
    ],
  })

  if (!room)
    return (
      <MessagesInner tab="chat">
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon="messages-2"
            title={t("chat.notFound")}
            description={t("chat.notFoundText")}
            className="py-16"
            actions={
              <Button variant="outline" asChild>
                <Link href={chatHref()}>{t("chat.backToChat")}</Link>
              </Button>
            }
          />
        </div>
      </MessagesInner>
    )

  const mute = () => {
    if (room.muted) {
      muteRoom(room.id, null)
      toast.info(t("toasts.unmuted"), { description: t("toasts.unmutedText") })
    } else {
      const until = new Date(`${MSG_NOW}:00`)
      until.setHours(until.getHours() + 8)
      muteRoom(room.id, `${MSG_NOW.slice(0, 11)}${String(until.getHours()).padStart(2, "0")}:${MSG_NOW.slice(14, 16)}`)
      toast.info(t("toasts.muted"), { description: t("toasts.mutedText") })
    }
  }
  const canAdd = room.kind !== "direct"

  return (
    <>
      <div data-mobile-page-bar className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
        <Button variant="ghost" size="icon" asChild>
          <Link href={chatHref()} aria-label={t("actions.back")}>
            <Icon name="arrow-left" size={24} />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{name(room)}</h1>
        <ActionMenu
          title={name(room)}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("actions.more")}>
              <Icon name="more" size={20} />
            </Button>
          }
          groups={[
            [
              canAdd && { key: "add", icon: "user-add", label: t("actions.addPeople"), onSelect: () => setDlg("add") },
              { key: "mute", icon: "volume-slash", label: room.muted ? t("actions.unmute") : t("actions.mute"), onSelect: mute },
              { key: "new", icon: "messages-2", label: t("actions.newChat"), onSelect: () => setDlg("new") },
            ],
          ]}
        />
      </div>
      <MessagesInner
        tab="chat"
        actions={
          <>
            <Button variant="outline" onClick={mute}>
              <Icon name="volume-slash" size={18} />
              {room.muted ? t("actions.unmute") : t("actions.mute")}
            </Button>
            {canAdd && (
              <Button onClick={() => setDlg("add")}>
                <Icon name="user-add" size={18} />
                {t("actions.addPeople")}
              </Button>
            )}
          </>
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-6">
          <section className="min-w-0 rounded-[14px] border bg-card p-4 md:p-6">
            <div className="hidden md:block">
              <ConversationPane room={room} />
            </div>
            <div className="md:hidden">
              <ConversationPane room={room} head={false} />
            </div>
          </section>
          <div className="flex flex-col gap-4">
            <Members room={room} onAdd={canAdd ? () => setDlg("add") : undefined} />
            <Pinned room={room} />
            <SharedPatients room={room} />
            <Notifications room={room} />
          </div>
        </div>
      </MessagesInner>
      {dlg === "add" && <AddPeopleDialog room={room} onOpenChange={(o) => !o && setDlg(null)} />}
      {dlg === "new" && <NewChatDialog onOpenChange={(o) => !o && setDlg(null)} />}
    </>
  )
}

const ROLE_ORDER: StaffRole[] = ["doctor", "nurse", "reception", "claims", "billing", "admin"]

function Members({ room, onAdd }: { room: ChatRoom; onAdd?: () => void }) {
  const { t, b, locale } = useMsgText()
  const role = useMsgRole()
  const [all, setAll] = React.useState(false)
  const people = room.members.filter((k) => STAFF[k])
  const roles = ROLE_ORDER.filter((r) => people.some((k) => STAFF[k].role === r)).map((r) => t(`conv.roles.${r as "doctor"}`))
  const rolesText = roles.length > 1 ? `${roles.slice(0, -1).join(locale === "ar" ? "، " : ", ")} ${locale === "ar" ? "و" : "and "}${roles.at(-1)}` : (roles[0] ?? "")
  const shown = all ? people : people.slice(0, 4)
  const showAll = () => {
    setAll(true)
    toast.info(t("toasts.moreLoaded", { n: people.length - 4 }), { description: t("toasts.moreLoadedText") })
  }
  return (
    <MsgCard
      title={t("conv.members")}
      sub={t("conv.membersSub", { n: room.memberCount, roles: rolesText })}
      action={
        onAdd && (
          <Button variant="ghost" onClick={onAdd}>
            <Icon name="user-add" size={18} />
            {t("actions.add")}
          </Button>
        )
      }
    >
      <ul className="flex flex-col gap-3">
        {shown.map((k) => {
          const s = STAFF[k]
          const title = k === ME && msgCan(role, "admin") ? `${b(s.title)} · ${t("roles.admin").toLowerCase()}` : b(s.title)
          return (
            <li key={k} className="flex items-center gap-2.5">
              <PersonAvatar initials={s.initials} presence={s.presence} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-foreground">{b(s.name)}</span>
                <span className="text-xs text-muted-foreground">{title}</span>
              </span>
            </li>
          )
        })}
      </ul>
      {people.length > 4 && (
        <Button variant="outline" className="w-full" onClick={all ? () => setAll(false) : showAll}>
          {all ? t("conv.showLess") : t("conv.showAll", { n: room.memberCount })}
        </Button>
      )}
    </MsgCard>
  )
}

function Pinned({ room }: { room: ChatRoom }) {
  const { t, b, locale } = useMsgText()
  const posts = useChatMessages(room.id)
  const files: { name: Attachment["name"]; meta: Attachment["meta"]; icon: "calendar" | "document-text" }[] = [
    ...(room.pinned ?? []).map((p) => ({ name: p.name, meta: p.meta, icon: p.icon as "calendar" | "document-text" })),
    ...posts
      .filter((m) => m.kind === "file")
      .map((m) => (m.kind === "file" ? { name: m.file.name, meta: m.file.meta, icon: "document-text" as const } : null))
      .filter((x): x is NonNullable<typeof x> => !!x),
  ].filter((f, i, arr) => arr.findIndex((x) => x.name.en === f.name.en) === i)
  return (
    <MsgCard title={t("conv.pinned")}>
      {files.length ? (
        <ul className="flex flex-col">
          {files.map((f) => (
            <li key={f.name.en} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon name={f.icon} size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{b(f.name)}</span>
                <span className="text-xs text-muted-foreground">{b(f.meta)}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("actions.download")}
                onClick={() => void downloadFile({ name: f.name, meta: f.meta, kind: "pdf" }, b(room.name), locale, b, { title: t("toasts.pdf"), text: t("toasts.pdfText") })}
              >
                <Icon name="document-download" size={22} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("conv.pinnedNone")}</p>
      )}
    </MsgCard>
  )
}

/** Patients shared here: from the room's patient cards, in the order they were shared; only their care team opens them (logged). */
function SharedPatients({ room }: { room: ChatRoom }) {
  const { t, b, l, when } = useMsgText()
  const open = usePatientCard(room.id)
  const posts = useChatMessages(room.id)
  const list = [...(SHARED_PATIENTS[room.id] ?? []), ...posts.filter((m) => m.kind === "patient").map((m) => ({ patient: m.kind === "patient" ? m.patient : "", at: m.at }))]
    .filter((x, i, arr) => x.patient && arr.findIndex((y) => y.patient === x.patient) === i)
    .sort((a, x) => a.at.localeCompare(x.at))
  if (!room.patientsAllowed) return null
  return (
    <MsgCard title={t("conv.patients")} sub={t("conv.patientsSub")}>
      {list.length ? (
        <ul className="flex flex-col">
          {list.map((x) => {
            const p = pts[x.patient]
            return (
              <li key={x.patient} className="border-b last:border-b-0">
                <button type="button" onClick={() => open(x.patient)} className="flex w-full items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <span className="w-[140px] shrink-0 text-xs text-muted-foreground">{b(p.name)}</span>
                  <span className="min-w-0 flex-1 text-sm text-foreground">{t("conv.patientLine", { mrn: l(p.mrn), when: when(x.at) === x.at.slice(11, 16) ? t("chat.today").toLowerCase() : when(x.at) })}</span>
                  <Icon name="lock" size={16} className="shrink-0 text-muted-foreground" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t("conv.patientsNone")}</p>
      )}
    </MsgCard>
  )
}

function Notifications({ room }: { room: ChatRoom }) {
  const { t } = useMsgText()
  const n = room.notify ?? { mentionOnly: false, urgentBreaks: true }
  return (
    <MsgCard title={t("conv.notifications")}>
      <div className="flex flex-col gap-4">
        <SwitchRow label={t("conv.mentionOnly")} checked={n.mentionOnly} onChange={(v) => setRoomNotify(room.id, { ...n, mentionOnly: v })} />
        <SwitchRow label={t("conv.urgent")} checked={n.urgentBreaks} onChange={(v) => setRoomNotify(room.id, { ...n, urgentBreaks: v })} />
      </div>
    </MsgCard>
  )
}
