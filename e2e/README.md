# End-to-end tests (Playwright)

Browser tests for the screens. Chromium only, two projects: `desktop` and `mobile` (Pixel 7 width).

## Run

```bash
npm ci
npx playwright install --with-deps chromium   # once (drop --with-deps on Windows and macOS)
npm run build:e2e                             # static export into ./out, served from the site root
npm run e2e                                   # all tests, both projects
npm run e2e:ui                                # Playwright UI mode
npx playwright test e2e/smoke.spec.ts --project=desktop
npx playwright show-report                    # open the last HTML report
```

`npm run e2e` starts `npx serve out` on port 3100 (`E2E_PORT` changes it) and stops it afterwards. The app under test is the
static export (`output: "export"`, no server, no `src/proxy.ts`), the same build that goes to GitHub Pages without the base path.

To test an app that is already running (for example `npm run dev` or a staging site), set the address and no server is started:

```bash
E2E_BASE_URL=http://localhost:3000 npm run e2e
```

Failures keep a trace and a screenshot in `test-results/`; the report is in `playwright-report/`. Both are git-ignored.
Locally there are no retries; CI retries twice.

## Write a test

Add `e2e/<flow>.spec.ts`. Open pages with the locale prefix and a trailing slash (`/en/login/`).

```ts
import { expect, test } from "@playwright/test"
import en from "../messages/en/auth.json"

test("sign-in shows its title", async ({ page }) => {
  await page.goto("/en/login/")
  await expect(page.getByRole("heading", { level: 1, name: en.login.title })).toBeVisible()
})
```

## Rules

- Made-up patients and users only. No real patient data in tests, fixtures, screenshots or traces.
- Both languages. Run each check for `en` and `ar`; loop over the locales as `smoke.spec.ts` does.
- RTL. On Arabic pages check `dir="rtl"` on the `html` element, and check layout-sensitive parts where it matters.
- Take texts from `messages/en/*.json` and `messages/ar/*.json`; never hard-code a string that exists there.
- Prefer roles and labels (`getByRole`, `getByLabel`) over CSS selectors.
- Do not test flows that will change when the API replaces the mock data; test what the user sees and does.
- Never point tests at production or at an outside service.
