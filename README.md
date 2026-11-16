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
