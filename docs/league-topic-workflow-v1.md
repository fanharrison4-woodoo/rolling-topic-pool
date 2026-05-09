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

### 1. A league can have many topics, but only **one open topic at a time**
Reason:
- keeps the product simple
- makes the active round obvious
- keeps pool math straightforward

Rule:
- there may be many `upcoming` topics
- there may be many `settled` topics
- there may be at most one `open` topic
- there may be at most one `closed` topic waiting for judgment if we keep transitions tidy

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

### 6. Topic editing should be restricted once predictions exist
Reason:
- avoids changing the game after people already committed

Rule:
- league admin can freely edit a topic before predictions exist
- after predictions exist, only minor edits should be allowed in principle
- in v1, simplest rule is:
  - if any prediction exists, editing the meaning-critical fields should be blocked

Meaning-critical fields:
- title
- description/question
- close time

### 7. Settlement should require an explicit admin action
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

### 1. Topic is created
League admin creates a topic.

Possible initial states:
- `upcoming` if another topic is already open
- `open` if there is no active open topic

### 2. Topic is open
Players can:
- view the prompt
- submit one prediction
- edit their own prediction until close time

Players cannot:
- see other players’ predictions yet

### 3. Topic closes
At close time:
- predictions lock
- no more edits allowed
- topic becomes `closed`

### 4. Topic is judged
League admin:
- reviews the real-world outcome
- writes resolution note
- selects winner(s)
- confirms settlement

### 5. Topic is settled
After settlement:
- all predictions are visible
- winners are visible
- payout or rollover is visible
- topic becomes part of league history

### 6. Next topic becomes active
League admin opens or prepares the next topic.

---

## League admin workflow in v1

### Setup
1. Create league
2. Set fixed stake
3. Become initial league admin
4. Create first topic

### Ongoing cycle
1. Keep exactly one active open topic
2. Create future topics as upcoming
3. Monitor submissions
4. Wait for close time
5. Judge the closed topic
6. Confirm winners and settlement
7. Move the league to the next topic
8. Repeat

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
4. Open active topic
5. Submit prediction
6. Edit prediction before close if needed
7. Wait for close
8. Review settled result
9. See payout or rollover
10. Return for next topic

---

## Visibility model in v1

### Signed-in viewer, not joined
Can see:
- league name
- active topic
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
- one league has at most one open topic at a time

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
4. hide others’ predictions while open
5. submit/edit own prediction
6. auto-lock at close time
7. admin settlement flow
8. reveal predictions + payout math after settlement
9. topic editing restrictions after submissions exist

---

## Things to review
These are the highest-value product choices to confirm:

1. **Hide other players’ predictions while topic is open**
   - current proposal: yes

2. **Exactly one open topic at a time**
   - current proposal: yes

3. **Open joining in v1**
   - current proposal: yes

4. **Block topic edits after any prediction exists**
   - current proposal: yes

5. **Require explicit admin settlement confirmation**
   - current proposal: yes
