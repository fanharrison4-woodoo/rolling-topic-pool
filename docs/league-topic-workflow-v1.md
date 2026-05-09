# League and Topic Workflow — Proposed V1

## Purpose
This is the **proposed default product workflow** for PoolChain v1.

It turns the earlier draft into concrete decisions so we can build against a stable model.

---

## Core model

### League
A league is the long-lived container for one group of people.

A league has:
- a name
- a fixed stake amount
- members
- league admins
- an ordered sequence of topics
- a rolling pool across topics

### Topic
A topic is one prediction round inside a league.

A topic has:
- a title
- a description/question
- a close time
- a status
- predictions from players
- a final judged result

---

## Roles in v1

### App admin
Global role.

Can:
- change users between `league admin` and `player`
- oversee access across leagues

Cannot replace league workflow itself unless also a league admin in that league.

### League admin
League-scoped operator.

Can:
- create topics
- edit topics
- manage the order of topics
- close/judge topics
- select winners
- write resolution notes
- keep the league moving

### Player
League participant.

Can:
- join a league
- submit one prediction per open topic
- edit only their own prediction before close time
- review results

Cannot:
- edit league settings
- create/edit topics
- judge winners
- change roles

---

## Concrete v1 decisions

### 1. A league can have **multiple open topics at the same time**
Reason:
- some real-world events happen at the same time
- a World Cup round may have multiple matches with the same open/close window
- we still need a topic order so pool carryover can be applied deterministically

Rule:
- there may be many `draft` topics
- there may be many `open` topics
- there may be many `closed` topics waiting for judgment
- there may be many `settled` topics
- topics still have a strict order inside the league

Important:
- topic order is the source of truth for carryover sequencing
- open/close times may be equal across multiple topics
- settlement must still respect topic order when carryover is calculated

### 2. Signed-in users can see league/topic info before joining
Reason:
- easier onboarding
- makes “Participate / Join league” meaningful
- reduces confusion

Rule:
- viewers can read the league and topic shell
- only joined members can submit predictions

### 3. Joining a league is open in v1
Reason:
- lowest friction
- good for an internal friend-circle app

Later option:
- invite-only or admin-approved joining

### 4. Players can edit predictions until close time
Reason:
- expected behavior
- already aligned with the existing product direction

Rule:
- one prediction per player per topic
- editable until close time
- locked immediately after close time

### 5. Other players’ predictions should be **hidden while topic is open** in v1
Reason:
- reduces copycat behavior
- makes the game more interesting
- feels fairer for prediction rounds

Rule:
- while topic is `open`, a player sees only their own prediction
- after topic closes, all predictions become visible for audit/review

Note:
- admins may still need visibility for moderation/debugging, but normal player-facing UX should hide open predictions from others

### 6. Topics use these statuses in v1: `draft`, `open`, `closed`, `settled`

#### Draft
League admin can:
- create the topic
- edit the topic freely
- adjust title, description, close time, and order

Players:
- do not submit predictions yet

#### Open
League admin:
- cannot edit the topic anymore
- cannot change the meaning or timing

Players:
- can submit one prediction
- can edit only their own prediction before close time
- can view only their own prediction

#### Closed
League admin:
- can review all predictions
- can declare winners
- can move the league forward to the next topic(s)

Players:
- cannot edit predictions
- can view all predictions for that topic

#### Settled
- winners and pool outcome are finalized
- topic becomes immutable history for normal workflow purposes

### 7. Topic close time must align with topic order
Reason:
- carryover is applied by ordered topic sequence
- if topic order and close timing disagree, league progression becomes ambiguous

Rule:
- topic close times must be non-decreasing with topic order
- later topics cannot close before earlier topics
- equal close times are allowed
- equal close times are the mechanism that supports simultaneous events

Validation requirement:
- when creating or editing a topic, the app should reject any topic whose close time conflicts with its position in the league order

### 8. Settlement should require an explicit admin action
Reason:
- avoid accidental winner selection
- keep audit trail clean

