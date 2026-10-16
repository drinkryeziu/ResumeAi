import { redirect } from "next/navigation";
import { ClipboardPaste, Download, FileCheck2, ShieldCheck, Target, UserRound } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ButtonLink } from "@/components/ui/Button";
import { FeatureItem } from "@/components/ui/FeatureItem";
import { auth } from "@/server/auth/config";
import { DEFAULT_PLANS } from "@/server/billing/catalog";

export const metadata = { title: "ApplyAI — Tailor your resume to every job" };

const STEPS = [
  { icon: <UserRound size={36} strokeWidth={1.6} />, title: "Create your profile once", body: "Add your experience, skills and education. We turn it into your Master Resume and Cover Letter." },
  { icon: <ClipboardPaste size={36} strokeWidth={1.6} />, title: "Add a job", body: "Paste or upload any job description you want to apply for." },
  { icon: <Target size={36} strokeWidth={1.6} />, title: "See your match", body: "Get a Job Match Score with matching skills, missing keywords and requirements." },
  { icon: <FileCheck2 size={36} strokeWidth={1.6} />, title: "Download and apply", body: "Get a tailored resume and cover letter as PDF or Word, then apply on any site." },
];

export default async function LandingPage() {
  if ((await auth())?.user?.id) redirect("/dashboard");
  const money = (c: number) => (c === 0 ? "Free" : `$${(c / 100).toFixed(2)}`);

  return (
    <>
      <PublicHeader />
      <main>
        {/* Hero: white type on a dark ground, as the design system specifies for hero areas without photography. */}
        <section className="bg-navy-900 px-ds-4 py-ds-6 text-center md:px-ds-5">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-ds-4">
            <h1 className="text-display-hero text-white md:text-[44px] md:leading-[52px]">Create your profile once. Tailor your application for every job.</h1>
            <p className="text-hero-subtitle text-white/90">
              ApplyAI builds your resume and cover letter from your professional profile, compares them with any job description, and creates documents tailored to that job — using only
              what&apos;s true about you.
            </p>
            <div className="mt-ds-2 flex flex-wrap items-center justify-center gap-ds-4">
              <ButtonLink href="/sign-up" className="px-9 py-4">
                Get started
              </ButtonLink>
              <a href="#how-it-works" className="text-body-sm text-white underline">
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-[1120px] px-ds-4 py-ds-6 md:px-ds-5">
          <h2 className="text-heading-section mb-ds-1">How it works</h2>
          <p className="text-body mb-ds-5">Four steps from job post to a ready-to-send application.</p>
          <div className="grid gap-ds-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <FeatureItem key={s.title} icon={s.icon} title={`${i + 1}. ${s.title}`}>
                {s.body}
              </FeatureItem>
            ))}
          </div>
        </section>

        {/* The page's one sand-300 moment (PromoPanel). */}
        <section className="mx-auto grid max-w-[1120px] items-center gap-ds-5 px-ds-4 pb-ds-6 md:grid-cols-[1.2fr_1fr] md:px-ds-5">
          <div className="relative h-72" aria-hidden="true">
            <div className="absolute top-6 -left-4 h-64 w-1/2 rounded-md bg-sand-300" />
            <div className="relative z-10 ml-4 flex h-64 flex-col gap-ds-3 rounded-md bg-white p-ds-5 shadow-card">
              <span className="text-label-bold">Senior UX Designer · Example Co.</span>
              <span className="text-display-hero text-blue-600">87% match</span>
              {[
                ["Skills", 92],
                ["Experience", 85],
                ["Keywords", 78],
              ].map(([l, v]) => (
                <span key={l} className="grid grid-cols-[90px_1fr] items-center gap-ds-3 text-body-sm">
                  {l}
                  <span className="h-2 rounded-pill bg-sky-50">
                    <span className="block h-2 rounded-pill bg-blue-600" style={{ width: `${v}%` }} />
                  </span>
                </span>
              ))}
              <span className="text-caption">Example</span>
            </div>
          </div>
          <div className="flex flex-col gap-ds-3">
            <h2 className="text-heading-section">Honest by design</h2>
            <p className="text-body">
              We never add experience, skills, education or results you haven&apos;t given us. If a job asks for something we can&apos;t find, we ask you — and only use your answer.
            </p>
            <ul className="flex flex-col gap-ds-2 text-body-sm">
              <li className="flex gap-ds-2">
                <ShieldCheck size={20} className="shrink-0 text-blue-600" aria-hidden="true" /> Your Master Resume never changes when you tailor
              </li>
              <li className="flex gap-ds-2">
                <Download size={20} className="shrink-0 text-blue-600" aria-hidden="true" /> ATS-friendly PDF and Word files
              </li>
              <li className="flex gap-ds-2">
                <FileCheck2 size={20} className="shrink-0 text-blue-600" aria-hidden="true" /> You apply yourself — we never submit for you
              </li>
            </ul>
          </div>
        </section>

        <section id="pricing" className="bg-sky-50 px-ds-4 py-ds-6 md:px-ds-5">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="text-heading-section mb-ds-1">Simple pricing</h2>
            <p className="text-body mb-ds-5">AI actions use credits. A full tailored application costs about 35 credits.</p>
            <ul className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
              {DEFAULT_PLANS.map((p) => (
                <li key={p.key} className="flex flex-col gap-ds-2 rounded-md bg-white p-ds-4 shadow-card">
                  <span className="text-card-title">{p.name}</span>
                  <span className="text-heading-section">
                    {money(p.priceCents)}
                    {p.interval === "MONTH" && <span className="text-body-sm">/month</span>}
                  </span>
                  <span className="text-body-sm">{p.monthlyCredits ? `${p.monthlyCredits} credits every month` : `${p.signupCredits} credits to try it`}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-ds-4 py-ds-6 text-center">
          <h2 className="text-heading-section mb-ds-4">Ready to tailor your next application?</h2>
          <ButtonLink href="/sign-up">Create your resume</ButtonLink>
        </section>
      </main>
      <footer className="border-t border-gray-100 px-ds-4 py-ds-5 text-center text-caption">© {new Date().getFullYear()} ApplyAI</footer>
    </>
  );
}
