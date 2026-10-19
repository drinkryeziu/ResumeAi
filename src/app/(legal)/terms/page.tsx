import { Contact, LegalPage, List, P, Section } from "@/components/features/legal/LegalPage";

export const metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="October 19, 2026"
      intro="These terms are the agreement between you and the operator of ResumeAi. By creating an account or using the service you agree to them. If you do not agree, please do not use it."
    >
      <Section title="What ResumeAi does">
        <P>
          ResumeAi turns the information you give us into a resume and cover letter written for a specific job. You review, edit and download the result and apply yourself.
          ResumeAi never applies to jobs for you and never sends your documents to anyone.
        </P>
      </Section>
      <Section title="Your account">
        <List
          items={[
            "Give accurate information and keep your password to yourself. You are responsible for what happens under your account.",
            "One person per account. Do not create accounts in bulk or by automated means to collect free credits.",
            "You must be at least 16.",
          ]}
        />
      </Section>
      <Section title="Your content and what you promise">
        <P>
          You own the information and documents you put in or create. You give us permission to store and process them, and to send the relevant parts to our providers, only so the
          service can work for you (see the Privacy policy). Only add information you have the right to use, and do not add other people’s personal data without their permission.
        </P>
        <P>
          The documents are written only from the facts in your profile. You are responsible for checking them before you use them. Do not apply with anything that is untrue about
          you.
        </P>
      </Section>
      <Section title="Scores and results">
        <P>
          The Job Match Score and ATS Compatibility Score are estimates calculated from your profile and the job text. They do not predict what any employer or hiring system will
          decide, and we cannot promise interviews or offers.
        </P>
      </Section>
      <Section title="Credits">
        <P>
          AI actions use credits. The price is shown before you click, and an action that fails is refunded automatically. Credits have no cash value and cannot be transferred. We
          may change prices and free credit amounts for the future.
        </P>
      </Section>
      <Section title="Acceptable use">
        <List
          items={[
            "Do not try to break, overload or probe the service, or get around limits and credits.",
            "Do not use it to produce misleading, unlawful or abusive material.",
            "Do not copy or resell the service.",
          ]}
        />
        <P>We may limit or suspend accounts that break these rules.</P>
      </Section>
      <Section title="Availability and changes">
        <P>
          We work to keep ResumeAi running but cannot promise it will always be available or error free. Features, prices and these terms may change; if they change in a way that
          matters, we will update the date above.
        </P>
      </Section>
      <Section title="Ending your account">
        <P>You can delete your account at any time in Settings. We may close accounts that break these terms.</P>
      </Section>
      <Section title="Liability">
        <P>
          The service is provided “as is”. To the extent the law allows, the operator is not liable for indirect or consequential loss, including lost opportunities, arising from
          use of the service. Nothing in these terms limits rights that cannot be limited by law.
        </P>
      </Section>
      <Section title="Contact">
        <Contact />
      </Section>
    </LegalPage>
  );
}
