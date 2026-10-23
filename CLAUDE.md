# ResumeAi — project guide for Claude Code

Resume & cover-letter tailoring web app. Users create a professional profile once (typed or imported from a CV),
get a Master Resume + Master Cover Letter, then for each job: paste/upload the description → Analyze Job (Job Match
Score) → Create Application (tailored resume + cover letter) → review/edit → download PDF/Word/ZIP → apply manually.
The app never applies to jobs automatically.

## Commands
- `npm run dev` — http://localhost:3000. There is no built-in account: create one on the sign-up page (the in-memory store is empty after every restart).
- `npm test` — Vitest (~100 tests). Run before every commit. The MongoDB tests start a throwaway local MongoDB (`mongodb-memory-server`); the first run downloads its binary.
- `npx tsc --noEmit` — typecheck. `npm run build` — production build.
- No API key needed: every AI workflow falls back to a deterministic mock provider. Set `ANTHROPIC_API_KEY` in `.env.local` for real output.
- Data: with no `MONGODB_URI` the app uses an in-memory store (`src/server/store/memory.ts`, resets on restart). With `MONGODB_URI` it uses MongoDB (`src/server/store/mongo.ts`, `src/server/credits/mongo-store.ts`). Both implement `AppStore` and must pass `tests/store-contract.ts`. The Prisma/PostgreSQL schema is unused. To deploy, see the README "Deploy" section.

## Stack
Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, Zod v4 (`zod/v4`), Auth.js v5 (credentials + Google/LinkedIn when keys set),
MongoDB (`mongodb` driver), @react-pdf/renderer + docx + jszip for exports, unpdf + mammoth for reading uploads.

## Where things are
- `src/app/` — routes only. Pages compose components; server actions (`actions.ts`) stay thin and call services.
- `src/components/ui/` — design-system kit (Button, Card, Field, Badge, ScoreRing, ScoreBar…). `features/` — feature components. The /profile page's sections are `ProfileSection`s (`features/profile/CollapsibleSections.tsx`): the first starts open, the rest closed, with Expand all / Collapse all above.
- `src/server/ai/` — Career AI Agent: `workflows/` (one file per capability), `runner.ts` (credits → model → validate → guard → settle),
  `guard/fabrication-guard.ts`, `scoring.ts`, `routing.ts` (model per workflow), `providers/` (anthropic, openai, mock).
- `src/server/services/job-pipeline.ts` — business logic for every step. `src/server/store/` — `AppStore` interface + memory and MongoDB impls (`getStore()` picks by env).
- `src/server/documents/` — `ResumeDocument` model, `templates/classic/` (pdf.tsx, docx.ts), `export.tsx`, `extract-text.ts`.
- `src/server/credits/` — append-only ledger. Prices live in data (`billing/catalog.ts` seeds), never hard-coded in logic.
  Running out of credits is a pause, not an error: multi-step tasks check the whole remaining cost first (`ensureCredits`), skip steps already done (so a resumed task never pays twice), and the page shows the credit-limit window (`CreditLimitDialog`) with what is really saved, read back from the store (`describeCreditStop`); if that read fails the window warns instead of claiming anything.
