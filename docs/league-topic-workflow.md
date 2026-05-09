# League and Topic Workflow

## Goal
Clarify how a league works over time through its topics, from the perspective of:
- league admins
- players

This is a product workflow document, not an implementation spec.

---

## Core concepts

### League
A league is the long-lived container for a friend group.

A league contains:
- members
- roles
- shared stake amount
- an ordered list of topics
- a rolling pool that carries from topic to topic

### Topic
A topic is one prediction round within a league.

A topic has:
- title
- description / question
- open / close timing
- status
- predictions from players
- a final judged outcome

### Pool behavior
For each topic:
- every participating player contributes the fixed stake
- if at least one player wins, the full pool is split among winners
- if nobody wins, the full pool rolls into the next topic

---

## Roles in the workflow

### League admin
League admins run the league.

They can:
- create and manage topics
- decide timing
- close/judge topics
- select winners
- keep the workflow moving

### Player
Players participate in the league.

They can:
- join the league
- view topics
- submit predictions
- edit only their own prediction before close
- review outcomes after judgment

---

## Lifecycle of a league

## 1. League setup

### League admin
- creates the league
- sets the stake amount
- invites or allows players to join
- creates the first topic

### Players
- sign in
- join / participate in the league
- wait for open topics to submit predictions

---

## 2. Topic creation

A league is expected to have an ordered sequence of topics.

### League admin
- creates a topic
- writes the question/title/description
- sets the close time
- places it in the sequence
- decides whether it is the active open topic or an upcoming future topic

### Players
- can view the topic
- understand what prediction is being asked
- know when submissions close

---

## 3. Topic is open

This is the active participation phase.

### League admin
- monitors participation
- may clarify wording if needed before the topic is finalized
- generally should avoid changing the meaning once players start predicting

### Players
- submit one prediction for the open topic
- edit their own prediction before close time
- can see their own saved state
- may or may not see others’ predictions depending on product settings

Key rule:
- each player gets one prediction per topic
- only that player can edit it
- edits stop at close time

---

## 4. Topic closes

When close time passes, prediction entry stops.

### League admin
- can no longer expect prediction changes
- prepares to review the real-world outcome

### Players
- can no longer edit predictions
- can wait for judgment/result

Key rule:
- after close time, predictions are locked

---

## 5. Topic judgment / settlement

This is the admin decision phase.

### League admin
- reviews the real-world result
- writes a resolution note if needed
- selects winner(s)
- confirms the topic outcome
- finalizes settlement

### Players
- review the judged outcome
- see whether they won
- see the payout or rollover result

Key rule:
- winner selection is an admin action
- players do not judge their own outcomes

---

## 6. Pool resolution

After the topic is judged:

### If there are winners
- total pool is split across all winners
- next topic starts with no carryover

### If there are no winners
- total pool rolls forward
- next topic inherits that carryover

### League admin
- confirms the result is recorded
- moves the league forward to the next topic

### Players
- can inspect the math and outcome

---

## 7. Move to next topic

A league continues through topics one by one.

### League admin
- ensures there is always a sensible next topic
- opens the next topic when appropriate
- keeps the ordered sequence coherent

### Players
- return for the next round
- repeat the submit → lock → wait → review cycle

---

## Topic statuses

Suggested meaning of statuses:

### Upcoming
- created but not active yet
- not accepting predictions yet

### Open
- active topic
- players can submit/edit predictions until close time

### Closed
- prediction entry is locked
- awaiting admin judgment

### Settled
- winners have been judged
- payout / rollover is final
- topic is part of history

---

## Workflow summary by role

## League admin workflow
1. Create league
2. Create first topic
3. Let players join
4. Open topic for predictions
5. Wait until close time
6. Judge the result
7. Select winner(s)
8. Confirm payout or rollover
9. Open/manage the next topic
10. Repeat

## Player workflow
1. Sign in
2. Join league
3. View active topic
4. Submit prediction
5. Edit prediction before close if needed
6. Wait for topic to close
7. Review judged result
8. See win/loss + payout/rollover
9. Participate in next topic
10. Repeat

---

## Product principles implied by this workflow
- leagues are long-lived; topics are rounds within them
- admins run the league; players participate in it
- players control only their own predictions
- admins control topic management and winner judgment
- every topic should have a clear lifecycle
- settlement should be auditable and understandable
- the next topic should naturally follow from the previous one

---

## Open questions for later
- should there be multiple open topics at once, or exactly one?
- should players see other players’ predictions before close?
- should joining a league be open, invite-only, or admin-approved?
- should league admins be able to edit a topic after predictions exist?
- should settlement require a confirmation step before becoming final?
