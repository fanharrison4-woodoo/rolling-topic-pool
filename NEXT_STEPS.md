# Next steps for Harrison

These are the exact steps I still need from you because they are tied to your accounts.

## 1. GitHub

I can create and push the public repository for you from this machine.

What you may still want to decide:
- repo visibility: public (recommended)
- final repo name: currently assumed `rolling-topic-pool`
- whether you want a short project description on GitHub

## 2. Vercel

Please do this when ready:

1. Sign in to Vercel
2. Import the GitHub repo
3. Create a new project
4. Keep framework as Next.js
5. Do not deploy until Supabase env vars are ready, or deploy the mock version first

I can prepare the app for deployment, but I cannot fully complete the account linking step without your Vercel account/session.

## 3. Supabase

You already created the project and shared the public values. Nice.

Please do these exact steps next:

1. Open **Supabase → SQL Editor**
2. Open the file `supabase/schema.sql` from this repo
3. Paste it into SQL Editor and run it
4. Open **Authentication → Providers → Email**
5. Enable **Email** auth
6. Enable **Magic Link** login
7. If Supabase asks about site URL later, use your future Vercel URL first, then your custom domain if you add one

Do **not** send me the service role key.

## 4. Product choices to confirm soon

Please confirm these when convenient:

- final app name: `PoolChain` is the current working name
- final repo name: `rolling-topic-pool`
- auth method: magic link email is my recommendation
- should player predictions be hidden from others before close time?
  - recommendation: yes

## 5. What I can do next without you

I can continue on my own with:

- cleaning up the UI prototype
- adding real route structure
- wiring the app to read/write from Supabase
- adding a first pass magic-link auth flow
- preparing Vercel env setup notes

## 6. What I need from you before backend wiring is finished

I need:
- you to run `supabase/schema.sql` in Supabase SQL Editor
- you to enable Email + Magic Link auth in Supabase
- Vercel project access on your side when we deploy
