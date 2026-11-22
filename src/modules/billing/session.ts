import { SESSION_USER } from "@/lib/mock/shell"
import { CENTER, STAFF, type BillUser, type StaffKey } from "./data"

/*
 * Who is signed in, as Billing sees it. Every "you" in the module — "Waiting for you", "CEO · you", "Your turn",
 * whose national ID goes to Nafath, who recorded a payment or uploaded a paper — comes from here, matched by the
 * session's e-mail against the center's users. When the auth API lands, replace `sessionEmail()` with the signed-in
 * user from the session (and STAFF with the users table); nothing else changes.
 */

const sessionEmail = () => SESSION_USER.email

/** The signed-in user's record, or undefined when the session isn't one of the center's users. */
export function currentUser(): (BillUser & { key: StaffKey }) | undefined {
  const email = sessionEmail().toLowerCase()
  const key = (Object.keys(STAFF) as StaffKey[]).find((k) => STAFF[k].email?.toLowerCase() === email)
  return key ? { ...STAFF[key], key } : undefined
}

export const currentUserId = () => currentUser()?.id

/** Hook form (components); same source as currentUser(). */
export function useBillUser() {
  return currentUser()
}

/** The signatory a new contract routes to: the signed-in user when they're an authorized signatory, else the center's. */
export function signatoryFor(): StaffKey {
  const me = currentUser()
  return me?.signatory ? me.key : CENTER.signatory
}
