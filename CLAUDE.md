# dadmarkethelper — standing brief

WHAT THIS IS: A single-page web app that shows the day's biggest stock movers (gainers/losers) for a non-technical user ("dad"). It pulls from Webull's undocumented public quote API and is session-aware (pre-market / regular / after-hours / closed).

STATE: Working and deployed on Vercel (project linked in `.vercel/`, remote `MattDevOps/dadmarkethelper`). Last work (HEAD `3fcab2f`) fixed stale pre/post-market quotes and surfaced small early movers. No open TODOs in-repo; resume from feature requests.

STACK: Next.js 16.2.6 (App Router, Turbopack), React 19.2.4, TypeScript 5, Tailwind CSS v4. No DB, no auth, no env vars. Key files:
- `src/lib/session.ts` — ET clock -> session + Webull rankType + labels.
- `src/lib/webull.ts` — Webull fetchers, filters, extended-hours re-quoting, company-brief cache (24h TTL).
- `src/lib/movers-loader.ts` — orchestrates a payload; FILTERS (minPrice $35, minPct 4%, limit 25) and EXTENDED_FILTERS (minPct 0.01) live here.
- `src/app/page.tsx` (SSR, force-dynamic) renders `MoversView.tsx` (client, auto-refresh every 5 min); JSON also at `src/app/api/movers/route.ts` (`/api/movers`).

HOW TO WORK HERE:
- Build: `npm run build` (verified). Dev: `npm run dev`. Prod serve: `npm run start`.
- Test: none yet. No lint script defined (only dev/build/start in package.json).
- This is Next.js 16 with breaking changes vs older training data. Before writing framework code, read the relevant guide under `node_modules/next/dist/docs/` (see AGENTS.md).
- Webull endpoints are undocumented and unofficial; expect field/shape drift. All parsing goes through `parseFloatOr` with fallbacks — keep new parsing tolerant.
- Deploy is via Vercel (linked); do not commit `.vercel/`.

NEVER: hardcode a session/filter assumption that only holds during regular hours (pre/post market uses live re-quoting on purpose). Do not add API keys or secrets for Webull — the endpoints are keyless.

DONE = `npm run build` passes clean and the movers list renders correctly for the current session (pre / regular / after / closed) with live prices and correct gainer/loser sides.
