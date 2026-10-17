import { redirect } from "next/navigation";
import { Download, FileCheck2, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ResumeShowcase } from "@/components/features/marketing/ResumeShowcase";
import { ButtonLink } from "@/components/ui/Button";
import { FeatureItem } from "@/components/ui/FeatureItem";
import { auth } from "@/server/auth/config";
import { DEFAULT_PLANS } from "@/server/billing/catalog";

export const metadata = { title: "ResumeAi — Tailor your resume to every job" };

/** A genuine sequence, so the steps are numbered. */
const STEPS = [
  { title: "Create your profile once", body: "Type it in or upload your CV. We turn it into your Master Resume and Cover Letter." },
  { title: "Add a job", body: "Paste the job description or upload it as a file." },
  { title: "See how you match", body: "A Job Match Score with your matching skills, missing keywords and gaps." },
  { title: "Download and apply", body: "A resume and cover letter tailored to that job, as PDF or Word." },
];

export default async function LandingPage() {
  if ((await auth())?.user?.id) redirect("/dashboard");
  const money = (c: number) => (c === 0 ? "Free" : `$${(c / 100).toFixed(2)}`);

  return (
    <>
      <PublicHeader />
      <main>
        <section className="overflow-hidden bg-navy-900 px-ds-4 pt-ds-6 pb-[104px] md:px-ds-5">
          <div className="mx-auto grid max-w-[1120px] items-center gap-ds-6 lg:grid-cols-[1fr_440px]">
            <div className="flex flex-col gap-ds-4">
              <h1 className="text-display-hero max-w-[19ch] text-white text-balance md:text-[48px] md:leading-[54px] md:tracking-[-1.1px]">
                Create your profile once. Tailor your application for every job.
              </h1>
              <p className="text-hero-subtitle max-w-[52ch] font-normal text-white/85">
                Paste any job description. ResumeAi shows how well you match, then writes a resume and cover letter for that job using only what&apos;s true about you.
              </p>
              <div className="mt-ds-2 flex flex-wrap items-center gap-ds-5">
                <ButtonLink href="/sign-up" className="px-9 py-4">
                  Get started free
                </ButtonLink>
                <a href="/sign-in" className="text-body-sm text-white underline">
                  I already have an account
                </a>
              </div>
              <p className="text-caption text-white/70">{DEFAULT_PLANS[0].signupCredits} free credits — enough for your first tailored application.</p>
            </div>
            <ResumeShowcase />
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-[1120px] scroll-mt-[60px] px-ds-4 py-ds-6 md:px-ds-5">
          <h2 className="text-heading-section mb-ds-5">How it works</h2>
          <ol className="grid gap-ds-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-ds-2 border-t-2 border-blue-600 pt-ds-3">
                <span className="text-[32px] leading-none font-bold text-blue-600">{i + 1}</span>
                <h3 className="text-heading-feature">{s.title}</h3>
                <p className="text-body-sm">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-sky-50 px-ds-4 py-ds-6 md:px-ds-5">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="text-heading-section mb-ds-2">Nothing on your resume that isn&apos;t true</h2>
            <p className="text-body mb-ds-5 max-w-[60ch]">ResumeAi rewords and reorders what you&apos;ve done to fit each job. It never adds experience, skills, schools or results you didn&apos;t give it.</p>
            <div className="grid gap-ds-5 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureItem icon={<ShieldCheck size={36} strokeWidth={1.6} />} title="Your profile is the source">
                Every line in a tailored resume traces back to something in your profile.
              </FeatureItem>
              <FeatureItem icon={<MessageCircleQuestion size={36} strokeWidth={1.6} />} title="It asks instead of guessing">
                If a job wants something we can&apos;t find, we ask whether you have it.
              </FeatureItem>
              <FeatureItem icon={<FileCheck2 size={36} strokeWidth={1.6} />} title="Built to get read">
                Single-column, ATS-friendly PDF and Word files that tracking systems can parse.
              </FeatureItem>
              <FeatureItem icon={<Download size={36} strokeWidth={1.6} />} title="You stay in control">
                Edit anything before you download. You apply yourself — we never submit for you.
              </FeatureItem>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-[1120px] scroll-mt-[60px] px-ds-4 py-ds-6 md:px-ds-5">
          <h2 className="text-heading-section mb-ds-2">Pricing</h2>
          <p className="text-body mb-ds-5">AI actions use credits. A full tailored application uses about 35.</p>
          <ul className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEFAULT_PLANS.map((p) => (
              <li key={p.key} className={`flex flex-col gap-ds-2 rounded-md p-ds-4 ${p.key === "PRO" ? "bg-white shadow-[inset_0_0_0_2px_var(--blue-600)]" : "bg-white shadow-card"}`}>
                <span className="flex items-center justify-between">
                  <span className="text-card-title">{p.name}</span>
                  {p.key === "PRO" && <span className="rounded-pill bg-blue-600 px-ds-2 py-0.5 text-micro font-bold text-white">Most popular</span>}
                </span>
                <span className="text-heading-section">
                  {money(p.priceCents)}
                  {p.interval === "MONTH" && <span className="text-body-sm font-normal">/month</span>}
                </span>
                <span className="text-body-sm">{p.monthlyCredits ? `${p.monthlyCredits} credits a month` : `${p.signupCredits} credits to try it`}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="px-ds-4 pb-ds-6 text-center">
          <h2 className="text-heading-section mb-ds-4">Your next application starts with your profile</h2>
          <ButtonLink href="/sign-up">Create your resume</ButtonLink>
        </section>
      </main>
      <footer className="border-t border-gray-100 px-ds-4 py-ds-5 text-center text-caption">© {new Date().getFullYear()} ResumeAi</footer>
    </>
  );
}
