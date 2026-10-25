import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { BrandText } from "@/components/ui/Brand";
import { LegalLinks } from "./LegalLinks";

/** Frame for the Privacy policy and Terms: public header, a readable column, the same two links at the bottom. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: string; children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl px-ds-4 py-ds-6">
        <h1 className="text-heading-section">{title}</h1>
        <p className="text-caption mt-ds-1">Last updated {updated}</p>
        <p className="text-body mt-ds-4">
          <BrandText>{intro}</BrandText>
        </p>
        <div className="mt-ds-5 flex flex-col gap-ds-5">{children}</div>
        <p className="text-body-sm mt-ds-6">
          <LegalLinks />
        </p>
      </main>
    </>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-ds-2">
      <h2 className="text-card-title">
        <BrandText>{title}</BrandText>
      </h2>
      {children}
    </section>
  );
}

export const P = ({ children }: { children: ReactNode }) => (
  <p className="text-body">
    <BrandText>{children}</BrandText>
  </p>
);
export const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="flex list-disc flex-col gap-ds-1 pl-5 text-body">
    {items.map((it, i) => (
      <li key={i}>
        <BrandText>{it}</BrandText>
      </li>
    ))}
  </ul>
);

/** Where people can write to the operator. Set CONTACT_EMAIL; without it the pages say to use the site's own contact details. */
export function Contact() {
  const email = process.env.CONTACT_EMAIL?.trim();
  return email ? (
    <P>
      Write to{" "}
      <a href={`mailto:${email}`} className="text-blue-700 underline">
        {email}
      </a>
      .
    </P>
  ) : (
    <P>Contact the person or company that runs this site, using the contact details given where you found it.</P>
  );
}
