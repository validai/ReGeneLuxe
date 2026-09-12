# ReGeneLuxe

ReGeneLuxe is a private local-first social media manager with a Campaign Brain.

It is for one operator to connect accounts, create and schedule content, run campaigns, and iterate from real results. It is not a SaaS product, marketplace, or sales funnel.

## Local install

```bash
cd regeneluxe-web
npm install
```

## Local run

```bash
npm run dev
```

Canonical UI + API: **`http://127.0.0.1:5174/`**

Next.js App Router serves the UI and `/api` on the same port. No separate API process.

Verify before browser testing:

```bash
curl -sS http://127.0.0.1:5174/api/health | python3 -m json.tool
```

Expect `app: "ReGeneLuxe"`, `framework: "next"`, and `canonicalUiUrl: "http://127.0.0.1:5174"`.

Do **not** use ports `5175`, `3200`, or a standalone `8787` for product verification.

## Build / quality

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

Production serve (after build):

```bash
npm start
```

## What it does

- **Dashboard** (`/`) — what needs attention now
- **Calendar** (`/calendar`) — scheduled and published posts
- **Queue** (`/queue`) — publish jobs with honest manual fallback
- **Content** (`/content`) — ideas, drafts, composer, platform variants
- **Campaigns** (`/campaigns`) — active work; workspace opens on Overview
- **Inbox** (`/inbox`) — comments and messages when a connection can provide them
- **Analytics** (`/analytics`) — recorded snapshots only
- **Accounts** (`/accounts`) — social profiles and connection state
- **Settings** (`/settings`) — theme, Campaign Brain mode, local runtime key, backup

Campaign workspace tabs: Overview · Strategy · Content · Calendar · Analytics · Results.

Strategy holds structured Intake and Blueprint. Campaign Brain can build plans from strategy, propose iteration, and coordinate channels using recorded evidence only.

Accounts start as manual. Connection states and connector capabilities are declared, but ReGeneLuxe never shows Connected, Published, Inbox, or analytics unless backed by a real connection, manual record, or configured AI runtime.

## Local storage

All operator data stays in this browser's `localStorage` (campaigns, accounts, content, queue, analytics, decisions, settings). Existing records migrate on load. Export/import lives under Settings.

## Architecture note

Product runtime is **Next.js 16 + React 19 + TypeScript**. Vite remains only as the Vitest test runner, not as an application server.