Rule:
- topic moves from `closed` to `settled` only after league admin confirms settlement
- settlement includes:
  - resolution note
  - selected winners
  - payout/rollover outcome

---

## Topic lifecycle in v1

### 1. Topic is created as draft
League admin creates a topic in `draft`.

In draft:
- league admin can edit freely
- topic is not yet accepting predictions

### 2. Topic is opened
League admin changes the topic to `open`.

In open:
- players can submit one prediction
- players can edit only their own prediction until close time
- players cannot see other players’ predictions
- league admin can no longer edit the topic

Note:
- multiple topics may be open at the same time
- topic order still defines carryover sequencing

### 3. Topic closes
At close time:
- predictions lock
- no more edits allowed
- all predictions become visible to players
- topic becomes `closed`

### 4. Topic is judged
League admin:
- reviews the real-world outcome
- writes resolution note
- selects winner(s)
- confirms settlement
- moves the league forward

### 5. Topic is settled
After settlement:
- winners are visible
- payout or rollover is visible
- topic becomes part of league history

### 6. Next topic(s) continue the league
The league continues in topic order.
If multiple topics are already open, they proceed independently on timing but pool carryover still follows topic order.

---

## League admin workflow in v1

### Setup
1. Create league
2. Set fixed stake
3. Become initial league admin
4. Create first topic

### Ongoing cycle
1. Create draft topics in order
2. Validate that close times align with topic order
3. Open one or more topics when appropriate
4. Monitor submissions
5. Wait for close time
6. Judge closed topics
7. Confirm winners and settlement in topic order
8. Move the league forward
9. Repeat

### Admin guardrails
League admin should not:
- change topic meaning after players have already submitted
- judge casually without a resolution note
- leave a closed topic unresolved for too long

---

## Player workflow in v1

1. Sign in
2. View league
3. Join / participate
4. View currently open topic(s)
5. Submit prediction for any open topic
6. Edit own prediction before close if needed
7. Wait for close
8. Review all predictions once closed
9. Review settled result
10. See payout or rollover
11. Return for next topic(s)

---

## Visibility model in v1

### Signed-in viewer, not joined
Can see:
- league name
- open/closed topic shell
- topic history shell
- join button

Cannot:
- submit prediction
- manage anything

### Player while topic is open
Can see:
- topic prompt
- own prediction
- close time
- pool info

Cannot see:
- other players’ open predictions

### Everyone after topic is closed
Can see:
- all predictions for that topic

### Everyone after topic is settled
Can see:
- all predictions
- resolution note
- winners
- payout / rollover math

---

## Pool logic in v1

For every topic:
- each participating player contributes the fixed stake
- total pool = prior carryover + current round contributions

If there are winners:
- total pool is split evenly among winners
- next topic carryover = 0

If there are no winners:
- payout = 0
- next topic carryover = full total pool

---

## Operational rules to build against

### Topic rules
- one league has many topics
- one topic belongs to one league
- one player has at most one prediction per topic
- one league may have multiple open topics at a time
- topic close times must be non-decreasing with topic order

### Permission rules
- app admin manages league roles
- league admin manages league workflow
- player participates only

### Data integrity rules
- predictions lock at close time
- settlement is explicit
- settled topics become auditable history

---

## Recommended implementation order from this workflow

1. reliable sign-in
2. join league
3. create topic as league admin
4. support topic draft/open/closed/settled lifecycle
5. validate close-time alignment with topic order
6. hide others’ predictions while open
7. submit/edit own prediction
8. auto-lock at close time
9. reveal predictions when closed
10. admin settlement flow
11. payout math by topic order

---

## Things to review
These are the highest-value product choices to confirm:

1. **Hide other players’ predictions while topic is open**
   - current proposal: yes

2. **Allow multiple open topics at the same time**
   - current proposal: yes
   - with carryover still applied by topic order

3. **Open joining in v1**
   - current proposal: yes

4. **Open topics are not editable by league admin**
   - current proposal: yes

5. **Require explicit admin settlement confirmation**
   - current proposal: yes
