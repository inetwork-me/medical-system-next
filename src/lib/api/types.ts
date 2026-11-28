/** Shapes of the API replies the app shell needs (docs/api/auth.md in the API repo). */
export type ApiBranch = { id: number; code: string; name_en: string; name_ar: string }

export type ApiTenant = { id: string; name: string; subdomain: string; enabled_modules: string[] }

export type ApiUser = { id: number; name: string; email: string | null; roles: string[]; permissions: string[] }

/** GET /api/user */
export type CurrentUser = { user: ApiUser; tenant: ApiTenant; branch: ApiBranch | null }
