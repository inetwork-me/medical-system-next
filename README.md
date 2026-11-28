# Medical System · web

Bilingual (English / Arabic, full RTL) clinic management front-end, built from the FigCraft design
`Medical System.figcraft` (read-only source of truth) and the brief `../CODE_CHAT_START.md`.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (new-york, slate, RTL) · next-intl · Iconsax (`iconsax-reactjs`) · Recharts · TanStack Table.

```bash
npm install
npm run dev -- -p 3200   # http://localhost:3200/en  ·  /ar
```

- Tokens: `src/app/globals.css` (from `../design-tokens.css`).
- Copy: `messages/{en,ar}/<namespace>.json`. Arabic is Saudi conversational tone, taken from the design scripts.
- Icons: `<Icon name="…">` in `src/components/ds/icon.tsx` uses the file's icon names.
- Dev token sheet: `/en/dev/tokens` (dev only).

## Talking to the API

- One client: `src/lib/api` (`api` for signed-in calls, `publicApi` for sign-in). It calls same-origin `/api/...` and never holds a token: the API sets an httpOnly cookie, `his_session`.
- `src/proxy.ts` forwards `/api/*` to the API, sets the tenant from the first label of the address (`demo.localhost:3010` is tenant `demo`), and checks the signed cookie before a page loads.
- Server settings (see `.env.example`; real values go in your own `.env.local`, never in git): `HIS_API_URL`, `HIS_SESSION_COOKIE_KEY` (same value as on the API), `HIS_AUTH_MODE` (`api` by default, or `mock` to work without the API). On Windows point `HIS_API_URL` at `http://127.0.0.1:8010`, not `localhost` (IPv6 is tried first and adds about 220 ms per request).
- The static export (`npm run build:pages`) has no server: it keeps the mock sign-in and sample user.
- Checks: `npm run test:unit` (cookie verifier, tenant rule, client errors), `npm run check:server` (after `npm run build`: headers, route protection and the proxy, against a fake API).
