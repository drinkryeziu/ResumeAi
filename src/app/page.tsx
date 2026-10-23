import { redirect } from "next/navigation";
import { ArrowRight, Download, FileCheck2, FilePlus2, Gauge, MessageCircleQuestion, PlayCircle, ShieldCheck, UserRound } from "lucide-react";
import { LegalLinks } from "@/components/features/legal/LegalLinks";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ResumeShowcase } from "@/components/features/marketing/ResumeShowcase";
import { TourVideo } from "@/components/features/marketing/TourVideo";
import { ButtonLink } from "@/components/ui/Button";
import { signedInUserId } from "@/server/auth/session";
import { DEFAULT_PLANS } from "@/server/billing/catalog";

export const metadata = { title: "ResumeAi — Tailor your resume to every job" };

/** A genuine sequence, so the steps are numbered. */
const STEPS = [
  { title: "Create your profile once", body: "Type it in or upload your CV. We turn it into your Master Resume and Cover Letter, and show which kinds of jobs your experience fits.", icon: UserRound, card: "bg-[#efe9ff]", dot: "bg-[#6d4aff]", ink: "text-[#6d4aff]" },
  { title: "Add a job", body: "Paste the job description or upload it as a file.", icon: FilePlus2, card: "bg-[#ffe6f3]", dot: "bg-[#d6338f]", ink: "text-[#b3216f]" },
  { title: "See how you match", body: "A Job Match Score with your matching skills, missing keywords and gaps.", icon: Gauge, card: "bg-[#ffebd9]", dot: "bg-[#c75a12]", ink: "text-[#a04a0b]" },
  { title: "Download and apply", body: "A resume and cover letter tailored to that job, as PDF or Word.", icon: Download, card: "bg-[#d9f6f1]", dot: "bg-[#0e8f7e]", ink: "text-[#0b6b5e]" },
];

