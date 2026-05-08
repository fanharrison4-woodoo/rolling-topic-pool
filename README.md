# PoolChain

PoolChain is a lightweight friends-only rolling pool betting app.

Instead of building a full sportsbook, the app focuses on a simple social format:

- one league
- one ordered series of topics
- one fixed stake per player per topic
- one rolling pool that carries forward until somebody wins

The initial MVP is intentionally generic. Topics can be anything: sports, product launches, elections, awards, markets, or group jokes.

## Core rules

For each topic in the ordered list:

- every player owes the fixed stake amount
- every player can submit one prediction
- players can edit their own prediction until the close time
- after close time, predictions are locked
- admin manually resolves the outcome and selects winner(s)
- if at least one winner exists, the full pool is split evenly and the next topic starts at zero
- if no winner exists, the full pool rolls to the next topic

## Transparency model

This project is meant to be public so league members can inspect how the app works.

The app should make these details visible:

- exact topic wording
- close time
- every player’s submitted prediction
- created and updated timestamps
- admin resolution note
- selected winners
- pool math for every topic

Open source improves trust, but it does not prove the deployed site matches the repo by itself. Later we should show the deployed commit SHA in the UI footer.

## MVP scope

### Player features

- sign in
- view current pool and next topic
- submit/edit prediction before close time
- review locked predictions after close time
- review past results and payouts

### Admin features

- create and order topics
- edit topic title, description, and close time
- lock/close topics automatically by time
- manually resolve a topic
- mark winner(s)
- add a resolution note
- trigger an announcement later

### Out of scope for v1

- payments or wallet integration
- real-money settlement automation
- odds
- multiple leagues
- advanced notification routing
- anti-cheat beyond timestamps, locking, and visibility

## Suggested stack

- **Frontend:** Next.js + TypeScript + Tailwind
- **Backend:** Supabase (Auth + Postgres)
- **Hosting:** Vercel
- **Code hosting:** GitHub public repo

## Local development

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Current state of this repo

Right now the app is a UI prototype with mock data. It demonstrates:

- league dashboard
- rolling pool math
- ordered topic list
- player prediction editing mock
- admin settlement flow mock
- audit/history views

The next step is wiring the app to Supabase.

## Planned data model

Core entities:

- `users`
- `league_members`
- `leagues`
- `topics`
- `predictions`
- `settlements`
- `announcement_logs`

A fuller draft is in [`docs/plan.md`](docs/plan.md).

## Deployment plan

1. Create a public GitHub repo
2. Push this project
3. Create a Supabase project
4. Add schema + auth + row-level policies
5. Create a Vercel project linked to the repo
6. Set environment variables in Vercel
7. Deploy and test end-to-end

## What still needs Harrison

Account-bound steps are listed in [`NEXT_STEPS.md`](NEXT_STEPS.md).
