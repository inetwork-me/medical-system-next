/**
 * Messages routes. Inner pages live under their tab's path so the nav keeps that tab active:
 * Inbox › /messages/message?id= and /messages/new; Chat › /messages/chat/conversation?id=;
 * Patient messages › /messages/patients/conversation?id=; Partners › /messages/partners/partner?id=;
 * Mail accounts › /messages/accounts/mailbox?id=.
 */
const q = (base: string, params: Record<string, string | undefined>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v)
  const str = s.toString()
  return str ? `${base}?${str}` : base
}

export const inboxHref = (params: { box?: string; filter?: string; open?: string } = {}) => q("/messages", params)
export const threadHref = (id: string) => q("/messages/message", { id })
export const composeHref = (params: { to?: string; partner?: string; link?: string; forward?: string; draft?: string } = {}) => q("/messages/new", params)
export const chatHref = () => "/messages/chat"
export const roomHref = (id: string) => q("/messages/chat/conversation", { id })
export const patientsHref = () => "/messages/patients"
export const patientThreadHref = (id: string) => q("/messages/patients/conversation", { id })
export const partnersHref = () => "/messages/partners"
export const partnerHref = (id: string) => q("/messages/partners/partner", { id })
export const templatesHref = () => "/messages/templates"
export const accountsHref = () => "/messages/accounts"
export const mailboxHref = (id: string) => q("/messages/accounts/mailbox", { id })
