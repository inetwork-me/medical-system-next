import { SESSION_USER } from "@/lib/mock/shell"
import { USERS, type UserKey } from "./data"

/*
 * Who is signed in, as Medical records sees it: "my notes", "your own" chart items, who signs, who broke the glass.
 * Matched by the session's e-mail against the center's users; when the auth API lands, replace sessionEmail().
 */
const sessionEmail = () => SESSION_USER.email

export function currentUserKey(): UserKey | undefined {
  const email = sessionEmail().toLowerCase()
  return (Object.keys(USERS) as UserKey[]).find((k) => (USERS[k] as { email?: string }).email?.toLowerCase() === email)
}

/** The signed-in doctor (demo: Dr. Khaled Mansour). */
export const ME: UserKey = currentUserKey() ?? "khaled"
