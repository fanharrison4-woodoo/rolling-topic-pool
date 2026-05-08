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

Please do this when ready:

1. Create a new Supabase project
2. Save these values:
   - project URL
   - anon public key
   - service role key (keep private)
3. Decide auth method for MVP:
   - magic link email (recommended)
   - Google login
4. Share the project URL + anon key with me when you want me to wire the app

Optional but useful:
- create a dedicated organization/project name for PoolChain

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
- preparing Supabase schema files
- adding placeholder auth flow
- creating the public GitHub repo and pushing the current code

## 6. What I need from you before backend wiring is finished

I need:
- your approval of the repo/app naming if you want changes
- Vercel project access on your side
- Supabase project credentials
