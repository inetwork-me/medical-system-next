// Static build for the Playwright tests: the same as `npm run build:pages` but served from the site root (no base path),
// so the tests open /en/login/ on a local static server.
process.env.NEXT_PUBLIC_BASE_PATH = ""
await import("./build-pages.mjs")
