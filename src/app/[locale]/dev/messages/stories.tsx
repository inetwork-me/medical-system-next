"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CHAT_ROOMS, MAILBOXES, PATIENT_THREADS, STAFF, THREADS } from "@/modules/messages/data"
import {
  AccessBadge,
  BrandMark,
  ChannelChip,
  ChannelIcon,
  ConnectionBadge,
  CountPill,
  DeliveryBadge,
  GrantChip,
  IconTile,
  LogoTile,
  MiniChip,
  PartnerTypeChip,
  PersonAvatar,
  PresenceDot,
  TagChip,
  ThreadStatusBadge,
  useMsgText,
} from "@/modules/messages/parts"
import { MSG_ROLES, MSG_TABS, msgCan, msgTabs, type MsgAction } from "@/modules/messages/roles"
import { canOpenThread, levelIn, mailboxesOf } from "@/modules/messages/rules"
import { setMsgRole, useMsgCounts, useMsgRole } from "@/modules/messages/store"
import type { StaffKey } from "@/modules/messages/types"

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

const ACTIONS: MsgAction[] = ["patientMessages", "admin", "logs", "templates", "personalMailbox"]
const PEOPLE: StaffKey[] = ["khaled", "sami", "amal", "rawan", "nora"]

export function MessagesStories() {
  const { b, t, when, stamp, l } = useMsgText()
  const role = useMsgRole()
  const counts = useMsgCounts()

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Box title="Status badges · access · delivery · thread status · connection">
        <div className="flex flex-wrap gap-2">
          <AccessBadge level="manage" />
          <AccessBadge level="sendAs" />
          <AccessBadge level="reply" />
          <AccessBadge level="read" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeliveryBadge state="replied" needsAction female />
          <DeliveryBadge state="read" />
          <DeliveryBadge state="failed" />
          <span className="text-xs text-muted-foreground">(delivered, sent and handled replies: no badge)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ThreadStatusBadge status="waitingUs" />
          <ThreadStatusBadge status="waitingThem" />
          <ThreadStatusBadge status="closed" />
        </div>
        <div className="flex flex-wrap gap-2">
          <ConnectionBadge status="connected" />
          <ConnectionBadge status="notConnected" />
          <ConnectionBadge status="allowed" />
          <ConnectionBadge status="error" />
        </div>
      </Box>

      <Box title="Chips · partner type · channels · grants · mini chips">
        <div className="flex flex-wrap gap-2">
          <PartnerTypeChip type="insurer" />
          <PartnerTypeChip type="lab" />
          <PartnerTypeChip type="hospital" />
          <PartnerTypeChip type="supplier" />
          <PartnerTypeChip type="government" />
        </div>
        <div className="flex flex-wrap gap-2">
          <ChannelChip channel="sms" />
          <ChannelChip channel="whatsapp" />
          <ChannelChip channel="email" />
          <ChannelChip channel="chat" />
          <ChannelIcon channel="whatsapp" />
          <ChannelIcon channel="sms" />
        </div>
        <div className="flex flex-wrap gap-2">
          <GrantChip grant="role" managed />
          <GrantChip grant="role" />
          <GrantChip grant="branch" />
          <GrantChip grant="named" />
        </div>
        <div className="flex flex-wrap gap-2">
          <MiniChip icon="direct-inbox">{l("cardiology@")}</MiniChip>
          <MiniChip icon="user-tag" tone="warning">
            {t("chips.assignedYou")}
          </MiniChip>
          <MiniChip icon="link-2" tone="primary">
            {b({ en: "Fahad · MRN-17654", ar: "فهد · MRN-17654" })}
          </MiniChip>
          <MiniChip icon="buildings" tone="info">
            {t("chips.partner", { name: b({ en: "Bupa Arabia", ar: "بوبا العربية" }) })}
          </MiniChip>
          <MiniChip icon="paperclip-2">{t("chips.files", { n: 1 })}</MiniChip>
          <MiniChip icon="lock">{t("chips.locked")}</MiniChip>
          <TagChip tone="primary">{"{first_name}"}</TagChip>
          <CountPill n={3} />
        </div>
      </Box>

      <Box title="Tiles · logos · provider marks · avatars · presence">
        <div className="flex flex-wrap items-center gap-3">
          <LogoTile initials="BU" tone="info" />
          <LogoTile initials="KF" tone="accent" size={36} />
          <LogoTile initials="AB" tone="success" size={40} />
          <LogoTile initials="GM" tone="warning" size={44} />
          <LogoTile initials="BU" tone="info" size={56} />
          <LogoTile initials="MO" tone="muted" />
          <IconTile icon="hashtag" />
          <IconTile icon="notification" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BrandMark kind="m365" />
          <BrandMark kind="google" />
          <BrandMark kind="people" />
          <BrandMark kind="whatsapp" />
          <BrandMark kind="sms" />
          <PersonAvatar initials="SA" presence="online" />
          <PersonAvatar initials="AM" presence="away" />
          <PersonAvatar initials="RM" size="default" />
          <PresenceDot presence="online" />
          <PresenceDot presence="away" />
        </div>
      </Box>

      <Box title="Time + Arabic isolation (demo clock Wed 25 Nov 2026 11:00)">
        <ul className="flex flex-col gap-1 text-sm">
          {THREADS.slice(0, 6).map((x) => (
            <li key={x.id} className="flex justify-between gap-4">
              <span className="truncate">{b(x.subject)}</span>
              <span className="shrink-0 text-muted-foreground">
                {when(x.lastAt)} · {stamp(x.lastAt)}
              </span>
            </li>
          ))}
          <li>{b({ en: "From cardiology@alnoor.sa · to Sara Al-Ghamdi", ar: "من cardiology@alnoor.sa · لسارة الغامدي" })}</li>
          <li>{b({ en: "Approval PA-88213 is valid for 30 days.", ar: "الموافقة صالحة 30 يوم · PA-88213" })}</li>
        </ul>
      </Box>

      <Box title="Counts from the data (tabs · nav)" className="lg:col-span-2">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            Inbox unread <b>{counts.inbox.unread}</b> · mine <b>{counts.inbox.mine}</b> · mailboxes <b>{counts.inbox.mailboxes}</b>
            <div className="text-muted-foreground" dir="ltr">
              by mailbox: {Object.entries(counts.inbox.byBox).map(([k, v]) => `${k} ${v}`).join(" · ")}
            </div>
          </div>
          <div>
            Chat unread <b>{counts.chat}</b>
            <div className="text-muted-foreground" dir="ltr">
              {CHAT_ROOMS.filter((r) => r.unread).map((r) => `${r.name.en} ${r.unread}`).join(" · ")}
            </div>
          </div>
          <div>
            Patient replies <b>{counts.patients.replies}</b> · failed <b>{counts.patients.failed}</b>
            <div className="text-muted-foreground">{PATIENT_THREADS.length} conversations</div>
          </div>
        </div>
      </Box>

      <Box title="Role → tabs and actions (dev only: the demo role)" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          {MSG_ROLES.map((r) => (
            <Button key={r} size="sm" variant={r === role ? "default" : "outline"} onClick={() => setMsgRole(r)}>
              {t(`roles.${r}`)}
            </Button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-muted-foreground">
                <th className="py-1 text-start font-medium">Role</th>
                {MSG_TABS.map((x) => (
                  <th key={x} className="py-1 text-start font-mono text-xs font-medium">
                    {x}
                  </th>
                ))}
                {ACTIONS.map((a) => (
                  <th key={a} className="py-1 text-start font-mono text-xs font-medium">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MSG_ROLES.map((r) => (
                <tr key={r} className={cn("border-t", r === role && "bg-accent")}>
                  <td className="py-1">{t(`roles.${r}`)}</td>
                  {MSG_TABS.map((x) => (
                    <td key={x}>{msgTabs(r).includes(x) ? "✓" : "–"}</td>
                  ))}
                  {ACTIONS.map((a) => (
                    <td key={a}>{msgCan(r, a) ? "✓" : "–"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      <Box title="Who can open what (mailbox access × care team)" className="lg:col-span-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-start font-medium">Thread</th>
                {PEOPLE.map((p) => (
                  <th key={p} className="py-1 text-start font-medium">
                    {b(STAFF[p].name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {THREADS.map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="py-1">
                    <div className="truncate">{b(x.subject)}</div>
                    <div className="text-xs text-muted-foreground">{l(MAILBOXES.find((m) => m.id === x.mailbox)!.short)}</div>
                  </td>
                  {PEOPLE.map((p) => {
                    const box = MAILBOXES.find((m) => m.id === x.mailbox)!
                    const level = levelIn(box, p)
                    return (
                      <td key={p} className="py-1">
                        {canOpenThread(x, p) ? "✓" : "–"}
                        {level && <span className="ms-1 text-xs text-muted-foreground">({t(`access.${level}`)})</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground" dir="ltr">
          Mailboxes per person: {PEOPLE.map((p) => `${p} ${mailboxesOf(p).length}`).join(" · ")}
        </p>
      </Box>
    </div>
  )
}