- Admin dashboard (`/admin`, `src/app/(app)/admin/`): owner = the account with `ADMIN_OWNER_EMAIL` (default the site owner's address, `src/server/admin/access.ts`); the owner can add existing accounts as read-only viewers. `requireAdmin` / `requireOwner` (`server/auth/admin.ts`) answer anyone else with not-found, and the header link only shows for admins. The owner can delete a person's account from the people table (`removeUserAsOwner`: typed email, never the owner's own, logs an `account_removed` event). It is the only code that reads across users (`store.adminSnapshot`, `aiRunStats`, `securitySummary`); every number is computed in `server/admin/overview.ts` and tested. Security events (`recordSecurityEvent`) hold no personal data and expire after 30 days. `/privacy` describes it. The error log (`admin/errors.ts`, `recordError`; shown on the dashboard) holds only what failed, where and who: messages are cleaned and never contain CV, profile or document text. It is in the data export and removed on account deletion; add `recordError` when a new action can fail for a person. The owner-only Money report (`admin/money.ts`, `MoneyReport`): of each purchase 20% is the owner's and 80% pays for running the app (AI measured from real runs, plus the fixed monthly costs the owner enters). **Checkout must call `store.recordPurchase` for every payment** (what was bought, price, credits; never who), or it will not appear there.
- Job suggestions (`server/jobs/search.ts`, `suggest.ts`, `JobSuggestions.tsx`, shown on `/onboarding/done`): up to 5 real openings from Google Jobs via SerpApi (`SERPAPI_API_KEY`; there is no official Google job API), searched from the profile's job title and city only, kept per person for a week, never written or reworded by us (a result without title, company or https link is dropped). Off without the key. Errors go to the admin error log.
- The first page's tour (`components/features/marketing/TourVideo.tsx`, scenes in `TourScenes.tsx`) plays a conversation written in `src/lib/walkthrough.ts`. When a step of the app changes, change that script too (a test checks it stays plain and promises only what the product does).
- Promotions: `src/server/billing/promotions.ts` lists credit gifts (e.g. `launch-150`, 150 credits once per user, applied when a signed-in user loads the app). To stop one, set `active: false` and push; a new promotion needs a new `id`.
- `src/server/domain/` — profile types, Zod schema, form ↔ profile mapping, CV-import merge. `application-answers.ts` defines the optional, private application questions (work authorization, visa, relocation, pronouns, gender, race, veteran, disability…): they are stored with the profile, shown on `/profile` and in the setup/edit steps, exported with the account, and must never reach a document, evidence or an AI prompt (tests enforce it). `fact-answers.ts` covers "Your answers" (answers given to job-match questions): editable in the profile editor (Yes/No and the person's own sentence; the topic never changes) through `store.updateApprovedFacts`, which only touches the rows shown, so answers added meanwhile survive.

## Non-negotiable product rules
1. **AI never invents candidate facts.** No new employers, titles, schools, certifications, tools, languages, dates, achievements or numbers.
   Facts are copied from the profile in code (`assembleResume`); AI only rewords. Every AI output cites evidence ids and passes the
   fabrication guard. Missing info → ask the user (gap questions), never guess. Keep or extend tests in `tests/fabrication-guard.test.ts`.
   Two things the AI may add beyond the profile's own words, both guarded: **inferred competencies** (`inferredSkills`: each cites the responsibility, achievement or project that shows it; never tools, languages, certifications or degrees; invalid ones are dropped by `sanitize`, see `badInferredSkills`) the resume's **Core competencies** section (a skill the candidate listed, an inferred one with evidence, or a supported job term; `unsupportedCompetencies`; technical skills stay profile-only) and a plain **title equivalent** after a vague official title (`badTitleEquivalents`; the official title is always kept and no management/executive level can be claimed). Job keywords with no evidence (`keywordStrategy.unsupported`) may never appear in a resume.
   Experience is arithmetic on the profile's dates (`src/server/ai/experience.ts`, overlapping roles counted once, start and end months both counted). The model only judges which roles are the same profession / industry / show a skill; code adds up the years, decides years requirements (profession, industry, profession+industry = intersection, skill, leadership), and labels them. The candidate is never asked about years, and the guard rejects any "N years" claim longer than the history.
2. **The Master Profile and Master documents are read-only to job steps.** Each job gets its own versions.
3. **Versions are immutable.** Edits and restores create a new version; nothing is overwritten.
4. **Every paid AI action goes through `runWorkflow`** so credits are reserved, refunded on failure, and the run is logged.
5. **Scores and fit are computed in code**, not generated by the model: each requirement gets one of six evidence labels (strong, match, partial, weak, none, unknown); the overall fit (Excellent … Insufficient evidence) is derived by `src/server/ai/fit.ts` and mandatory requirements are never hidden by preferred ones. Call it "ATS Compatibility Score" / "Job Match Score", never a prediction of an employer's system.
6. **Every data access is owner-scoped** (`requireUser` / `requireProfile`, store methods take `userId`).

## Design system: ApplyAiJobBoard (tokens in `src/styles/tokens.css`, mapped to Tailwind in `src/app/globals.css`)
- Ink `navy-900` on white; `blue-600` is the ONLY action color (hover `blue-700`); `sky-50` is the only surface tint;
  `sand-300` is one warm accent per page at most, never text or buttons; `gray-100` for input wells.
- Buttons are pills, uppercase `text-button`. **One primary button per view**; second action = secondary (outline) or link.
- Cards `rounded-md` + `shadow-card`, no hard borders. Use named type utilities (`text-heading-section`, `text-body`, `text-body-sm`, `text-label-bold`, `text-caption`…), not raw px.
- Header: text links only, no filled button in the bar. Nav = Dashboard, Documents, Professional profile (jobs and applications open from the Dashboard; every resume and cover letter, master or per application, is listed under Documents with Edit, Download and Delete); credits/settings in the account menu; "Sign out" is a text link at the right of the bar (inside the Menu on mobile). While first-time setup is unfinished the header is just the wordmark and Sign out.
- Plain language in the UI: "Optimize resume", "5 credits" — never "LLM", "tokens", "agent".
- Sentence case everywhere except button labels. No emoji. Line icons from `lucide-react`.
- Quality floor: responsive to 375px, visible focus, labels on every input, AA contrast.

## Accounts, abuse and privacy
- Sign-in, sign-up, password reset and AI actions are rate limited (`src/server/security/rate-limit.ts`, counters in the store, hashed keys). Don't add an AI-calling action without `overLimit`.
- Production never serves the sample writer: no `ANTHROPIC_API_KEY` means AI actions refuse with `AINotConfiguredError` (credits refunded). `AI_ALLOW_MOCK=true` is only for previews.
- Settings has "Download my data" (`/api/account/export`) and "Delete my account". A new collection or table that holds user data must be added to `exportAccountData` and to both stores' `deleteAccount` (the contract test checks deletion).
- `/privacy` and `/terms` describe what the app really does; update them when data handling or providers change.

## Working conventions
- Small, reviewable commits. Typecheck + tests + build before committing.
- For UI work, run the app and look at the page (desktop and 375px) before calling it done.
- Don't add dependencies without saying why. Don't weaken the fabrication guard to make a test pass.

## Roadmap (next)
1. UI: rename/duplicate applications and documents (the Documents tab lists them; renaming and duplicating are not built). Job Match screen and profile-editor section progress are done.
2. File storage for uploads (only extracted text is used today); decide whether to remove the unused Prisma schema.
3. Stripe plans + credit packs (webhook → ledger GRANT/PURCHASE), admin pricing page.
4. Rate limits, prompt-evaluation set with real job descriptions, more resume templates.