/** The four promises of "Nothing on your resume that isn't true"; the first and last cards are wide. */
const PROMISES = [
  { title: "Your profile is the source", body: "Every line in a tailored resume traces back to something in your profile.", icon: ShieldCheck, tint: "from-[#7c5cff] to-[#d6338f]", wide: true },
  { title: "It asks instead of guessing", body: "If a job wants something we can't find, we ask whether you have it.", icon: MessageCircleQuestion, tint: "from-[#d6338f] to-[#e8590c]", wide: false },
  { title: "Built to get read", body: "Single-column, ATS-friendly PDF and Word files that tracking systems can parse.", icon: FileCheck2, tint: "from-[#0e8f7e] to-[#3b82f6]", wide: false },
  { title: "You stay in control", body: "Edit anything before you download. You apply yourself — we never submit for you.", icon: Download, tint: "from-[#e8590c] to-[#c99a00]", wide: true },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ "account-deleted"?: string }> }) {
  if (await signedInUserId()) redirect("/dashboard");
  const money = (c: number) => (c === 0 ? "Free" : `$${(c / 100).toFixed(2)}`);

  return (
    <div className="aurora overflow-x-clip">
      <PublicHeader aurora />
      {(await searchParams)["account-deleted"] === "1" && (
        <p role="status" className="bg-sky-50 px-ds-4 py-ds-3 text-center text-body-sm">
          Your account and all your data were deleted.
        </p>
      )}
      <main>
        <section className="relative overflow-hidden px-ds-4 pt-[72px] pb-[150px] md:px-ds-5">
          <div aria-hidden="true" className="au-blob -top-[200px] -right-[160px] size-[640px] bg-[radial-gradient(circle,rgba(109,74,255,0.28),rgba(109,74,255,0)_68%)]" />
          <div aria-hidden="true" className="au-blob -bottom-[60px] -left-[200px] size-[560px] bg-[radial-gradient(circle,rgba(255,138,61,0.32),rgba(255,138,61,0)_68%)]" />
          <div aria-hidden="true" className="au-blob right-[20%] -bottom-[220px] size-[480px] bg-[radial-gradient(circle,rgba(242,63,166,0.22),rgba(242,63,166,0)_68%)]" />
          <div className="relative mx-auto grid max-w-[1120px] items-center gap-[52px] lg:grid-cols-[1fr_440px]">
            <div className="flex flex-col gap-ds-4">
              <h1 className="text-[clamp(38px,5.4vw,64px)] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance">
                Create your profile <span className="au-grad-text">once.</span> Tailor your application for <span className="au-grad-text">every job.</span>
              </h1>
              <p className="max-w-[52ch] text-[20px] leading-[1.55] text-[#3c3566]">
                Paste any job description. ResumeAi shows how well you match, then writes a resume and cover letter for that job using only what&apos;s true about you.
              </p>
              <div className="mt-ds-2 flex flex-wrap items-center gap-x-[22px] gap-y-ds-3">
                <ButtonLink href="/sign-up" className="au-grad px-9 py-4 shadow-[0_14px_30px_-10px_rgba(109,74,255,0.65)] hover:brightness-110" icon={<ArrowRight size={18} aria-hidden="true" />}>
                  Get started free
                </ButtonLink>
                <a href="/sign-in" className="text-label-bold underline underline-offset-4">
                  I already have an account
                </a>
                <a href="#tour" className="inline-flex items-center gap-2 rounded-pill border-[1.5px] border-[#d9cff7] bg-white px-5 py-3 text-label-bold no-underline">
                  <PlayCircle size={20} className="text-blue-600" aria-hidden="true" /> Watch how it works
                </a>
              </div>
              <p className="inline-flex items-center gap-2.5 self-start rounded-pill bg-white px-[18px] py-2.5 text-body-sm font-medium shadow-[0_8px_24px_-12px_rgba(60,30,160,0.35)]">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-[#19c3b0]" />
                {DEFAULT_PLANS[0].signupCredits} free credits — enough for your first tailored application.
              </p>
            </div>
            <ResumeShowcase />
          </div>
        </section>

        {/* The tour sits across the bottom edge of the hero, right under the headline and the buttons. */}
        <div id="tour" className="relative z-10 mx-auto -mt-[100px] max-w-[1120px] scroll-mt-[80px] px-ds-4 md:px-ds-5">
          <TourVideo />
        </div>

        <section id="how-it-works" className="mx-auto max-w-[1120px] scroll-mt-[80px] px-ds-4 pt-[104px] pb-[96px] md:px-ds-5">
          <h2 className="mb-11 text-[clamp(30px,4vw,48px)] leading-[1.1] font-extrabold tracking-[-0.03em]">How it works</h2>
          <ol className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`relative flex flex-col gap-2.5 rounded-[28px] p-[30px] ${s.card}`}>
                <s.icon size={30} strokeWidth={1.8} aria-hidden="true" className={`absolute top-7 right-[26px] ${s.ink}`} />
                <span className={`grid size-[58px] place-items-center rounded-full text-[26px] font-extrabold text-white ${s.dot}`}>{i + 1}</span>
                <h3 className="mt-2.5 text-[23px] leading-tight font-extrabold tracking-[-0.01em]">{s.title}</h3>
                <p className="text-[16px] leading-[1.55] text-[#3c3566]">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="relative overflow-hidden bg-navy-900 px-ds-4 py-[96px] text-white md:px-ds-5">
          <div aria-hidden="true" className="au-blob -top-[200px] -right-[180px] size-[560px] bg-[radial-gradient(circle,rgba(242,63,166,0.35),rgba(242,63,166,0)_68%)]" />
          <div aria-hidden="true" className="au-blob -bottom-[240px] -left-[200px] size-[520px] bg-[radial-gradient(circle,rgba(109,74,255,0.5),rgba(109,74,255,0)_68%)]" />
          <div className="relative mx-auto max-w-[1120px]">
            <h2 className="mb-4 max-w-[20ch] text-[clamp(30px,4vw,48px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
              Nothing on your resume that <span className="au-grad-text-light">isn&apos;t true</span>
            </h2>
            <p className="mb-12 max-w-[60ch] text-[19px] leading-[1.6] text-[#dad3f5]">
              ResumeAi rewords and reorders what you&apos;ve done to fit each job. It never adds experience, skills, schools or results you didn&apos;t give it.
            </p>
            <div className="flex flex-col gap-[22px]">
              {[PROMISES.slice(0, 2), PROMISES.slice(2)].map((row) => (
                <ul key={row[0]!.title} className="flex flex-wrap gap-[22px]">
                  {row.map((f) => (
                    <li
                      key={f.title}
                      className={`flex flex-col gap-2.5 rounded-[28px] border border-white/15 bg-white/[0.08] p-ds-4 sm:p-8 ${f.wide ? "flex-[2_1_440px]" : "flex-[1_1_260px]"}`}
                    >
                      <span aria-hidden="true" className={`grid size-[60px] place-items-center rounded-[20px] bg-gradient-to-br text-white ${f.tint}`}>
                        <f.icon size={28} strokeWidth={2} />
                      </span>
                      <h3 className="mt-2.5 text-[24px] leading-tight font-extrabold tracking-[-0.01em]">{f.title}</h3>
                      <p className="max-w-[46ch] text-[17px] leading-[1.55] text-[#dad3f5]">{f.body}</p>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-[1120px] scroll-mt-[80px] px-ds-4 py-[104px] md:px-ds-5">
          <h2 className="mb-3 text-[clamp(30px,4vw,48px)] leading-[1.1] font-extrabold tracking-[-0.03em]">Pricing</h2>
          <p className="mb-12 text-[19px] text-[#3c3566]">AI actions use credits. A full tailored application uses about 35.</p>
          <ul className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
            {DEFAULT_PLANS.map((p) => {
              const pro = p.key === "PRO";
              return (
                <li key={p.key} className={`relative flex flex-col gap-1.5 rounded-[28px] p-[30px] ${pro ? "au-grad text-white shadow-[0_30px_50px_-20px_rgba(109,74,255,0.7)]" : "bg-white shadow-card"}`}>
                  {pro && <span className="absolute -top-3.5 right-[22px] rounded-pill bg-[#ffd66b] px-3.5 py-1.5 text-[13px] font-extrabold text-navy-900">Most popular</span>}
                  <span className={`text-[20px] font-extrabold ${pro ? "" : "text-blue-700"}`}>{p.name}</span>
                  <span className="text-[44px] leading-[1.1] font-extrabold tracking-[-0.03em]">
                    {money(p.priceCents)}
                    {p.interval === "MONTH" && <span className="text-[17px] font-medium tracking-normal">/month</span>}
                  </span>
                  <span className={`text-[16px] ${pro ? "" : "text-[#3c3566]"}`}>{p.monthlyCredits ? `${p.monthlyCredits} credits a month` : `${p.signupCredits} credits to try it`}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-10">
            <ButtonLink href="/pricing" variant="secondary" className="py-3.5">
              See details
            </ButtonLink>
          </div>
        </section>

        <section className="px-ds-4 pb-[96px] md:px-ds-5">
          <div className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[40px] bg-[linear-gradient(120deg,#4a2bd1,#c0287f)] px-ds-4 py-[72px] text-center sm:px-8">
            <div aria-hidden="true" className="au-blob -right-[90px] -bottom-[130px] size-[320px] bg-[radial-gradient(circle,rgba(255,138,61,0.7),rgba(255,138,61,0)_68%)]" />
            <div aria-hidden="true" className="au-blob -top-[100px] -left-[70px] size-[260px] bg-[radial-gradient(circle,rgba(255,255,255,0.25),rgba(255,255,255,0)_68%)]" />
            <div className="relative mx-auto flex max-w-[780px] flex-col items-center gap-[30px]">
              <h2 className="text-[clamp(30px,5vw,54px)] leading-[1.06] font-extrabold tracking-[-0.03em] text-white text-balance">Your next application starts with your profile</h2>
              <a
                href="/sign-up"
                className="inline-flex items-center gap-2.5 rounded-pill bg-white px-9 py-[18px] text-button text-navy-900 no-underline shadow-[0_16px_30px_-12px_rgba(10,5,60,0.6)] hover:brightness-95"
              >
                Create your resume <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col items-center gap-ds-1 bg-navy-900 px-ds-4 py-ds-5 text-center text-caption text-[#dad3f5] [&_a]:text-white">
        <LegalLinks />
        <span>© {new Date().getFullYear()} ResumeAi</span>
      </footer>
    </div>
  );
}
