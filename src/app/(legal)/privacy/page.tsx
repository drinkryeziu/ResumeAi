import { Contact, LegalPage, List, P, Section } from "@/components/features/legal/LegalPage";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="October 19, 2026"
      intro="ResumeAi helps you write a resume and cover letter for each job. To do that we handle personal information about you and your work history. This page says what we keep, why, who helps us, and how you stay in control."
    >
      <Section title="What we collect">
        <List
          items={[
            "Your account: name, email address and a password (stored only as a one-way hash, so we cannot read it). If you sign in with Google or LinkedIn we receive your name and email from them.",
            "Your profile: the jobs, education, skills, achievements and contact details you type in or import from a CV, plus the CV text we read from files or text you give us.",
            "Application answers (optional): if you choose to fill in the application questions on your profile, such as work authorization, salary expectation, and voluntary equal-opportunity answers (gender, race or ethnicity, veteran and disability status), we store them with your profile so you can copy them into forms. They are never put in your resume or cover letter and are never sent to the AI. You can leave any of them blank, choose “Prefer not to say”, or clear them at any time.",
            "Jobs you add: the job description, the link and the details you enter.",
            "What we create for you: match reports, resumes and cover letters, and every saved version of them.",
            "Usage records: your credit balance and history, and a log of AI actions (which action, when, how long, and its cost) so credits can be charged and refunded correctly.",
            "Technical data: a session cookie that keeps you signed in, and your network address for a short time to stop abuse (see below).",
          ]}
        />
      </Section>
      <Section title="Why we use it">
        <P>
          Only to run the service: to sign you in, to read your CV, to compare your profile with a job, to write and let you download your documents, to keep your credit balance
          right, to send password reset emails, and to protect the site from abuse. We do not sell your information and we do not show ads. We do not use your content to train AI
          models.
        </P>
      </Section>
      <Section title="Who helps us run it">
        <P>We use these providers. Each gets only what it needs for its job:</P>
        <List
          items={[
            "Hosting: Vercel, which serves the website.",
            "Database: MongoDB Atlas, which stores your account, profile, documents and records.",
            "AI writing: Anthropic. When you read a CV, analyze a job or create a document, the relevant parts of your profile and the job description are sent to Anthropic to produce the result.",
            "Job suggestions: SerpApi, which looks up openings on Google Jobs. When your Master documents are created we send it your job title and your city and state (and nothing else, no name, email or documents) to find openings, and we keep the five we show you so we don't search again for a week.",
            "Email: Resend, which delivers password reset emails (it receives your email address and the message).",
          ]}
        />
        <P>These providers may process data in other countries. They have their own terms and privacy policies.</P>
      </Section>
      <Section title="Cookies">
        <P>We use one essential cookie that keeps you signed in. We do not use advertising or tracking cookies.</P>
      </Section>
      <Section title="Protecting the site">
        <P>
          To stop password guessing, mass sign-ups and runaway use, we count requests from the same network address and the same email. These counters store only a scrambled
          (hashed) value and disappear on their own within an hour or less. We also keep a short log of security events (a wrong password, a request turned away
          because of too many tries) with the kind of event and the time, and nothing that identifies you. It is deleted after 30 days.
        </P>
        <P>
          When something goes wrong for you, for example a CV that can&apos;t be read or a page that crashes, we keep a note of what failed, where, when and which account it
          was, so we can fix it. The note never includes the content of your profile, CV or documents. It is part of &quot;Download my data&quot;, and it is deleted after 30 days or
          when you delete your account.
        </P>
        <P>
          To run the service, the site owner, and people the owner allows, can open an admin page. It shows each account&apos;s name and email, how many applications
          they created and ticked as applied, their average Job Match Score and when they were last active, together with system health. It does not show the
          content of your profile, resumes or cover letters.
        </P>
      </Section>
      <Section title="How long we keep it">
        <P>
          Until you delete your account. In Settings, “Download my data” gives you a copy and “Delete my account” removes your account, profile, documents, jobs, credit history and
          usage records from our database right away. Copies held by our providers, where they exist, expire on their own schedule. Password reset links work once and expire after
          an hour.
        </P>
      </Section>
      <Section title="Your choices and rights">
        <List
          items={[
            "See and change your information in your profile.",
            "Get a copy of your data in Settings, as a file you can keep.",
            "Delete your account and data in Settings.",
            "Ask us a question or raise a concern with the contact below. You may also complain to your local data protection authority.",
          ]}
        />
      </Section>
      <Section title="Security">
        <P>
          Connections to the site use HTTPS, passwords are stored as hashes, and every record is tied to your account so other users cannot read it. No system is perfectly secure,
          so please choose a strong, unique password.
        </P>
      </Section>
      <Section title="Children">
        <P>ResumeAi is not meant for anyone under 16, and we do not knowingly collect their information.</P>
      </Section>
      <Section title="Changes and contact">
        <P>If this policy changes in a way that matters, we will update the date above and, where we can, tell you.</P>
        <Contact />
      </Section>
    </LegalPage>
  );
}
