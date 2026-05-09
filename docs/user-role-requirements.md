# User Role Requirements

## Goal
Define the user/permission model for PoolChain so the app can evolve from the current hard-coded shortcut to a proper data-driven access system later.

## Role model

### 1. App admin
Global role.

Permissions:
- change other users' league roles
- promote/demote users between `league admin` and `player`
- oversee league access across the app

Notes:
- currently hard-coded in app code for speed
- later should be managed from Supabase data instead of code

Current hard-coded app admin emails:
- `fanharrison4@gmail.com`
- `fanhaipeng@gmail.com`

### 2. League admin
League-scoped role.

Permissions:
- create a league
- manage a league
- create topics
- edit topics
- judge/select winners
- operate league workflow

Notes:
- league admin is not necessarily a global app admin
- app admins can assign/remove this role

### 3. Player
League-scoped role.

Permissions:
- join/participate in a league
- submit predictions
- update only their own predictions before close time

Restrictions:
- cannot manage league settings
- cannot create/edit topics
- cannot judge winners
- cannot change other users' roles

## Relationship between roles
- app admin is a global role
- league admin and player are league-scoped roles
- a user may be:
  - app admin + league admin
  - app admin + player
  - league admin only
  - player only
  - signed-in viewer/not yet participating

## Current implementation direction

### Short-term
- keep app admins hard-coded in code
- keep league roles in Supabase via `league_members.role`
- use app admin UI to change league roles

### Later / preferred long-term design
Replace hard-coded app admins with Supabase-managed data.

Possible options:
- add `is_app_admin` to `users_profile`
- or create a dedicated `app_admins` table

Benefits:
- no redeploy needed to add/remove app admins
- role changes become data-driven
- easier auditability

## Product requirements captured from discussion
- signed-in users should be able to participate in a league
- only authorized users can create/edit/manage league and topics
- only authorized users can judge/select winners
- app admins can change other users' roles
- league admins manage league operations
- players only participate and submit predictions

## Open follow-up questions
- should a league have multiple league admins? (current direction: yes)
- should signed-in viewers be able to see league/topic info before joining? (current direction: yes)
- should app admins be able to create leagues directly, or only manage roles? (likely yes)
- should there eventually be invite-only league joining? (possible later)
