# ApplyAI — Resume & Cover Letter Optimizer

Create your professional profile once, then tailor your resume and cover letter to every job.
Built on the **ApplyAiJobBoard design system** (tokens in `src/styles/tokens.css`).

The app follows the product flow end to end:

**Landing page → Sign up / sign in → Create professional profile → AI creates Master Resume + Master Cover Letter →
Dashboard → Tailor resume to a job (upload or paste) → Analyze Job → Job Match Score → Create Application →
Review & edit → Download PDF / Word / both → user applies manually.**

With no configuration it runs on an in-memory demo store, so no database or API keys are needed to try it. Set `MONGODB_URI` and it stores everything in MongoDB instead (see [Deploy](#deploy-vercel--mongodb-atlas)).

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # ~100 tests: credits, fabrication guard, full flow, accounts, profile, uploads, both data stores
```

Create an account, or sign in with the demo account shown on the sign-in page
(`demo@applyai.dev` / `applyai-demo`). On "Tailor resume to a job", **Try a sample job** fills in a posting.

### Sign-in
Email + password works out of the box (scrypt-hashed). Google and LinkedIn buttons appear automatically when
`AUTH_GOOGLE_ID/SECRET` and `AUTH_LINKEDIN_ID/SECRET` are set. Set `AUTH_SECRET` in production.

### Using a real model
Add `ANTHROPIC_API_KEY` (and/or `OPENAI_API_KEY`) to `.env.local`. Each workflow's model is set in
`src/server/ai/routing.ts`. With no key, every workflow falls back to a deterministic mock provider.

### Data storage
| Setting | Store | Data |
| --- | --- | --- |
| nothing set | in-memory demo store, with the demo account | resets when the server restarts |
| `MONGODB_URI` | MongoDB (Atlas) | persists |

Both implement the same `AppStore` interface (`src/server/store/types.ts`), and one shared test suite
(`tests/store-contract.ts`) runs against both. `prisma/schema.prisma` is a PostgreSQL model for a possible later
phase and is **not used** today.

The MongoDB tests start a throwaway local MongoDB with `mongodb-memory-server`. The first run downloads an official
MongoDB server binary (a few hundred MB, cached afterwards); without network they are skipped with a warning
(`MONGODB_TEST_REQUIRED=1` makes that an error). To test against your own server instead, set `MONGODB_TEST_URI`;
each test uses a throwaway database named `applyai_test_<random>` and drops it.

## Deploy (Vercel + MongoDB Atlas)

The in-memory store cannot work on Vercel (every serverless instance would have its own empty memory), so a deployment needs MongoDB.

### 1. MongoDB Atlas
1. Create a free **M0** cluster at <https://www.mongodb.com/atlas>, in a region near your Vercel region.
2. **Database Access** → add a database user with a strong password (read and write to any database).
3. **Network Access** → allow `0.0.0.0/0`. Vercel has no fixed IP addresses. (Or install the *MongoDB Atlas* integration from the Vercel Marketplace, which manages this and sets the connection variable for you.)
4. **Connect → Drivers** → copy the connection string and put the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/applyai?retryWrites=true&w=majority`
   (URL-encode special characters in the password.)

You do not create collections or indexes by hand: on the first request the app creates its indexes and seeds the
credit prices (existing prices are never overwritten). Collections: `users`, `profiles`, `cv_imports`, `jobs`,
`analyses`, `matches`, `ats_reports`, `resumes`, `cover_letters`, `ai_runs`, `credit_ledger`, `credit_balances`, `credit_actions`.
Atlas is always a replica set, which the credit ledger needs (it writes balance and entry in one transaction).

### 2. Vercel
1. <https://vercel.com> → **Add New → Project** → import this repository. It is detected as Next.js.
2. Add **Environment Variables** (Production, and Preview if you use it):

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | yes | the connection string from step 1 |
| `AUTH_SECRET` | yes | production refuses to start without it: `openssl rand -base64 32` |
| `MONGODB_DB` | no | overrides the database name in the URI |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | no | without a key the deterministic mock writer is used |
| `AI_FORCE_MOCK` | no | `true` forces the mock even when keys are set |
| `ALLOW_MEMORY_STORE` | no | `true` lets a Vercel preview run on the temporary in-memory store (data is lost). Leave unset |
| `MONGODB_SEED_DEMO` | no | `true` creates the public demo account (`demo@applyai.dev`). Leave unset in production |
| `AUTH_GOOGLE_ID/SECRET`, `AUTH_LINKEDIN_ID/SECRET` | no | enable social sign-in |

3. **Deploy.** Every push to `main` redeploys.

Never commit credentials: `.env*.local`, `*.env` and `*credentials*` are git-ignored; put secrets in Vercel's settings.

### Good to know
- **Upload size:** Vercel serverless functions accept request bodies of about 4.5 MB, so CV and job-description uploads are limited to 4 MB.
- **AI time limit:** pages and actions are set to a 60 second limit (`maxDuration` in `src/app/(app)/layout.tsx`), downloads to 30 seconds. Raise it there if a real model needs longer (your Vercel plan sets the ceiling).
- **Forgot `MONGODB_URI`?** On Vercel the app refuses to start without it (instead of silently using temporary memory) and shows the reason in the function logs. `ALLOW_MEMORY_STORE=true` overrides this for throwaway previews.
- **Backups:** the free Atlas tier has no automated backups. Take a manual export before anything risky.

## How it's organized

```
src/app/            routes only (pages compose components, actions stay thin)
src/components/     ui/ (design-system kit) · layout/ · features/
src/server/
  ai/               Career AI Agent: providers/, workflows/, guard/, runner, scoring, routing, pricing
  credits/          ledger service + memory, MongoDB and (unused) Prisma stores
  documents/        ResumeDocument model, templates/classic (PDF + DOCX), export
  services/         job-pipeline — the business logic for each step
  store/            AppStore interface + in-memory and MongoDB implementations; db/ holds the MongoDB connection
  queries/          page read-models
  auth/ billing/ demo/
prisma/             schema + seed
tests/
```

## Key decisions

- **The AI never writes facts.** Workflows return reworded text plus *evidence ids*; code copies
  employers, titles, dates, schools and certifications from the profile (`assembleResume`).
- **Fabrication guard in code**, not just prompts (`server/ai/guard`): rejects unknown evidence ids,
  numbers not in the cited evidence, skills not in the profile, achievements borrowed across roles,
  headlines never held, and unknown organizations. One retry with the violations, then refund.
- **Gap questions, not guesses.** Missing requirements become Yes / No / Skip questions. A Yes stores the
  user's own words as an approved fact — the only new information AI may use.
- **Scores are computed, not generated.** The model classifies each requirement; fixed weights turn
  that into Job Match and ATS Compatibility scores, so they're stable and explainable.
- **Credits are a ledger.** Reserve before the call, settle or refund after; prices are rows in
  `CreditAction`, so changing a price is not a deploy. Every model call is an `AIRun` with tokens and USD cost.
- **Provider abstraction.** One `AIProvider` interface; Anthropic, OpenAI and Mock adapters.
- **Versions are immutable.** "Restore" copies an old version forward.

## Credits per action (editable in `CreditAction`)
Analyze Job 10 (analysis 5 + match 5) · Create Application 25 (resume 15 + cover letter 10) ·
ATS check 3 · cover-letter rewrite 3 · Master documents free. New accounts get 60 credits.

## Next
- PrismaAppStore (persistent accounts and documents), file storage for uploads
- Stripe plans and credit packs, admin pricing page
- Rate limits, prompt evaluation set against real job descriptions
- More resume templates
