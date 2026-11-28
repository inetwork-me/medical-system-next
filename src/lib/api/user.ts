import { api } from "./client.ts"
import type { CurrentUser } from "./types.ts"

/** Who is signed in, their roles and permissions, the tenant and the working branch. */
export const getCurrentUser = (signal?: AbortSignal) => api.get<CurrentUser>("/api/user", { signal })
