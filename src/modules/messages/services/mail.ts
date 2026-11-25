import type { Provider } from "../types"

/**
 * Mail provider interface (brief §4 · Mail connections). The app talks to every provider through this; the real
 * implementations live on the server:
 * - Microsoft Graph (Microsoft 365 / Outlook.com) and the Gmail API (Google Workspace / Gmail), both by OAuth. Org-wide
 *   connections use admin consent, personal ones the user's consent. Tokens are stored encrypted on the server — the app
 *   never sees or keeps a password.
 * - IMAP / SMTP for other providers, with an app password the server stores encrypted.
 * Sync is push where possible (Graph change notifications, Gmail watch) and otherwise polled every minute. Disconnecting
 * stops sync; mail already stored is kept for the retention period.
 *
 * The stubs below answer like the providers would for the demo: Google Workspace at Al Noor Jeddah has 38 mailboxes.
 */
export type ConnectScope = "org" | "personal"

export type Discovery = {
  /** The account that will sign in (admin for org, the user for personal). */
  account: string
  domain: string
  mailboxes: number
}

export type Consent = Discovery & { tokenRef: string; sync: "push" | "poll"; connectedAt: string }

export type ImapLogin = { email: string; server: string; appPassword: string }

export interface MailProvider {
  provider: Provider
  /** What the provider will connect before the user signs in (tenant / domain lookup). */
  discover(scope: ConnectScope, me: { email: string }): Promise<Discovery>
  /**
   * OAuth: opens the provider's own sign-in page and returns once consent is granted (the server swaps the code for
   * tokens and stores them encrypted). IMAP: checks the login and stores the app password encrypted.
   */
  connect(scope: ConnectScope, me: { email: string }, login?: ImapLogin): Promise<Consent>
  /** Starts a sync now (webhook already pushes new mail; this pulls anything missed). */
  syncNow(mailbox: string): Promise<{ startedAt: string }>
  /** Shared mailbox created in the tenant too (Microsoft 365: Exchange shared mailbox). */
  createShared(address: string, displayName: string): Promise<{ id: string }>
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const token = (p: string) => `kv://mail/${p}/${Math.random().toString(36).slice(2, 10)}`

function personal(provider: Provider, me: { email: string }): Discovery {
  const local = me.email.split("@")[0]
  return { account: provider === "google" ? `${local}@gmail.com` : `${local}@outlook.com`, domain: provider === "google" ? "gmail.com" : "outlook.com", mailboxes: 1 }
}

export const graphStub: MailProvider = {
  provider: "m365",
  async discover(scope, me) {
    await wait(150)
    return scope === "org" ? { account: "admin@alnoor.sa", domain: "alnoor.sa", mailboxes: 142 } : personal("m365", me)
  },
  async connect(scope, me) {
    const d = await this.discover(scope, me)
    await wait(700)
    return { ...d, tokenRef: token("m365"), sync: "push", connectedAt: new Date().toISOString() }
  },
  async syncNow() {
    await wait(300)
    return { startedAt: new Date().toISOString() }
  },
  async createShared(address) {
    await wait(400)
    return { id: `exo-${address}` }
  },
}

export const gmailStub: MailProvider = {
  provider: "google",
  async discover(scope, me) {
    await wait(150)
    return scope === "org" ? { account: "admin@alnoor-jeddah.sa", domain: "alnoor-jeddah.sa", mailboxes: 38 } : personal("google", me)
  },
  async connect(scope, me) {
    const d = await this.discover(scope, me)
    await wait(700)
    return { ...d, tokenRef: token("google"), sync: "push", connectedAt: new Date().toISOString() }
  },
  async syncNow() {
    await wait(300)
    return { startedAt: new Date().toISOString() }
  },
  async createShared(address) {
    await wait(400)
    return { id: `gws-${address}` }
  },
}

/** IMAP / SMTP: polled every minute. The stub refuses the app password "0000" (wrong password). */
export const imapStub: MailProvider = {
  provider: "imap",
  async discover(_scope, me) {
    await wait(100)
    return { account: me.email, domain: me.email.split("@")[1] ?? "", mailboxes: 1 }
  },
  async connect(_scope, me, login) {
    await wait(700)
    if (!login || login.appPassword === "0000") throw new Error("auth")
    return { account: login.email, domain: login.email.split("@")[1] ?? "", mailboxes: 1, tokenRef: token("imap"), sync: "poll", connectedAt: new Date().toISOString() }
  },
  async syncNow() {
    await wait(300)
    return { startedAt: new Date().toISOString() }
  },
  async createShared() {
    throw new Error("unsupported")
  },
}

export const mailProvider = (p: Provider): MailProvider => (p === "m365" ? graphStub : p === "google" ? gmailStub : imapStub)
