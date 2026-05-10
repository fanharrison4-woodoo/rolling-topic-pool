# PoolChain MVP plan

## Product summary

PoolChain is a private, friends-only prediction pool app with a rolling jackpot.

- Topics are ordered in a sequence.
- Every player owes the same fixed stake for every topic.
- Players can edit their prediction until close time.
- Admin resolves the topic manually.
- Winners split the entire pool.
- No winners means the pool rolls forward.

## Roles

### Admin

- manage league settings
- manage players
- create/edit/reorder topics
- resolve topics
- select winners
- write resolution notes
- trigger announcements later

### Player

- sign in
- view topics and pool state
- submit/edit prediction before close time
- review results and history

## MVP pages

### 1. Dashboard

Purpose:
- show current pool
- show next/current topic
- show player’s own prediction status
- show quick settlement math

### 2. Topics page

Purpose:
- list all topics in order
- show status: upcoming / open / closed / settled
- show close time
- show contribution / pool information

### 3. Topic detail page

Purpose:
- show topic title and description
- show close time
- show all predictions after lock
- show player’s own prediction before lock
- show settlement details after resolution

### 4. Prediction form

Purpose:
- create or update a prediction
- enforce close-time locking
- show last-updated timestamp

### 5. Admin resolution page

Purpose:
- review all locked predictions
- add resolution note
- select winners
- preview payout split
- settle topic

### 6. History page

Purpose:
- browse settled topics
- inspect predictions
- inspect payout / rollover math
- inspect audit trail

## Data model draft

### users

- id
- email
- display_name
- created_at

### leagues

- id
- name
- stake_amount
- currency
- created_by
- created_at

### league_members

- id
- league_id
- user_id
- role (`admin`, `player`)
- joined_at
- is_active

### topics

- id
- league_id
- order_index
- title
- description
- status (`upcoming`, `open`, `closed`, `settled`)
- open_at
- close_at
- created_by
- created_at
- updated_at

### predictions

- id
- topic_id
- user_id
- prediction_text
- created_at
- updated_at
- locked_snapshot_at (optional)

Constraint:
- unique `(topic_id, user_id)`

### settlements

- id
- topic_id
- previous_pool_amount
- contribution_amount
- total_pool_amount
- winner_count
- payout_per_winner
- next_pool_amount
- resolution_note
- settled_by
- settled_at

### settlement_winners

- id
- settlement_id
- user_id

### announcement_logs

- id
- topic_id
- channel_type
- channel_target
- payload_summary
- sent_at
- sent_by

## Settlement flow

1. Topic reaches close time
2. Predictions become locked
3. Admin reviews all predictions
4. Admin writes resolution note
5. Admin selects zero or more winners
6. App computes:
   - `contribution_amount = stake_amount * active_player_count`
   - `total_pool_amount = previous_pool_amount + contribution_amount`
   - if `winner_count > 0`
     - `payout_per_winner = total_pool_amount / winner_count`
     - `next_pool_amount = 0`
   - else
     - `payout_per_winner = 0`
     - `next_pool_amount = total_pool_amount`
7. Settlement is saved to audit history
8. Optional announcement is sent later

## Product decisions already made

- generic free-form topics, not sports-only
- manual winner selection by admin
- fixed stake for every player on every topic
- predictions editable before close time
- full audit visibility after close / settlement
- notifications can come later

## Recommended implementation phases

### Phase 1 — mock prototype
- build UI with in-memory data
- validate workflow and wording

### Phase 2 — Supabase foundation
- add auth
- create schema
- add row-level security
- wire reads/writes

### Phase 3 — admin settlement
- real topic CRUD
- real prediction updates
- settlement persistence
- history pages

### Phase 4 — deploy
- GitHub
- Vercel
- Supabase env vars
- smoke test

### Phase 5 — polish
- announcement integrations
- invite flow
- commit SHA in footer
- hide others’ predictions before lock if desired

### Phase 6 — E2E testing
- Add Playwright against a dedicated test Supabase project
- Cover the core player loop: sign in → join league → submit prediction → view locked predictions after close
- Cover the admin loop: create topic → open → close → settle with winners → verify carryover math
- Cover role enforcement: player cannot access admin actions, unauthenticated visitor sees sign-in prompt

---

## UI feedback backlog (Phase 3 follow-up)

These were captured after first live deployment.

### UI-1 — Auth to top-right account button
Move auth status out of the page body. Add a sticky header with a top-right account button. Signed-in: avatar/initials opens a dropdown with email and sign-out. Signed-out: "Sign in" button opens a dropdown with the Google + magic-link form.

### UI-2 — Remove all mock/fake data
All pages currently fall back to hardcoded mock data when the user is not signed in. This confuses testing. Remove mock fallbacks from every page and component. Show a "sign in to continue" placeholder instead for unauthenticated visitors.

### UI-3 — Mobile-friendly layout
Ensure all pages are usable on mobile: single-column content, touch-friendly tap targets, sticky header that works at small widths.

### UI-4 — Fix top-level navigation visibility
The site nav links are not legible (reported as white-on-white). Fix by redesigning as part of the new sticky header (UI-1). Clear background, dark text, legible in all contexts.

### UI-5 — Single-column page layout
All pages should be one column (max-width ~2xl, centered). Remove the multi-column aside layout from the home page and other pages.
