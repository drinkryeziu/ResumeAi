# ApplyAI — Resume & Cover Letter Optimizer

Create your professional profile once, then tailor your resume and cover letter to every job.
Built on the **ApplyAiJobBoard design system** (tokens in `src/styles/tokens.css`).

The app follows the product flow end to end:

**Landing page → Sign up / sign in → Create professional profile → AI creates Master Resume + Master Cover Letter →
Dashboard → Tailor resume to a job (upload or paste) → Analyze Job → Job Match Score → Create Application →
Review & edit → Download PDF / Word / both → user applies manually.**

It runs on an in-memory demo store, so no database or API keys are needed to try it.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # 25 tests: credits, fabrication guard, full flow, accounts, profile, uploads
```

Create an account, or sign in with the demo account shown on the sign-in page
(`demo@applyai.dev` / `applyai-demo`). On "Tailor resume to a job", **Try a sample job** fills in a posting.

### Sign-in
Email + password works out of the box (scrypt-hashed). Google and LinkedIn buttons appear automatically when
`AUTH_GOOGLE_ID/SECRET` and `AUTH_LINKEDIN_ID/SECRET` are set. Set `AUTH_SECRET` in production.

### Using a real model
Add `ANTHROPIC_API_KEY` (and/or `OPENAI_API_KEY`) to `.env.local`. Each workflow's model is set in
`src/server/ai/routing.ts`. With no key, every workflow falls back to a deterministic mock provider.

### Database (next step)
`prisma/schema.prisma` defines the full model. Until `PrismaAppStore` is added, accounts and documents
live in memory and reset when the server restarts.

```bash
cp .env.example .env.local      # set DATABASE_URL
npm run db:generate && npm run db:migrate && npm run db:seed
```

## How it's organized

```
src/app/            routes only (pages compose components, actions stay thin)
src/components/     ui/ (design-system kit) · layout/ · features/
src/server/
  ai/               Career AI Agent: providers/, workflows/, guard/, runner, scoring, routing, pricing
  credits/          ledger service + memory and Prisma stores
  documents/        ResumeDocument model, templates/classic (PDF + DOCX), export
  services/         job-pipeline — the business logic for each step
  store/            AppStore interface + in-memory implementation
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
